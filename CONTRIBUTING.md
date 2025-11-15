# Contributing to Nextium

Thank you for your interest in contributing to Nextium! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/nextium.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development

### Project Structure

```
nextium/
├── bin/
│   └── cli.js              # CLI entry point
├── src/
│   ├── index.js            # Main module entry
│   ├── config.js           # Configuration management
│   ├── hosts.js            # Hosts file manipulation
│   ├── proxy.js            # Proxy server implementation
│   ├── certificates.js     # SSL certificate management
│   ├── process-manager.js  # Process lifecycle management
│   └── project-config.js   # Project configuration handling
├── index.d.ts              # TypeScript definitions
├── package.json
├── install-service.sh      # macOS service installer
├── uninstall-service.sh    # macOS service uninstaller
└── README.md
```

### Testing Your Changes

1. Link the package locally:
   ```bash
   npm link
   ```

2. Test in a Next.js project:
   ```bash
   cd path/to/your/nextjs-project
   nextium create
   # Follow prompts
   ```

3. Start the daemon and test:
   ```bash
   sudo nextium start
   # Access your project at https://yourproject.nextium
   ```

4. Test CLI commands:
   ```bash
   nextium ps
   nextium logs yourproject.nextium
   nextium dev yourproject.nextium
   ```

5. Clean up after testing:
   ```bash
   nextium remove yourproject.nextium
   sudo nextium sync
   npm unlink
   ```

### Development Mode

For rapid development and testing of the daemon itself:

```bash
cd nextium
sudo nextium dev
```

This will:
- Stop the system service temporarily (if running)
- Run the proxy with auto-reload (nodemon)
- Automatically restart the service when you exit

## Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add JSDoc comments for all exported functions
- Keep functions focused and single-purpose
- Use meaningful variable and function names

### Example

```javascript
/**
 * Start a Next.js dev server for a project
 * @param {string} domain - The project domain
 * @param {Object} config - Project configuration
 * @returns {Promise<Object>} Process information
 */
async function startDevServer(domain, config) {
  // Implementation
}
```

## Testing

### Manual Testing Checklist

When making changes, test the following workflows:

- [ ] `nextium create` in a Next.js project
- [ ] `sudo nextium start` starts the daemon
- [ ] Accessing `https://project.nextium` starts the dev server
- [ ] `nextium ps` shows correct process status
- [ ] Idle timeout stops inactive projects
- [ ] `nextium dev` streams logs correctly
- [ ] Service installation works (`sudo nextium service install`)
- [ ] Hosts file is correctly updated
- [ ] SSL certificates are generated

### Platform Testing

Try to test on:
- macOS (primary platform)
- Linux (Ubuntu/Debian)
- Windows (WSL2 if possible)

## Commit Guidelines

- Use clear, descriptive commit messages
- Start with a verb in present tense (Add, Fix, Update, Remove, etc.)
- Reference issue numbers when applicable

**Examples:**
- `Add file watcher for automatic server restart`
- `Fix process cleanup on daemon shutdown`
- `Update README with new dev command`
- `Remove deprecated mapping commands`

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the TypeScript definitions if you add/modify exports
3. Test your changes thoroughly
4. Ensure backward compatibility or document breaking changes
5. Update ROADMAP.md if adding features mentioned there
6. Create a pull request with a clear description of changes

### PR Description Template

```markdown
## Summary
Brief description of what this PR does

## Changes
- List of changes made
- Another change

## Testing
How you tested these changes

## Breaking Changes
Any breaking changes (if applicable)

## Related Issues
Fixes #123
```

## Feature Ideas

See [ROADMAP.md](ROADMAP.md) for planned features. Some good areas for contributions:

- **Process Management:**
  - Hybrid smart detection (file watcher + HTTP triggers)
  - Better process ready detection
  - Graceful restart on config changes
  
- **Proxy Improvements:**
  - Local DNS server integration
  - Caddy-based reverse proxy
  - WebSocket support improvements
  - HTTP/2 and HTTP/3 support

- **Multi-Framework Support:**
  - Support for other frameworks (Vite, Remix, etc.)
  - Configurable dev commands
  - Framework detection

- **Developer Experience:**
  - Interactive TUI for process management
  - Better logging and debugging
  - Project templates
  - Configuration validation and autocomplete

- **Cloud Integration:**
  - Deploy from Nextium to Vercel/Netlify
  - Environment sync
  - Team collaboration features

## Architecture Notes

### Process Lifecycle

```
HTTP Request → Proxy → Process Manager
                           ↓
                    [Process Running?]
                      ↙         ↘
                   YES          NO
                    ↓            ↓
             Proxy Request   Start Process
                              ↓
                         Wait for Ready
                              ↓
                         Proxy Request
```

### State Management

- **Global State:** `~/.nextium/config.json` (daemon config)
- **Projects Registry:** `~/.nextium/projects.json` (registered projects)
- **Process State:** `~/.nextium/processes.json` (running processes)

All state files are JSON for simplicity and inspectability.

### Domain Resolution

```
Browser → DNS Lookup
            ↓
       /etc/hosts (managed by Nextium)
            ↓
       127.0.0.1:80/443
            ↓
       Nextium Proxy
            ↓
       localhost:3000-3999 (actual dev server)
```

## Reporting Issues

When reporting issues, please include:

- Operating system and version
- Node.js version
- Next.js version (if project-specific)
- Steps to reproduce
- Expected vs actual behavior
- Error messages (if any)
- Output of `nextium status`
- Relevant logs from `nextium logs <domain>` or `nextium service logs`

### Issue Template

```markdown
**Environment:**
- OS: macOS 13.0
- Node: v18.0.0
- Nextium: v1.0.0
- Next.js: v14.0.0

**Steps to Reproduce:**
1. Run `nextium create`
2. Start daemon with `sudo nextium start`
3. Access https://myapp.nextium

**Expected Behavior:**
Server should start and respond

**Actual Behavior:**
Timeout after 30 seconds

**Error Logs:**
```
[paste logs here]
```
```

## Questions?

Feel free to:
- Open an issue for questions
- Start a discussion on GitHub Discussions
- Check existing issues for similar questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

Be respectful, constructive, and collaborative. We're all here to build something useful together.
