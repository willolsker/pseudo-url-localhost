# Quick Start - AI Fitness Domain

This package is pre-configured for an AI fitness application on port 3000.

## Prerequisites

Make sure you have Node.js installed:

```bash
# Check if Node.js is installed
node --version

# If not installed:
# macOS: brew install node
# Linux: sudo apt install nodejs npm
# Or download from: https://nodejs.org/
```

## Setup (First Time Only)

```bash
# 1. Navigate to the package directory
cd /Users/willolsker/pseudo-url-localhost

# 2. Install dependencies
npm install

# 3. Run the setup script
./setup-ai-fitness.sh
```

The setup script will:
- ✅ Backup your hosts file to `/etc/hosts.backup.TIMESTAMP`
- ✅ Add the domain mapping: `ai-fitness.local → localhost:3000`
- ✅ Update your system's hosts file (requires sudo)

## Starting the Service

After setup, use the quick start script:

```bash
./START_SERVICE.sh
```

This will:
1. Show your current configuration
2. Let you choose between port 80 (with sudo) or port 8080 (no sudo)
3. Start the proxy server

## Manual Start

If you prefer to start manually:

```bash
# Port 80 (requires sudo)
sudo node bin/cli.js start

# Port 8080 (no sudo)
node bin/cli.js start -p 8080
```

## Accessing Your App

1. **Start your AI fitness app** on port 3000:
   ```bash
   # In your app directory
   npm start
   ```

2. **Start the proxy** (using either script above)

3. **Open your browser** to:
   - Port 80: `http://ai-fitness.local`
   - Port 8080: `http://ai-fitness.local:8080`

## Verify Setup

```bash
# Check configuration
node bin/cli.js status

# List all mappings
node bin/cli.js list

# Verify hosts file
cat /etc/hosts | grep ai-fitness
```

## Stopping the Service

Press `Ctrl+C` in the terminal running the proxy server.

## Pre-configured Settings

- **Domain**: `ai-fitness.local`
- **Target Port**: `3000`
- **Proxy Port**: `80` (default) or `8080` (alternative)
- **Config Location**: `~/.pseudo-url/config.json`

## Need Help?

- Full setup guide: [AI_FITNESS_SETUP.md](AI_FITNESS_SETUP.md)
- Complete documentation: [README.md](README.md)
- Usage examples: [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md)
- Getting started: [GETTING_STARTED.md](GETTING_STARTED.md)

---

**⚡ Quick Command Reference:**

```bash
# Setup (first time)
./setup-ai-fitness.sh

# Start service
./START_SERVICE.sh

# Check status
node bin/cli.js status

# Add more domains
node bin/cli.js add <domain> <port>

# Sync hosts file
sudo node bin/cli.js sync
```

