const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.nextium');
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
 * Get default configuration
 */
function getDefaultConfig() {
  return {
    mappings: {},
    proxyPort: 80, // Legacy field, kept for backward compatibility
    httpPort: 80,
    httpsPort: 443,
    httpsEnabled: true
  };
}

/**
 * Validate that a domain uses the .nextium TLD
 * @param {string} domain - Domain to validate
 * @returns {boolean} True if valid
 * @throws {Error} If domain doesn't end with .nextium
 */
function validateNextiumDomain(domain) {
  if (!domain.endsWith('.nextium')) {
    throw new Error(
      `Invalid domain: ${domain}\n` +
      `Nextium requires all domains to end with .nextium\n` +
      `Example: myproject.nextium`
    );
  }
  
  // Additional validation
  if (domain === '.nextium') {
    throw new Error('Domain cannot be just .nextium');
  }
  
  // Check for valid subdomain format
  const parts = domain.split('.');
  if (parts.length < 2 || parts[parts.length - 1] !== 'nextium') {
    throw new Error(`Invalid domain format: ${domain}`);
  }
  
  // Validate subdomain parts (no empty parts, no invalid characters)
  const subdomainParts = parts.slice(0, -1);
  for (const part of subdomainParts) {
    if (!part || part.length === 0) {
      throw new Error(`Invalid domain: ${domain} (empty subdomain part)`);
    }
    if (!/^[a-z0-9-]+$/i.test(part)) {
      throw new Error(
        `Invalid domain: ${domain}\n` +
        `Subdomain parts can only contain letters, numbers, and hyphens`
      );
    }
    if (part.startsWith('-') || part.endsWith('-')) {
      throw new Error(`Invalid domain: ${domain} (subdomain cannot start or end with hyphen)`);
    }
  }
  
  return true;
}

/**
 * Validate configuration for security issues
 */
function validateConfig(config) {
  // Check file permissions
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const stats = fs.statSync(CONFIG_FILE);
      const mode = stats.mode & parseInt('777', 8);
      
      if (mode & 0o002) {
        console.warn('Warning: Config file is world-writable');
        console.warn(`Run: chmod 644 ${CONFIG_FILE}`);
      }
    }
  } catch (error) {
    // Ignore permission check errors
  }
  
  // Validate ports
  if (config.mappings) {
    Object.entries(config.mappings).forEach(([domain, port]) => {
      if (typeof port !== 'number' || port < 1 || port > 65535) {
        throw new Error(`Invalid port for domain ${domain}: ${port}`);
      }
    });
  }
  
  // Validate domain names
  if (config.mappings) {
    Object.keys(config.mappings).forEach(domain => {
      // Validate .nextium TLD
      validateNextiumDomain(domain);
      
      // Additional security checks
      if (domain.includes('..') || domain.startsWith('.')) {
        throw new Error(`Invalid domain name: ${domain}`);
      }
      if (domain.includes('/') || domain.includes('\\')) {
        throw new Error(`Invalid domain name: ${domain}`);
      }
    });
  }
  
  return true;
}

/**
 * Load configuration from disk
 */
function loadConfig() {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return getDefaultConfig();
  }
  
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(data);
    
    // Merge with defaults to ensure all fields exist
    const mergedConfig = { ...getDefaultConfig(), ...config };
    
    // Validate configuration
    validateConfig(mergedConfig);
    
    return mergedConfig;
  } catch (error) {
    console.error('Error loading config:', error.message);
    return getDefaultConfig();
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
 * @param {string} domain - Domain name (must end with .nextium)
 * @param {number} port - Port number
 * @returns {boolean} Success status
 */
function addMapping(domain, port) {
  // Validate .nextium domain
  validateNextiumDomain(domain);
  
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
 * Set proxy port (legacy - sets HTTP port)
 */
function setProxyPort(port) {
  const config = loadConfig();
  config.proxyPort = port;
  config.httpPort = port;
  return saveConfig(config);
}

/**
 * Get proxy port (legacy - returns HTTP port)
 */
function getProxyPort() {
  const config = loadConfig();
  return config.httpPort || config.proxyPort || 80;
}

/**
 * Set HTTP port
 */
function setHttpPort(port) {
  const config = loadConfig();
  config.httpPort = port;
  config.proxyPort = port; // Keep legacy field in sync
  return saveConfig(config);
}

/**
 * Get HTTP port
 */
function getHttpPort() {
  const config = loadConfig();
  return config.httpPort || config.proxyPort || 80;
}

/**
 * Set HTTPS port
 */
function setHttpsPort(port) {
  const config = loadConfig();
  config.httpsPort = port;
  return saveConfig(config);
}

/**
 * Get HTTPS port
 */
function getHttpsPort() {
  const config = loadConfig();
  return config.httpsPort || 443;
}

/**
 * Enable or disable HTTPS
 */
function setHttpsEnabled(enabled) {
  const config = loadConfig();
  config.httpsEnabled = enabled;
  return saveConfig(config);
}

/**
 * Check if HTTPS is enabled
 */
function isHttpsEnabled() {
  const config = loadConfig();
  return config.httpsEnabled !== false; // Default to true
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  HOSTS_BACKUP,
  getDefaultConfig,
  loadConfig,
  saveConfig,
  addMapping,
  removeMapping,
  getAllMappings,
  clearAllMappings,
  setProxyPort,
  getProxyPort,
  setHttpPort,
  getHttpPort,
  setHttpsPort,
  getHttpsPort,
  setHttpsEnabled,
  isHttpsEnabled,
  validateNextiumDomain
};

