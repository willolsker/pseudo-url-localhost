#!/bin/bash
# Install pseudo-url as a system service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "pseudo-url Service Installation"
echo "================================"
echo ""

# Must run as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run with sudo: sudo bash install-service.sh"
    exit 1
fi

# Check if service is already installed
if [ -f "/Library/LaunchDaemons/com.pseudo-url-localhost.plist" ]; then
    echo -e "${YELLOW}Service is already installed.${NC}"
    read -p "Do you want to reinstall? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    # Unload existing service
    launchctl bootout system/com.pseudo-url-localhost 2>/dev/null || true
    rm -f /Library/LaunchDaemons/com.pseudo-url-localhost.plist
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

# Detect pseudo-url CLI path
echo "Detecting pseudo-url installation..."

# Try global installation first
CLI_PATH=$(which pseudo-url 2>/dev/null)

# If not found globally, check if we're in the repo directory
if [ -z "$CLI_PATH" ]; then
    if [ -f "$PWD/bin/cli.js" ]; then
        CLI_PATH="$PWD/bin/cli.js"
    else
        echo -e "${RED}Error: pseudo-url CLI not found${NC}"
        echo "Please install pseudo-url globally: npm install -g pseudo-url-localhost"
        echo "Or run this script from the pseudo-url-localhost directory"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} pseudo-url found at: $CLI_PATH"

# Determine working directory
if [ -L "$CLI_PATH" ]; then
    # If it's a symlink, resolve it
    WORKING_DIR=$(dirname $(readlink "$CLI_PATH"))
else
    WORKING_DIR=$(dirname "$CLI_PATH")
fi

echo -e "${GREEN}✓${NC} Working directory: $WORKING_DIR"

# Check if template exists
TEMPLATE_FILE="$WORKING_DIR/../com.pseudo-url-localhost.plist.template"
if [ ! -f "$TEMPLATE_FILE" ]; then
    # Try current directory
    if [ -f "$PWD/com.pseudo-url-localhost.plist.template" ]; then
        TEMPLATE_FILE="$PWD/com.pseudo-url-localhost.plist.template"
    else
        echo -e "${RED}Error: Plist template not found${NC}"
        echo "Expected at: $TEMPLATE_FILE"
        exit 1
    fi
fi

# Create log directory
echo "Creating log directory..."
mkdir -p /var/log/pseudo-url-localhost
chmod 755 /var/log/pseudo-url-localhost
echo -e "${GREEN}✓${NC} Log directory created"

# Generate plist from template
echo "Generating service configuration..."
sed -e "s|{{NODE_PATH}}|$NODE_PATH|g" \
    -e "s|{{CLI_PATH}}|$CLI_PATH|g" \
    -e "s|{{WORKING_DIR}}|$WORKING_DIR|g" \
    "$TEMPLATE_FILE" > /tmp/com.pseudo-url-localhost.plist

# Install plist
echo "Installing service..."
cp /tmp/com.pseudo-url-localhost.plist /Library/LaunchDaemons/
chown root:wheel /Library/LaunchDaemons/com.pseudo-url-localhost.plist
chmod 644 /Library/LaunchDaemons/com.pseudo-url-localhost.plist
rm /tmp/com.pseudo-url-localhost.plist
echo -e "${GREEN}✓${NC} Service configuration installed"

# Load service
echo "Starting service..."
launchctl bootstrap system /Library/LaunchDaemons/com.pseudo-url-localhost.plist

# Wait a moment for service to start
sleep 2

# Verify service is running
if launchctl print system/com.pseudo-url-localhost > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}✓ Service installed and started successfully!${NC}"
    echo ""
    echo "The pseudo-url proxy is now running system-wide on ports 80/443."
    echo "It will automatically start on system boot."
    echo ""
    echo "Useful commands:"
    echo "  pseudo-url service status    - Check service status"
    echo "  pseudo-url service logs      - View logs"
    echo "  pseudo-url service restart   - Restart service"
    echo "  pseudo-url service stop      - Stop service"
    echo "  pseudo-url add <domain> <port> - Add a mapping"
    echo ""
    echo "Log files are located at:"
    echo "  /var/log/pseudo-url-localhost/stdout.log"
    echo "  /var/log/pseudo-url-localhost/stderr.log"
else
    echo ""
    echo -e "${RED}✗ Service failed to start${NC}"
    echo "Check logs for errors:"
    echo "  cat /var/log/pseudo-url-localhost/stderr.log"
    exit 1
fi

