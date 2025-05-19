// backend/test/utils/socket-test-utils.js
const { createServer } = require("http");
const { Server } = require("socket.io");
const { io: ioc } = require("socket.io-client");
const setupSocketHandlers = require("../../utils/socketHandler");

/**
 * Create a Socket.io server and client for testing
 * @returns {Object} Socket server and client instances
 */
function createSocketTestEnvironment() {
  // Create HTTP server
  const httpServer = createServer();

  // Create Socket.io server
  const io = new Server(httpServer);

  // Set up socket handlers
  setupSocketHandlers(io);

  // Start the server
  const port = 3001;
  httpServer.listen(port);

  // Create client
  const client = ioc(`http://localhost:${port}`, {
    transports: ["websocket"],
    autoConnect: false,
  });

  return {
    server: io,
    httpServer,
    client,
    port,

    // Helper function to clean up
    cleanup: () => {
      client.disconnect();
      io.close();
      httpServer.close();
    },
  };
}

module.exports = { createSocketTestEnvironment };
