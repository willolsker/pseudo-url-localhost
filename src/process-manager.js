const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { CONFIG_DIR } = require("./config");
const { getProject, detectDevCommand } = require("./project-config");

const PROCESSES_FILE = path.join(CONFIG_DIR, "processes.json");

// In-memory process tracking
const runningProcesses = new Map();

// Process states
const PROCESS_STATE = {
  STARTING: "starting",
  RUNNING: "running",
  STOPPING: "stopping",
  STOPPED: "stopped",
  MANUAL: "manual", // Manual mode (via `nextium dev`)
};

/**
 * Ensure processes file exists
 */
function ensureProcessesFile() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (!fs.existsSync(PROCESSES_FILE)) {
    fs.writeFileSync(
      PROCESSES_FILE,
      JSON.stringify({ processes: {} }, null, 2)
    );
  }
}

/**
 * Load processes from disk
 * @returns {Object} Processes object
 */
function loadProcesses() {
  ensureProcessesFile();

  try {
    const data = fs.readFileSync(PROCESSES_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading processes:", error.message);
    return { processes: {} };
  }
}

/**
 * Save processes to disk
 * @param {Object} data - Processes data to save
 */
function saveProcesses(data) {
  try {
    fs.writeFileSync(PROCESSES_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving processes:", error.message);
  }
}

/**
 * Check if a port is available
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} True if port is available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port, "127.0.0.1");
  });
}

/**
 * Find an available port in the given range
 * @param {number} startPort - Start of port range
 * @param {number} endPort - End of port range
 * @returns {Promise<number|null>} Available port or null
 */
async function findAvailablePort(startPort = 3000, endPort = 3999) {
  for (let port = startPort; port <= endPort; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return null;
}

/**
 * Allocate a port for a project
 * @param {Object} config - Project configuration
 * @returns {Promise<number>} Allocated port
 */
async function allocatePort(config) {
  if (config.port === "auto") {
    const port = await findAvailablePort();
    if (!port) {
      throw new Error("No available ports in range 3000-3999");
    }
    return port;
  }

  // Check if specified port is available
  if (!(await isPortAvailable(config.port))) {
    throw new Error(`Port ${config.port} is already in use`);
  }

  return config.port;
}

/**
 * Detect when a dev server is ready
 * @param {Object} childProcess - Child process object
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {boolean} streamLogs - Whether logs are being streamed (stdio: inherit)
 * @returns {Promise<void>}
 */
function waitForReady(childProcess, timeoutMs = 30000, streamLogs = false) {
  return new Promise((resolve, reject) => {
    // If streaming logs, we can't detect ready state from output
    // So we just wait a bit and hope for the best
    if (streamLogs) {
      if (!childProcess) {
        reject(new Error("childProcess is null"));
        return;
      }

      // Check if process already exited
      if (childProcess.killed || childProcess.exitCode !== null) {
        reject(
          new Error(`Process already exited with code ${childProcess.exitCode}`)
        );
        return;
      }

      const timeout = setTimeout(() => {
        // Check if process is still running before resolving
        if (
          !childProcess ||
          childProcess.killed ||
          childProcess.exitCode !== null
        ) {
          reject(
            new Error(
              `Process exited with code ${
                childProcess?.exitCode ?? "unknown"
              } before becoming ready`
            )
          );
        } else {
          // Assume it's ready after a delay
          resolve();
        }
      }, 5000); // Give it 5 seconds to start

      // Safely attach exit handler
      if (!childProcess || typeof childProcess.once !== "function") {
        clearTimeout(timeout);
        reject(
          new Error(
            "childProcess is invalid when trying to attach exit handler"
          )
        );
        return;
      }

      try {
        childProcess.once("exit", (code) => {
          clearTimeout(timeout);
          reject(
            new Error(`Process exited with code ${code} before becoming ready`)
          );
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`Failed to attach exit handler: ${error.message}`));
        return;
      }
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for server to be ready"));
    }, timeoutMs);

    const readyPatterns = [
      /ready on/i,
      /started server on/i,
      /local:/i,
      /listening on/i,
      /ready in/i,
    ];

    const checkOutput = (data) => {
      const str = data.toString();

      for (const pattern of readyPatterns) {
        if (pattern.test(str)) {
          clearTimeout(timeout);
          if (childProcess.stdout) childProcess.stdout.off("data", checkOutput);
          if (childProcess.stderr) childProcess.stderr.off("data", checkOutput);
          resolve();
          return;
        }
      }
    };

    if (!childProcess) {
      clearTimeout(timeout);
      reject(new Error("childProcess is null in non-streamLogs path"));
      return;
    }

    if (childProcess.stdout && typeof childProcess.stdout.on === "function") {
      try {
        childProcess.stdout.on("data", checkOutput);
      } catch (error) {
        // Ignore errors attaching stdout handler
      }
    }
    if (childProcess.stderr && typeof childProcess.stderr.on === "function") {
      try {
        childProcess.stderr.on("data", checkOutput);
      } catch (error) {
        // Ignore errors attaching stderr handler
      }
    }

    if (typeof childProcess.once !== "function") {
      clearTimeout(timeout);
      reject(new Error("childProcess.once is not a function"));
      return;
    }

    try {
      childProcess.once("exit", (code) => {
        clearTimeout(timeout);
        reject(
          new Error(`Process exited with code ${code} before becoming ready`)
        );
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(new Error(`Failed to attach exit handler: ${error.message}`));
    }
  });
}

/**
 * Start a dev server for a project
 * @param {string} domain - Project domain
 * @param {Object} options - Options (manual mode, etc.)
 * @returns {Promise<Object>} Process info
 */
async function startDevServer(domain, options = {}) {
  const project = getProject(domain);

  if (!project) {
    throw new Error(`Project ${domain} not found in registry`);
  }

  // Check if already running
  if (runningProcesses.has(domain)) {
    const existing = runningProcesses.get(domain);
    if (existing.state !== PROCESS_STATE.STOPPED) {
      throw new Error(`Process for ${domain} is already ${existing.state}`);
    }
  }

  // Allocate port
  const port = await allocatePort(project.config);

  // Detect dev command with flags
  const devFlags = project.config.devFlags || [];
  const devCommand = detectDevCommand(project.path, devFlags);
  const [command, ...args] = devCommand.split(" ");

  // Set port environment variable for Next.js
  // Note: .env files in the project directory are automatically loaded by Next.js
  const env = {
    ...process.env,
    PORT: port.toString(),
  };

  // Log what we're about to run (for debugging)
  if (options.streamLogs) {
    console.error(`[Nextium] Running: ${command} ${args.join(" ")}`);
    console.error(`[Nextium] Working directory: ${project.path}`);
    console.error(`[Nextium] Port: ${port}`);
  }

  // Spawn the process
  let childProcess;
  try {
    childProcess = spawn(command, args, {
      cwd: project.path,
      env: env,
      stdio: options.streamLogs ? "inherit" : "pipe",
    });
  } catch (error) {
    throw new Error(`Failed to spawn process: ${error.message}`);
  }

  // Check if spawn failed
  if (!childProcess) {
    throw new Error(`Failed to spawn process: ${command} ${args.join(" ")}`);
  }

  // Set up error handler IMMEDIATELY (before anything else)
  // This must be done synchronously to catch immediate spawn errors
  let spawnError = null;
  const errorHandler = (error) => {
    spawnError = error;
    console.error(`[Process Manager] Process error for ${domain}:`, error);
    const proc = runningProcesses.get(domain);
    if (proc) {
      proc.state = PROCESS_STATE.STOPPED;
      proc.error = error.message;
    }
  };

  // Set up exit handler
  const exitHandler = (code, signal) => {
    const proc = runningProcesses.get(domain);
    if (proc) {
      proc.state = PROCESS_STATE.STOPPED;
      proc.exitCode = code;
      proc.exitSignal = signal;
      proc.stoppedAt = new Date().toISOString();
    }

    // Remove from tracking after a delay
    setTimeout(() => {
      runningProcesses.delete(domain);
      updatePersistedProcesses();
    }, 5000);
  };

  // Attach handlers immediately with error handling
  if (!childProcess) {
    throw new Error("childProcess is null after spawn");
  }

  if (typeof childProcess.on !== "function") {
    throw new Error(
      `Invalid childProcess object: ${typeof childProcess}, on method: ${typeof childProcess.on}`
    );
  }

  try {
    childProcess.on("error", errorHandler);
    childProcess.on("exit", exitHandler);
  } catch (error) {
    throw new Error(`Failed to attach event handlers: ${error.message}`);
  }

  // Wait a tick to check for immediate spawn errors
  await new Promise((resolve) => setImmediate(resolve));

  // Check for spawn errors
  if (spawnError) {
    throw new Error(`Process spawn failed: ${spawnError.message}`);
  }

  // Check if process has a valid PID
  if (!childProcess || !childProcess.pid) {
    throw new Error(`Process failed to start: ${command} ${args.join(" ")}`);
  }

  const processInfo = {
    domain: domain,
    pid: childProcess.pid,
    port: port,
    command: devCommand,
    state: PROCESS_STATE.STARTING,
    mode: options.manual ? "manual" : "managed",
    startedAt: new Date().toISOString(),
    lastAccess: new Date().toISOString(),
    childProcess: childProcess,
  };

  runningProcesses.set(domain, processInfo);

  try {
    // Ensure childProcess is still valid before waiting
    if (!childProcess) {
      throw new Error("childProcess became null before waitForReady");
    }

    // Wait for server to be ready
    await waitForReady(childProcess, 30000, options.streamLogs);

    // Double-check process is still running
    if (!childProcess || childProcess.killed) {
      throw new Error("Process was killed before becoming ready");
    }

    processInfo.state = options.manual
      ? PROCESS_STATE.MANUAL
      : PROCESS_STATE.RUNNING;
    processInfo.readyAt = new Date().toISOString();

    updatePersistedProcesses();

    return processInfo;
  } catch (error) {
    // Failed to start - clean up
    if (childProcess && !childProcess.killed) {
      try {
        childProcess.kill("SIGTERM");
      } catch (killError) {
        // Ignore kill errors
      }
    }
    runningProcesses.delete(domain);

    // Re-throw with more context
    const enhancedError = new Error(
      `Failed to start dev server for ${domain}: ${error.message}`
    );
    enhancedError.originalError = error;
    throw enhancedError;
  }
}

/**
 * Stop a dev server
 * @param {string} domain - Project domain
 * @param {boolean} force - Force kill if true
 * @returns {Promise<boolean>} Success status
 */
async function stopDevServer(domain, force = false) {
  const processInfo = runningProcesses.get(domain);

  if (!processInfo || processInfo.state === PROCESS_STATE.STOPPED) {
    return false;
  }

  processInfo.state = PROCESS_STATE.STOPPING;

  return new Promise((resolve) => {
    const { childProcess } = processInfo;

    if (force) {
      childProcess.kill("SIGKILL");
      resolve(true);
      return;
    }

    // Graceful shutdown
    childProcess.kill("SIGTERM");

    // Wait up to 10 seconds for graceful shutdown
    const timeout = setTimeout(() => {
      childProcess.kill("SIGKILL");
      resolve(true);
    }, 10000);

    childProcess.once("exit", () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

/**
 * Restart a dev server
 * @param {string} domain - Project domain
 * @param {Object} options - Options
 * @returns {Promise<Object>} Process info
 */
async function restartDevServer(domain, options = {}) {
  await stopDevServer(domain, false);

  // Wait a bit for port to be released
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return startDevServer(domain, options);
}

/**
 * Update last access time for a process
 * @param {string} domain - Project domain
 */
function updateLastAccess(domain) {
  const processInfo = runningProcesses.get(domain);

  if (processInfo) {
    processInfo.lastAccess = new Date().toISOString();
    updatePersistedProcesses();
  }
}

/**
 * Get process info for a domain
 * @param {string} domain - Project domain
 * @returns {Object|null} Process info or null
 */
function getProcessInfo(domain) {
  const processInfo = runningProcesses.get(domain);

  if (!processInfo) {
    return null;
  }

  // Return a copy without the childProcess object
  const { childProcess, ...info } = processInfo;
  return info;
}

/**
 * Get all running processes
 * @returns {Object} All processes keyed by domain
 */
function getAllProcesses() {
  const processes = {};

  for (const [domain, processInfo] of runningProcesses.entries()) {
    const { childProcess, ...info } = processInfo;
    processes[domain] = info;
  }

  return processes;
}

/**
 * Check for idle processes and stop them
 */
async function checkIdleProcesses() {
  const now = Date.now();

  for (const [domain, processInfo] of runningProcesses.entries()) {
    // Skip manual mode processes
    if (processInfo.mode === "manual") {
      continue;
    }

    // Skip if not running
    if (processInfo.state !== PROCESS_STATE.RUNNING) {
      continue;
    }

    const project = getProject(domain);
    if (!project) {
      continue;
    }

    const idleTimeout = project.config.idle?.timeoutMs || 300000;
    const lastAccess = new Date(processInfo.lastAccess).getTime();
    const idleTime = now - lastAccess;

    if (idleTime > idleTimeout) {
      console.log(
        `[Process Manager] Stopping idle process: ${domain} (idle for ${Math.round(
          idleTime / 1000
        )}s)`
      );
      await stopDevServer(domain);
    }
  }
}

/**
 * Start idle check interval
 * @param {number} intervalMs - Check interval in milliseconds
 * @returns {NodeJS.Timeout} Interval ID
 */
function startIdleCheck(intervalMs = 30000) {
  return setInterval(() => {
    checkIdleProcesses().catch((error) => {
      console.error("[Process Manager] Error checking idle processes:", error);
    });
  }, intervalMs);
}

/**
 * Update persisted processes file
 */
function updatePersistedProcesses() {
  const processes = getAllProcesses();
  saveProcesses({ processes });
}

/**
 * Clean up all processes
 */
async function cleanup() {
  console.log("[Process Manager] Cleaning up all processes...");

  const domains = Array.from(runningProcesses.keys());

  for (const domain of domains) {
    try {
      await stopDevServer(domain, true);
    } catch (error) {
      console.error(
        `[Process Manager] Error stopping ${domain}:`,
        error.message
      );
    }
  }

  runningProcesses.clear();
  updatePersistedProcesses();
}

module.exports = {
  PROCESS_STATE,
  startDevServer,
  stopDevServer,
  restartDevServer,
  updateLastAccess,
  getProcessInfo,
  getAllProcesses,
  checkIdleProcesses,
  startIdleCheck,
  cleanup,
  allocatePort,
  isPortAvailable,
  findAvailablePort,
};
