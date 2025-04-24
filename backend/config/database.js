// backend/config/database.js
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Path to your CA certificate
const caCertPath = path.join(__dirname, "..", "certs", "ca.pem");
const caCert = fs.existsSync(caCertPath)
  ? fs.readFileSync(caCertPath).toString()
  : null;

console.log(`Database config: Using certificate: ${caCert ? "Yes" : "No"}`);
console.log(
  `Database connection string: ${process.env.DATABASE_URL ? "Set" : "Not set"}`
);

// Configure PostgreSQL connection with proper CA certificate
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true, // Node will now trust the cert via the env var
});

// Add event listeners for connection issues
pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log("Database connection successful");
    client.release();
    return true;
  } catch (err) {
    console.error("Database connection error:", err);
    return false;
  }
};

// Execute test connection on module load
testConnection();

module.exports = { pool, testConnection };
