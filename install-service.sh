#!/bin/bash
# Install nextium as a system service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Nextium Service Installation"
echo "============================"
echo ""

# Must run as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run with sudo: sudo bash install-service.sh"
    exit 1
fi

# Check if service is already installed
if [ -f "/Library/LaunchDaemons/com.nextium.plist" ]; then
    echo -e "${YELLOW}Service is already installed.${NC}"
    read -p "Do you want to reinstall? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    # Unload existing service
    launchctl bootout system/com.nextium 2>/dev/null || true
    rm -f /Library/LaunchDaemons/com.nextium.plist
fi

# Detect Node.js path
echo "Detecting Node.js installation..."
NODE_PATH=$(which node 2>/dev/null)

if [ -z "$NODE_PATH" ] || [ ! -f "$NODE_PATH" ]; then
    echo -e "${RED}Error: Node.js not found${NC}"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js found at: $NODE_PATH"

# Detect user's home directory (for config access when running as root)
USER_HOME=$(eval echo ~${SUDO_USER:-$USER})
echo -e "${GREEN}✓${NC} User home directory: $USER_HOME"

# Detect nextium CLI path
echo "Detecting nextium installation..."

# Try global installation first
CLI_PATH=$(which nextium 2>/dev/null)

# If not found globally, check if we're in the repo directory
if [ -z "$CLI_PATH" ]; then
    if [ -f "$PWD/bin/cli.js" ]; then
        CLI_PATH="$PWD/bin/cli.js"
    else
        echo -e "${RED}Error: nextium CLI not found${NC}"
        echo "Please install nextium globally: npm install -g nextium"
        echo "Or run this script from the nextium directory"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} nextium found at: $CLI_PATH"

# Determine working directory (must be absolute path)
if [ -L "$CLI_PATH" ]; then
    # If it's a symlink, resolve it to absolute path
    RESOLVED=$(readlink "$CLI_PATH")
    if [[ "$RESOLVED" == /* ]]; then
        # Already absolute
        WORKING_DIR=$(dirname "$RESOLVED")
    else
        # Relative path, resolve from symlink location
        SYMLINK_DIR=$(dirname "$CLI_PATH")
        WORKING_DIR=$(cd "$SYMLINK_DIR" && cd "$(dirname "$RESOLVED")" && pwd)
    fi
else
    WORKING_DIR=$(cd "$(dirname "$CLI_PATH")" && pwd)
fi

echo -e "${GREEN}✓${NC} Working directory: $WORKING_DIR"

# Determine bin directory for PATH
if [ -L "$CLI_PATH" ]; then
    # For symlinked installations (global), use the directory of the symlink
    BIN_DIR=$(dirname "$CLI_PATH")
else
    # For local installations, use the bin directory
    BIN_DIR=$(dirname "$CLI_PATH")
fi

echo -e "${GREEN}✓${NC} Bin directory: $BIN_DIR"

# Check if template exists
TEMPLATE_FILE="$WORKING_DIR/../com.nextium.plist.template"
if [ ! -f "$TEMPLATE_FILE" ]; then
    # Try current directory
    if [ -f "$PWD/com.nextium.plist.template" ]; then
        TEMPLATE_FILE="$PWD/com.nextium.plist.template"
    else
        echo -e "${RED}Error: Plist template not found${NC}"
        echo "Expected at: $TEMPLATE_FILE"
        exit 1
    fi
fi

# Create log directory
echo "Creating log directory..."
mkdir -p /var/log/nextium
chmod 755 /var/log/nextium
echo -e "${GREEN}✓${NC} Log directory created"

# Generate plist from template
echo "Generating service configuration..."
sed -e "s|{{NODE_PATH}}|$NODE_PATH|g" \
    -e "s|{{CLI_PATH}}|$CLI_PATH|g" \
    -e "s|{{WORKING_DIR}}|$WORKING_DIR|g" \
    -e "s|{{BIN_DIR}}|$BIN_DIR|g" \
    -e "s|{{USER_HOME}}|$USER_HOME|g" \
    "$TEMPLATE_FILE" > /tmp/com.nextium.plist

# Install plist
echo "Installing service..."
cp /tmp/com.nextium.plist /Library/LaunchDaemons/
chown root:wheel /Library/LaunchDaemons/com.nextium.plist
chmod 644 /Library/LaunchDaemons/com.nextium.plist
rm /tmp/com.nextium.plist
echo -e "${GREEN}✓${NC} Service configuration installed"

# Load service
echo "Starting service..."
launchctl bootstrap system /Library/LaunchDaemons/com.nextium.plist

# Wait a moment for service to start
sleep 2

# Verify service is running
if launchctl print system/com.nextium > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}✓ Service installed and started successfully!${NC}"
    echo ""
    echo "The nextium proxy is now running system-wide on ports 80/443."
    echo "It will automatically start on system boot."
    echo ""
    echo "Useful commands:"
    echo "  nextium service status    - Check service status"
    echo "  nextium service logs      - View logs"
    echo "  nextium service restart   - Restart service"
    echo "  nextium service stop      - Stop service"
    echo "  nextium create            - Setup a Next.js project"
    echo ""
    echo "Log files are located at:"
    echo "  /var/log/nextium/stdout.log"
    echo "  /var/log/nextium/stderr.log"
else
    echo ""
    echo -e "${RED}✗ Service failed to start${NC}"
    echo "Check logs for errors:"
    echo "  cat /var/log/nextium/stderr.log"
    exit 1
fi

