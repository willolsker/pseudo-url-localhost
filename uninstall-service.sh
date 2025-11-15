#!/bin/bash
# Uninstall pseudo-url system service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "pseudo-url Service Uninstallation"
echo "=================================="
echo ""

# Must run as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run with sudo: sudo bash uninstall-service.sh"
    exit 1
fi

# Check if service is installed
if [ ! -f "/Library/LaunchDaemons/com.pseudo-url-localhost.plist" ]; then
    echo -e "${YELLOW}Service is not installed.${NC}"
    exit 0
fi

# Stop and unload service
echo "Stopping service..."
launchctl bootout system/com.pseudo-url-localhost 2>/dev/null || true
echo -e "${GREEN}✓${NC} Service stopped"

# Remove plist
echo "Removing service configuration..."
rm -f /Library/LaunchDaemons/com.pseudo-url-localhost.plist
echo -e "${GREEN}✓${NC} Service configuration removed"

# Ask about logs
echo ""
read -p "Remove log files? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf /var/log/pseudo-url-localhost
    echo -e "${GREEN}✓${NC} Logs removed"
else
    echo "Logs preserved at /var/log/pseudo-url-localhost"
fi

echo ""
echo -e "${GREEN}✓ Service uninstalled successfully${NC}"
echo ""
echo "Your configuration in ~/.pseudo-url/ has been preserved."
echo "Your domain mappings and certificates are still available."
echo ""
echo "To remove configuration completely, run:"
echo "  rm -rf ~/.pseudo-url"

