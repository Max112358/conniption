// backend/server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

// Import configuration
const { pool } = require("./config/database");
const corsConfig = require("./config/cors");

// Import middleware
const logger = require("./middleware/logger");
const errorHandler = require("./middleware/errorHandler");

// Import route handlers
const boardRoutes = require("./routes/boards");
const threadRoutes = require("./routes/threads");
const postRoutes = require("./routes/posts");

// Import socket handler
const setupSocketHandlers = require("./utils/socketHandler");

// Initialize database
const initDatabase = async () => {
  console.log("Initializing database...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL
      )
    `);

    await pool.query(`
      INSERT INTO boards (id, name, description)
      VALUES ('tech', 'Technology', 'Technology Discussion')
      ON CONFLICT (id) DO NOTHING
    `);

    await pool.query(`
      INSERT INTO boards (id, name, description)
      VALUES ('politics', 'Politics', 'Political Discussion')
      ON CONFLICT (id) DO NOTHING
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id SERIAL PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        topic TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_thread_per_board UNIQUE (id, board_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER NOT NULL,
        board_id TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id, board_id) REFERENCES threads(id, board_id) ON DELETE CASCADE
      )
    `);

    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Error initializing database:", err);
    throw err;
  }
};

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

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
