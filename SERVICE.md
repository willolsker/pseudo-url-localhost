# Running pseudo-url as a System Service

This guide explains how to run `pseudo-url-localhost` as a macOS system service that automatically starts on boot and keeps running in the background.

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

When installed as a system service, pseudo-url:

- ✓ Starts automatically on system boot
- ✓ Runs in the background (no terminal required)
- ✓ Automatically restarts if it crashes
- ✓ Reloads configuration automatically when you add/remove mappings
- ✓ Logs all activity to `/var/log/pseudo-url-localhost/`
- ✓ Supports both HTTP (port 80) and HTTPS (port 443)

## Installation

### Prerequisites

- Node.js (v14 or later)
- pseudo-url-localhost installed globally: `npm install -g pseudo-url-localhost`
- macOS (this guide is macOS-specific; Linux support via systemd coming soon)

### Install as System Service

```bash
sudo pseudo-url service install
```

This command will:

1. Detect your Node.js and pseudo-url installations
2. Create a launchd configuration file
3. Install it to `/Library/LaunchDaemons/`
4. Start the service immediately
5. Configure it to start automatically on boot

**Example output:**

```
pseudo-url Service Installation
================================

Detecting Node.js installation...
✓ Node.js found at: /usr/local/bin/node
Detecting pseudo-url installation...
✓ pseudo-url found at: /usr/local/bin/pseudo-url
✓ Working directory: /usr/local/lib/node_modules/pseudo-url-localhost/bin
Creating log directory...
✓ Log directory created
Generating service configuration...
Installing service...
✓ Service configuration installed
Starting service...

✓ Service installed and started successfully!

The pseudo-url proxy is now running system-wide on ports 80/443.
It will automatically start on system boot.
```

### Verify Installation

Check service status:

```bash
pseudo-url service status
```

You should see:

```
System Service Status:

  Service Installed: ✓
  Service Running: ✓
  PID: 12345
  Mappings: 3

Useful commands:
  pseudo-url service logs      - View service logs
  pseudo-url service restart   - Restart service
  pseudo-url list              - Show all mappings
```

## Service Management

### View Status

```bash
pseudo-url service status
```

Shows whether the service is installed, running, PID, and number of mappings.

### Start Service

```bash
sudo pseudo-url service start
```

Starts the service if it's not running. No effect if already running.

### Stop Service

```bash
sudo pseudo-url service stop
```

Stops the service. **Note:** The service will not restart on boot until you explicitly start it again or reboot.

### Restart Service

```bash
sudo pseudo-url service restart
```

Stops and starts the service. Useful after:

- Updating Node.js
- Manually editing configuration files
- Troubleshooting issues

### Reinstall Service

```bash
sudo pseudo-url service reinstall
```

Uninstalls and reinstalls the service. Use this when:

- You've updated pseudo-url-localhost (`npm update -g pseudo-url-localhost`)
- You've moved Node.js or pseudo-url to a different location
- You've been developing pseudo-url locally and want to use your changes

**Important for development:** When you exit `pseudo-url dev` mode, you'll see a reminder to run this command to install your local changes.

### View Logs

```bash
# View recent logs (last 50 lines)
pseudo-url service logs

# Follow logs in real-time
pseudo-url service logs -f

# View only errors
pseudo-url service logs --errors

# View more lines
pseudo-url service logs -n 100
```

### Uninstall Service

```bash
sudo pseudo-url service uninstall
```

Stops and removes the service. You'll be asked if you want to remove log files. Your configuration in `~/.pseudo-url/` is preserved.

## Development Mode

Development mode is designed for contributing to or debugging pseudo-url itself. It:

1. Stops the system service temporarily
2. Runs pseudo-url with nodemon (auto-reload on file changes)
3. Restarts the system service when you exit

### Prerequisites

- Must run from the pseudo-url-localhost source directory
- Requires nodemon: `npm install` in the project directory

### Start Development Mode

```bash
cd /path/to/pseudo-url-localhost
sudo pseudo-url dev
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
4. Test your changes immediately at `http://your-domain.local`

### Exiting Development Mode

Press **Ctrl+C**. You'll see:

```
Stopping development mode...
Restarting system service...
✓ Service restarted

To install your local changes to the system service:
  sudo pseudo-url service reinstall
```

### Installing Your Changes

After testing in development mode:

```bash
sudo pseudo-url service reinstall
```

This will install your local version to the system service.

## Real-time Config Reloading

The service automatically detects configuration changes **without requiring a restart**.

### How It Works

When you add or remove a domain mapping:

```bash
pseudo-url add newapp.local 4000
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
- Updates to pseudo-url code

For these changes, run: `sudo pseudo-url service restart`

### Manual Reload

You can also force a reload by sending SIGHUP to the process:

```bash
sudo kill -HUP $(pgrep -f 'pseudo-url.*start')
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
cat /var/log/pseudo-url-localhost/stderr.log
```

**Common issues:**

- **Node.js not found**: Service was installed with a different Node.js version. Run `sudo pseudo-url service reinstall`.
- **Permission denied**: Make sure the service was installed with sudo.
- **mkcert issues**: If HTTPS isn't working, check `pseudo-url cert-status`.

### Mappings Not Working

**Verify service is running:**

```bash
pseudo-url service status
```

**Check mappings are configured:**

```bash
pseudo-url list
```

**Verify hosts file entries:**

```bash
cat /etc/hosts | grep pseudo-url
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
pseudo-url cert-status
```

**Regenerate certificates:**

```bash
pseudo-url cert-regenerate
sudo pseudo-url service restart
```

### High CPU Usage

Check rate limit logs:

```bash
pseudo-url service logs --errors | grep "Rate limit"
```

The service has a built-in rate limiter (1000 requests/minute per domain). If you're hitting this limit frequently, it may indicate:

- A misbehaving client
- An infinite redirect loop
- A frontend polling too aggressively

### Service Keeps Crashing

**View crash logs:**

```bash
pseudo-url service logs -n 200
```

**Check system logs:**

```bash
log show --predicate 'process == "node"' --last 10m
```

**Reinstall service:**

```bash
sudo pseudo-url service reinstall
```

If crashes persist, please [file an issue](https://github.com/yourusername/pseudo-url-localhost/issues) with logs.

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
/Library/LaunchDaemons/com.pseudo-url-localhost.plist: 644 (root:wheel)

# Configuration directory
~/.pseudo-url/: 755 (your user)

# Configuration file
~/.pseudo-url/config.json: 644 (your user)

# Log directory
/var/log/pseudo-url-localhost/: 755 (root:wheel)
```

### Checking Config File Security

The service automatically warns if your config file is world-writable:

```
Warning: Config file is world-writable
Run: chmod 644 /Users/you/.pseudo-url/config.json
```

### Attack Surface

**What's exposed:**

- HTTP proxy on 127.0.0.1:80
- HTTPS proxy on 127.0.0.1:443
- Config file: `~/.pseudo-url/config.json`

**What's NOT exposed:**

- No external network interfaces
- No listening on 0.0.0.0
- No remote configuration
- No API endpoints

### Best Practices

1. **Review mappings regularly:** `pseudo-url list`
2. **Keep dependencies updated:** `npm update -g pseudo-url-localhost`
3. **Monitor logs:** `pseudo-url service logs` for suspicious activity
4. **Limit config access:** `chmod 644 ~/.pseudo-url/config.json`
5. **Use HTTPS:** Install mkcert for secure local development

## Log Management

### Log Locations

```
/var/log/pseudo-url-localhost/stdout.log - Standard output (structured JSON logs)
/var/log/pseudo-url-localhost/stderr.log - Error output
```

### Log Format

Logs are output as structured JSON for easy parsing:

```json
{"timestamp":"2025-11-15T10:23:45.123Z","level":"info","message":"HTTP GET myapp.local -> localhost:3000 /","protocol":"HTTP","method":"GET","hostname":"myapp.local","targetPort":3000,"url":"/"}
{"timestamp":"2025-11-15T10:23:46.456Z","level":"info","message":"Config reloaded - domains changed","oldCount":5,"newCount":6,"added":["newapp.local"],"removed":[]}
```

### Viewing Logs

**Recent activity:**

```bash
pseudo-url service logs
```

**Follow in real-time:**

```bash
pseudo-url service logs -f
```

**Filter by level using jq:**

```bash
tail -f /var/log/pseudo-url-localhost/stdout.log | jq 'select(.level == "error")'
```

### Log Rotation

Logs are not automatically rotated. To prevent disk space issues, set up log rotation:

**Create `/etc/newsyslog.d/pseudo-url-localhost.conf`:**

```
# logfilename                          [owner:group]  mode count size when  flags
/var/log/pseudo-url-localhost/*.log    root:wheel     644  7     1024 *     J
```

This rotates logs daily, keeping 7 days of history, when they exceed 1MB.

**Or manually rotate:**

```bash
sudo mv /var/log/pseudo-url-localhost/stdout.log /var/log/pseudo-url-localhost/stdout.log.old
sudo mv /var/log/pseudo-url-localhost/stderr.log /var/log/pseudo-url-localhost/stderr.log.old
sudo pseudo-url service restart
```

## Updating the Service

### Updating pseudo-url-localhost

```bash
# Update the package
npm update -g pseudo-url-localhost

# Reinstall the service to use the new version
sudo pseudo-url service reinstall
```

### Updating Node.js

If you update Node.js to a different version or location:

```bash
sudo pseudo-url service reinstall
```

This will detect the new Node.js path and update the service configuration.

### Checking Current Version

```bash
pseudo-url --version
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
sudo pseudo-url service stop

# Run manually on custom ports
sudo pseudo-url start -p 8080 --https-port 8443
```

Then access your domains with the port:

```
http://myapp.local:8080
https://myapp.local:8443
```

**Note:** This won't persist across reboots. For persistent custom ports, modify the config and reinstall the service.

### Running Without HTTPS

```bash
sudo pseudo-url start --no-https
```

The service will only start the HTTP proxy on port 80.

### Multiple Instances

You cannot run multiple instances of the service simultaneously as they would conflict on ports 80 and 443.

However, you can:

- Run the service for daily use
- Stop it with `sudo pseudo-url service stop`
- Run a custom instance manually
- Restart the service when done

## Getting Help

### Documentation

- Main README: `README.md`
- This Service Guide: `SERVICE.md`

### Checking Status

```bash
pseudo-url service status
pseudo-url status
pseudo-url list
pseudo-url cert-status
```

### Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. View logs: `pseudo-url service logs`
3. Search [existing issues](https://github.com/yourusername/pseudo-url-localhost/issues)
4. File a [new issue](https://github.com/yourusername/pseudo-url-localhost/issues/new) with:
   - Output of `pseudo-url service status`
   - Output of `pseudo-url status`
   - Relevant logs from `pseudo-url service logs`
   - Your Node.js version: `node --version`
   - Your macOS version: `sw_vers`

## Summary

**Installation:**

```bash
sudo pseudo-url service install
```

**Daily usage:**

```bash
pseudo-url add myapp.local 3000  # Just works, no restart needed
pseudo-url list                  # View mappings
pseudo-url service logs          # Check logs
```

**Development:**

```bash
cd pseudo-url-localhost
sudo pseudo-url dev
# Make changes, test, exit with Ctrl+C
sudo pseudo-url service reinstall
```

**Troubleshooting:**

```bash
pseudo-url service status
pseudo-url service logs
sudo pseudo-url service restart
```

The service is designed to be "set it and forget it" — install once, use forever.

