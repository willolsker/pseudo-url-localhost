const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.pseudo-url');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const HOSTS_BACKUP = path.join(CONFIG_DIR, 'hosts.backup');

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load configuration from disk
 */
function loadConfig() {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return { mappings: {}, proxyPort: 80 };
  }
  
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading config:', error.message);
    return { mappings: {}, proxyPort: 80 };
  }
}

/**
 * Save configuration to disk
 */
function saveConfig(config) {
  ensureConfigDir();
  
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error.message);
    return false;
  }
}

/**
 * Add a new URL mapping
 */
function addMapping(domain, port) {
  const config = loadConfig();
  config.mappings[domain] = port;
  return saveConfig(config);
}

/**
 * Remove a URL mapping
 */
function removeMapping(domain) {
  const config = loadConfig();
  delete config.mappings[domain];
  return saveConfig(config);
}

/**
 * Get all mappings
 */
function getAllMappings() {
  const config = loadConfig();
  return config.mappings || {};
}

/**
 * Clear all mappings
 */
function clearAllMappings() {
  const config = loadConfig();
  config.mappings = {};
  return saveConfig(config);
}

/**
 * Set proxy port
 */
function setProxyPort(port) {
  const config = loadConfig();
  config.proxyPort = port;
  return saveConfig(config);
}

/**
 * Get proxy port
 */
function getProxyPort() {
  const config = loadConfig();
  return config.proxyPort || 80;
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  HOSTS_BACKUP,
  loadConfig,
  saveConfig,
  addMapping,
  removeMapping,
  getAllMappings,
  clearAllMappings,
  setProxyPort,
  getProxyPort
};

