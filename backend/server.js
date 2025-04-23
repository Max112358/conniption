const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
// Define the frontend domain in one place
const FRONTEND_DOMAIN = "https://conniption.pages.dev";
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Path to your CA certificate
const caCertPath = path.join(__dirname, "certs", "ca.pem");
const caCert = fs.readFileSync(caCertPath).toString();

// Configure PostgreSQL connection with proper CA certificate
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true, // Node will now trust the cert via the env var
});

// Initialize database
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create boards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL
      )
    `);

    // Insert default boards if they don't exist
    await client.query(`
      INSERT INTO boards (id, name, description)
      VALUES ('tech', 'Technology', 'Technology Discussion')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO boards (id, name, description)
      VALUES ('politics', 'Politics', 'Political Discussion')
      ON CONFLICT (id) DO NOTHING
    `);

    // We'll create threads and posts tables in the next iteration
  } finally {
    client.release();
  }
}

// Initialize database on startup
initDatabase().catch(console.error);

const app = express();
// Use the shared domain variable for Express CORS
app.use(
  cors({
    origin: FRONTEND_DOMAIN,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

const server = http.createServer(app);
// Use the same shared domain variable for Socket.io CORS
const io = socketIo(server, {
  cors: {
    origin: FRONTEND_DOMAIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// API endpoint to get all boards
app.get("/api/boards", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, description FROM boards");
    res.json({ boards: result.rows });
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ error: "Failed to fetch boards" });
  }
});

// API endpoint to get a specific board
app.get("/api/boards/:boardId", async (req, res) => {
  try {
    const { boardId } = req.params;
    const result = await pool.query(
      "SELECT id, name, description FROM boards WHERE id = $1",
      [boardId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Board not found" });
    }

    res.json({ board: result.rows[0] });
  } catch (error) {
    console.error("Error fetching board:", error);
    res.status(500).json({ error: "Failed to fetch board" });
  }
});

// Socket.io connection handling
io.on("connection", async (socket) => {
  console.log("New client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
