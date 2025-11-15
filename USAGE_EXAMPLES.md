# Usage Examples

This document provides practical examples of using nextium-localhost in various scenarios.

## Basic Usage

### Single Application

You have a React app running on port 3000:

```bash
# Add mapping
nextium add myreactapp.nextium 3000

# Sync hosts file
sudo nextium sync

# Start proxy
sudo nextium start

# Now visit: http://myreactapp.nextium
```

### Multiple Applications

Running multiple services for a full-stack application:

```bash
# Frontend
nextium add frontend.nextium 3000

# Backend API
nextium add api.nextium 8000

# Database admin tool
nextium add dbadmin.nextium 5050

# Documentation site
nextium add docs.nextium 3001

# Sync all at once
sudo nextium sync

# Start proxy
sudo nextium start
```

Now access:
- Frontend: `http://frontend.nextium`
- API: `http://api.nextium`
- DB Admin: `http://dbadmin.nextium`
- Docs: `http://docs.nextium`

## Advanced Scenarios

### Team Development

Share your configuration with team members:

```bash
# Export configuration
cat ~/.nextium/config.json > project-domains.json

# Team member imports (manual):
# Copy mappings from project-domains.json
nextium add frontend.nextium 3000
nextium add api.nextium 8000
# ... etc
```

### Using Non-Privileged Port

If you can't use sudo or want to avoid port 80:

```bash
# Set proxy to port 8080
nextium port 8080

# Start without sudo
nextium start

# Access with port number
# http://myapp.nextium:8080
```

### Development vs Production Naming

Use `.nextium` for development to avoid conflicts:

```bash
# Development
nextium add myapp.nextium 3000
nextium add api.myapp.nextium 8000

# Later, your production might be:
# myapp.com
# api.myapp.com
```

### Microservices Architecture

Map all your microservices:

```bash
nextium add gateway.nextium 8000
nextium add auth.nextium 8001
nextium add users.nextium 8002
nextium add products.nextium 8003
nextium add orders.nextium 8004
nextium add payments.nextium 8005

sudo nextium sync
sudo nextium start
```

### Quick Project Switching

```bash
# Check current mappings
nextium list

# Working on Project A
nextium add app.nextium 3000
sudo nextium sync

# Switch to Project B (different port)
nextium add app.nextium 4000
sudo nextium sync

# Or use different domains
nextium add projecta.nextium 3000
nextium add projectb.nextium 4000
```

## Integration with Development Tools

### With Docker Compose

```yaml
# docker-compose.yml
services:
  frontend:
    ports:
      - "3000:3000"
  backend:
    ports:
      - "8000:8000"
```

```bash
# After docker-compose up
nextium add frontend.nextium 3000
nextium add backend.nextium 8000
sudo nextium sync
sudo nextium start
```

### With Package.json Scripts

```json
{
  "scripts": {
    "dev": "npm run start",
    "setup:domain": "nextium add myapp.nextium 3000 && sudo nextium sync",
    "proxy:start": "sudo nextium start"
  }
}
```

### With Create React App

```bash
# React app on 3000
nextium add myapp.nextium 3000

# API proxy in package.json still works
# The proxy field in package.json proxies API calls
# while nextium handles the domain
```

## Workflow Examples

### Morning Startup Routine

```bash
# 1. Check status
nextium status

# 2. Start your dev servers (example)
cd ~/projects/frontend && npm start &
cd ~/projects/backend && npm start &

# 3. Start proxy
sudo nextium start
```

### Adding New Service Mid-Development

```bash
# You're already running proxy server
# In a new terminal:

nextium add newservice.nextium 9000
sudo nextium sync

# Restart proxy server (Ctrl+C in proxy terminal, then):
sudo nextium start
```

### End of Day Cleanup

```bash
# Stop proxy (Ctrl+C)
# Optionally clear mappings if project is done
nextium clear
sudo nextium sync
```

## Troubleshooting Examples

### Domain Not Working

```bash
# 1. Verify mapping exists
nextium list

# 2. Check hosts file
cat /etc/hosts | grep nextium

# 3. Flush DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# 4. Verify proxy is running
nextium status

# 5. Check if dev server is running
curl http://localhost:3000
```

### Port Conflict

```bash
# If port 80 is taken
sudo lsof -i :80

# Use different port
nextium port 8080
nextium start
```

### Permission Issues

```bash
# Check permissions
nextium status

# Grant permissions
sudo nextium sync

# For proxy on port 80
sudo nextium start

# Or use non-privileged port
nextium port 8080
nextium start
```

## Best Practices

1. **Use `.nextium` TLD**: Avoid conflicts with real domains
   ```bash
   nextium add myapp.nextium 3000    # Good
   nextium add myapp.com 3000      # Bad - might conflict
   ```

2. **Descriptive Names**: Use clear, project-specific names
   ```bash
   nextium add ecommerce-admin.nextium 3000
   nextium add ecommerce-api.nextium 8000
   ```

3. **Document Your Mappings**: Keep a list in your project
   ```bash
   # Create domains.txt in your project
   echo "frontend.nextium -> 3000" > domains.txt
   echo "api.nextium -> 8000" >> domains.txt
   ```

4. **Regular Cleanup**: Remove unused mappings
   ```bash
   nextium list
   nextium remove old-project.nextium
   ```

5. **Team Coordination**: Share your domain scheme
   ```bash
   # In project README.md
   # Development URLs:
   # - Frontend: http://myapp.nextium (port 3000)
   # - API: http://api.myapp.nextium (port 8000)
   ```

