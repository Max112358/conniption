// backend/utils/dbInit.js
const { pool } = require("../config/database");
const boards = require("../config/boards");

/**
 * Initialize database tables and seed with initial boards
 */
const initDatabase = async () => {
  console.log("Initializing database...");
  try {
    // Create tables
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
 * Create database tables
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

    // Create threads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id SERIAL PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        topic TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        thread_salt TEXT,
        is_sticky BOOLEAN DEFAULT FALSE,
        is_dead BOOLEAN DEFAULT FALSE,
        died_at TIMESTAMP WITH TIME ZONE,
        post_count INTEGER DEFAULT 0,
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
        file_type TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        thread_user_id TEXT,
        country_code VARCHAR(2),
        color VARCHAR(20) DEFAULT 'black' CHECK (color IN ('black', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'brown')),
        dont_bump BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (thread_id, board_id) REFERENCES threads(id, board_id) ON DELETE CASCADE
      )
    `);

    // ==================== SURVEY SYSTEM TABLES ====================

    // Create surveys table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS surveys (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        thread_id INTEGER NOT NULL,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        survey_type TEXT NOT NULL CHECK (survey_type IN ('single', 'multiple')),
        question TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE(post_id)
      )
    `);

    // Create survey options table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_options (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL,
        option_order INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_survey_option_order UNIQUE (survey_id, option_order)
      )
    `);

    // Create survey responses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_responses (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
        ip_address TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_survey_ip UNIQUE (survey_id, ip_address)
      )
    `);

    // Create survey response options table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_response_options (
        id SERIAL PRIMARY KEY,
        response_id INTEGER NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
        option_id INTEGER NOT NULL REFERENCES survey_options(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_response_option UNIQUE (response_id, option_id)
      )
    `);

    // ==================== ADMIN SYSTEM TABLES ====================

    // Create admin_users table with security enhancements
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('janitor', 'moderator', 'admin')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE,
        boards TEXT[],
        is_active BOOLEAN DEFAULT TRUE,
        is_locked BOOLEAN DEFAULT FALSE,
        locked_at TIMESTAMP WITH TIME ZONE,
        failed_login_count INTEGER DEFAULT 0,
        last_failed_login TIMESTAMP WITH TIME ZONE
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
        action_type TEXT NOT NULL CHECK (action_type IN ('ban', 'unban', 'delete_post', 'delete_thread', 'edit_post', 'appeal_response', 'rangeban', 'remove_rangeban', 'view_ip', 'change_post_color', 'sticky_thread', 'unsticky_thread')),
        board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
        thread_id INTEGER,
        post_id INTEGER,
        ban_id INTEGER REFERENCES bans(id) ON DELETE CASCADE,
        rangeban_id INTEGER REFERENCES rangebans(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT
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

    // ==================== IP ACTION HISTORY TABLE ====================

    // Create ip_action_history table to track all actions against IPs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ip_action_history (
        id SERIAL PRIMARY KEY,
        ip_address TEXT NOT NULL,
        action_type TEXT NOT NULL CHECK (action_type IN ('post_deleted', 'thread_deleted', 'banned', 'unbanned', 'rangebanned', 'post_edited', 'color_changed', 'appeal_submitted', 'appeal_response')),
        admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        admin_username TEXT,
        board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
        thread_id INTEGER,
        post_id INTEGER,
        ban_id INTEGER REFERENCES bans(id) ON DELETE SET NULL,
        rangeban_id INTEGER REFERENCES rangebans(id) ON DELETE SET NULL,
        reason TEXT,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ==================== SECURITY TRACKING TABLES ====================

    // Create admin access logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_access_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        username TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        status_code INTEGER,
        duration_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create failed login attempts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS failed_login_attempts (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT,
        attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create security incidents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_incidents (
        id SERIAL PRIMARY KEY,
        ip_address TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        user_agent TEXT,
        incident_type TEXT,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create application errors table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS application_errors (
        id SERIAL PRIMARY KEY,
        error_type TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        ip_address TEXT,
        url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ==================== CREATE ALL INDEXES ====================

    // Indexes for boards table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_boards_nsfw ON boards(nsfw);
      CREATE INDEX IF NOT EXISTS idx_boards_thread_ids_enabled ON boards(thread_ids_enabled);
      CREATE INDEX IF NOT EXISTS idx_boards_country_flags_enabled ON boards(country_flags_enabled);
    `);

    // Indexes for threads table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_board_id ON threads(board_id);
      CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at);
      CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at);
      CREATE INDEX IF NOT EXISTS idx_threads_is_sticky ON threads(is_sticky);
      CREATE INDEX IF NOT EXISTS idx_threads_board_sticky ON threads(board_id, is_sticky DESC);
      CREATE INDEX IF NOT EXISTS idx_threads_is_dead ON threads(is_dead);
      CREATE INDEX IF NOT EXISTS idx_threads_died_at ON threads(died_at);
      CREATE INDEX IF NOT EXISTS idx_threads_post_count ON threads(post_count);
    `);

    // Indexes for posts table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_thread_id ON posts(thread_id);
      CREATE INDEX IF NOT EXISTS idx_posts_board_id ON posts(board_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
      CREATE INDEX IF NOT EXISTS idx_posts_ip_address ON posts(ip_address);
      CREATE INDEX IF NOT EXISTS idx_posts_file_type ON posts(file_type);
      CREATE INDEX IF NOT EXISTS idx_posts_thread_user_id ON posts(thread_user_id);
      CREATE INDEX IF NOT EXISTS idx_posts_country_code ON posts(country_code);
      CREATE INDEX IF NOT EXISTS idx_posts_color ON posts(color);
      CREATE INDEX IF NOT EXISTS idx_posts_dont_bump ON posts(dont_bump);
    `);

    // Indexes for survey tables
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_surveys_post_id ON surveys(post_id);
      CREATE INDEX IF NOT EXISTS idx_surveys_board_id ON surveys(board_id);
      CREATE INDEX IF NOT EXISTS idx_surveys_thread_id ON surveys(thread_id);
      CREATE INDEX IF NOT EXISTS idx_surveys_is_active ON surveys(is_active);
      CREATE INDEX IF NOT EXISTS idx_survey_options_survey_id ON survey_options(survey_id);
      CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
      CREATE INDEX IF NOT EXISTS idx_survey_responses_ip ON survey_responses(ip_address);
      CREATE INDEX IF NOT EXISTS idx_survey_response_options_response_id ON survey_response_options(response_id);
      CREATE INDEX IF NOT EXISTS idx_survey_response_options_option_id ON survey_response_options(option_id);
    `);

    // Indexes for admin tables
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
      CREATE INDEX IF NOT EXISTS idx_admin_users_boards ON admin_users USING GIN(boards);
      CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);
      CREATE INDEX IF NOT EXISTS idx_admin_users_is_locked ON admin_users(is_locked);
      CREATE INDEX IF NOT EXISTS idx_rangebans_ban_type ON rangebans(ban_type);
      CREATE INDEX IF NOT EXISTS idx_rangebans_ban_value ON rangebans(ban_value);
      CREATE INDEX IF NOT EXISTS idx_rangebans_board_id ON rangebans(board_id);
      CREATE INDEX IF NOT EXISTS idx_rangebans_is_active ON rangebans(is_active);
      CREATE INDEX IF NOT EXISTS idx_rangebans_expires_at ON rangebans(expires_at);
      CREATE INDEX IF NOT EXISTS idx_bans_ip_address ON bans(ip_address);
      CREATE INDEX IF NOT EXISTS idx_bans_board_id ON bans(board_id);
      CREATE INDEX IF NOT EXISTS idx_bans_is_active ON bans(is_active);
      CREATE INDEX IF NOT EXISTS idx_bans_expires_at ON bans(expires_at);
      CREATE INDEX IF NOT EXISTS idx_bans_appeal_status ON bans(appeal_status);
      CREATE INDEX IF NOT EXISTS idx_moderation_actions_admin_user_id ON moderation_actions(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_actions_board_id ON moderation_actions(board_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_actions_action_type ON moderation_actions(action_type);
      CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_at ON moderation_actions(created_at);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expire ON admin_sessions(expire);
    `);

    // Indexes for IP action history table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_ip_address ON ip_action_history(ip_address);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_action_type ON ip_action_history(action_type);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_board_id ON ip_action_history(board_id);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_admin_user_id ON ip_action_history(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_created_at ON ip_action_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_ban_id ON ip_action_history(ban_id);
    `);

    // Indexes for security tracking tables
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_access_logs_user_id ON admin_access_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_access_logs_username ON admin_access_logs(username);
      CREATE INDEX IF NOT EXISTS idx_admin_access_logs_created_at ON admin_access_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_admin_access_logs_ip_address ON admin_access_logs(ip_address);
      CREATE INDEX IF NOT EXISTS idx_admin_access_logs_path ON admin_access_logs(path);
      CREATE INDEX IF NOT EXISTS idx_failed_login_username ON failed_login_attempts(username);
      CREATE INDEX IF NOT EXISTS idx_failed_login_ip ON failed_login_attempts(ip_address);
      CREATE INDEX IF NOT EXISTS idx_failed_login_attempted_at ON failed_login_attempts(attempted_at);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_ip ON security_incidents(ip_address);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_created ON security_incidents(created_at);
      CREATE INDEX IF NOT EXISTS idx_application_errors_created ON application_errors(created_at);
      CREATE INDEX IF NOT EXISTS idx_application_errors_type ON application_errors(error_type);
    `);

    // ==================== CREATE VIEWS ====================

    // Create view for survey results
    await pool.query(`
      CREATE OR REPLACE VIEW survey_results AS
      SELECT 
        s.id as survey_id,
        s.question,
        s.survey_type,
        so.id as option_id,
        so.option_text,
        so.option_order,
        COUNT(sro.response_id) as vote_count,
        ROUND((COUNT(sro.response_id)::NUMERIC / NULLIF((SELECT COUNT(DISTINCT id) FROM survey_responses WHERE survey_id = s.id), 0) * 100), 2) as percentage
      FROM surveys s
      CROSS JOIN survey_options so
      LEFT JOIN survey_response_options sro ON so.id = sro.option_id
      LEFT JOIN survey_responses sr ON sro.response_id = sr.id AND sr.survey_id = s.id
      WHERE so.survey_id = s.id
      GROUP BY s.id, s.question, s.survey_type, so.id, so.option_text, so.option_order
      ORDER BY s.id, so.option_order
    `);

    // Create view for active bans
    await pool.query(`
      CREATE OR REPLACE VIEW active_bans AS
      SELECT 
        b.*,
        au.username as banned_by_username
      FROM bans b
      LEFT JOIN admin_users au ON b.admin_user_id = au.id
      WHERE b.is_active = TRUE
        AND (b.expires_at IS NULL OR b.expires_at > CURRENT_TIMESTAMP)
    `);

    // Create view for admin activity summary
    await pool.query(`
      CREATE OR REPLACE VIEW admin_activity_summary AS
      SELECT 
        au.id as user_id,
        au.username,
        au.role,
        COUNT(DISTINCT aal.id) as total_accesses,
        COUNT(DISTINCT ma.id) as total_mod_actions,
        MAX(aal.created_at) as last_access,
        MAX(au.last_login) as last_login
      FROM admin_users au
      LEFT JOIN admin_access_logs aal ON au.id = aal.user_id
      LEFT JOIN moderation_actions ma ON au.id = ma.admin_user_id
      WHERE au.is_active = TRUE
      GROUP BY au.id, au.username, au.role
    `);

    // Create view for IP action summary
    await pool.query(`
      CREATE OR REPLACE VIEW ip_action_summary AS
      SELECT 
        ip_address,
        COUNT(*) as total_actions,
        COUNT(DISTINCT board_id) as boards_affected,
        COUNT(CASE WHEN action_type = 'banned' THEN 1 END) as ban_count,
        COUNT(CASE WHEN action_type = 'post_deleted' THEN 1 END) as posts_deleted,
        COUNT(CASE WHEN action_type = 'thread_deleted' THEN 1 END) as threads_deleted,
        MIN(created_at) as first_action,
        MAX(created_at) as last_action,
        COUNT(DISTINCT admin_user_id) as unique_admins
      FROM ip_action_history
      GROUP BY ip_address
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
