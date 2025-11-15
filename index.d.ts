/**
 * Type definitions for nextium
 */

/**
 * Configuration object structure
 */
export interface Config {
  mappings: Record<string, number>;
  proxyPort: number;
}

/**
 * Start the proxy server
 */
export function start(): Promise<void>;

/**
 * Start the proxy server on a specific port
 */
export function startProxyServer(port?: number): Promise<any>;

/**
 * Load configuration from disk
 */
export function loadConfig(): Config;

/**
 * Save configuration to disk
 */
export function saveConfig(config: Config): boolean;

/**
 * Add a new URL mapping
 */
export function addMapping(domain: string, port: number): boolean;

/**
 * Remove a URL mapping
 */
export function removeMapping(domain: string): boolean;

/**
 * Get all mappings
 */
export function getAllMappings(): Record<string, number>;

/**
 * Clear all mappings
 */
export function clearAllMappings(): boolean;

/**
 * Set the default proxy port
 */
export function setProxyPort(port: number): boolean;

/**
 * Get the current proxy port
 */
export function getProxyPort(): number;

/**
 * Read the system hosts file
 */
export function readHostsFile(): string;

/**
 * Write to the system hosts file
 */
export function writeHostsFile(content: string): boolean;

/**
 * Backup the hosts file
 */
export function backupHostsFile(): boolean;

/**
 * Remove nextium entries from hosts file
 */
export function removeFromHosts(): boolean;

/**
 * Add domains to hosts file
 */
export function addToHosts(domains: string[]): boolean;

/**
 * Update hosts file with current mappings
 */
export function updateHostsFile(mappings: Record<string, number>): boolean;

/**
 * Check if we have permissions to modify hosts file
 */
export function checkPermissions(): boolean;

/**
 * Path to the hosts file on the current system
 */
export const HOSTS_FILE: string;

/**
 * Path to the config directory
 */
export const CONFIG_DIR: string;

/**
 * Path to the config file
 */
export const CONFIG_FILE: string;

/**
 * Path to the hosts file backup
 */
export const HOSTS_BACKUP: string;

