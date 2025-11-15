# Nextium

> Local serverless management for Next.js projects with on-demand process management

Never type `localhost:3000` again. Nextium is your local mini-Vercel for development - manage Next.js projects with custom `.nextium` domains, automatic on-demand startup, and intelligent idle shutdown to minimize resource usage.

## Features

- 🚀 **On-Demand Process Management** - Next.js dev servers start automatically when accessed
- 💤 **Intelligent Idle Shutdown** - Conserves resources by stopping inactive projects
- 🌐 **Custom .nextium Domains** - Access projects at memorable URLs like `myapp.nextium`
- 🔒 **Built-in HTTPS** - Automatic SSL certificates via mkcert
- ⚡ **Zero Configuration** - Auto-detects Next.js projects and available ports
- 🎯 **Project Isolation** - Each project runs independently with its own process
- 💻 **Simple CLI** - Intuitive commands for project management
- 🔄 **Auto-Restart** - Projects restart on file changes (via Next.js dev server)

## Installation

```bash
npm install -g nextium
```

## Quick Start

1. **Install mkcert** (for HTTPS support - recommended):

```bash
# macOS
brew install mkcert
mkcert -install

# Linux
# See: https://github.com/FiloSottile/mkcert#installation

# Windows
choco install mkcert
mkcert -install
```

2. **Navigate to your Next.js project**:

```bash
cd my-nextjs-project
```

3. **Run the setup wizard**:

```bash
nextium create
```

You'll be prompted to choose a domain name (e.g., `myapp.nextium`). Nextium will:

- Create a `nextium.config.js` file
- Register your project
- Update your hosts file
- Generate SSL certificates

4. **Start the Nextium daemon** (requires sudo for ports 80/443):

```bash
sudo nextium start
```

5. **Access your app** at `https://myapp.nextium`

Your Next.js dev server will start automatically on first access! When idle for 5 minutes, it will automatically stop to conserve resources.

## How It Works

Nextium acts as a local serverless platform for development:

1. **HTTP Proxy**: Runs on ports 80/443 and routes requests to your projects
2. **Process Manager**: Starts/stops Next.js dev servers on-demand
3. **Smart Scheduling**: Tracks access patterns and idles out unused projects
4. **Domain Routing**: Maps `.nextium` domains to running processes via hosts file

**On First Request:**

```
Browser → https://myapp.nextium
         ↓
    Nextium Proxy (detects no server running)
         ↓
    Starts `npm run dev` for project
         ↓
    Waits for "ready" signal
         ↓
    Proxies request to localhost:3000
         ↓
    Your Next.js app!
```

**Subsequent Requests:** Instant proxy to already-running server

**After 5 Minutes Idle:** Process automatically stopped, resources freed

## Configuration

When you run `nextium create`, a `nextium.config.js` file is created in your project:

```javascript
module.exports = {
  // Your custom .nextium domain
  domain: "myapp.nextium",

  // Port configuration
  // 'auto' = automatically find available port (3000-3999)
  // Or specify a port number
  port: "auto",

  // Idle timeout configuration
  idle: {
    timeoutMs: 300000, // 5 minutes (in milliseconds)
  },
};
```

## Commands

### Project Management

```bash
# Setup a new Next.js project
nextium create

# List all registered projects and their status
nextium ps

# View logs for a project
nextium logs myapp.nextium

# Manually start a project (background)
nextium start myapp.nextium

# Manually stop a project
nextium stop myapp.nextium

# Restart a project
nextium restart myapp.nextium

# Remove a project from Nextium
nextium remove myapp.nextium
```

### Development Mode

Run a project in the foreground with live log streaming:

```bash
nextium dev myapp.nextium
```

**Options:**

- `--attach` - Attach to existing process without restarting
- `--restart` - Force restart even if already running
- `--detach` - Keep server running after exit (returns to managed mode)
- `--stop` - Stop server when exiting (default)
- `--port <port>` - Override configured port
- `--no-prompt` - Use defaults for all prompts

**Example:**

```bash
# Run with live logs, restart if needed
nextium dev myapp.nextium --restart

# Attach to running process and keep it running after exit
nextium dev myapp.nextium --attach --detach
```

### Daemon Management

```bash
# Start the Nextium daemon (required for automatic startup)
sudo nextium start

# Check daemon status
nextium status

# Sync hosts file manually
sudo nextium sync
```

### System Service (Recommended)

Install Nextium as a system service that runs automatically on startup:

```bash
sudo nextium service install
```

**Service Commands:**

```bash
nextium service status     # Check if running
nextium service logs       # View service logs
nextium service restart    # Restart service
nextium service stop       # Stop service
nextium service reinstall  # Update after npm upgrade
```

### Certificate Management

```bash
# Check certificate status
nextium cert-status

# Get mkcert installation instructions
nextium cert-install

# Regenerate certificates for all projects
nextium cert-regenerate

# Delete generated certificates
nextium cert-delete
```

## Example Workflow

```bash
# Terminal 1: Start the Nextium daemon
sudo nextium start

# Terminal 2: Setup your first project
cd ~/projects/my-store
nextium create
# Choose domain: store.nextium

# Terminal 2: Setup another project
cd ~/projects/my-blog
nextium create
# Choose domain: blog.nextium

# Now access:
# https://store.nextium  (auto-starts on first visit)
# https://blog.nextium   (auto-starts on first visit)

# Check what's running
nextium ps
# Shows which projects are active and which are idle

# Manually start a project
nextium start store.nextium

# Watch logs in real-time
nextium dev blog.nextium
```

## Multi-Project Development

Nextium shines when working on multiple projects:

```bash
# Register all your projects
cd ~/projects/frontend && nextium create
cd ~/projects/backend && nextium create
cd ~/projects/admin && nextium create

# Start daemon once
sudo nextium start

# Access any project instantly:
# https://frontend.nextium
# https://backend.nextium
# https://admin.nextium

# Only active projects consume resources!
nextium ps
# Shows:
# frontend.nextium  [RUNNING]  (last access: 2s ago)
# backend.nextium   [RUNNING]  (last access: 10s ago)
# admin.nextium     [STOPPED]  (idle)
```

## Configuration Directory

Nextium stores its configuration in `~/.nextium/`:

```
~/.nextium/
├── config.json           # Global daemon configuration
├── projects.json         # Registered projects registry
├── processes.json        # Running processes state
├── hosts.backup          # Backup of original hosts file
└── certs/               # SSL certificates
    ├── cert.pem
    └── key.pem
```

## Troubleshooting

### Project Not Starting

1. Check if Next.js project is valid:

   ```bash
   cd your-project
   npm run dev  # Does this work?
   ```

2. Check Nextium daemon is running:

   ```bash
   nextium status
   ```

3. View project logs:
   ```bash
   nextium logs myapp.nextium
   ```

### Domain Not Resolving

1. Verify hosts file was updated:

   ```bash
   cat /etc/hosts | grep nextium
   ```

2. Flush DNS cache:

   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

   # Linux
   sudo systemd-resolve --flush-caches
   ```

3. Manually sync hosts file:
   ```bash
   sudo nextium sync
   ```

### Port Conflicts

If a port is already in use, Nextium will automatically allocate a different port when using `port: "auto"`. To use a specific port:

```javascript
// nextium.config.js
module.exports = {
  domain: "myapp.nextium",
  port: 3001, // Specific port instead of 'auto'
  idle: {
    timeoutMs: 300000,
  },
};
```

### Permission Errors

Nextium requires sudo for:

- Starting the daemon (ports 80/443)
- Modifying the hosts file
- Generating SSL certificates

```bash
# Always use sudo for these commands:
sudo nextium start
sudo nextium sync
sudo nextium service install
```

## Resource Management

Nextium is designed to be resource-efficient:

- **Daemon**: Lightweight proxy (~20-50 MB RAM)
- **Idle Projects**: No resources consumed
- **Active Projects**: Normal Next.js dev server overhead (~200-500 MB RAM each)
- **Automatic Cleanup**: Projects idle out after 5 minutes (configurable)

**Example Resource Usage:**

```
5 registered projects, 2 active:
- Nextium Daemon:     45 MB
- Project A (active): 320 MB
- Project B (active): 280 MB
- Project C-E (idle): 0 MB
Total: ~645 MB (vs ~1.6 GB if all were running)
```

## Security Considerations

- **Runs as root** (required for ports 80/443)
- **Only listens on localhost** (127.0.0.1) - not exposed to network
- **SSL certificates are locally-trusted only** (via mkcert)
- **No external network access** required
- **Configuration files are local** (~/.nextium/)

## Cleanup

To completely remove Nextium:

```bash
# Uninstall service (if installed)
sudo nextium service uninstall

# Remove all projects
nextium remove --all

# Sync hosts file to remove domains
sudo nextium sync

# Uninstall globally
npm uninstall -g nextium

# Remove configuration
rm -rf ~/.nextium
```

## Why Nextium?

**Before Nextium:**

```bash
# Terminal 1
cd ~/projects/store
npm run dev
# Running on http://localhost:3000

# Terminal 2
cd ~/projects/blog
npm run dev
# Error: Port 3000 already in use
# Running on http://localhost:3001

# Terminal 3
cd ~/projects/admin
npm run dev
# Running on http://localhost:3002

# Which port was which again? 🤔
# 3 terminals, 3 processes, ~1.5 GB RAM always running
```

**With Nextium:**

```bash
# Terminal 1
sudo nextium start

# Access any project instantly:
# https://store.nextium
# https://blog.nextium
# https://admin.nextium

# Only 1-2 projects actually running at any time
# Automatic cleanup when idle
# Memorable domain names
# Single command to rule them all! 🎉
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features including:

- Hybrid smart detection (file watcher + HTTP triggers)
- Custom proxy solutions (DNS server, Caddy integration)
- Multi-framework support
- Cloud deployment integration
- Team collaboration features

## License

MIT

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Support

If you encounter issues or have questions, please file an issue on GitHub.
