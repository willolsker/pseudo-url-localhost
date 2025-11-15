# Usage Examples

This document provides practical examples of using pseudo-url-localhost in various scenarios.

## Basic Usage

### Single Application

You have a React app running on port 3000:

```bash
# Add mapping
pseudo-url add myreactapp.local 3000

# Sync hosts file
sudo pseudo-url sync

# Start proxy
sudo pseudo-url start

# Now visit: http://myreactapp.local
```

### Multiple Applications

Running multiple services for a full-stack application:

```bash
# Frontend
pseudo-url add frontend.local 3000

# Backend API
pseudo-url add api.local 8000

# Database admin tool
pseudo-url add dbadmin.local 5050

# Documentation site
pseudo-url add docs.local 3001

# Sync all at once
sudo pseudo-url sync

# Start proxy
sudo pseudo-url start
```

Now access:
- Frontend: `http://frontend.local`
- API: `http://api.local`
- DB Admin: `http://dbadmin.local`
- Docs: `http://docs.local`

## Advanced Scenarios

### Team Development

Share your configuration with team members:

```bash
# Export configuration
cat ~/.pseudo-url/config.json > project-domains.json

# Team member imports (manual):
# Copy mappings from project-domains.json
pseudo-url add frontend.local 3000
pseudo-url add api.local 8000
# ... etc
```

### Using Non-Privileged Port

If you can't use sudo or want to avoid port 80:

```bash
# Set proxy to port 8080
pseudo-url port 8080

# Start without sudo
pseudo-url start

# Access with port number
# http://myapp.local:8080
```

### Development vs Production Naming

Use `.local` for development to avoid conflicts:

```bash
# Development
pseudo-url add myapp.local 3000
pseudo-url add api.myapp.local 8000

# Later, your production might be:
# myapp.com
# api.myapp.com
```

### Microservices Architecture

Map all your microservices:

```bash
pseudo-url add gateway.local 8000
pseudo-url add auth.local 8001
pseudo-url add users.local 8002
pseudo-url add products.local 8003
pseudo-url add orders.local 8004
pseudo-url add payments.local 8005

sudo pseudo-url sync
sudo pseudo-url start
```

### Quick Project Switching

```bash
# Check current mappings
pseudo-url list

# Working on Project A
pseudo-url add app.local 3000
sudo pseudo-url sync

# Switch to Project B (different port)
pseudo-url add app.local 4000
sudo pseudo-url sync

# Or use different domains
pseudo-url add projecta.local 3000
pseudo-url add projectb.local 4000
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
pseudo-url add frontend.local 3000
pseudo-url add backend.local 8000
sudo pseudo-url sync
sudo pseudo-url start
```

### With Package.json Scripts

```json
{
  "scripts": {
    "dev": "npm run start",
    "setup:domain": "pseudo-url add myapp.local 3000 && sudo pseudo-url sync",
    "proxy:start": "sudo pseudo-url start"
  }
}
```

### With Create React App

```bash
# React app on 3000
pseudo-url add myapp.local 3000

# API proxy in package.json still works
# The proxy field in package.json proxies API calls
# while pseudo-url handles the domain
```

## Workflow Examples

### Morning Startup Routine

```bash
# 1. Check status
pseudo-url status

# 2. Start your dev servers (example)
cd ~/projects/frontend && npm start &
cd ~/projects/backend && npm start &

# 3. Start proxy
sudo pseudo-url start
```

### Adding New Service Mid-Development

```bash
# You're already running proxy server
# In a new terminal:

pseudo-url add newservice.local 9000
sudo pseudo-url sync

# Restart proxy server (Ctrl+C in proxy terminal, then):
sudo pseudo-url start
```

### End of Day Cleanup

```bash
# Stop proxy (Ctrl+C)
# Optionally clear mappings if project is done
pseudo-url clear
sudo pseudo-url sync
```

## Troubleshooting Examples

### Domain Not Working

```bash
# 1. Verify mapping exists
pseudo-url list

# 2. Check hosts file
cat /etc/hosts | grep pseudo-url

# 3. Flush DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# 4. Verify proxy is running
pseudo-url status

# 5. Check if dev server is running
curl http://localhost:3000
```

### Port Conflict

```bash
# If port 80 is taken
sudo lsof -i :80

# Use different port
pseudo-url port 8080
pseudo-url start
```

### Permission Issues

```bash
# Check permissions
pseudo-url status

# Grant permissions
sudo pseudo-url sync

# For proxy on port 80
sudo pseudo-url start

# Or use non-privileged port
pseudo-url port 8080
pseudo-url start
```

## Best Practices

1. **Use `.local` TLD**: Avoid conflicts with real domains
   ```bash
   pseudo-url add myapp.local 3000    # Good
   pseudo-url add myapp.com 3000      # Bad - might conflict
   ```

2. **Descriptive Names**: Use clear, project-specific names
   ```bash
   pseudo-url add ecommerce-admin.local 3000
   pseudo-url add ecommerce-api.local 8000
   ```

3. **Document Your Mappings**: Keep a list in your project
   ```bash
   # Create domains.txt in your project
   echo "frontend.local -> 3000" > domains.txt
   echo "api.local -> 8000" >> domains.txt
   ```

4. **Regular Cleanup**: Remove unused mappings
   ```bash
   pseudo-url list
   pseudo-url remove old-project.local
   ```

5. **Team Coordination**: Share your domain scheme
   ```bash
   # In project README.md
   # Development URLs:
   # - Frontend: http://myapp.local (port 3000)
   # - API: http://api.myapp.local (port 8000)
   ```

