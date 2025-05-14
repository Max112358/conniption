// backend/utils/dbInit.js
const { pool } = require("../config/database");
const boards = require("../config/boards");

/**
 * Initialize database tables and seed with initial boards
 */
const initDatabase = async () => {
  console.log("Initializing database...");
  try {
    // Create tables if they don't exist
    await createTables();

    // Seed boards
    await seedBoards();

    console.log(
      `Database initialized successfully with ${boards.length} boards.`
    );
    return true;
  } catch (err) {
    console.error("Error initializing database:", err);
    throw err;
  }
};

/**
 * Create database tables if they don't exist
 */
const createTables = async () => {
  try {
    // Create boards table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        nsfw BOOLEAN DEFAULT FALSE
      )
    `);

    // Add nsfw column if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE boards
        ADD COLUMN IF NOT EXISTS nsfw BOOLEAN DEFAULT FALSE
      `);
      console.log("Added NSFW column to boards table");
    } catch (err) {
      console.error("Error adding NSFW column:", err);
      // Continue with initialization even if this fails
    }

    // Create threads table
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

    // Create posts table
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

    console.log("Database tables created successfully");
  } catch (err) {
    console.error("Error creating database tables:", err);
    throw err;
  }
};

/**
 * Seed the database with initial boards
 */
const seedBoards = async () => {
  try {
    // Insert all boards using a loop
    for (const board of boards) {
      await pool.query(
        `
        INSERT INTO boards (id, name, description, nsfw)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE 
        SET name = $2, description = $3, nsfw = $4
      `,
        [board.id, board.name, board.description, board.nsfw || false]
      );
    }

    console.log(`Seeded ${boards.length} boards`);
  } catch (err) {
    console.error("Error seeding boards:", err);
    throw err;
  }
};

module.exports = { initDatabase };
