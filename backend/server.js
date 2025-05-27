// backend/server.js
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

// Trust proxy - important for Socket.io when behind a proxy
app.set("trust proxy", 1);

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
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
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

// Add health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    socketio: io ? "initialized" : "not initialized",
    environment: process.env.NODE_ENV || "development",
  });
});

// Add Socket.io specific health check
app.get("/socket.io/health", (req, res) => {
  const engineIO = io && io.engine;
  res.json({
    status: "ok",
    transports: ["polling", "websocket"],
    clients: engineIO ? engineIO.clientsCount : 0,
    cors: corsConfig.FRONTEND_DOMAINS,
  });
});

// Add error handler middleware (should be last)
app.use(errorHandler);

// Set up HTTP server and Socket.io
const server = http.createServer(app);

// Configure Socket.io with proper CORS and transports
const io = socketIo(server, {
  cors: {
    origin: corsConfig.FRONTEND_DOMAINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Allow both websocket and polling transports
  transports: ["polling", "websocket"],
  // Configure ping timeout and interval for better connection stability
  pingTimeout: 60000,
  pingInterval: 25000,
  // Allow upgrades from polling to websocket
  allowUpgrades: true,
  // Configure the path
  path: "/socket.io/",
  // Configure for better WebSocket handling
  perMessageDeflate: false,
  httpCompression: false,
  // Allow EIO3 clients
  allowEIO3: true,
});

// Log Socket.io configuration
console.log("Socket.io configured with:");
console.log("- CORS origins:", corsConfig.FRONTEND_DOMAINS);
console.log("- Transports:", ["polling", "websocket"]);
console.log("- Environment:", process.env.NODE_ENV || "development");

// Add middleware to handle the session properly
io.use((socket, next) => {
  const clientIp =
    socket.handshake.headers["x-forwarded-for"] ||
    socket.handshake.headers["true-client-ip"] ||
    socket.handshake.address;

  console.log(`Socket.io handshake from IP: ${clientIp}`);
  console.log(`Socket.io handshake headers:`, {
    origin: socket.handshake.headers.origin,
    transport: socket.handshake.query.transport,
    sid: socket.handshake.query.sid,
  });

  // Accept the connection
  next();
});

// Set up socket handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io server ready for connections`);
});

// Export app and server for testing
module.exports = { app, server };
