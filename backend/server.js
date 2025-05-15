// backend/server.js updated with admin routes and session handling
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { pool } = require("./config/database");

// Import configuration
const corsConfig = require("./config/cors");

// Import middleware
const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const { checkBanned, enforceBan } = require("./middleware/adminAuth");

// Import route handlers
const boardRoutes = require("./routes/boards");
const adminRoutes = require("./routes/admin");

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

// Set up session middleware
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "admin_sessions", // Table name for sessions
      createTableIfMissing: true, // Create table if it doesn't exist
    }),
    secret:
      process.env.SESSION_SECRET || "development_secret_change_in_production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // secure in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Add request logger middleware
app.use(logger);

// Check if user is banned - this just adds ban info to req object
app.use(checkBanned);

// Register routes
app.use("/api/admin", adminRoutes);

// Apply ban enforcement to content routes only (not admin routes)
app.use("/api/boards", enforceBan);
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
