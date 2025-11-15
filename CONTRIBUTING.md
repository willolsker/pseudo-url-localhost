# Contributing to pseudo-url-localhost

Thank you for your interest in contributing to pseudo-url-localhost! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/pseudo-url-localhost.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development

### Project Structure

```
pseudo-url-localhost/
├── bin/
│   └── cli.js          # CLI entry point
├── src/
│   ├── index.js        # Main module entry
│   ├── config.js       # Configuration management
│   ├── hosts.js        # Hosts file manipulation
│   └── proxy.js        # Proxy server implementation
├── index.d.ts          # TypeScript definitions
├── package.json
└── README.md
```

### Testing Your Changes

1. Link the package locally:
   ```bash
   npm link
   ```

2. Test CLI commands:
   ```bash
   pseudo-url add test.local 3000
   pseudo-url list
   sudo pseudo-url sync
   sudo pseudo-url start
   ```

3. Clean up after testing:
   ```bash
   pseudo-url clear
   sudo pseudo-url sync
   npm unlink
   ```

## Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add JSDoc comments for all exported functions
- Keep functions focused and single-purpose

## Commit Guidelines

- Use clear, descriptive commit messages
- Start with a verb in present tense (Add, Fix, Update, Remove, etc.)
- Reference issue numbers when applicable

Examples:
- `Add support for HTTPS proxying`
- `Fix hosts file backup on Windows`
- `Update README with troubleshooting section`

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the TypeScript definitions if you add/modify exports
3. Ensure your code works on macOS, Linux, and Windows (if possible)
4. Create a pull request with a clear description of changes

## Feature Ideas

Some ideas for contributions:

- HTTPS/SSL support
- WebSocket proxying
- Configuration import/export
- GUI interface
- Docker integration
- Automatic port detection
- Pattern-based domain matching (wildcards)
- Multiple proxy server support

## Reporting Issues

When reporting issues, please include:

- Operating system and version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Error messages (if any)

## Questions?

Feel free to open an issue for questions or discussions about the project.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

