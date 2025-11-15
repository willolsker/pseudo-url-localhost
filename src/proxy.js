const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const fs = require('fs');
const { getAllMappings, CONFIG_FILE } = require('./config');
const { loadCertificates, ensureCertificates, isMkcertInstalled, isMkcertCAInstalled } = require('./certificates');

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
    ...data
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
    log('warn', 'Rate limit exceeded', { hostname, count: record.count });
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
      if (eventType === 'change') {
        // Debounce rapid changes
        if (watchDebounceTimer) {
          clearTimeout(watchDebounceTimer);
        }
        
        watchDebounceTimer = setTimeout(() => {
          handleConfigChange();
        }, 500);
      }
    });
    
    log('info', 'Config file watcher started', { configFile: CONFIG_FILE });
  } catch (error) {
    log('warn', 'Failed to setup config watcher', { error: error.message });
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
      !newDomains.every(d => currentDomains.includes(d));
    
    if (domainsChanged) {
      log('info', 'Config reloaded - domains changed', {
        oldCount: currentDomains.length,
        newCount: newDomains.length,
        added: newDomains.filter(d => !currentDomains.includes(d)),
        removed: currentDomains.filter(d => !newDomains.includes(d))
      });
      
      // Update current domains
      currentDomains = newDomains;
      
      // Regenerate certificates if mkcert is available
      if (newDomains.length > 0 && isMkcertInstalled() && isMkcertCAInstalled()) {
        const result = ensureCertificates(newDomains);
        if (result.success) {
          log('info', 'SSL certificates regenerated automatically', { domains: newDomains });
        } else {
          log('warn', 'Failed to regenerate certificates', { error: result.message });
        }
      }
    } else {
      log('info', 'Config reloaded - no domain changes');
    }
  } catch (error) {
    log('error', 'Error handling config change', { error: error.message });
  }
}

/**
 * Setup signal handlers for graceful shutdown and reload
 */
function setupSignalHandlers(servers) {
  // SIGTERM - graceful shutdown
  process.on('SIGTERM', () => {
    log('info', 'Received SIGTERM, shutting down gracefully');
    if (configWatcher) {
      configWatcher.close();
    }
    servers.forEach(server => server.close());
    process.exit(0);
  });
  
  // SIGINT - graceful shutdown (Ctrl+C)
  process.on('SIGINT', () => {
    log('info', 'Received SIGINT, shutting down gracefully');
    if (configWatcher) {
      configWatcher.close();
    }
    servers.forEach(server => server.close());
    process.exit(0);
  });
  
  // SIGHUP - reload config
  process.on('SIGHUP', () => {
    log('info', 'Received SIGHUP, reloading configuration');
    handleConfigChange();
  });
}

/**
 * Create request handler for both HTTP and HTTPS servers
 */
function createRequestHandler(proxy, protocol) {
  return (req, res) => {
    const hostname = req.headers.host ? req.headers.host.split(':')[0] : '';
    const mappings = getAllMappings();
    
    if (hostname && mappings[hostname]) {
      // Check rate limit
      if (!checkRateLimit(hostname)) {
        res.writeHead(429, { 'Content-Type': 'text/html' });
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
      
      const targetPort = mappings[hostname];
      const target = `http://127.0.0.1:${targetPort}`;
      
      log('info', `${protocol} ${req.method} ${hostname} -> localhost:${targetPort} ${req.url}`, {
        protocol,
        method: req.method,
        hostname,
        targetPort,
        url: req.url
      });
      
      proxy.web(req, res, { 
        target,
        changeOrigin: true,
        secure: false
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>404 Not Found</title></head>
          <body>
            <h1>404 Not Found</h1>
            <p>No mapping found for domain: <strong>${hostname || 'unknown'}</strong></p>
            <hr>
            <h2>Configured Mappings:</h2>
            <ul>
              ${Object.entries(mappings).map(([domain, port]) => 
                `<li><strong>${domain}</strong> → localhost:${port}</li>`
              ).join('')}
            </ul>
            <p>Use <code>pseudo-url add</code> to add new mappings.</p>
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
  proxy.on('error', (err, req, res) => {
    const hostname = req.headers.host ? req.headers.host.split(':')[0] : 'unknown';
    log('error', 'Proxy error', { hostname, error: err.message });
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/html' });
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
  const httpServer = http.createServer(createRequestHandler(proxy, 'HTTP'));
  
  const httpPromise = new Promise((resolve, reject) => {
    httpServer.on('error', (err) => {
      if (err.code === 'EACCES') {
        reject(new Error(`Permission denied to bind to port ${httpPort}. Try running with sudo or use a port >= 1024.`));
      } else if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${httpPort} is already in use. Stop the other service or choose a different port.`));
      } else {
        reject(err);
      }
    });
    
    httpServer.listen(httpPort, '127.0.0.1', () => {
      log('info', `HTTP proxy server running on port ${httpPort}`, { port: httpPort });
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
            cert: certs.cert
          },
          createRequestHandler(proxy, 'HTTPS')
        );
        
        const httpsPromise = new Promise((resolve, reject) => {
          httpsServer.on('error', (err) => {
            if (err.code === 'EACCES') {
              reject(new Error(`Permission denied to bind to port ${httpsPort}. Try running with sudo.`));
            } else if (err.code === 'EADDRINUSE') {
              reject(new Error(`Port ${httpsPort} is already in use. Stop the other service or choose a different port.`));
            } else {
              reject(err);
            }
          });
          
          httpsServer.listen(httpsPort, '127.0.0.1', () => {
            log('info', `HTTPS proxy server running on port ${httpsPort}`, { port: httpsPort });
            console.log(`✓ HTTPS proxy server running on port ${httpsPort}`);
            resolve(httpsServer);
          });
        });
        
        promises.push(httpsPromise);
        servers.push(httpsServer);
      } catch (error) {
        console.error('Warning: Failed to start HTTPS server:', error.message);
      }
    }
  }
  
  return Promise.all(promises).then(() => {
    const mappings = getAllMappings();
    const domainCount = Object.keys(mappings).length;
    
    log('info', 'Proxy server started', { 
      httpPort, 
      httpsPort, 
      httpsEnabled: enableHttps && servers.length > 1,
      domainCount 
    });
    
    console.log(`✓ Monitoring ${domainCount} domain(s)\n`);
    
    if (domainCount > 0) {
      console.log('Active mappings:');
      Object.entries(mappings).forEach(([domain, port]) => {
        const protocols = [];
        if (servers.length >= 1) protocols.push(`http://${domain}`);
        if (servers.length >= 2) protocols.push(`https://${domain}`);
        console.log(`  • ${protocols.join(' | ')} → http://localhost:${port}`);
      });
      console.log('');
    }
    
    // Setup config file watcher for automatic cert regeneration
    setupConfigWatcher();
    
    // Setup signal handlers for graceful shutdown
    setupSignalHandlers(servers);
    
    return servers;
  });
}

module.exports = {
  startProxyServer
};

