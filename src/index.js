const { startProxyServer } = require('./proxy');
const { getProxyPort } = require('./config');

/**
 * Start the proxy server with the configured port
 */
async function start() {
  try {
    const port = getProxyPort();
    await startProxyServer(port);
  } catch (error) {
    console.error('Error starting proxy server:', error.message);
    process.exit(1);
  }
}

// If run directly
if (require.main === module) {
  start();
}

module.exports = {
  start,
  ...require('./config'),
  ...require('./hosts'),
  ...require('./proxy')
};

