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
  getProxyPort
} = require('../src/config');
const { updateHostsFile, removeFromHosts, checkPermissions, HOSTS_FILE } = require('../src/hosts');
const { startProxyServer } = require('../src/proxy');

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
  .option('-p, --port <port>', 'Port to run proxy on (default: 80)')
  .action(async (options) => {
    try {
      const mappings = getAllMappings();
      
      if (Object.keys(mappings).length === 0) {
        console.log(chalk.yellow('No mappings configured.'));
        console.log(chalk.cyan(`Use ${chalk.bold('pseudo-url add')} to add a mapping first.`));
        return;
      }
      
      const port = options.port ? parseInt(options.port) : getProxyPort();
      
      if (port < 1024 && process.getuid && process.getuid() !== 0) {
        console.log(chalk.yellow(`⚠ Warning: Port ${port} requires elevated permissions.`));
        console.log(chalk.yellow(`Run: ${chalk.bold(`sudo pseudo-url start`)}`));
        console.log(chalk.cyan(`\nOr use a port >= 1024: ${chalk.bold('pseudo-url start -p 8080')}`));
        process.exit(1);
      }
      
      if (options.port) {
        setProxyPort(port);
      }
      
      console.log(chalk.cyan('Starting pseudo-url proxy server...\n'));
      await startProxyServer(port);
      
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
    const port = getProxyPort();
    const hasPermissions = checkPermissions();
    
    console.log(chalk.bold('\nPseudo-URL Status:\n'));
    console.log(`  Proxy Port: ${chalk.cyan(port)}`);
    console.log(`  Hosts Permissions: ${hasPermissions ? chalk.green('✓') : chalk.red('✗')}`);
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
  });

program.parse();

