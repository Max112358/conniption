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
        nsfw BOOLEAN DEFAULT FALSE,
        thread_ids_enabled BOOLEAN DEFAULT FALSE,
        country_flags_enabled BOOLEAN DEFAULT FALSE
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

    // Add new columns to boards table if they don't exist
    try {
      await pool.query(`
        ALTER TABLE boards
        ADD COLUMN IF NOT EXISTS thread_ids_enabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS country_flags_enabled BOOLEAN DEFAULT FALSE
      `);
      console.log(
        "Added thread_ids_enabled and country_flags_enabled columns to boards table"
      );
    } catch (err) {
      console.error("Error adding new columns to boards:", err);
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
        thread_salt TEXT,
        CONSTRAINT unique_thread_per_board UNIQUE (id, board_id)
      )
    `);

    // Add thread_salt column to threads if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE threads
        ADD COLUMN IF NOT EXISTS thread_salt TEXT
      `);
      console.log("Added thread_salt column to threads table");
    } catch (err) {
      console.error("Error adding thread_salt column:", err);
    }

    // Create posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER NOT NULL,
        board_id TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        file_type TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        thread_user_id TEXT,
        country_code VARCHAR(2),
        FOREIGN KEY (thread_id, board_id) REFERENCES threads(id, board_id) ON DELETE CASCADE
      )
    `);

    // Add ip_address column to posts if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS ip_address TEXT
      `);
      console.log("Added ip_address column to posts table");
    } catch (err) {
      console.error("Error adding ip_address column:", err);
      // Continue with initialization even if this fails
    }

    // Add file_type column to posts if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS file_type TEXT
      `);
      console.log("Added file_type column to posts table");

      // Update existing posts to set file_type
      await pool.query(`
        UPDATE posts
        SET file_type = 
          CASE 
            WHEN image_url LIKE '%.mp4' THEN 'video'
            WHEN image_url LIKE '%.webm' THEN 'video'
            WHEN image_url IS NOT NULL THEN 'image'
            ELSE NULL
          END
        WHERE image_url IS NOT NULL AND file_type IS NULL
      `);
      console.log("Updated file_type for existing posts");
    } catch (err) {
      console.error("Error adding file_type column:", err);
      // Continue with initialization even if this fails
    }

    // Add new columns to posts if they don't exist
    try {
      await pool.query(`
        ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS thread_user_id TEXT,
        ADD COLUMN IF NOT EXISTS country_code VARCHAR(2)
      `);
      console.log(
        "Added thread_user_id and country_code columns to posts table"
      );
    } catch (err) {
      console.error("Error adding new columns to posts:", err);
    }

    // Create index for file_type
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_file_type ON posts(file_type)
      `);
    } catch (err) {
      console.error("Error creating file_type index:", err);
    }

    // Create indexes for new columns
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_thread_user_id ON posts(thread_user_id);
        CREATE INDEX IF NOT EXISTS idx_posts_country_code ON posts(country_code);
      `);
    } catch (err) {
      console.error("Error creating indexes:", err);
    }

    // ==================== ADMIN SYSTEM TABLES ====================

    // Create admin_users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('janitor', 'moderator', 'admin')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE,
        boards TEXT[], -- Array of board IDs this user can moderate (empty means all boards)
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Create rangebans table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rangebans (
        id SERIAL PRIMARY KEY,
        ban_type TEXT NOT NULL CHECK (ban_type IN ('country', 'ip_range', 'asn')),
        ban_value TEXT NOT NULL,
        board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE(ban_type, ban_value, board_id)
      )
    `);

    // Create bans table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bans (
        id SERIAL PRIMARY KEY,
        ip_address TEXT NOT NULL,
        board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        appeal_text TEXT,
        appeal_status TEXT CHECK (appeal_status IN ('none', 'pending', 'approved', 'denied')) DEFAULT 'none',
        post_content TEXT,
        post_image_url TEXT,
        thread_id INTEGER,
        post_id INTEGER,
        rangeban_id INTEGER REFERENCES rangebans(id) ON DELETE SET NULL
      )
    `);

    // Create moderation_actions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS moderation_actions (
        id SERIAL PRIMARY KEY,
        admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        action_type TEXT NOT NULL CHECK (action_type IN ('ban', 'unban', 'delete_post', 'delete_thread', 'edit_post', 'appeal_response', 'rangeban', 'remove_rangeban', 'view_ip')),
        board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
        thread_id INTEGER,
        post_id INTEGER,
        ban_id INTEGER REFERENCES bans(id) ON DELETE CASCADE,
        rangeban_id INTEGER REFERENCES rangebans(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT -- IP address that was moderated (for reference)
      )
    `);

    // Create admin sessions table for express-session
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        sid varchar NOT NULL COLLATE "default",
        sess json NOT NULL,
        expire timestamp(6) NOT NULL,
        CONSTRAINT admin_sessions_pkey PRIMARY KEY (sid)
      )
    `);

    // Create indexes for admin tables
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
      CREATE INDEX IF NOT EXISTS idx_admin_users_boards ON admin_users USING GIN(boards);
      CREATE INDEX IF NOT EXISTS idx_rangebans_ban_type ON rangebans(ban_type);
      CREATE INDEX IF NOT EXISTS idx_rangebans_ban_value ON rangebans(ban_value);
      CREATE INDEX IF NOT EXISTS idx_rangebans_board_id ON rangebans(board_id);
      CREATE INDEX IF NOT EXISTS idx_rangebans_is_active ON rangebans(is_active);
      CREATE INDEX IF NOT EXISTS idx_rangebans_expires_at ON rangebans(expires_at);
      CREATE INDEX IF NOT EXISTS idx_bans_ip_address ON bans(ip_address);
      CREATE INDEX IF NOT EXISTS idx_bans_board_id ON bans(board_id);
      CREATE INDEX IF NOT EXISTS idx_bans_is_active ON bans(is_active);
      CREATE INDEX IF NOT EXISTS idx_moderation_actions_admin_user_id ON moderation_actions(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_actions_board_id ON moderation_actions(board_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_actions_action_type ON moderation_actions(action_type);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expire ON admin_sessions(expire);
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
        INSERT INTO boards (id, name, description, nsfw, thread_ids_enabled, country_flags_enabled)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE 
        SET name = $2, description = $3, nsfw = $4, 
            thread_ids_enabled = $5, country_flags_enabled = $6
      `,
        [
          board.id,
          board.name,
          board.description,
          board.nsfw || false,
          board.thread_ids_enabled || false,
          board.country_flags_enabled || false,
        ]
      );
    }

    console.log(`Seeded ${boards.length} boards`);
  } catch (err) {
    console.error("Error seeding boards:", err);
    throw err;
  }
};

module.exports = { initDatabase };
