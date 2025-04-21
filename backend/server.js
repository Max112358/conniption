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

console.log("Reading CA cert from:", caCertPath);
console.log("CA cert exists?", fs.existsSync(caCertPath));

// Configure PostgreSQL connection with proper CA certificate
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: caCert,
    rejectUnauthorized: true, // Now we can safely set this to true
  },
});

// Initialize database
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create counters table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS counters (
        id TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      )
    `);

    // Insert default counter if it doesn't exist
    await client.query(`
      INSERT INTO counters (id, value)
      VALUES ('main', 0)
      ON CONFLICT (id) DO NOTHING
    `);
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

// Get counter from database
async function getCounter() {
  const result = await pool.query(
    "SELECT value FROM counters WHERE id = 'main'"
  );
  return result.rows[0].value;
}

// Update counter in database
async function updateCounter(value) {
  await pool.query("UPDATE counters SET value = $1 WHERE id = 'main'", [value]);
  return value;
}

// API endpoint to get the current counter value
app.get("/api/counter", async (req, res) => {
  try {
    const counter = await getCounter();
    res.json({ counter });
  } catch (error) {
    console.error("Error fetching counter:", error);
    res.status(500).json({ error: "Failed to fetch counter" });
  }
});

// Socket.io connection handling
io.on("connection", async (socket) => {
  console.log("New client connected");

  try {
    // Send current counter value to newly connected client
    const counter = await getCounter();
    socket.emit("counterUpdate", { counter });

    // Handle increment requests
    socket.on("increment", async () => {
      try {
        const counter = await getCounter();
        const updatedCounter = await updateCounter(counter + 1);
        io.emit("counterUpdate", { counter: updatedCounter });
      } catch (error) {
        console.error("Error incrementing counter:", error);
      }
    });
  } catch (error) {
    console.error("Error on new connection:", error);
  }

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
