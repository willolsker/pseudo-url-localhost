const fs = require('fs');
const path = require('path');
const { CONFIG_DIR, validateNextiumDomain } = require('./config');

const PROJECTS_REGISTRY = path.join(CONFIG_DIR, 'projects.json');

/**
 * Default project configuration
 */
function getDefaultProjectConfig(domain) {
  return {
    domain: domain,
    port: 'auto',
    idle: {
      timeoutMs: 300000 // 5 minutes
    }
  };
}

/**
 * Ensure projects registry exists
 */
function ensureProjectsRegistry() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(PROJECTS_REGISTRY)) {
    fs.writeFileSync(PROJECTS_REGISTRY, JSON.stringify({ projects: {} }, null, 2));
  }
}

/**
 * Load projects registry
 * @returns {Object} Registry object with projects
 */
function loadProjectsRegistry() {
  ensureProjectsRegistry();
  
  try {
    const data = fs.readFileSync(PROJECTS_REGISTRY, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading projects registry:', error.message);
    return { projects: {} };
  }
}

/**
 * Save projects registry
 * @param {Object} registry - Registry object to save
 * @returns {boolean} Success status
 */
function saveProjectsRegistry(registry) {
  try {
    fs.writeFileSync(PROJECTS_REGISTRY, JSON.stringify(registry, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving projects registry:', error.message);
    return false;
  }
}

/**
 * Check if a directory contains a Next.js project
 * @param {string} projectPath - Path to check
 * @returns {boolean} True if Next.js project detected
 */
function isNextJsProject(projectPath) {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check for Next.js in dependencies or devDependencies
    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {})
    };
    
    return 'next' in deps;
  } catch (error) {
    return false;
  }
}

/**
 * Read nextium.config.js from a project directory
 * @param {string} projectPath - Path to project directory
 * @returns {Object|null} Configuration object or null if not found
 */
function readProjectConfig(projectPath) {
  const configPath = path.join(projectPath, 'nextium.config.js');
  
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  try {
    // Clear require cache to get fresh config
    delete require.cache[require.resolve(configPath)];
    const config = require(configPath);
    return config;
  } catch (error) {
    throw new Error(`Error reading nextium.config.js: ${error.message}`);
  }
}

/**
 * Write nextium.config.js to a project directory
 * @param {string} projectPath - Path to project directory
 * @param {Object} config - Configuration object
 * @returns {boolean} Success status
 */
function writeProjectConfig(projectPath, config) {
  const configPath = path.join(projectPath, 'nextium.config.js');
  
  const configContent = `module.exports = ${JSON.stringify(config, null, 2)};\n`;
  
  try {
    fs.writeFileSync(configPath, configContent);
    return true;
  } catch (error) {
    throw new Error(`Error writing nextium.config.js: ${error.message}`);
  }
}

/**
 * Validate project configuration
 * @param {Object} config - Configuration to validate
 * @returns {boolean} True if valid
 * @throws {Error} If configuration is invalid
 */
function validateProjectConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }
  
  // Validate domain
  if (!config.domain || typeof config.domain !== 'string') {
    throw new Error('Configuration must have a domain string');
  }
  validateNextiumDomain(config.domain);
  
  // Validate port
  if (config.port !== 'auto' && typeof config.port !== 'number') {
    throw new Error('Port must be "auto" or a number');
  }
  if (typeof config.port === 'number' && (config.port < 1 || config.port > 65535)) {
    throw new Error('Port must be between 1 and 65535');
  }
  
  // Validate idle timeout
  if (config.idle) {
    if (typeof config.idle !== 'object') {
      throw new Error('idle must be an object');
    }
    if (config.idle.timeoutMs && typeof config.idle.timeoutMs !== 'number') {
      throw new Error('idle.timeoutMs must be a number');
    }
    if (config.idle.timeoutMs && config.idle.timeoutMs < 0) {
      throw new Error('idle.timeoutMs must be >= 0');
    }
  }
  
  return true;
}

/**
 * Register a project in the global registry
 * @param {string} domain - Project domain
 * @param {string} projectPath - Absolute path to project
 * @param {Object} config - Project configuration
 * @returns {boolean} Success status
 */
function registerProject(domain, projectPath, config) {
  validateNextiumDomain(domain);
  
  const registry = loadProjectsRegistry();
  
  registry.projects[domain] = {
    path: projectPath,
    config: config,
    registeredAt: new Date().toISOString()
  };
  
  return saveProjectsRegistry(registry);
}

/**
 * Unregister a project from the global registry
 * @param {string} domain - Project domain
 * @returns {boolean} Success status
 */
function unregisterProject(domain) {
  const registry = loadProjectsRegistry();
  
  if (!registry.projects[domain]) {
    return false;
  }
  
  delete registry.projects[domain];
  return saveProjectsRegistry(registry);
}

/**
 * Get a project from the registry
 * @param {string} domain - Project domain
 * @returns {Object|null} Project info or null if not found
 */
function getProject(domain) {
  const registry = loadProjectsRegistry();
  return registry.projects[domain] || null;
}

/**
 * Get all registered projects
 * @returns {Object} All projects keyed by domain
 */
function getAllProjects() {
  const registry = loadProjectsRegistry();
  return registry.projects || {};
}

/**
 * Check if a domain is already registered
 * @param {string} domain - Domain to check
 * @returns {boolean} True if domain is registered
 */
function isDomainRegistered(domain) {
  const registry = loadProjectsRegistry();
  return domain in registry.projects;
}

/**
 * Get package.json from a project
 * @param {string} projectPath - Path to project
 * @returns {Object|null} Package.json contents or null
 */
function getPackageJson(projectPath) {
  try {
    const packagePath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packagePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

/**
 * Detect the dev command for a project
 * @param {string} projectPath - Path to project
 * @returns {string} Dev command (defaults to 'npm run dev')
 */
function detectDevCommand(projectPath) {
  const pkg = getPackageJson(projectPath);
  
  if (!pkg || !pkg.scripts) {
    return 'npm run dev';
  }
  
  // Check for common dev script names
  if (pkg.scripts.dev) {
    return 'npm run dev';
  }
  if (pkg.scripts.start) {
    return 'npm start';
  }
  if (pkg.scripts.develop) {
    return 'npm run develop';
  }
  
  return 'npm run dev'; // Default
}

/**
 * Suggest a domain name based on directory name
 * @param {string} projectPath - Path to project
 * @returns {string} Suggested domain
 */
function suggestDomainName(projectPath) {
  const dirName = path.basename(projectPath);
  
  // Convert to lowercase and replace spaces/underscores with hyphens
  let domain = dirName
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Ensure it's not empty
  if (!domain) {
    domain = 'myproject';
  }
  
  return `${domain}.nextium`;
}

module.exports = {
  PROJECTS_REGISTRY,
  getDefaultProjectConfig,
  loadProjectsRegistry,
  saveProjectsRegistry,
  isNextJsProject,
  readProjectConfig,
  writeProjectConfig,
  validateProjectConfig,
  registerProject,
  unregisterProject,
  getProject,
  getAllProjects,
  isDomainRegistered,
  getPackageJson,
  detectDevCommand,
  suggestDomainName
};

