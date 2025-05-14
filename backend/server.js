// backend/server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

// Import configuration
const corsConfig = require("./config/cors");

// Import middleware
const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");

// Import route handlers
const boardRoutes = require("./routes/boards");

// Import socket handler
const setupSocketHandlers = require("./utils/socketHandler");

// Import database initialization
const { initDatabase } = require("./utils/dbInit");

// Initialize database on startup
initDatabase().catch(console.error);

// Set up Express app
const app = express();

// Apply CORS configuration
app.use(corsConfig);

// Add JSON body parser
app.use(express.json());

// Add request logger middleware
app.use(logger);

// Register routes
app.use("/api/boards", boardRoutes);
// The threads and posts routes are configured in the boards.js route file

// Add error handler middleware (should be last)
app.use(errorHandler);

// Set up HTTP server and Socket.io
const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsConfig.corsOptions,
});

// Set up socket handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export app and server for testing
module.exports = { app, server };
