# Running Nextium as a System Service

This guide explains how to run `nextium` as a macOS system service that automatically starts on boot and keeps running in the background.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Service Management](#service-management)
- [Development Mode](#development-mode)
- [Real-time Config Reloading](#real-time-config-reloading)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Log Management](#log-management)
- [Updating the Service](#updating-the-service)

## Overview

When installed as a system service, nextium:

- ✓ Starts automatically on system boot
- ✓ Runs in the background (no terminal required)
- ✓ Automatically restarts if it crashes
- ✓ Reloads configuration automatically when you add/remove mappings
- ✓ Logs all activity to `/var/log/nextium/`
- ✓ Supports both HTTP (port 80) and HTTPS (port 443)

## Installation

### Prerequisites

- Node.js (v14 or later)
- Nextium installed globally: `npm install -g nextium`
- macOS (this guide is macOS-specific; Linux support via systemd coming soon)

### Install as System Service

```bash
sudo nextium service install
```

This command will:

1. Detect your Node.js and nextium installations
2. Create a launchd configuration file
3. Install it to `/Library/LaunchDaemons/`
4. Start the service immediately
5. Configure it to start automatically on boot

**Example output:**

```
nextium Service Installation
================================

Detecting Node.js installation...
✓ Node.js found at: /usr/local/bin/node
Detecting nextium installation...
✓ nextium found at: /usr/local/bin/nextium
✓ Working directory: /usr/local/lib/node_modules/nextium/bin
Creating log directory...
✓ Log directory created
Generating service configuration...
Installing service...
✓ Service configuration installed
Starting service...

✓ Service installed and started successfully!

The nextium proxy is now running system-wide on ports 80/443.
It will automatically start on system boot.
```

### Verify Installation

Check service status:

```bash
nextium service status
```

You should see:

```
System Service Status:

  Service Installed: ✓
  Service Running: ✓
  PID: 12345
  Mappings: 3

Useful commands:
  nextium service logs      - View service logs
  nextium service restart   - Restart service
  nextium list              - Show all mappings
```

## Service Management

### View Status

```bash
nextium service status
```

Shows whether the service is installed, running, PID, and number of mappings.

### Start Service

```bash
sudo nextium service start
```

Starts the service if it's not running. No effect if already running.

### Stop Service

```bash
sudo nextium service stop
```

Stops the service. **Note:** The service will not restart on boot until you explicitly start it again or reboot.

### Restart Service

```bash
sudo nextium service restart
```

Stops and starts the service. Useful after:

- Updating Node.js
- Manually editing configuration files
- Troubleshooting issues

### Reinstall Service

```bash
sudo nextium service reinstall
```

Uninstalls and reinstalls the service. Use this when:

- You've updated Nextium (`npm update -g nextium`)
- You've moved Node.js or nextium to a different location
- You've been developing nextium locally and want to use your changes

**Important for development:** When you exit `nextium dev` mode, you'll see a reminder to run this command to install your local changes.

### View Logs

```bash
# View recent logs (last 50 lines)
nextium service logs

# Follow logs in real-time
nextium service logs -f

# View only errors
nextium service logs --errors

# View more lines
nextium service logs -n 100
```

### Uninstall Service

```bash
sudo nextium service uninstall
```

Stops and removes the service. You'll be asked if you want to remove log files. Your configuration in `~/.nextium/` is preserved.

## Development Mode

Development mode is designed for contributing to or debugging nextium itself. It:

1. Stops the system service temporarily
2. Runs nextium with nodemon (auto-reload on file changes)
3. Restarts the system service when you exit

### Prerequisites

- Must run from the nextium source directory
- Requires nodemon: `npm install` in the project directory

### Start Development Mode

```bash
cd /path/to/nextium
sudo nextium dev
```

### What Happens

```
Development Mode
══════════════════════════════════════════════════

Starting proxy with auto-reload...
Edit files in src/ or bin/ to trigger reload
Press Ctrl+C to stop and restore service

✓ HTTP proxy server running on port 80
✓ HTTPS proxy server running on port 443
✓ Monitoring 5 domain(s)

[nodemon] watching: src/**/*.js bin/**/*.js
[nodemon] clean exit - waiting for changes...
```

### Making Changes

1. Edit any file in `src/` or `bin/`
2. Save the file
3. Nodemon automatically restarts the proxy
4. Test your changes immediately at `http://your-domain.nextium`

### Exiting Development Mode

Press **Ctrl+C**. You'll see:

```
Stopping development mode...
Restarting system service...
✓ Service restarted

To install your local changes to the system service:
  sudo nextium service reinstall
```

### Installing Your Changes

After testing in development mode:

```bash
sudo nextium service reinstall
```

This will install your local version to the system service.

## Real-time Config Reloading

The service automatically detects configuration changes **without requiring a restart**.

### How It Works

When you add or remove a domain mapping:

```bash
nextium create  # in your Next.js project directory
```

The service:

1. Detects the config file change
2. Reloads the configuration
3. Regenerates SSL certificates (if needed)
4. Starts proxying requests to the new domain
5. All within ~500ms, zero downtime

### What Gets Reloaded

- ✓ New domain mappings
- ✓ Removed domain mappings
- ✓ SSL certificates (auto-regenerated)

### What Requires a Restart

- Changes to proxy ports (HTTP/HTTPS)
- Changes to HTTPS enable/disable
- Updates to nextium code

For these changes, run: `sudo nextium service restart`

### Manual Reload

You can also force a reload by sending SIGHUP to the process:

```bash
sudo kill -HUP $(pgrep -f 'nextium.*start')
```

## Troubleshooting

### Service Won't Start

**Check if port 80 or 443 is already in use:**

```bash
sudo lsof -i :80
sudo lsof -i :443
```

If another service is using these ports, stop it first.

**Check logs for errors:**

```bash
cat /var/log/nextium/stderr.log
```

**Common issues:**

- **Node.js not found**: Service was installed with a different Node.js version. Run `sudo nextium service reinstall`.
- **Permission denied**: Make sure the service was installed with sudo.
- **mkcert issues**: If HTTPS isn't working, check `nextium cert-status`.

### Mappings Not Working

**Verify service is running:**

```bash
nextium service status
```

**Check mappings are configured:**

```bash
nextium list
```

**Verify hosts file entries:**

```bash
cat /etc/hosts | grep nextium
```

Each mapped domain should have an entry pointing to `127.0.0.1`.

**Flush DNS cache:**

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

### HTTPS Not Working

**Check mkcert status:**

```bash
nextium cert-status
```

**Regenerate certificates:**

```bash
nextium cert-regenerate
sudo nextium service restart
```

### High CPU Usage

Check rate limit logs:

```bash
nextium service logs --errors | grep "Rate limit"
```

The service has a built-in rate limiter (1000 requests/minute per domain). If you're hitting this limit frequently, it may indicate:

- A misbehaving client
- An infinite redirect loop
- A frontend polling too aggressively

### Service Keeps Crashing

**View crash logs:**

```bash
nextium service logs -n 200
```

**Check system logs:**

```bash
log show --predicate 'process == "node"' --last 10m
```

**Reinstall service:**

```bash
sudo nextium service reinstall
```

If crashes persist, please [file an issue](https://github.com/yourusername/nextium/issues) with logs.

## Security Considerations

### Root Privileges

The service runs as root because:

- Binding to ports 80 and 443 requires root access on macOS
- Modifying `/etc/hosts` requires root access

### Mitigation Strategies

1. **Localhost-only binding**: The proxy only listens on `127.0.0.1`, never on external interfaces
2. **No external network access**: The proxy only forwards to localhost ports
3. **Config validation**: Invalid domains and ports are rejected
4. **Rate limiting**: 1000 requests per minute per domain
5. **File permissions**: Config files should not be world-writable

### File Permissions

**Recommended permissions:**

```bash
# Service plist (managed automatically)
/Library/LaunchDaemons/com.nextium.plist: 644 (root:wheel)

# Configuration directory
~/.nextium/: 755 (your user)

# Configuration file
~/.nextium/config.json: 644 (your user)

# Log directory
/var/log/nextium/: 755 (root:wheel)
```

### Checking Config File Security

The service automatically warns if your config file is world-writable:

```
Warning: Config file is world-writable
Run: chmod 644 /Users/you/.nextium/config.json
```

### Attack Surface

**What's exposed:**

- HTTP proxy on 127.0.0.1:80
- HTTPS proxy on 127.0.0.1:443
- Config file: `~/.nextium/config.json`

**What's NOT exposed:**

- No external network interfaces
- No listening on 0.0.0.0
- No remote configuration
- No API endpoints

### Best Practices

1. **Review mappings regularly:** `nextium list`
2. **Keep dependencies updated:** `npm update -g nextium`
3. **Monitor logs:** `nextium service logs` for suspicious activity
4. **Limit config access:** `chmod 644 ~/.nextium/config.json`
5. **Use HTTPS:** Install mkcert for secure local development

## Log Management

### Log Locations

```
/var/log/nextium/stdout.log - Standard output (structured JSON logs)
/var/log/nextium/stderr.log - Error output
```

### Log Format

Logs are output as structured JSON for easy parsing:

```json
{"timestamp":"2025-11-15T10:23:45.123Z","level":"info","message":"HTTP GET myapp.nextium -> localhost:3000 /","protocol":"HTTP","method":"GET","hostname":"myapp.nextium","targetPort":3000,"url":"/"}
{"timestamp":"2025-11-15T10:23:46.456Z","level":"info","message":"Config reloaded - domains changed","oldCount":5,"newCount":6,"added":["newapp.nextium"],"removed":[]}
```

### Viewing Logs

**Recent activity:**

```bash
nextium service logs
```

**Follow in real-time:**

```bash
nextium service logs -f
```

**Filter by level using jq:**

```bash
tail -f /var/log/nextium/stdout.log | jq 'select(.level == "error")'
```

### Log Rotation

Logs are not automatically rotated. To prevent disk space issues, set up log rotation:

**Create `/etc/newsyslog.d/nextium.conf`:**

```
# logfilename                          [owner:group]  mode count size when  flags
/var/log/nextium/*.log    root:wheel     644  7     1024 *     J
```

This rotates logs daily, keeping 7 days of history, when they exceed 1MB.

**Or manually rotate:**

```bash
sudo mv /var/log/nextium/stdout.log /var/log/nextium/stdout.log.old
sudo mv /var/log/nextium/stderr.log /var/log/nextium/stderr.log.old
sudo nextium service restart
```

## Updating the Service

### Updating Nextium

```bash
# Update the package
npm update -g nextium

# Reinstall the service to use the new version
sudo nextium service reinstall
```

### Updating Node.js

If you update Node.js to a different version or location:

```bash
sudo nextium service reinstall
```

This will detect the new Node.js path and update the service configuration.

### Checking Current Version

```bash
nextium --version
```

### NPM Scripts

If you cloned the repository, you can use npm scripts:

```bash
# Install service
npm run service:install

# Check status
npm run service:status

# View logs
npm run service:logs

# Restart service
npm run service:restart

# Development mode
npm run dev
```

## Advanced Usage

### Custom Ports

If you can't use ports 80/443, you can run the proxy on different ports:

```bash
# Stop the service
sudo nextium service stop

# Run manually on custom ports
sudo nextium start -p 8080 --https-port 8443
```

Then access your domains with the port:

```
http://myapp.nextium:8080
https://myapp.nextium:8443
```

**Note:** This won't persist across reboots. For persistent custom ports, modify the config and reinstall the service.

### Running Without HTTPS

```bash
sudo nextium start --no-https
```

The service will only start the HTTP proxy on port 80.

### Multiple Instances

You cannot run multiple instances of the service simultaneously as they would conflict on ports 80 and 443.

However, you can:

- Run the service for daily use
- Stop it with `sudo nextium service stop`
- Run a custom instance manually
- Restart the service when done

## Getting Help

### Documentation

- Main README: `README.md`
- This Service Guide: `SERVICE.md`

### Checking Status

```bash
nextium service status
nextium status
nextium list
nextium cert-status
```

### Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. View logs: `nextium service logs`
3. Search [existing issues](https://github.com/yourusername/nextium/issues)
4. File a [new issue](https://github.com/yourusername/nextium/issues/new) with:
   - Output of `nextium service status`
   - Output of `nextium status`
   - Relevant logs from `nextium service logs`
   - Your Node.js version: `node --version`
   - Your macOS version: `sw_vers`

## Summary

**Installation:**

```bash
sudo nextium service install
```

**Daily usage:**

```bash
nextium create              # Setup a new Next.js project
nextium ps                  # View all projects
nextium list                  # View mappings
nextium service logs          # Check logs
```

**Development:**

```bash
cd nextium
sudo nextium dev
# Make changes, test, exit with Ctrl+C
sudo nextium service reinstall
```

**Troubleshooting:**

```bash
nextium service status
nextium service logs
sudo nextium service restart
```

The service is designed to be "set it and forget it" — install once, use forever.

