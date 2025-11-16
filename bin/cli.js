#!/usr/bin/env node

const { program } = require("commander");
const chalk = require("chalk");
const inquirer = require("inquirer");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  addMapping,
  removeMapping,
  getAllMappings,
  clearAllMappings,
  setProxyPort,
  getProxyPort,
  getHttpPort,
  getHttpsPort,
  isHttpsEnabled,
} = require("../src/config");
const {
  updateHostsFile,
  removeFromHosts,
  checkPermissions,
  HOSTS_FILE,
} = require("../src/hosts");
const { startProxyServer } = require("../src/proxy");
const {
  isMkcertInstalled,
  getMkcertVersion,
  isMkcertCAInstalled,
  installMkcertCA,
  getMkcertInstallInstructions,
  generateCertificates,
  getCertificatePaths,
  ensureCertificates,
  deleteCertificates,
} = require("../src/certificates");
const {
  isNextJsProject,
  writeProjectConfig,
  getDefaultProjectConfig,
  registerProject,
  suggestDomainName,
  isDomainRegistered,
  getAllProjects,
  unregisterProject,
  getProject,
} = require("../src/project-config");
const {
  getAllProcesses,
  getProcessInfo,
  startDevServer,
  stopDevServer,
  restartDevServer,
} = require("../src/process-manager");

program
  .name("nextium")
  .description("Local serverless management for Next.js projects")
  .version("1.0.0");

/**
 * Create/setup a Next.js project with Nextium
 */
program
  .command("create")
  .description(
    "Setup a Next.js project with Nextium (run in project directory)"
  )
  .option(
    "--dev-flags <flags>",
    'Additional flags for dev command (comma-separated, e.g., "--turbo,--experimental-https")'
  )
  .action(async (cmdOptions) => {
    try {
      const projectPath = process.cwd();

      // Check if in a Next.js project
      if (!isNextJsProject(projectPath)) {
        console.log(chalk.red("✗ Not a Next.js project"));
        console.log(
          chalk.yellow(
            "This directory doesn't appear to contain a Next.js project."
          )
        );
        console.log(
          chalk.gray(
            'Make sure you have a package.json with "next" as a dependency.'
          )
        );
        process.exit(1);
      }

      console.log(chalk.green("✓ Detected Next.js project"));
      console.log("");

      // Suggest domain name
      const suggestedDomain = suggestDomainName(projectPath);

      // Prompt for domain name
      const { domain } = await inquirer.prompt([
        {
          type: "input",
          name: "domain",
          message: "What domain would you like to use?",
          default: suggestedDomain,
          validate: (input) => {
            if (!input || input.trim() === "") {
              return "Domain name is required";
            }
            if (!input.endsWith(".nextium.local")) {
              return "Domain must end with .nextium.local (e.g., myproject.nextium.local)";
            }
            if (isDomainRegistered(input)) {
              return `Domain ${input} is already registered`;
            }
            return true;
          },
        },
      ]);

      const finalDomain = domain.trim();

      // Create configuration
      const config = getDefaultProjectConfig(finalDomain);

      // Add dev flags if provided
      if (cmdOptions.devFlags) {
        const flags = cmdOptions.devFlags
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f);
        if (flags.length > 0) {
          config.devFlags = flags;
          console.log(chalk.gray(`Dev flags: ${flags.join(" ")}`));
        }
      }

      // Write nextium.config.js
      writeProjectConfig(projectPath, config);
      console.log(chalk.green("✓ Created nextium.config.js"));

      // Register project
      registerProject(finalDomain, projectPath, config);
      console.log(chalk.green("✓ Registered project"));

      // Update hosts file
      if (!checkPermissions()) {
        console.log(
          chalk.yellow("\n⚠ Need elevated permissions to update hosts file")
        );
        console.log(
          chalk.yellow(`Please run: ${chalk.bold("sudo nextium sync")}`)
        );
      } else {
        // Add domain to hosts via config
        addMapping(finalDomain, 0); // Port doesn't matter for Nextium projects
        const allMappings = getAllMappings();
        updateHostsFile(allMappings);
        console.log(chalk.green("✓ Updated hosts file"));

        // Generate SSL certificate
        if (isMkcertInstalled() && isMkcertCAInstalled()) {
          try {
            const domains = Object.keys(allMappings);
            const certResult = ensureCertificates(domains);

            if (certResult.success) {
              console.log(chalk.green("✓ Generated SSL certificate"));
            } else {
              console.log(
                chalk.yellow("⚠ Warning: Could not generate SSL certificate")
              );
              console.log(chalk.gray(`  ${certResult.message}`));
            }
          } catch (error) {
            console.log(
              chalk.yellow("⚠ Warning: Could not generate SSL certificate")
            );
            console.log(chalk.gray(`  ${error.message}`));
          }
        } else {
          console.log(
            chalk.yellow("⚠ mkcert not installed - HTTPS will not be available")
          );
          console.log(
            chalk.gray(
              `  Run ${chalk.bold("nextium cert-install")} for instructions`
            )
          );
        }
      }

      // Success message
      console.log("");
      console.log(chalk.bold.green("✓ Setup complete!"));
      console.log("");
      console.log("Your project is ready. Start the Nextium daemon with:");
      console.log(chalk.cyan(`  ${chalk.bold("sudo nextium start")}`));
      console.log("");
      console.log("Then access your project at:");
      console.log(chalk.cyan(`  ${chalk.bold(`https://${finalDomain}`)}`));
      console.log("");
      console.log(
        chalk.gray("The dev server will start automatically on first access!")
      );
      console.log("");
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * List all registered projects and their status
 */
program
  .command("ps")
  .description("List all registered projects and their status")
  .action(() => {
    const projects = getAllProjects();
    const processes = getAllProcesses();

    if (Object.keys(projects).length === 0) {
      console.log(chalk.yellow("No projects registered."));
      console.log(
        chalk.cyan(
          `\nRun ${chalk.bold(
            "nextium create"
          )} in a Next.js project to get started.`
        )
      );
      return;
    }

    console.log(chalk.bold("\nNextium Projects:\n"));

    Object.entries(projects).forEach(([domain, project]) => {
      const processInfo = processes[domain];

      let status;
      let details = "";

      if (processInfo) {
        if (processInfo.state === "running" || processInfo.state === "manual") {
          const mode = processInfo.mode === "manual" ? " (manual)" : "";
          status = chalk.green(`● RUNNING${mode}`);
          details = chalk.gray(
            ` on port ${processInfo.port}, PID ${processInfo.pid}`
          );

          // Calculate idle time
          const lastAccess = new Date(processInfo.lastAccess);
          const now = new Date();
          const idleSeconds = Math.floor((now - lastAccess) / 1000);
          if (idleSeconds > 60) {
            details += chalk.gray(`, idle ${Math.floor(idleSeconds / 60)}m`);
          } else {
            details += chalk.gray(`, active`);
          }
        } else if (processInfo.state === "starting") {
          status = chalk.yellow("◐ STARTING");
          details = chalk.gray(` on port ${processInfo.port}`);
        } else if (processInfo.state === "stopping") {
          status = chalk.yellow("◑ STOPPING");
        } else {
          status = chalk.gray("○ STOPPED");
        }
      } else {
        status = chalk.gray("○ STOPPED");
      }

      console.log(`  ${chalk.cyan(domain.padEnd(35))} ${status}${details}`);
      console.log(chalk.gray(`    ${project.path}`));
      console.log("");
    });
  });

/**
 * Stop a project
 */
program
  .command("stop")
  .description("Stop a running project")
  .argument("<domain>", "Project domain")
  .action(async (domain) => {
    try {
      const project = getProject(domain);
      if (!project) {
        console.log(chalk.red(`✗ Project ${domain} not found`));
        console.log(chalk.gray("Use nextium ps to see registered projects"));
        process.exit(1);
      }

      const processInfo = getProcessInfo(domain);
      if (!processInfo || processInfo.state === "stopped") {
        console.log(chalk.yellow(`Project ${domain} is not running`));
        return;
      }

      console.log(`Stopping ${domain}...`);
      await stopDevServer(domain);
      console.log(chalk.green(`✓ Stopped ${domain}`));
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Start a project
 */
program
  .command("start-project")
  .description("Start a project in background")
  .argument("<domain>", "Project domain")
  .option(
    "--dev-flags <flags>",
    'Override dev flags (comma-separated, e.g., "--turbo,--experimental-https")'
  )
  .action(async (domain, cmdOptions) => {
    try {
      const project = getProject(domain);
      if (!project) {
        console.log(chalk.red(`✗ Project ${domain} not found`));
        console.log(chalk.gray("Use nextium ps to see registered projects"));
        process.exit(1);
      }

      const processInfo = getProcessInfo(domain);
      if (processInfo && processInfo.state !== "stopped") {
        console.log(chalk.yellow(`Project ${domain} is already running`));
        return;
      }

      // Override dev flags if provided
      if (cmdOptions.devFlags) {
        const project = getProject(domain);
        const flags = cmdOptions.devFlags
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f);
        project.config.devFlags = flags;
      }

      console.log(`Starting ${domain}...`);
      const info = await startDevServer(domain);
      console.log(chalk.green(`✓ Started ${domain} on port ${info.port}`));
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Restart a project
 */
program
  .command("restart")
  .description("Restart a project")
  .argument("<domain>", "Project domain")
  .action(async (domain) => {
    try {
      const project = getProject(domain);
      if (!project) {
        console.log(chalk.red(`✗ Project ${domain} not found`));
        console.log(chalk.gray("Use nextium ps to see registered projects"));
        process.exit(1);
      }

      console.log(`Restarting ${domain}...`);
      const info = await restartDevServer(domain);
      console.log(chalk.green(`✓ Restarted ${domain} on port ${info.port}`));
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Remove/unregister a project
 */
program
  .command("remove")
  .alias("rm")
  .description("Remove a project from Nextium")
  .argument("<domain>", "Project domain")
  .action(async (domain) => {
    try {
      const project = getProject(domain);
      if (!project) {
        console.log(chalk.red(`✗ Project ${domain} not found`));
        process.exit(1);
      }

      // Stop if running
      const processInfo = getProcessInfo(domain);
      if (processInfo && processInfo.state !== "stopped") {
        console.log("Stopping project...");
        await stopDevServer(domain);
      }

      // Remove from registry
      unregisterProject(domain);

      // Remove from mappings
      removeMapping(domain);

      console.log(chalk.green(`✓ Removed ${domain}`));
      console.log(
        chalk.gray(
          "Note: nextium.config.js in the project directory was not deleted"
        )
      );
      console.log(chalk.yellow("\nRun sudo nextium sync to update hosts file"));
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * View logs for a project (placeholder - would need log file implementation)
 */
program
  .command("logs")
  .description("View logs for a project")
  .argument("<domain>", "Project domain")
  .option("-f, --follow", "Follow log output")
  .action((domain, options) => {
    const project = getProject(domain);
    if (!project) {
      console.log(chalk.red(`✗ Project ${domain} not found`));
      process.exit(1);
    }

    const processInfo = getProcessInfo(domain);
    if (!processInfo || processInfo.state === "stopped") {
      console.log(chalk.yellow(`Project ${domain} is not running`));
      console.log(chalk.gray("Start it with: nextium start-project " + domain));
      return;
    }

    console.log(chalk.cyan(`Logs for ${domain} (PID ${processInfo.pid}):`));
    console.log(
      chalk.gray("Note: Log viewing will be enhanced in future versions")
    );
    console.log(chalk.gray(`Project is running on port ${processInfo.port}`));
  });

/**
 * Run a project in manual mode with live log streaming
 */
program
  .command("dev")
  .description("Run project in foreground with live logs (manual mode)")
  .argument("<domain>", "Project domain")
  .option("--attach", "Attach to existing process without restarting")
  .option("--restart", "Force restart even if already running")
  .option(
    "--detach, -d",
    "Keep server running after exit (returns to managed mode)"
  )
  .option("--stop", "Stop server when exiting (default)")
  .option("--port <port>", "Override configured port")
  .option(
    "--dev-flags <flags>",
    'Override dev flags (comma-separated, e.g., "--turbo,--experimental-https")'
  )
  .option("--no-prompt", "Use defaults for all prompts")
  .action(async (domain, options) => {
    try {
      const project = getProject(domain);
      if (!project) {
        console.log(chalk.red(`✗ Project ${domain} not found`));
        console.log(chalk.gray("Use nextium ps to see registered projects"));
        process.exit(1);
      }

      let processInfo = getProcessInfo(domain);
      let shouldRestart = false;
      let exitBehavior = "stop"; // default

      // Handle existing process
      if (processInfo && processInfo.state !== "stopped") {
        if (options.noPrompt) {
          // Default: attach
          if (options.restart) {
            shouldRestart = true;
          }
        } else {
          const { action } = await inquirer.prompt([
            {
              type: "list",
              name: "action",
              message: `Process is already running in background (PID ${processInfo.pid}). What would you like to do?`,
              choices: [
                {
                  name: "Attach to existing process (stream logs)",
                  value: "attach",
                },
                { name: "Stop and restart in foreground", value: "restart" },
                { name: "Cancel", value: "cancel" },
              ],
              default: "attach",
            },
          ]);

          if (action === "cancel") {
            console.log(chalk.yellow("Cancelled."));
            return;
          }

          shouldRestart = action === "restart";
        }

        if (shouldRestart || options.restart) {
          console.log("Restarting...");
          await stopDevServer(domain);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          processInfo = null;
        }
      }

      // Ask about exit behavior
      if (!options.noPrompt && !options.detach && !options.stop) {
        const { exit } = await inquirer.prompt([
          {
            type: "list",
            name: "exit",
            message: "When you exit (Ctrl+C), should the server:",
            choices: [
              { name: "Stop completely", value: "stop" },
              { name: "Keep running in background", value: "detach" },
            ],
            default: "stop",
          },
        ]);
        exitBehavior = exit;
      } else if (options.detach) {
        exitBehavior = "detach";
      }

      // Override dev flags if provided
      if (options.devFlags) {
        const flags = options.devFlags
          .split(",")
          .map((f) => f.trim())
          .filter((f) => f);
        project.config.devFlags = flags;
      }

      // Start or attach to process
      if (!processInfo || processInfo.state === "stopped") {
        console.log(chalk.cyan(`Starting ${domain}...`));
        try {
          processInfo = await startDevServer(domain, {
            manual: true,
            streamLogs: true,
          });
        } catch (error) {
          console.error(chalk.red("Failed to start dev server:"));
          console.error(chalk.red(error.message));
          if (error.originalError) {
            console.error(
              chalk.gray(`Original error: ${error.originalError.message}`)
            );
          }
          process.exit(1);
        }
      }

      // Display info
      console.log("");
      console.log(chalk.bold("━".repeat(60)));
      console.log(chalk.bold(`  MANUAL MODE: ${domain}`));
      console.log(
        `  PID: ${processInfo.pid} | Port: ${processInfo.port} | Idle timeout: DISABLED`
      );
      console.log(
        `  Press Ctrl+C to ${exitBehavior === "stop" ? "stop" : "detach"}`
      );
      console.log(chalk.bold("━".repeat(60)));
      console.log("");

      // Handle Ctrl+C
      const cleanup = async () => {
        console.log("");
        console.log(chalk.cyan("\nExiting manual mode..."));

        if (exitBehavior === "stop") {
          await stopDevServer(domain);
          console.log(chalk.green(`✓ Stopped ${domain}`));
        } else {
          console.log(chalk.green(`✓ Detached from ${domain}`));
          console.log(chalk.gray("Server is still running in background"));
          console.log(chalk.gray(`View logs: nextium logs ${domain}`));
        }

        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      // Keep process alive
      await new Promise(() => {}); // Never resolves, waits for SIGINT
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Add a new mapping
 */
program
  .command("add")
  .description("Add a new domain to port mapping")
  .argument("[domain]", "Domain name (e.g., myapp.local)")
  .argument("[port]", "Port number (e.g., 3000)")
  .option("-y, --yes", "Skip confirmation")
  .action(async (domain, port, options) => {
    try {
      // Interactive mode if no arguments provided
      if (!domain || !port) {
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "domain",
            message: "Enter domain name (e.g., myapp.local):",
            default: domain,
            validate: (input) => {
              if (!input || input.trim() === "") {
                return "Domain name is required";
              }
              if (input.includes("://")) {
                return "Enter domain name only (without http:// or https://)";
              }
              return true;
            },
          },
          {
            type: "input",
            name: "port",
            message: "Enter port number:",
            default: port || "3000",
            validate: (input) => {
              const portNum = parseInt(input);
              if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return "Please enter a valid port number (1-65535)";
              }
              return true;
            },
          },
        ]);

        domain = answers.domain.trim();
        port = parseInt(answers.port);
      } else {
        port = parseInt(port);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.error(chalk.red("Error: Invalid port number"));
          process.exit(1);
        }
      }

      // Check for existing mapping
      const mappings = getAllMappings();
      if (mappings[domain] && !options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: `Domain ${domain} is already mapped to port ${mappings[domain]}. Override?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow("Cancelled."));
          return;
        }
      }

      // Add mapping
      addMapping(domain, port);
      console.log(
        chalk.green(`✓ Added mapping: ${domain} → localhost:${port}`)
      );

      // Update hosts file
      if (!checkPermissions()) {
        console.log(
          chalk.yellow(
            "\n⚠ Warning: Need elevated permissions to update hosts file."
          )
        );
        console.log(
          chalk.yellow(`Please run: ${chalk.bold("sudo nextium sync")}`)
        );
      } else {
        const allMappings = getAllMappings();
        updateHostsFile(allMappings);
        console.log(chalk.green("✓ Updated hosts file"));

        // Regenerate certificates if mkcert is installed
        if (isMkcertInstalled() && isMkcertCAInstalled()) {
          try {
            const domains = Object.keys(allMappings);
            const certResult = ensureCertificates(domains);

            if (certResult.success) {
              console.log(chalk.green("✓ SSL certificates updated"));
            }
          } catch (error) {
            console.log(
              chalk.yellow("⚠ Warning: Could not update SSL certificates")
            );
            console.log(chalk.gray(`  ${error.message}`));
          }
        }

        console.log(
          chalk.cyan(
            `\nRun ${chalk.bold("nextium start")} to start the proxy server.`
          )
        );
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Remove a mapping
 */
program
  .command("remove")
  .alias("rm")
  .description("Remove a domain mapping")
  .argument("[domain]", "Domain name to remove")
  .action(async (domain) => {
    try {
      const mappings = getAllMappings();

      if (Object.keys(mappings).length === 0) {
        console.log(chalk.yellow("No mappings configured."));
        return;
      }

      if (!domain) {
        const { selectedDomain } = await inquirer.prompt([
          {
            type: "list",
            name: "selectedDomain",
            message: "Select domain to remove:",
            choices: Object.keys(mappings),
          },
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
        console.log(chalk.green("✓ Updated hosts file"));

        // Regenerate certificates if mkcert is installed
        if (isMkcertInstalled() && isMkcertCAInstalled()) {
          try {
            const domains = Object.keys(allMappings);
            if (domains.length > 0) {
              const certResult = ensureCertificates(domains);

              if (certResult.success) {
                console.log(chalk.green("✓ SSL certificates updated"));
              }
            } else {
              // No domains left, delete certificates
              deleteCertificates();
              console.log(chalk.green("✓ SSL certificates removed"));
            }
          } catch (error) {
            console.log(
              chalk.yellow("⚠ Warning: Could not update SSL certificates")
            );
            console.log(chalk.gray(`  ${error.message}`));
          }
        }
      } else {
        console.log(
          chalk.yellow(
            "\n⚠ Warning: Need elevated permissions to update hosts file."
          )
        );
        console.log(
          chalk.yellow(`Please run: ${chalk.bold("sudo nextium sync")}`)
        );
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * List all mappings
 */
program
  .command("list")
  .alias("ls")
  .description("List all domain mappings")
  .action(() => {
    const mappings = getAllMappings();

    if (Object.keys(mappings).length === 0) {
      console.log(chalk.yellow("No mappings configured."));
      console.log(
        chalk.cyan(`\nUse ${chalk.bold("nextium add")} to add a mapping.`)
      );
      return;
    }

    console.log(chalk.bold("\nConfigured Mappings:\n"));
    Object.entries(mappings).forEach(([domain, port]) => {
      console.log(
        `  ${chalk.cyan(domain.padEnd(30))} → ${chalk.green(
          `localhost:${port}`
        )}`
      );
    });
    console.log("");
  });

/**
 * Clear all mappings
 */
program
  .command("clear")
  .description("Remove all domain mappings")
  .option("-y, --yes", "Skip confirmation")
  .action(async (options) => {
    try {
      const mappings = getAllMappings();

      if (Object.keys(mappings).length === 0) {
        console.log(chalk.yellow("No mappings to clear."));
        return;
      }

      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: `Remove all ${Object.keys(mappings).length} mapping(s)?`,
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow("Cancelled."));
          return;
        }
      }

      clearAllMappings();
      console.log(chalk.green("✓ Cleared all mappings"));

      // Update hosts file
      if (checkPermissions()) {
        removeFromHosts();
        console.log(chalk.green("✓ Cleaned up hosts file"));
      } else {
        console.log(
          chalk.yellow(
            "\n⚠ Warning: Need elevated permissions to clean up hosts file."
          )
        );
        console.log(
          chalk.yellow(`Please run: ${chalk.bold("sudo nextium sync")}`)
        );
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Start the proxy server
 */
program
  .command("start")
  .description("Start the proxy server")
  .option("-p, --port <port>", "HTTP port to run proxy on (default: 80)")
  .option("--https-port <port>", "HTTPS port to run proxy on (default: 443)")
  .option("--no-https", "Disable HTTPS")
  .action(async (options) => {
    try {
      const mappings = getAllMappings();
      const projects = getAllProjects();

      if (
        Object.keys(mappings).length === 0 &&
        Object.keys(projects).length === 0
      ) {
        console.log(chalk.yellow("No mappings or projects configured."));
        console.log(
          chalk.cyan(
            `Use ${chalk.bold(
              "nextium create"
            )} to setup a Next.js project, or ${chalk.bold(
              "nextium add"
            )} to add a mapping.`
          )
        );
        return;
      }

      const httpPort = options.port ? parseInt(options.port) : getHttpPort();
      const httpsPort = options.httpsPort
        ? parseInt(options.httpsPort)
        : getHttpsPort();
      const enableHttps = options.https !== false && isHttpsEnabled();

      if (httpPort < 1024 && process.getuid && process.getuid() !== 0) {
        console.log(
          chalk.yellow(
            `⚠ Warning: Port ${httpPort} requires elevated permissions.`
          )
        );
        console.log(chalk.yellow(`Run: ${chalk.bold(`sudo nextium start`)}`));
        console.log(
          chalk.cyan(
            `\nOr use a port >= 1024: ${chalk.bold("nextium start -p 8080")}`
          )
        );
        process.exit(1);
      }

      if (
        httpsPort < 1024 &&
        enableHttps &&
        process.getuid &&
        process.getuid() !== 0
      ) {
        console.log(
          chalk.yellow(
            `⚠ Warning: Port ${httpsPort} requires elevated permissions.`
          )
        );
        console.log(chalk.yellow(`Run: ${chalk.bold(`sudo nextium start`)}`));
        process.exit(1);
      }

      console.log(chalk.cyan("Starting nextium proxy server...\n"));

      // Check mkcert and certificates if HTTPS is enabled
      if (enableHttps) {
        const mkcertInstalled = isMkcertInstalled();

        if (!mkcertInstalled) {
          console.log(
            chalk.yellow(
              "⚠ mkcert is not installed - starting in HTTP-only mode"
            )
          );
          console.log(
            chalk.gray(
              `  Run ${chalk.bold(
                "nextium cert-install"
              )} for installation instructions\n`
            )
          );
        } else {
          const mkcertCAInstalled = isMkcertCAInstalled();

          if (!mkcertCAInstalled) {
            console.log(
              chalk.yellow(
                "⚠ mkcert CA is not installed - starting in HTTP-only mode"
              )
            );
            console.log(
              chalk.gray(
                `  Run ${chalk.bold(
                  "mkcert -install"
                )} to install the local CA\n`
              )
            );
          } else {
            // Ensure certificates are generated
            const domains = Object.keys(mappings);
            const certResult = ensureCertificates(domains);

            if (certResult.success) {
              console.log(chalk.green("✓ SSL certificates ready"));
            } else {
              console.log(
                chalk.yellow(
                  "⚠ Could not generate certificates - starting in HTTP-only mode"
                )
              );
              console.log(chalk.gray(`  ${certResult.message}\n`));
            }
          }
        }
      }

      await startProxyServer(httpPort, httpsPort, { enableHttps });

      console.log(chalk.cyan("Press Ctrl+C to stop.\n"));

      // Handle graceful shutdown
      process.on("SIGINT", () => {
        console.log(chalk.yellow("\n\nShutting down proxy server..."));
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Sync hosts file with current mappings and Nextium projects
 */
program
  .command("sync")
  .description(
    "Synchronize hosts file with current mappings and Nextium projects (requires sudo)"
  )
  .action(() => {
    try {
      if (!checkPermissions()) {
        console.log(
          chalk.red("Error: Need elevated permissions to modify hosts file.")
        );
        console.log(chalk.yellow(`Run: ${chalk.bold("sudo nextium sync")}`));
        process.exit(1);
      }

      // Get both static mappings and Nextium projects
      const mappings = getAllMappings();
      const projects = getAllProjects();

      // Combine all domains
      const allDomains = { ...mappings };
      Object.keys(projects).forEach((domain) => {
        // Add Nextium projects (port doesn't matter for Nextium projects)
        allDomains[domain] = 0;
      });

      updateHostsFile(allDomains);
      const totalCount = Object.keys(allDomains).length;
      const projectCount = Object.keys(projects).length;
      const mappingCount = Object.keys(mappings).length;

      console.log(
        chalk.green(`✓ Synced ${totalCount} domain(s) to hosts file`)
      );
      if (projectCount > 0) {
        console.log(
          chalk.gray(
            `  ${projectCount} Nextium project(s), ${mappingCount} static mapping(s)`
          )
        );
      }
      console.log(chalk.gray(`  (${HOSTS_FILE})`));
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Set proxy port
 */
program
  .command("port")
  .description("Set default proxy port")
  .argument("[port]", "Port number")
  .action(async (port) => {
    try {
      if (!port) {
        const answer = await inquirer.prompt([
          {
            type: "input",
            name: "port",
            message: "Enter proxy port:",
            default: getProxyPort().toString(),
            validate: (input) => {
              const portNum = parseInt(input);
              if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return "Please enter a valid port number (1-65535)";
              }
              return true;
            },
          },
        ]);
        port = answer.port;
      }

      const portNum = parseInt(port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        console.error(chalk.red("Error: Invalid port number"));
        process.exit(1);
      }

      setProxyPort(portNum);
      console.log(chalk.green(`✓ Set default proxy port to ${portNum}`));

      if (portNum < 1024) {
        console.log(
          chalk.yellow(
            `\n⚠ Note: Port ${portNum} requires elevated permissions (sudo)`
          )
        );
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Show status
 */
program
  .command("status")
  .description("Show current configuration status")
  .action(() => {
    const mappings = getAllMappings();
    const httpPort = getHttpPort();
    const httpsPort = getHttpsPort();
    const httpsEnabled = isHttpsEnabled();
    const hasPermissions = checkPermissions();
    const mkcertInstalled = isMkcertInstalled();
    const mkcertCAInstalled = isMkcertCAInstalled();
    const certs = getCertificatePaths();

    console.log(chalk.bold("\nPseudo-URL Status:\n"));
    console.log(`  HTTP Port: ${chalk.cyan(httpPort)}`);
    console.log(`  HTTPS Port: ${chalk.cyan(httpsPort)}`);
    console.log(
      `  HTTPS Enabled: ${httpsEnabled ? chalk.green("✓") : chalk.yellow("✗")}`
    );
    console.log(
      `  Hosts Permissions: ${
        hasPermissions ? chalk.green("✓") : chalk.red("✗")
      }`
    );
    console.log(
      `  mkcert Installed: ${
        mkcertInstalled ? chalk.green("✓") : chalk.yellow("✗")
      }`
    );
    if (mkcertInstalled) {
      console.log(
        `  mkcert CA Installed: ${
          mkcertCAInstalled ? chalk.green("✓") : chalk.yellow("✗")
        }`
      );
      console.log(
        `  Certificates Generated: ${
          certs ? chalk.green("✓") : chalk.yellow("✗")
        }`
      );
      if (certs) {
        console.log(
          `  Certificate Domains: ${chalk.cyan(certs.domains.join(", "))}`
        );
      }
    }
    console.log(`  Mappings: ${chalk.cyan(Object.keys(mappings).length)}\n`);

    if (Object.keys(mappings).length > 0) {
      console.log(chalk.bold("Configured Mappings:\n"));
      Object.entries(mappings).forEach(([domain, targetPort]) => {
        console.log(
          `  ${chalk.cyan(domain.padEnd(30))} → ${chalk.green(
            `localhost:${targetPort}`
          )}`
        );
      });
      console.log("");
    }

    if (!hasPermissions) {
      console.log(chalk.yellow("⚠ Run with sudo to modify hosts file"));
    }

    if (!mkcertInstalled) {
      console.log(
        chalk.yellow("⚠ mkcert not installed - HTTPS will not be available")
      );
      console.log(
        chalk.cyan(
          `  Run ${chalk.bold(
            "nextium cert-install"
          )} for installation instructions`
        )
      );
    } else if (!mkcertCAInstalled) {
      console.log(
        chalk.yellow("⚠ mkcert CA not installed - HTTPS will not work")
      );
      console.log(
        chalk.cyan(
          `  Run ${chalk.bold("mkcert -install")} to install the local CA`
        )
      );
    } else if (!certs && Object.keys(mappings).length > 0) {
      console.log(chalk.yellow("⚠ Certificates not generated"));
      console.log(
        chalk.cyan(
          `  Run ${chalk.bold(
            "nextium cert-regenerate"
          )} to generate certificates`
        )
      );
    }
  });

/**
 * Certificate status
 */
program
  .command("cert-status")
  .description("Check mkcert installation and certificate status")
  .action(() => {
    console.log(chalk.bold("\nCertificate Status:\n"));

    const mkcertInstalled = isMkcertInstalled();
    console.log(
      `  mkcert Installed: ${
        mkcertInstalled ? chalk.green("✓") : chalk.red("✗")
      }`
    );

    if (mkcertInstalled) {
      const version = getMkcertVersion();
      if (version) {
        console.log(`  Version: ${chalk.cyan(version)}`);
      }

      const caInstalled = isMkcertCAInstalled();
      console.log(
        `  Local CA Installed: ${
          caInstalled ? chalk.green("✓") : chalk.yellow("✗")
        }`
      );

      const certs = getCertificatePaths();
      console.log(
        `  Certificates Generated: ${
          certs ? chalk.green("✓") : chalk.yellow("✗")
        }`
      );

      if (certs) {
        console.log(`\n  Certificate Files:`);
        console.log(`    Cert: ${chalk.cyan(certs.cert)}`);
        console.log(`    Key: ${chalk.cyan(certs.key)}`);
        console.log(`    Domains: ${chalk.cyan(certs.domains.join(", "))}`);
      }

      console.log("");

      if (!caInstalled) {
        console.log(chalk.yellow("⚠ Local CA not installed. Run:"));
        console.log(chalk.cyan("  mkcert -install"));
        console.log("");
      } else if (!certs) {
        const mappings = getAllMappings();
        if (Object.keys(mappings).length > 0) {
          console.log(chalk.yellow("⚠ Certificates not generated. Run:"));
          console.log(chalk.cyan("  nextium cert-regenerate"));
          console.log("");
        } else {
          console.log(
            chalk.cyan(
              "Add domain mappings first, then certificates will be generated automatically."
            )
          );
          console.log("");
        }
      } else {
        console.log(chalk.green("✓ Everything is configured correctly!"));
        console.log("");
      }
    } else {
      console.log("");
      console.log(chalk.yellow("⚠ mkcert is not installed. Run:"));
      console.log(chalk.cyan("  nextium cert-install"));
      console.log("");
    }
  });

/**
 * Certificate installation instructions
 */
program
  .command("cert-install")
  .description("Show mkcert installation instructions")
  .action(() => {
    console.log(chalk.bold("\nmkcert Installation:\n"));

    if (isMkcertInstalled()) {
      console.log(chalk.green("✓ mkcert is already installed!"));
      const version = getMkcertVersion();
      if (version) {
        console.log(chalk.gray(`  ${version}`));
      }

      if (!isMkcertCAInstalled()) {
        console.log("");
        console.log(
          chalk.yellow("However, the local CA is not installed yet.")
        );
        console.log(
          chalk.cyan("\nRun the following command to install the local CA:")
        );
        console.log(chalk.bold("  mkcert -install"));
        console.log("");
        console.log(
          chalk.gray(
            "This will add mkcert's root certificate to your system trust store."
          )
        );
        console.log(chalk.gray("You may be prompted for your password."));
      } else {
        console.log(chalk.green("✓ Local CA is also installed!"));
        console.log("");
        console.log(
          chalk.cyan("You're all set! Run ") +
            chalk.bold("nextium start") +
            chalk.cyan(" to start the proxy with HTTPS.")
        );
      }
    } else {
      console.log(getMkcertInstallInstructions());
    }
    console.log("");
  });

/**
 * Regenerate certificates
 */
program
  .command("cert-regenerate")
  .description("Regenerate SSL certificates for all configured domains")
  .action(() => {
    try {
      if (!isMkcertInstalled()) {
        console.log(chalk.red("Error: mkcert is not installed."));
        console.log(
          chalk.cyan(
            `Run ${chalk.bold(
              "nextium cert-install"
            )} for installation instructions.`
          )
        );
        process.exit(1);
      }

      if (!isMkcertCAInstalled()) {
        console.log(chalk.red("Error: mkcert CA is not installed."));
        console.log(chalk.cyan("Run: ") + chalk.bold("mkcert -install"));
        process.exit(1);
      }

      const mappings = getAllMappings();
      const domains = Object.keys(mappings);

      if (domains.length === 0) {
        console.log(chalk.yellow("No domains configured."));
        console.log(
          chalk.cyan(`Use ${chalk.bold("nextium add")} to add a domain first.`)
        );
        return;
      }

      console.log(
        chalk.cyan(`Generating certificates for ${domains.length} domain(s)...`)
      );
      console.log(chalk.gray(`  ${domains.join(", ")}\n`));

      const result = generateCertificates(domains);

      console.log(chalk.green("✓ Certificates generated successfully!"));
      console.log(chalk.gray(`  Cert: ${result.cert}`));
      console.log(chalk.gray(`  Key: ${result.key}`));
      console.log("");
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Delete certificates
 */
program
  .command("cert-delete")
  .description("Delete generated SSL certificates")
  .action(async () => {
    try {
      const certs = getCertificatePaths();

      if (!certs) {
        console.log(chalk.yellow("No certificates to delete."));
        return;
      }

      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "Delete SSL certificates?",
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow("Cancelled."));
        return;
      }

      if (deleteCertificates()) {
        console.log(chalk.green("✓ Certificates deleted."));
      } else {
        console.log(chalk.red("Failed to delete certificates."));
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

/**
 * Service management commands
 */
const serviceCommand = program
  .command("service")
  .description("Manage nextium as a system service");

/**
 * Helper function to check if service is installed
 */
function isServiceInstalled() {
  return fs.existsSync("/Library/LaunchDaemons/com.nextium.plist");
}

/**
 * Helper function to check if service is running
 */
function isServiceRunning() {
  try {
    execSync("launchctl print system/com.nextium", { stdio: "pipe" });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get service information
 */
function getServiceInfo() {
  try {
    const output = execSync("launchctl print system/com.nextium", {
      encoding: "utf8",
      stdio: "pipe",
    });

    const pidMatch = output.match(/pid = (\d+)/);
    const stateMatch = output.match(/state = ([^\n]+)/);

    return {
      running: true,
      pid: pidMatch ? pidMatch[1] : null,
      state: stateMatch ? stateMatch[1] : null,
    };
  } catch (error) {
    return {
      running: false,
      pid: null,
      state: null,
    };
  }
}

/**
 * Service install command
 */
serviceCommand
  .command("install")
  .description("Install nextium as a system service")
  .action(() => {
    try {
      if (isServiceInstalled()) {
        console.log(chalk.yellow("Service is already installed."));
        console.log(
          chalk.cyan("Use ") +
            chalk.bold("nextium service reinstall") +
            chalk.cyan(" to reinstall.")
        );
        return;
      }

      // Find install script
      const scriptPath = path.join(__dirname, "..", "install-service.sh");

      if (!fs.existsSync(scriptPath)) {
        console.log(chalk.red("Error: Installation script not found."));
        console.log(chalk.gray(`Expected at: ${scriptPath}`));
        process.exit(1);
      }

      console.log(chalk.cyan("Running installation script..."));
      console.log(chalk.gray("You may be prompted for your password.\n"));

      execSync(`bash "${scriptPath}"`, { stdio: "inherit" });
    } catch (error) {
      console.error(chalk.red("Installation failed:"), error.message);
      process.exit(1);
    }
  });

/**
 * Service uninstall command
 */
serviceCommand
  .command("uninstall")
  .description("Uninstall the system service")
  .action(() => {
    try {
      if (!isServiceInstalled()) {
        console.log(chalk.yellow("Service is not installed."));
        return;
      }

      // Find uninstall script
      const scriptPath = path.join(__dirname, "..", "uninstall-service.sh");

      if (!fs.existsSync(scriptPath)) {
        console.log(chalk.red("Error: Uninstallation script not found."));
        console.log(chalk.gray(`Expected at: ${scriptPath}`));
        process.exit(1);
      }

      console.log(chalk.cyan("Running uninstallation script..."));
      console.log(chalk.gray("You may be prompted for your password.\n"));

      execSync(`bash "${scriptPath}"`, { stdio: "inherit" });
    } catch (error) {
      console.error(chalk.red("Uninstallation failed:"), error.message);
      process.exit(1);
    }
  });

/**
 * Service status command
 */
serviceCommand
  .command("status")
  .description("Check service status")
  .action(() => {
    console.log(chalk.bold("\nSystem Service Status:\n"));

    const installed = isServiceInstalled();
    console.log(
      `  Service Installed: ${installed ? chalk.green("✓") : chalk.red("✗")}`
    );

    if (!installed) {
      console.log("");
      console.log(chalk.cyan("Install the service with:"));
      console.log(chalk.bold("  sudo nextium service install"));
      console.log("");
      return;
    }

    const info = getServiceInfo();
    console.log(
      `  Service Running: ${info.running ? chalk.green("✓") : chalk.red("✗")}`
    );

    if (info.running) {
      if (info.pid) {
        console.log(`  PID: ${chalk.cyan(info.pid)}`);
      }

      const mappings = getAllMappings();
      console.log(`  Mappings: ${chalk.cyan(Object.keys(mappings).length)}`);

      console.log("");
      console.log("Useful commands:");
      console.log("  nextium service logs      - View service logs");
      console.log("  nextium service restart   - Restart service");
      console.log("  nextium list              - Show all mappings");
    } else {
      console.log("");
      console.log(chalk.yellow("Service is installed but not running."));
      console.log(chalk.cyan("Start it with:"));
      console.log(chalk.bold("  sudo nextium service start"));
    }

    console.log("");
  });

/**
 * Service start command
 */
serviceCommand
  .command("start")
  .description("Start the system service")
  .action(() => {
    try {
      if (!isServiceInstalled()) {
        console.log(chalk.red("Error: Service is not installed."));
        console.log(chalk.cyan("Install it first with:"));
        console.log(chalk.bold("  sudo nextium service install"));
        process.exit(1);
      }

      if (isServiceRunning()) {
        console.log(chalk.yellow("Service is already running."));
        console.log(
          chalk.cyan("Use ") +
            chalk.bold("nextium service restart") +
            chalk.cyan(" to restart it.")
        );
        return;
      }

      console.log("Starting service...");
      execSync(
        "launchctl bootstrap system /Library/LaunchDaemons/com.nextium.plist",
        { stdio: "pipe" }
      );

      // Wait a moment
      setTimeout(() => {
        if (isServiceRunning()) {
          console.log(chalk.green("✓ Service started successfully"));
          console.log("");
          console.log("View logs: " + chalk.bold("nextium service logs"));
        } else {
          console.log(chalk.red("✗ Service failed to start"));
          console.log("Check logs: cat /var/log/nextium/stderr.log");
        }
      }, 1000);
    } catch (error) {
      console.error(chalk.red("Failed to start service:"), error.message);
      process.exit(1);
    }
  });

/**
 * Service stop command
 */
serviceCommand
  .command("stop")
  .description("Stop the system service")
  .action(() => {
    try {
      if (!isServiceInstalled()) {
        console.log(chalk.yellow("Service is not installed."));
        return;
      }

      if (!isServiceRunning()) {
        console.log(chalk.yellow("Service is not running."));
        return;
      }

      console.log("Stopping service...");
      execSync("launchctl bootout system/com.nextium", { stdio: "pipe" });
      console.log(chalk.green("✓ Service stopped"));
      console.log("");
      console.log(
        chalk.gray("Note: Service will not restart on boot until you run:")
      );
      console.log(chalk.bold("  sudo nextium service start"));
      console.log("");
    } catch (error) {
      console.error(chalk.red("Failed to stop service:"), error.message);
      process.exit(1);
    }
  });

/**
 * Service restart command
 */
serviceCommand
  .command("restart")
  .description("Restart the system service")
  .action(() => {
    try {
      if (!isServiceInstalled()) {
        console.log(chalk.red("Error: Service is not installed."));
        console.log(chalk.cyan("Install it first with:"));
        console.log(chalk.bold("  sudo nextium service install"));
        process.exit(1);
      }

      console.log("Restarting service...");

      // Stop if running
      if (isServiceRunning()) {
        execSync("launchctl bootout system/com.nextium", { stdio: "pipe" });
        console.log(chalk.gray("✓ Service stopped"));
      }

      // Start
      execSync(
        "launchctl bootstrap system /Library/LaunchDaemons/com.nextium.plist",
        { stdio: "pipe" }
      );

      // Wait and verify
      setTimeout(() => {
        if (isServiceRunning()) {
          console.log(chalk.green("✓ Service restarted successfully"));
        } else {
          console.log(chalk.red("✗ Service failed to restart"));
          console.log("Check logs: cat /var/log/nextium/stderr.log");
        }
      }, 1000);
    } catch (error) {
      console.error(chalk.red("Failed to restart service:"), error.message);
      process.exit(1);
    }
  });

/**
 * Service reinstall command
 */
serviceCommand
  .command("reinstall")
  .description("Reinstall the system service (useful after updates)")
  .action(() => {
    try {
      console.log(chalk.cyan("Reinstalling service..."));
      console.log("");

      // Uninstall if installed
      if (isServiceInstalled()) {
        const uninstallScript = path.join(
          __dirname,
          "..",
          "uninstall-service.sh"
        );
        if (fs.existsSync(uninstallScript)) {
          console.log("Uninstalling current service...");
          // Run uninstall non-interactively
          execSync(`bash "${uninstallScript}" <<< "n"`, { stdio: "pipe" });
          console.log(chalk.green("✓ Uninstalled"));
          console.log("");
        }
      }

      // Install
      const installScript = path.join(__dirname, "..", "install-service.sh");
      if (!fs.existsSync(installScript)) {
        console.log(chalk.red("Error: Installation script not found."));
        process.exit(1);
      }

      console.log("Installing service...");
      execSync(`bash "${installScript}"`, { stdio: "inherit" });
    } catch (error) {
      console.error(chalk.red("Reinstallation failed:"), error.message);
      process.exit(1);
    }
  });

/**
 * Service logs command
 */
serviceCommand
  .command("logs")
  .description("View service logs")
  .option("-f, --follow", "Follow log output")
  .option("-e, --errors", "Show only errors")
  .option("-n, --lines <number>", "Number of lines to show", "50")
  .action((options) => {
    const logDir = "/var/log/nextium";

    if (!fs.existsSync(logDir)) {
      console.log(chalk.yellow("No logs found. Service may not be installed."));
      return;
    }

    const stdoutLog = path.join(logDir, "stdout.log");
    const stderrLog = path.join(logDir, "stderr.log");

    try {
      if (options.follow) {
        console.log(chalk.cyan("Following logs (Ctrl+C to stop)...\n"));
        if (options.errors) {
          spawn("tail", ["-f", stderrLog], { stdio: "inherit" });
        } else {
          spawn("tail", ["-f", stdoutLog, stderrLog], { stdio: "inherit" });
        }
      } else {
        const lines = parseInt(options.lines);

        if (options.errors && fs.existsSync(stderrLog)) {
          console.log(chalk.bold("Error Log:\n"));
          const output = execSync(`tail -n ${lines} "${stderrLog}"`, {
            encoding: "utf8",
          });
          console.log(output);
        } else {
          if (fs.existsSync(stdoutLog)) {
            console.log(chalk.bold("Standard Output:\n"));
            const output = execSync(`tail -n ${lines} "${stdoutLog}"`, {
              encoding: "utf8",
            });
            console.log(output);
          }

          if (fs.existsSync(stderrLog)) {
            const stderr = fs.readFileSync(stderrLog, "utf8");
            if (stderr.trim()) {
              console.log(chalk.bold("\nError Log:\n"));
              const output = execSync(`tail -n ${lines} "${stderrLog}"`, {
                encoding: "utf8",
              });
              console.log(output);
            }
          }
        }

        console.log("");
        console.log(chalk.gray("Log files:"));
        console.log(chalk.gray(`  ${stdoutLog}`));
        console.log(chalk.gray(`  ${stderrLog}`));
        console.log("");
        console.log(chalk.gray("Use -f to follow logs in real-time"));
      }
    } catch (error) {
      console.error(chalk.red("Error reading logs:"), error.message);
      process.exit(1);
    }
  });

/**
 * Development mode command
 */
program
  .command("dev")
  .description(
    "Run in development mode with auto-reload (stops system service)"
  )
  .action(async () => {
    try {
      // Check if we're in a directory with bin/cli.js
      const localCli = path.join(process.cwd(), "bin", "cli.js");
      if (!fs.existsSync(localCli)) {
        console.log(chalk.red("Error: Must run from nextium directory"));
        console.log(
          chalk.gray("Development mode requires local source files.")
        );
        process.exit(1);
      }

      // Check if nodemon is available
      try {
        execSync("which nodemon", { stdio: "pipe" });
      } catch (error) {
        console.log(chalk.red("Error: nodemon not found"));
        console.log(chalk.cyan("Install it with: npm install"));
        process.exit(1);
      }

      // Check if service is running
      const serviceWasRunning = isServiceRunning();

      if (serviceWasRunning) {
        console.log(chalk.cyan("Stopping system service..."));
        try {
          execSync("launchctl bootout system/com.nextium", { stdio: "pipe" });
          console.log(chalk.green("✓ Service stopped"));
        } catch (error) {
          console.log(
            chalk.yellow("Warning: Could not stop service (may not be running)")
          );
        }
      }

      console.log("");
      console.log(chalk.bold("Development Mode"));
      console.log("━".repeat(50));
      console.log("");
      console.log(chalk.cyan("Starting proxy with auto-reload..."));
      console.log(chalk.gray("Edit files in src/ or bin/ to trigger reload"));
      console.log(chalk.gray("Press Ctrl+C to stop and restore service"));
      console.log("");

      // Setup cleanup handler
      const cleanup = () => {
        console.log("");
        console.log(chalk.cyan("Stopping development mode..."));

        if (serviceWasRunning) {
          console.log(chalk.cyan("Restarting system service..."));
          try {
            execSync(
              "launchctl bootstrap system /Library/LaunchDaemons/com.nextium.plist",
              { stdio: "pipe" }
            );
            console.log(chalk.green("✓ Service restarted"));
          } catch (error) {
            console.log(chalk.red("✗ Failed to restart service"));
            console.log(
              chalk.yellow("Manually restart with: sudo nextium service start")
            );
          }
        }

        console.log("");
        console.log(
          chalk.bold("To install your local changes to the system service:")
        );
        console.log(chalk.cyan("  sudo nextium service reinstall"));
        console.log("");

        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      // Run nodemon
      const nodemon = spawn("npx", ["nodemon", "--config", "nodemon.json"], {
        stdio: "inherit",
        env: process.env,
      });

      nodemon.on("exit", cleanup);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program.parse();
