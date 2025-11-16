const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { CONFIG_DIR } = require('./config');

const CERTS_DIR = path.join(CONFIG_DIR, 'certs');
const CERT_FILE = path.join(CERTS_DIR, 'cert.pem');
const KEY_FILE = path.join(CERTS_DIR, 'key.pem');
const DOMAINS_FILE = path.join(CERTS_DIR, 'domains.json');

/**
 * Ensure certificates directory exists
 */
function ensureCertsDir() {
  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
  }
}

/**
 * Check if mkcert is installed
 */
function isMkcertInstalled() {
  try {
    execSync('which mkcert', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get mkcert version
 */
function getMkcertVersion() {
  try {
    const version = execSync('mkcert -version', { stdio: 'pipe', encoding: 'utf8' });
    return version.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Check if mkcert CA is installed
 */
function isMkcertCAInstalled() {
  try {
    // Check if CAROOT directory exists and contains CA files
    const caRoot = execSync('mkcert -CAROOT', { stdio: 'pipe', encoding: 'utf8' }).trim();
    const rootCAExists = fs.existsSync(path.join(caRoot, 'rootCA.pem'));
    const rootCAKeyExists = fs.existsSync(path.join(caRoot, 'rootCA-key.pem'));
    return rootCAExists && rootCAKeyExists;
  } catch (error) {
    return false;
  }
}

/**
 * Install mkcert CA
 */
function installMkcertCA() {
  try {
    execSync('mkcert -install', { stdio: 'inherit' });
    return true;
  } catch (error) {
    throw new Error(`Failed to install mkcert CA: ${error.message}`);
  }
}

/**
 * Get installation instructions for mkcert
 */
function getMkcertInstallInstructions() {
  const platform = process.platform;
  
  if (platform === 'darwin') {
    return [
      'Install mkcert using Homebrew:',
      '  brew install mkcert',
      '  brew install nss  # for Firefox support',
      '',
      'Then install the local CA:',
      '  mkcert -install'
    ].join('\n');
  } else if (platform === 'linux') {
    return [
      'Install mkcert:',
      '',
      'On Arch Linux:',
      '  sudo pacman -S mkcert',
      '',
      'On Ubuntu/Debian:',
      '  sudo apt install libnss3-tools',
      '  curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"',
      '  chmod +x mkcert-v*-linux-amd64',
      '  sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert',
      '',
      'Then install the local CA:',
      '  mkcert -install'
    ].join('\n');
  } else if (platform === 'win32') {
    return [
      'Install mkcert using Chocolatey:',
      '  choco install mkcert',
      '',
      'Or using Scoop:',
      '  scoop bucket add extras',
      '  scoop install mkcert',
      '',
      'Then install the local CA:',
      '  mkcert -install'
    ].join('\n');
  }
  
  return 'Please visit https://github.com/FiloSottile/mkcert for installation instructions.';
}

/**
 * Load saved domains from disk
 */
function loadSavedDomains() {
  if (!fs.existsSync(DOMAINS_FILE)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(DOMAINS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

/**
 * Save domains to disk
 */
function saveDomains(domains) {
  ensureCertsDir();
  fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2));
}

/**
 * Check if certificates exist and are valid for the given domains
 * All domains should be .nextium.local and certificates should include *.nextium.local wildcard
 */
function certificatesExist(domains) {
  if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
    return false;
  }
  
  // Check if domains match what we generated for
  const savedDomains = loadSavedDomains();
  const savedSet = new Set(savedDomains);
  
  // Certificates should always include *.nextium.local wildcard
  if (!savedSet.has('*.nextium.local')) {
    return false;
  }
  
  // All domains should be .nextium.local (validated elsewhere)
  // With wildcard, we don't need to check individual .nextium.local domains
  // Just verify that the certificate was generated with wildcard
  return true;
}

/**
 * Generate certificates for the given domains
 * Automatically includes *.nextium.local wildcard if any .nextium.local domains exist
 */
function generateCertificates(domains) {
  if (!isMkcertInstalled()) {
    throw new Error('mkcert is not installed');
  }
  
  if (!isMkcertCAInstalled()) {
    throw new Error('mkcert CA is not installed. Run: mkcert -install');
  }
  
  if (domains.length === 0) {
    throw new Error('No domains provided');
  }
  
  ensureCertsDir();
  
  try {
    // Check if any domains end with .nextium.local
    const hasNextiumLocal = domains.some(domain => domain.endsWith('.nextium.local'));
    
    // Build certificate domains list - include wildcard if we have .nextium.local domains
    const certDomains = [...domains];
    if (hasNextiumLocal && !certDomains.includes('*.nextium.local')) {
      certDomains.push('*.nextium.local');
    }
    
    // Build mkcert command
    const certPath = CERT_FILE;
    const keyPath = KEY_FILE;
    
    // Remove old certificates if they exist
    if (fs.existsSync(certPath)) {
      fs.unlinkSync(certPath);
    }
    if (fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath);
    }
    
    // Generate new certificates
    const domainsArgs = certDomains.join(' ');
    const command = `mkcert -cert-file "${certPath}" -key-file "${keyPath}" ${domainsArgs}`;
    
    execSync(command, { stdio: 'pipe' });
    
    // Save the domains list (including wildcard if added)
    saveDomains(certDomains);
    
    return {
      cert: certPath,
      key: keyPath,
      domains: certDomains
    };
  } catch (error) {
    throw new Error(`Failed to generate certificates: ${error.message}`);
  }
}

/**
 * Get certificate paths if they exist
 */
function getCertificatePaths() {
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    return {
      cert: CERT_FILE,
      key: KEY_FILE,
      domains: loadSavedDomains()
    };
  }
  return null;
}

/**
 * Load certificate and key contents
 */
function loadCertificates() {
  if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
    return null;
  }
  
  try {
    return {
      cert: fs.readFileSync(CERT_FILE, 'utf8'),
      key: fs.readFileSync(KEY_FILE, 'utf8'),
      domains: loadSavedDomains()
    };
  } catch (error) {
    return null;
  }
}

/**
 * Ensure certificates are generated and up-to-date for the given domains
 * Automatically includes *.nextium.local wildcard if any .nextium.local domains exist
 */
function ensureCertificates(domains) {
  if (!isMkcertInstalled()) {
    return {
      success: false,
      error: 'mkcert_not_installed',
      message: 'mkcert is not installed'
    };
  }
  
  if (!isMkcertCAInstalled()) {
    return {
      success: false,
      error: 'mkcert_ca_not_installed',
      message: 'mkcert CA is not installed'
    };
  }
  
  if (domains.length === 0) {
    return {
      success: false,
      error: 'no_domains',
      message: 'No domains configured'
    };
  }
  
  try {
    // Check if certificates exist for these domains (wildcard handling is in certificatesExist)
    if (!certificatesExist(domains)) {
      // generateCertificates will automatically add wildcard if needed
      generateCertificates(domains);
    }
    
    return {
      success: true,
      paths: getCertificatePaths()
    };
  } catch (error) {
    return {
      success: false,
      error: 'generation_failed',
      message: error.message
    };
  }
}

/**
 * Delete all generated certificates
 */
function deleteCertificates() {
  try {
    if (fs.existsSync(CERT_FILE)) {
      fs.unlinkSync(CERT_FILE);
    }
    if (fs.existsSync(KEY_FILE)) {
      fs.unlinkSync(KEY_FILE);
    }
    if (fs.existsSync(DOMAINS_FILE)) {
      fs.unlinkSync(DOMAINS_FILE);
    }
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  CERTS_DIR,
  CERT_FILE,
  KEY_FILE,
  isMkcertInstalled,
  getMkcertVersion,
  isMkcertCAInstalled,
  installMkcertCA,
  getMkcertInstallInstructions,
  certificatesExist,
  generateCertificates,
  getCertificatePaths,
  loadCertificates,
  ensureCertificates,
  deleteCertificates
};

