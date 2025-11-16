const fs = require('fs');
const os = require('os');
const { HOSTS_BACKUP } = require('./config');

const HOSTS_FILE = os.platform() === 'win32' 
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts';

const MARKER_START = '# nextium START';
const MARKER_END = '# nextium END';

/**
 * Read the hosts file
 */
function readHostsFile() {
  try {
    return fs.readFileSync(HOSTS_FILE, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read hosts file: ${error.message}. Try running with sudo.`);
  }
}

/**
 * Write to the hosts file
 */
function writeHostsFile(content) {
  try {
    fs.writeFileSync(HOSTS_FILE, content, 'utf8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write hosts file: ${error.message}. Try running with sudo.`);
  }
}

/**
 * Backup the hosts file
 */
function backupHostsFile() {
  try {
    const content = readHostsFile();
    fs.writeFileSync(HOSTS_BACKUP, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to backup hosts file:', error.message);
    return false;
  }
}

/**
 * Remove pseudo-url entries from hosts file
 */
function removeFromHosts() {
  try {
    let content = readHostsFile();
    
    const startIndex = content.indexOf(MARKER_START);
    const endIndex = content.indexOf(MARKER_END);
    
    if (startIndex !== -1 && endIndex !== -1) {
      // Remove everything between markers (inclusive)
      content = content.substring(0, startIndex) + content.substring(endIndex + MARKER_END.length);
      // Clean up extra newlines
      content = content.replace(/\n{3,}/g, '\n\n').trim() + '\n';
      writeHostsFile(content);
    }
    
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Add domains to hosts file
 */
function addToHosts(domains) {
  try {
    // Backup first
    backupHostsFile();
    
    // Remove old entries
    removeFromHosts();
    
    if (domains.length === 0) {
      return true;
    }
    
    let content = readHostsFile();
    
    // Ensure file ends with newline
    if (!content.endsWith('\n')) {
      content += '\n';
    }
    
    // Add our entries
    content += '\n' + MARKER_START + '\n';
    
    // Add wildcard entry for .nextium.local domains
    // All domains should be .nextium.local (validated elsewhere)
    if (domains.length > 0) {
      content += `127.0.0.1 *.nextium.local\n`;
    }
    
    content += MARKER_END + '\n';
    
    writeHostsFile(content);
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Update hosts file with current mappings
 */
function updateHostsFile(mappings) {
  const domains = Object.keys(mappings);
  return addToHosts(domains);
}

/**
 * Check if we have permissions to modify hosts file
 */
function checkPermissions() {
  try {
    const content = readHostsFile();
    // Try to write it back (this won't change anything)
    fs.accessSync(HOSTS_FILE, fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  HOSTS_FILE,
  readHostsFile,
  writeHostsFile,
  backupHostsFile,
  removeFromHosts,
  addToHosts,
  updateHostsFile,
  checkPermissions
};

