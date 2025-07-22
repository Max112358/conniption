// backend/server.js
const express = require("express");
const { initDatabase } = require("./utils/dbInit");
const migrationRunner = require("./utils/migrationRunner");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const helmet = require("helmet");
const { pool } = require("./config/database");

// Import configuration
const corsConfig = require("./config/cors");

// Import middleware
const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");
const { checkBanned, enforceBan } = require("./middleware/adminAuth");
const securityHeaders = require("./middleware/securityHeaders");

// Import security middleware from security.js
const {
  generalLimiter,
  sanitizeInput,
  preventXSS,
  preventParameterPollution,
} = require("./middleware/security");

// Import route handlers
const boardRoutes = require("./routes/boards");
const adminRoutes = require("./routes/admin");
const statsRoutes = require("./routes/stats"); // ADD THIS

// Import socket handler
const setupSocketHandlers = require("./utils/socketHandler");

// Import scheduled jobs
const scheduledJobs = require("./utils/scheduledJobs");

// Import stats tracking middleware and scheduler
const { trackPageViews } = require("./middleware/statsTracking"); // ADD THIS
const statsScheduler = require("./services/statsScheduler"); // ADD THIS

// Import utility functions
const getClientIp = require("./utils/getClientIp");

// Create housekeeping service directory if needed
const fs = require("fs");
const housekeepingPath = path.join(__dirname, "services");
if (!fs.existsSync(housekeepingPath)) {
  fs.mkdirSync(housekeepingPath, { recursive: true });
}

// Set up Express app
const app = express();

// Trust proxy - important for Socket.io when behind a proxy
app.set("trust proxy", 1);

// Apply CORS configuration
app.use(corsConfig);

// Enhanced security headers with helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "https://*.r2.dev",
          "https://conniption.xyz",
          "blob:",
          "data:",
        ],
        mediaSrc: [
          "'self'",
          "https://*.r2.dev",
          "https://conniption.xyz",
          "blob:",
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "data:"],
        connectSrc: [
          "'self'",
          "https://conniption.onrender.com",
          "wss://conniption.onrender.com",
        ],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // May need to disable for media embedding
  })
);

// Apply custom security headers
app.use(securityHeaders);

// Apply general rate limiting to API routes
app.use("/api/", generalLimiter);

// Apply XSS protection
app.use(preventXSS);

// Prevent parameter pollution
app.use(preventParameterPollution);

// Add JSON body parser with size limit
app.use(express.json({ limit: "10mb" })); // Slightly higher than 4MB to account for base64 encoding
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Apply input sanitization from security.js
app.use(sanitizeInput);

// Apply page view tracking middleware - ADD THIS
app.use(trackPageViews);

// Session configuration with enhanced security
const sessionSecret =
  process.env.SESSION_SECRET ||
  (() => {
    if (process.env.NODE_ENV === "production") {
      console.error("FATAL: SESSION_SECRET must be set in production");
      process.exit(1);
    }
    console.warn("WARNING: Using default session secret in development");
    return "development_secret_change_in_production";
  })();

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "admin_sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: "sessionId", // Change default session name
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

// Add request logger middleware
app.use(logger);

// Security monitoring middleware
app.use((req, res, next) => {
  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\.\//g, // Directory traversal
    /<script/i, // Script injection attempts
    /union.*select/i, // SQL injection attempts
    /exec\s*\(/i, // Code execution attempts
    /eval\s*\(/i, // Eval attempts
    /on\w+\s*=/i, // Event handler injection
  ];

  const url = req.url + (req.body ? JSON.stringify(req.body) : "");
  const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(url));

  if (isSuspicious) {
    const clientIp = getClientIp(req);
    console.warn(
      `SECURITY: Suspicious request detected from ${clientIp}: ${req.method} ${req.url}`
    );

    // Log to database for tracking
    pool
      .query(
        `INSERT INTO security_incidents (ip_address, method, url, user_agent, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [clientIp, req.method, req.url, req.headers["user-agent"]]
      )
      .catch((err) => console.error("Failed to log security incident:", err));
  }

  next();
});

// Check if user is banned - this just adds ban info to req object
app.use(checkBanned);

// Register routes
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes); // ADD THIS

// Apply ban enforcement to content routes only (not admin routes)
app.use("/api/boards", enforceBan);
app.use("/api/boards", boardRoutes);

// Health check endpoint with limited information
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Detailed health check for internal monitoring (protected)
app.get("/health/detailed", (req, res) => {
  // Simple API key check for monitoring services
  const apiKey = req.headers["x-health-check-key"];
  if (apiKey !== process.env.HEALTH_CHECK_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    socketio: io ? "initialized" : "not initialized",
    environment: process.env.NODE_ENV || "development",
    housekeeping: scheduledJobs.getStatus(),
    statsScheduler: statsScheduler.getStatus(), // ADD THIS
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Socket.io specific health check
app.get("/socket.io/health", (req, res) => {
  const engineIO = io && io.engine;
  res.json({
    status: "ok",
    transports: ["polling", "websocket"],
    clients: engineIO ? engineIO.clientsCount : 0,
    cors: corsConfig.FRONTEND_DOMAINS,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Use the enhanced error handler
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

// Initialize database and run migrations before starting server
const startServer = async () => {
  try {
    console.log("Starting server initialization...");

    // Step 1: Initialize database tables
    console.log("Initializing database schema...");
    await initDatabase();
    console.log("Database schema initialized successfully");

    // Step 2: Run pending migrations
    console.log("Checking for pending migrations...");
    const migrationSuccess = await migrationRunner.runPendingMigrations();

    if (!migrationSuccess) {
      console.error("Migration failed! Server startup aborted.");
      process.exit(1);
    }
    console.log("All migrations completed successfully");

    // Step 3: Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.io server ready for connections`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

      if (
        process.env.NODE_ENV === "production" &&
        !process.env.SESSION_SECRET
      ) {
        console.error("FATAL: SESSION_SECRET not set in production!");
        process.exit(1);
      }

      // Start scheduled jobs after server is running
      scheduledJobs.start();
      console.log("Scheduled jobs started");

      // Start statistics scheduler - ADD THIS
      statsScheduler.start();
      console.log("Statistics scheduler started");
    });
  } catch (error) {
    console.error("Server startup error:", error);

    // Log to database if possible
    try {
      await pool.query(
        `INSERT INTO application_errors (error_type, message, stack, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        ["startup_error", error.message, error.stack]
      );
    } catch (dbError) {
      console.error("Failed to log startup error to database:", dbError);
    }

    process.exit(1);
  }
};

// Start the server
startServer();

// Graceful shutdown handling
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log("Shutdown already in progress");
    return;
  }

  console.log(`\nReceived ${signal}, starting graceful shutdown`);
  isShuttingDown = true;

  // Stop scheduled jobs first
  console.log("Stopping scheduled jobs...");
  scheduledJobs.stop();

  // Stop accepting new connections
  console.log("Closing HTTP server...");
  server.close(async () => {
    console.log("HTTP server closed");

    // Close Socket.io connections
    console.log("Closing Socket.io connections...");
    io.close(() => {
      console.log("Socket.io connections closed");
    });

    // Close database pool
    console.log("Closing database connections...");
    try {
      await pool.end();
      console.log("Database connections closed");
    } catch (err) {
      console.error("Error closing database connections:", err);
    }

    console.log("Graceful shutdown complete");
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  // Log to database if possible
  pool
    .query(
      `INSERT INTO application_errors (error_type, message, stack, created_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      ["uncaught_exception", err.message, err.stack]
    )
    .catch((e) => console.error("Failed to log error:", e));

  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled promise rejection:", reason);
  // Log to database if possible
  pool
    .query(
      `INSERT INTO application_errors (error_type, message, stack, created_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      ["unhandled_rejection", String(reason), new Error().stack]
    )
    .catch((e) => console.error("Failed to log error:", e));

  gracefulShutdown("unhandledRejection");
});

// Export app and server for testing
module.exports = { app, server };
