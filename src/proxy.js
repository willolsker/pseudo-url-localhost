const http = require("http");
const https = require("https");
const httpProxy = require("http-proxy");
const fs = require("fs");
const process = require("process");
const { getAllMappings, CONFIG_FILE } = require("./config");
const {
  loadCertificates,
  ensureCertificates,
  isMkcertInstalled,
  isMkcertCAInstalled,
} = require("./certificates");
const { getProject, getAllProjects } = require("./project-config");
const {
  getProcessInfo,
  startDevServer,
  updateLastAccess,
  startIdleCheck,
  cleanup,
} = require("./process-manager");

// Rate limiting storage
const requestCounts = new Map();

// Config watching variables
let configWatcher = null;
let watchDebounceTimer = null;
let currentDomains = [];

/**
 * Log structured message
 */
function log(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

/**
 * Check rate limit for a hostname
 */
function checkRateLimit(hostname) {
  const now = Date.now();
  const key = hostname;
  const limit = 1000; // requests per minute

  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }

  const record = requestCounts.get(key);
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + 60000;
    return true;
  }

  record.count++;
  if (record.count > limit) {
    log("warn", "Rate limit exceeded", { hostname, count: record.count });
    return false;
  }

  return true;
}

/**
 * Setup config file watching for automatic certificate regeneration
 */
function setupConfigWatcher() {
  if (configWatcher) {
    return; // Already watching
  }

  try {
    // Store current domains
    currentDomains = Object.keys(getAllMappings());

    configWatcher = fs.watch(CONFIG_FILE, (eventType) => {
      if (eventType === "change") {
        // Debounce rapid changes
        if (watchDebounceTimer) {
          clearTimeout(watchDebounceTimer);
        }

        watchDebounceTimer = setTimeout(() => {
          handleConfigChange();
        }, 500);
      }
    });

    log("info", "Config file watcher started", { configFile: CONFIG_FILE });
  } catch (error) {
    log("warn", "Failed to setup config watcher", { error: error.message });
  }
}

/**
 * Handle config file changes
 */
function handleConfigChange() {
  try {
    const newMappings = getAllMappings();
    const newDomains = Object.keys(newMappings);

    // Check if domains have changed
    const domainsChanged =
      newDomains.length !== currentDomains.length ||
      !newDomains.every((d) => currentDomains.includes(d));

    if (domainsChanged) {
      log("info", "Config reloaded - domains changed", {
        oldCount: currentDomains.length,
        newCount: newDomains.length,
        added: newDomains.filter((d) => !currentDomains.includes(d)),
        removed: currentDomains.filter((d) => !newDomains.includes(d)),
      });

      // Update current domains
      currentDomains = newDomains;

      // Regenerate certificates if mkcert is available
      if (
        newDomains.length > 0 &&
        isMkcertInstalled() &&
        isMkcertCAInstalled()
      ) {
        const result = ensureCertificates(newDomains);
        if (result.success) {
          log("info", "SSL certificates regenerated automatically", {
            domains: newDomains,
          });
        } else {
          log("warn", "Failed to regenerate certificates", {
            error: result.message,
          });
        }
      }
    } else {
      log("info", "Config reloaded - no domain changes");
    }
  } catch (error) {
    log("error", "Error handling config change", { error: error.message });
  }
}

/**
 * Setup signal handlers for graceful shutdown and reload
 */
function setupSignalHandlers(servers, idleCheckInterval) {
  // SIGTERM - graceful shutdown
  process.on("SIGTERM", async () => {
    log("info", "Received SIGTERM, shutting down gracefully");
    if (idleCheckInterval) {
      clearInterval(idleCheckInterval);
    }
    if (configWatcher) {
      configWatcher.close();
    }
    await cleanup();
    servers.forEach((server) => server.close());
    process.exit(0);
  });

  // SIGINT - graceful shutdown (Ctrl+C)
  process.on("SIGINT", async () => {
    log("info", "Received SIGINT, shutting down gracefully");
    if (idleCheckInterval) {
      clearInterval(idleCheckInterval);
    }
    if (configWatcher) {
      configWatcher.close();
    }
    await cleanup();
    servers.forEach((server) => server.close());
    process.exit(0);
  });

  // SIGHUP - reload config
  process.on("SIGHUP", () => {
    log("info", "Received SIGHUP, reloading configuration");
    handleConfigChange();
  });
}

/**
 * Show loading page while server is starting
 */
function showLoadingPage(res, hostname) {
  res.writeHead(200, {
    "Content-Type": "text/html",
    Refresh: "2", // Auto-refresh every 2 seconds
  });
  res.end(`
    <html>
      <head>
        <title>Starting ${hostname}...</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 2rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          h1 { margin: 0 0 1rem; font-size: 2rem; }
          p { margin: 0.5rem 0; opacity: 0.9; }
          code {
            background: rgba(0, 0, 0, 0.2);
            padding: 0.2rem 0.5rem;
            border-radius: 3px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h1>Starting Development Server</h1>
          <p><code>${hostname}</code></p>
          <p>This may take a moment on first start...</p>
          <p style="font-size: 0.9rem; margin-top: 2rem; opacity: 0.7;">
            Powered by Nextium
          </p>
        </div>
      </body>
    </html>
  `);
}

/**
 * Create request handler for both HTTP and HTTPS servers
 */
function createRequestHandler(proxy, protocol) {
  return async (req, res) => {
    const hostname = req.headers.host ? req.headers.host.split(":")[0] : "";
    const mappings = getAllMappings();

    if (hostname && (hostname.endsWith(".nextium") || mappings[hostname])) {
      // Check rate limit
      if (!checkRateLimit(hostname)) {
        res.writeHead(429, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <head><title>429 Too Many Requests</title></head>
            <body>
              <h1>429 Too Many Requests</h1>
              <p>Rate limit exceeded for domain: <strong>${hostname}</strong></p>
              <p>Please try again in a minute.</p>
            </body>
          </html>
        `);
        return;
      }

      // Check if this is a Nextium project
      const project = getProject(hostname);

      if (project) {
        // Process-managed project (Nextium)
        let processInfo = getProcessInfo(hostname);

        log("debug", `Checking process for ${hostname}`, {
          hostname,
          hasProcessInfo: !!processInfo,
          state: processInfo?.state,
          pid: processInfo?.pid,
          port: processInfo?.port,
        });

        // Verify process is actually running if we have process info
        if (processInfo && processInfo.pid) {
          try {
            // Check if process is still running by sending signal 0 (doesn't kill, just checks)
            process.kill(processInfo.pid, 0);
            log(
              "debug",
              `Process ${processInfo.pid} for ${hostname} is running`,
              {
                hostname,
                pid: processInfo.pid,
                port: processInfo.port,
              }
            );
          } catch (error) {
            // Process doesn't exist, treat as stopped
            log(
              "info",
              `Process ${processInfo.pid} for ${hostname} is no longer running`,
              { hostname, pid: processInfo.pid }
            );
            processInfo = null;
          }
        }

        // If not running or stopped, start it
        // Note: "manual" state means it was started via `nextium dev` and should be treated as running
        if (
          !processInfo ||
          processInfo.state === "stopped" ||
          processInfo.state === "stopping"
        ) {
          log("info", `Starting dev server for ${hostname} (HTTP-triggered)`, {
            hostname,
          });

          // Show loading page
          showLoadingPage(res, hostname);

          try {
            // Start the dev server
            processInfo = await startDevServer(hostname);
            log("info", `Dev server started for ${hostname}`, {
              hostname,
              port: processInfo.port,
              pid: processInfo.pid,
            });
          } catch (error) {
            log("error", `Failed to start dev server for ${hostname}`, {
              hostname,
              error: error.message,
            });
            res.writeHead(503, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <head><title>503 Service Unavailable</title></head>
                <body>
                  <h1>503 Service Unavailable</h1>
                  <p>Failed to start development server for: <strong>${hostname}</strong></p>
                  <p>Error: ${error.message}</p>
                  <p>Check logs with: <code>nextium logs ${hostname}</code></p>
                </body>
              </html>
            `);
            return;
          }
          return; // Loading page was sent, will retry on refresh
        }

        // Update last access time
        updateLastAccess(hostname);

        // Get port from process info
        const targetPort = processInfo.port;
        if (!targetPort) {
          log("error", `No port found for ${hostname}`, {
            hostname,
            processInfo,
          });
          res.writeHead(503, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <head><title>503 Service Unavailable</title></head>
              <body>
                <h1>503 Service Unavailable</h1>
                <p>No port information found for: <strong>${hostname}</strong></p>
                <p>Process state: ${processInfo.state || "unknown"}</p>
                <p>Try restarting the dev server: <code>nextium dev ${hostname}</code></p>
              </body>
            </html>
          `);
          return;
        }

        const target = `http://127.0.0.1:${targetPort}`;

        log(
          "info",
          `${protocol} ${req.method} ${hostname} -> localhost:${targetPort} ${req.url}`,
          {
            protocol,
            method: req.method,
            hostname,
            targetPort,
            url: req.url,
            state: processInfo.state,
          }
        );

        proxy.web(req, res, {
          target,
          changeOrigin: true,
          secure: false,
        });
      } else if (mappings[hostname]) {
        // Legacy static mapping (for backward compatibility)
        const targetPort = mappings[hostname];
        const target = `http://127.0.0.1:${targetPort}`;

        log(
          "info",
          `${protocol} ${req.method} ${hostname} -> localhost:${targetPort} ${req.url}`,
          {
            protocol,
            method: req.method,
            hostname,
            targetPort,
            url: req.url,
          }
        );

        proxy.web(req, res, {
          target,
          changeOrigin: true,
          secure: false,
        });
      } else {
        // Not found
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <head><title>404 Not Found</title></head>
            <body>
              <h1>404 Not Found</h1>
              <p>No project found for domain: <strong>${
                hostname || "unknown"
              }</strong></p>
              <p>Use <code>nextium create</code> in your Next.js project to register it.</p>
            </body>
          </html>
        `);
      }
    } else {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <head><title>404 Not Found</title></head>
          <body>
            <h1>404 Not Found</h1>
            <p>No mapping found for domain: <strong>${
              hostname || "unknown"
            }</strong></p>
            <p>Use <code>nextium create</code> to setup a Next.js project.</p>
          </body>
        </html>
      `);
    }
  };
}

/**
 * Create and start the proxy servers (HTTP and HTTPS)
 */
function startProxyServer(httpPort = 80, httpsPort = 443, options = {}) {
  const { enableHttps = true } = options;

  const proxy = httpProxy.createProxyServer({});

  // Handle proxy errors
  proxy.on("error", (err, req, res) => {
    const hostname = req.headers.host
      ? req.headers.host.split(":")[0]
      : "unknown";
    log("error", "Proxy error", { hostname, error: err.message });
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <head><title>502 Bad Gateway</title></head>
          <body>
            <h1>502 Bad Gateway</h1>
            <p>Cannot connect to target server: ${err.message}</p>
            <p>Make sure your development server is running on the correct port.</p>
          </body>
        </html>
      `);
    }
  });

  const servers = [];
  const promises = [];

  // Create HTTP server
  const httpServer = http.createServer(createRequestHandler(proxy, "HTTP"));

  const httpPromise = new Promise((resolve, reject) => {
    httpServer.on("error", (err) => {
      if (err.code === "EACCES") {
        reject(
          new Error(
            `Permission denied to bind to port ${httpPort}. Try running with sudo or use a port >= 1024.`
          )
        );
      } else if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${httpPort} is already in use. Stop the other service or choose a different port.`
          )
        );
      } else {
        reject(err);
      }
    });

    httpServer.listen(httpPort, "127.0.0.1", () => {
      log("info", `HTTP proxy server running on port ${httpPort}`, {
        port: httpPort,
      });
      console.log(`✓ HTTP proxy server running on port ${httpPort}`);
      resolve(httpServer);
    });
  });

  promises.push(httpPromise);
  servers.push(httpServer);

  // Create HTTPS server if enabled and certificates are available
  if (enableHttps) {
    const certs = loadCertificates();

    if (certs) {
      try {
        const httpsServer = https.createServer(
          {
            key: certs.key,
            cert: certs.cert,
          },
          createRequestHandler(proxy, "HTTPS")
        );

        const httpsPromise = new Promise((resolve, reject) => {
          httpsServer.on("error", (err) => {
            if (err.code === "EACCES") {
              reject(
                new Error(
                  `Permission denied to bind to port ${httpsPort}. Try running with sudo.`
                )
              );
            } else if (err.code === "EADDRINUSE") {
              reject(
                new Error(
                  `Port ${httpsPort} is already in use. Stop the other service or choose a different port.`
                )
              );
            } else {
              reject(err);
            }
          });

          httpsServer.listen(httpsPort, "127.0.0.1", () => {
            log("info", `HTTPS proxy server running on port ${httpsPort}`, {
              port: httpsPort,
            });
            console.log(`✓ HTTPS proxy server running on port ${httpsPort}`);
            resolve(httpsServer);
          });
        });

        promises.push(httpsPromise);
        servers.push(httpsServer);
      } catch (error) {
        console.error("Warning: Failed to start HTTPS server:", error.message);
      }
    }
  }

  return Promise.all(promises).then(() => {
    const mappings = getAllMappings();
    const projects = getAllProjects();
    const mappingCount = Object.keys(mappings).length;
    const projectCount = Object.keys(projects).length;
    const totalDomainCount = mappingCount + projectCount;

    log("info", "Proxy server started", {
      httpPort,
      httpsPort,
      httpsEnabled: enableHttps && servers.length > 1,
      mappingCount,
      projectCount,
      totalDomainCount,
    });

    console.log(
      `✓ Monitoring ${totalDomainCount} domain(s) (${projectCount} project(s), ${mappingCount} mapping(s))\n`
    );

    if (totalDomainCount > 0) {
      // Show Nextium projects
      if (projectCount > 0) {
        console.log("Nextium Projects:");
        Object.keys(projects).forEach((domain) => {
          const protocols = [];
          if (servers.length >= 1) protocols.push(`http://${domain}`);
          if (servers.length >= 2) protocols.push(`https://${domain}`);
          console.log(
            `  • ${protocols.join(" | ")} → (auto-started on access)`
          );
        });
        console.log("");
      }

      // Show static mappings
      if (mappingCount > 0) {
        console.log("Static Mappings:");
        Object.entries(mappings).forEach(([domain, port]) => {
          const protocols = [];
          if (servers.length >= 1) protocols.push(`http://${domain}`);
          if (servers.length >= 2) protocols.push(`https://${domain}`);
          console.log(
            `  • ${protocols.join(" | ")} → http://localhost:${port}`
          );
        });
        console.log("");
      }
    }

    // Setup config file watcher for automatic cert regeneration
    setupConfigWatcher();

    // Start idle process checker
    const idleCheckInterval = startIdleCheck();
    log("info", "Idle process checker started", { intervalMs: 30000 });

    // Setup signal handlers for graceful shutdown
    setupSignalHandlers(servers, idleCheckInterval);

    return servers;
  });
}

module.exports = {
  startProxyServer,
};
