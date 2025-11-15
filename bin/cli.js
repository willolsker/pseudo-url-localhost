#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const {
  addMapping,
  removeMapping,
  getAllMappings,
  clearAllMappings,
  setProxyPort,
  getProxyPort,
  getHttpPort,
  getHttpsPort,
  isHttpsEnabled
} = require('../src/config');
const { updateHostsFile, removeFromHosts, checkPermissions, HOSTS_FILE } = require('../src/hosts');
const { startProxyServer } = require('../src/proxy');
const {
  isMkcertInstalled,
  getMkcertVersion,
  isMkcertCAInstalled,
  installMkcertCA,
  getMkcertInstallInstructions,
  generateCertificates,
  getCertificatePaths,
  ensureCertificates,
  deleteCertificates
} = require('../src/certificates');

program
  .name('pseudo-url')
  .description('Map custom pseudo-URLs to your localhost development servers')
  .version('1.0.0');

/**
 * Add a new mapping
 */
program
  .command('add')
  .description('Add a new domain to port mapping')
  .argument('[domain]', 'Domain name (e.g., myapp.local)')
  .argument('[port]', 'Port number (e.g., 3000)')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (domain, port, options) => {
    try {
      // Interactive mode if no arguments provided
      if (!domain || !port) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'domain',
            message: 'Enter domain name (e.g., myapp.local):',
            default: domain,
            validate: (input) => {
              if (!input || input.trim() === '') {
                return 'Domain name is required';
              }
              if (input.includes('://')) {
                return 'Enter domain name only (without http:// or https://)';
              }
              return true;
            }
          },
          {
            type: 'input',
            name: 'port',
            message: 'Enter port number:',
            default: port || '3000',
            validate: (input) => {
              const portNum = parseInt(input);
              if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return 'Please enter a valid port number (1-65535)';
              }
              return true;
            }
          }
        ]);
        
        domain = answers.domain.trim();
        port = parseInt(answers.port);
      } else {
        port = parseInt(port);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.error(chalk.red('Error: Invalid port number'));
          process.exit(1);
        }
      }
      
      // Check for existing mapping
      const mappings = getAllMappings();
      if (mappings[domain] && !options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Domain ${domain} is already mapped to port ${mappings[domain]}. Override?`,
            default: false
          }
        ]);
        
        if (!confirm) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }
      
      // Add mapping
      addMapping(domain, port);
      console.log(chalk.green(`✓ Added mapping: ${domain} → localhost:${port}`));
      
      // Update hosts file
      if (!checkPermissions()) {
        console.log(chalk.yellow('\n⚠ Warning: Need elevated permissions to update hosts file.'));
        console.log(chalk.yellow(`Please run: ${chalk.bold('sudo pseudo-url sync')}`));
      } else {
        const allMappings = getAllMappings();
        updateHostsFile(allMappings);
        console.log(chalk.green('✓ Updated hosts file'));
        
        // Regenerate certificates if mkcert is installed
        if (isMkcertInstalled() && isMkcertCAInstalled()) {
          try {
            const domains = Object.keys(allMappings);
            const certResult = ensureCertificates(domains);
            
            if (certResult.success) {
              console.log(chalk.green('✓ SSL certificates updated'));
            }
          } catch (error) {
            console.log(chalk.yellow('⚠ Warning: Could not update SSL certificates'));
            console.log(chalk.gray(`  ${error.message}`));
          }
        }
        
        console.log(chalk.cyan(`\nRun ${chalk.bold('pseudo-url start')} to start the proxy server.`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Remove a mapping
 */
program
  .command('remove')
  .alias('rm')
  .description('Remove a domain mapping')
  .argument('[domain]', 'Domain name to remove')
  .action(async (domain) => {
    try {
      const mappings = getAllMappings();
      
      if (Object.keys(mappings).length === 0) {
        console.log(chalk.yellow('No mappings configured.'));
        return;
      }
      
      if (!domain) {
        const { selectedDomain } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedDomain',
            message: 'Select domain to remove:',
            choices: Object.keys(mappings)
          }
        ]);
        domain = selectedDomain;
      }
      
      if (!mappings[domain]) {
        console.log(chalk.yellow(`Domain ${domain} not found in mappings.`));
        return;
      }
      
      removeMapping(domain);
      console.log(chalk.green(`✓ Removed mapping: ${domain}`));
      
      // Update hosts file
      if (checkPermissions()) {
        const allMappings = getAllMappings();
        updateHostsFile(allMappings);
        console.log(chalk.green('✓ Updated hosts file'));
        
        // Regenerate certificates if mkcert is installed
        if (isMkcertInstalled() && isMkcertCAInstalled()) {
          try {
            const domains = Object.keys(allMappings);
            if (domains.length > 0) {
              const certResult = ensureCertificates(domains);
              
              if (certResult.success) {
                console.log(chalk.green('✓ SSL certificates updated'));
              }
            } else {
              // No domains left, delete certificates
              deleteCertificates();
              console.log(chalk.green('✓ SSL certificates removed'));
            }
          } catch (error) {
            console.log(chalk.yellow('⚠ Warning: Could not update SSL certificates'));
            console.log(chalk.gray(`  ${error.message}`));
          }
        }
      } else {
        console.log(chalk.yellow('\n⚠ Warning: Need elevated permissions to update hosts file.'));
        console.log(chalk.yellow(`Please run: ${chalk.bold('sudo pseudo-url sync')}`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * List all mappings
 */
program
  .command('list')
  .alias('ls')
  .description('List all domain mappings')
  .action(() => {
    const mappings = getAllMappings();
    
    if (Object.keys(mappings).length === 0) {
      console.log(chalk.yellow('No mappings configured.'));
      console.log(chalk.cyan(`\nUse ${chalk.bold('pseudo-url add')} to add a mapping.`));
      return;
    }
    
    console.log(chalk.bold('\nConfigured Mappings:\n'));
    Object.entries(mappings).forEach(([domain, port]) => {
      console.log(`  ${chalk.cyan(domain.padEnd(30))} → ${chalk.green(`localhost:${port}`)}`);
    });
    console.log('');
  });

/**
 * Clear all mappings
 */
program
  .command('clear')
  .description('Remove all domain mappings')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (options) => {
    try {
      const mappings = getAllMappings();
      
      if (Object.keys(mappings).length === 0) {
        console.log(chalk.yellow('No mappings to clear.'));
        return;
      }
      
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Remove all ${Object.keys(mappings).length} mapping(s)?`,
            default: false
          }
        ]);
        
        if (!confirm) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }
      
      clearAllMappings();
      console.log(chalk.green('✓ Cleared all mappings'));
      
      // Update hosts file
      if (checkPermissions()) {
        removeFromHosts();
        console.log(chalk.green('✓ Cleaned up hosts file'));
      } else {
        console.log(chalk.yellow('\n⚠ Warning: Need elevated permissions to clean up hosts file.'));
        console.log(chalk.yellow(`Please run: ${chalk.bold('sudo pseudo-url sync')}`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Start the proxy server
 */
program
  .command('start')
  .description('Start the proxy server')
  .option('-p, --port <port>', 'HTTP port to run proxy on (default: 80)')
  .option('--https-port <port>', 'HTTPS port to run proxy on (default: 443)')
  .option('--no-https', 'Disable HTTPS')
  .action(async (options) => {
    try {
      const mappings = getAllMappings();
      
      if (Object.keys(mappings).length === 0) {
        console.log(chalk.yellow('No mappings configured.'));
        console.log(chalk.cyan(`Use ${chalk.bold('pseudo-url add')} to add a mapping first.`));
        return;
      }
      
      const httpPort = options.port ? parseInt(options.port) : getHttpPort();
      const httpsPort = options.httpsPort ? parseInt(options.httpsPort) : getHttpsPort();
      const enableHttps = options.https !== false && isHttpsEnabled();
      
      if (httpPort < 1024 && process.getuid && process.getuid() !== 0) {
        console.log(chalk.yellow(`⚠ Warning: Port ${httpPort} requires elevated permissions.`));
        console.log(chalk.yellow(`Run: ${chalk.bold(`sudo pseudo-url start`)}`));
        console.log(chalk.cyan(`\nOr use a port >= 1024: ${chalk.bold('pseudo-url start -p 8080')}`));
        process.exit(1);
      }
      
      if (httpsPort < 1024 && enableHttps && process.getuid && process.getuid() !== 0) {
        console.log(chalk.yellow(`⚠ Warning: Port ${httpsPort} requires elevated permissions.`));
        console.log(chalk.yellow(`Run: ${chalk.bold(`sudo pseudo-url start`)}`));
        process.exit(1);
      }
      
      console.log(chalk.cyan('Starting pseudo-url proxy server...\n'));
      
      // Check mkcert and certificates if HTTPS is enabled
      if (enableHttps) {
        const mkcertInstalled = isMkcertInstalled();
        
        if (!mkcertInstalled) {
          console.log(chalk.yellow('⚠ mkcert is not installed - starting in HTTP-only mode'));
          console.log(chalk.gray(`  Run ${chalk.bold('pseudo-url cert-install')} for installation instructions\n`));
        } else {
          const mkcertCAInstalled = isMkcertCAInstalled();
          
          if (!mkcertCAInstalled) {
            console.log(chalk.yellow('⚠ mkcert CA is not installed - starting in HTTP-only mode'));
            console.log(chalk.gray(`  Run ${chalk.bold('mkcert -install')} to install the local CA\n`));
          } else {
            // Ensure certificates are generated
            const domains = Object.keys(mappings);
            const certResult = ensureCertificates(domains);
            
            if (certResult.success) {
              console.log(chalk.green('✓ SSL certificates ready'));
            } else {
              console.log(chalk.yellow('⚠ Could not generate certificates - starting in HTTP-only mode'));
              console.log(chalk.gray(`  ${certResult.message}\n`));
            }
          }
        }
      }
      
      await startProxyServer(httpPort, httpsPort, { enableHttps });
      
      console.log(chalk.cyan('Press Ctrl+C to stop.\n'));
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nShutting down proxy server...'));
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Sync hosts file with current mappings
 */
program
  .command('sync')
  .description('Synchronize hosts file with current mappings (requires sudo)')
  .action(() => {
    try {
      if (!checkPermissions()) {
        console.log(chalk.red('Error: Need elevated permissions to modify hosts file.'));
        console.log(chalk.yellow(`Run: ${chalk.bold('sudo pseudo-url sync')}`));
        process.exit(1);
      }
      
      const mappings = getAllMappings();
      updateHostsFile(mappings);
      console.log(chalk.green(`✓ Synced ${Object.keys(mappings).length} domain(s) to hosts file`));
      console.log(chalk.gray(`  (${HOSTS_FILE})`));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Set proxy port
 */
program
  .command('port')
  .description('Set default proxy port')
  .argument('[port]', 'Port number')
  .action(async (port) => {
    try {
      if (!port) {
        const answer = await inquirer.prompt([
          {
            type: 'input',
            name: 'port',
            message: 'Enter proxy port:',
            default: getProxyPort().toString(),
            validate: (input) => {
              const portNum = parseInt(input);
              if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return 'Please enter a valid port number (1-65535)';
              }
              return true;
            }
          }
        ]);
        port = answer.port;
      }
      
      const portNum = parseInt(port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        console.error(chalk.red('Error: Invalid port number'));
        process.exit(1);
      }
      
      setProxyPort(portNum);
      console.log(chalk.green(`✓ Set default proxy port to ${portNum}`));
      
      if (portNum < 1024) {
        console.log(chalk.yellow(`\n⚠ Note: Port ${portNum} requires elevated permissions (sudo)`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Show status
 */
program
  .command('status')
  .description('Show current configuration status')
  .action(() => {
    const mappings = getAllMappings();
    const httpPort = getHttpPort();
    const httpsPort = getHttpsPort();
    const httpsEnabled = isHttpsEnabled();
    const hasPermissions = checkPermissions();
    const mkcertInstalled = isMkcertInstalled();
    const mkcertCAInstalled = isMkcertCAInstalled();
    const certs = getCertificatePaths();
    
    console.log(chalk.bold('\nPseudo-URL Status:\n'));
    console.log(`  HTTP Port: ${chalk.cyan(httpPort)}`);
    console.log(`  HTTPS Port: ${chalk.cyan(httpsPort)}`);
    console.log(`  HTTPS Enabled: ${httpsEnabled ? chalk.green('✓') : chalk.yellow('✗')}`);
    console.log(`  Hosts Permissions: ${hasPermissions ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  mkcert Installed: ${mkcertInstalled ? chalk.green('✓') : chalk.yellow('✗')}`);
    if (mkcertInstalled) {
      console.log(`  mkcert CA Installed: ${mkcertCAInstalled ? chalk.green('✓') : chalk.yellow('✗')}`);
      console.log(`  Certificates Generated: ${certs ? chalk.green('✓') : chalk.yellow('✗')}`);
      if (certs) {
        console.log(`  Certificate Domains: ${chalk.cyan(certs.domains.join(', '))}`);
      }
    }
    console.log(`  Mappings: ${chalk.cyan(Object.keys(mappings).length)}\n`);
    
    if (Object.keys(mappings).length > 0) {
      console.log(chalk.bold('Configured Mappings:\n'));
      Object.entries(mappings).forEach(([domain, targetPort]) => {
        console.log(`  ${chalk.cyan(domain.padEnd(30))} → ${chalk.green(`localhost:${targetPort}`)}`);
      });
      console.log('');
    }
    
    if (!hasPermissions) {
      console.log(chalk.yellow('⚠ Run with sudo to modify hosts file'));
    }
    
    if (!mkcertInstalled) {
      console.log(chalk.yellow('⚠ mkcert not installed - HTTPS will not be available'));
      console.log(chalk.cyan(`  Run ${chalk.bold('pseudo-url cert-install')} for installation instructions`));
    } else if (!mkcertCAInstalled) {
      console.log(chalk.yellow('⚠ mkcert CA not installed - HTTPS will not work'));
      console.log(chalk.cyan(`  Run ${chalk.bold('mkcert -install')} to install the local CA`));
    } else if (!certs && Object.keys(mappings).length > 0) {
      console.log(chalk.yellow('⚠ Certificates not generated'));
      console.log(chalk.cyan(`  Run ${chalk.bold('pseudo-url cert-regenerate')} to generate certificates`));
    }
  });

/**
 * Certificate status
 */
program
  .command('cert-status')
  .description('Check mkcert installation and certificate status')
  .action(() => {
    console.log(chalk.bold('\nCertificate Status:\n'));
    
    const mkcertInstalled = isMkcertInstalled();
    console.log(`  mkcert Installed: ${mkcertInstalled ? chalk.green('✓') : chalk.red('✗')}`);
    
    if (mkcertInstalled) {
      const version = getMkcertVersion();
      if (version) {
        console.log(`  Version: ${chalk.cyan(version)}`);
      }
      
      const caInstalled = isMkcertCAInstalled();
      console.log(`  Local CA Installed: ${caInstalled ? chalk.green('✓') : chalk.yellow('✗')}`);
      
      const certs = getCertificatePaths();
      console.log(`  Certificates Generated: ${certs ? chalk.green('✓') : chalk.yellow('✗')}`);
      
      if (certs) {
        console.log(`\n  Certificate Files:`);
        console.log(`    Cert: ${chalk.cyan(certs.cert)}`);
        console.log(`    Key: ${chalk.cyan(certs.key)}`);
        console.log(`    Domains: ${chalk.cyan(certs.domains.join(', '))}`);
      }
      
      console.log('');
      
      if (!caInstalled) {
        console.log(chalk.yellow('⚠ Local CA not installed. Run:'));
        console.log(chalk.cyan('  mkcert -install'));
        console.log('');
      } else if (!certs) {
        const mappings = getAllMappings();
        if (Object.keys(mappings).length > 0) {
          console.log(chalk.yellow('⚠ Certificates not generated. Run:'));
          console.log(chalk.cyan('  pseudo-url cert-regenerate'));
          console.log('');
        } else {
          console.log(chalk.cyan('Add domain mappings first, then certificates will be generated automatically.'));
          console.log('');
        }
      } else {
        console.log(chalk.green('✓ Everything is configured correctly!'));
        console.log('');
      }
    } else {
      console.log('');
      console.log(chalk.yellow('⚠ mkcert is not installed. Run:'));
      console.log(chalk.cyan('  pseudo-url cert-install'));
      console.log('');
    }
  });

/**
 * Certificate installation instructions
 */
program
  .command('cert-install')
  .description('Show mkcert installation instructions')
  .action(() => {
    console.log(chalk.bold('\nmkcert Installation:\n'));
    
    if (isMkcertInstalled()) {
      console.log(chalk.green('✓ mkcert is already installed!'));
      const version = getMkcertVersion();
      if (version) {
        console.log(chalk.gray(`  ${version}`));
      }
      
      if (!isMkcertCAInstalled()) {
        console.log('');
        console.log(chalk.yellow('However, the local CA is not installed yet.'));
        console.log(chalk.cyan('\nRun the following command to install the local CA:'));
        console.log(chalk.bold('  mkcert -install'));
        console.log('');
        console.log(chalk.gray('This will add mkcert\'s root certificate to your system trust store.'));
        console.log(chalk.gray('You may be prompted for your password.'));
      } else {
        console.log(chalk.green('✓ Local CA is also installed!'));
        console.log('');
        console.log(chalk.cyan('You\'re all set! Run ') + chalk.bold('pseudo-url start') + chalk.cyan(' to start the proxy with HTTPS.'));
      }
    } else {
      console.log(getMkcertInstallInstructions());
    }
    console.log('');
  });

/**
 * Regenerate certificates
 */
program
  .command('cert-regenerate')
  .description('Regenerate SSL certificates for all configured domains')
  .action(() => {
    try {
      if (!isMkcertInstalled()) {
        console.log(chalk.red('Error: mkcert is not installed.'));
        console.log(chalk.cyan(`Run ${chalk.bold('pseudo-url cert-install')} for installation instructions.`));
        process.exit(1);
      }
      
      if (!isMkcertCAInstalled()) {
        console.log(chalk.red('Error: mkcert CA is not installed.'));
        console.log(chalk.cyan('Run: ') + chalk.bold('mkcert -install'));
        process.exit(1);
      }
      
      const mappings = getAllMappings();
      const domains = Object.keys(mappings);
      
      if (domains.length === 0) {
        console.log(chalk.yellow('No domains configured.'));
        console.log(chalk.cyan(`Use ${chalk.bold('pseudo-url add')} to add a domain first.`));
        return;
      }
      
      console.log(chalk.cyan(`Generating certificates for ${domains.length} domain(s)...`));
      console.log(chalk.gray(`  ${domains.join(', ')}\n`));
      
      const result = generateCertificates(domains);
      
      console.log(chalk.green('✓ Certificates generated successfully!'));
      console.log(chalk.gray(`  Cert: ${result.cert}`));
      console.log(chalk.gray(`  Key: ${result.key}`));
      console.log('');
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

/**
 * Delete certificates
 */
program
  .command('cert-delete')
  .description('Delete generated SSL certificates')
  .action(async () => {
    try {
      const certs = getCertificatePaths();
      
      if (!certs) {
        console.log(chalk.yellow('No certificates to delete.'));
        return;
      }
      
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Delete SSL certificates?',
          default: false
        }
      ]);
      
      if (!confirm) {
        console.log(chalk.yellow('Cancelled.'));
        return;
      }
      
      if (deleteCertificates()) {
        console.log(chalk.green('✓ Certificates deleted.'));
      } else {
        console.log(chalk.red('Failed to delete certificates.'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();

