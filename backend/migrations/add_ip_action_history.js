// backend/migrations/add_ip_action_history.js
const { pool } = require("../config/database");

/**
 * Migration to add IP action history tracking
 */
const runMigration = async () => {
  console.log("Running migration: Add IP Action History");

  try {
    // Create ip_action_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ip_action_history (
        id SERIAL PRIMARY KEY,
        ip_address TEXT NOT NULL,
        action_type TEXT NOT NULL CHECK (action_type IN ('post_deleted', 'thread_deleted', 'banned', 'unbanned', 'rangebanned', 'post_edited', 'color_changed', 'appeal_submitted', 'appeal_response', 'view_ip')),
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

    console.log("Created ip_action_history table");

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_ip_address ON ip_action_history(ip_address);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_action_type ON ip_action_history(action_type);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_board_id ON ip_action_history(board_id);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_admin_user_id ON ip_action_history(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_created_at ON ip_action_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_ip_action_history_ban_id ON ip_action_history(ban_id);
    `);

    console.log("Created indexes for ip_action_history");

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

    console.log("Created ip_action_summary view");

    // Optional: Import historical data from moderation_actions table
    console.log("Importing historical data from moderation_actions...");

    await pool.query(`
      INSERT INTO ip_action_history (ip_address, action_type, admin_user_id, admin_username, board_id, thread_id, post_id, ban_id, reason, created_at)
      SELECT 
        ma.ip_address,
        CASE 
          WHEN ma.action_type = 'delete_post' THEN 'post_deleted'
          WHEN ma.action_type = 'delete_thread' THEN 'thread_deleted'
          WHEN ma.action_type = 'ban' THEN 'banned'
          WHEN ma.action_type = 'unban' THEN 'unbanned'
          WHEN ma.action_type = 'edit_post' THEN 'post_edited'
          WHEN ma.action_type = 'change_post_color' THEN 'color_changed'
          WHEN ma.action_type = 'appeal_response' THEN 'appeal_response'
          ELSE ma.action_type
        END,
        ma.admin_user_id,
        au.username,
        ma.board_id,
        ma.thread_id,
        ma.post_id,
        ma.ban_id,
        ma.reason,
        ma.created_at
      FROM moderation_actions ma
      LEFT JOIN admin_users au ON ma.admin_user_id = au.id
      WHERE ma.ip_address IS NOT NULL
        AND ma.action_type IN ('delete_post', 'delete_thread', 'ban', 'unban', 'edit_post', 'change_post_color', 'appeal_response', 'view_ip')
      ON CONFLICT DO NOTHING
    `);

    const result = await pool.query("SELECT COUNT(*) FROM ip_action_history");
    console.log(
      `Migration completed successfully. ${result.rows[0].count} records in ip_action_history`
    );
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log("Migration completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { runMigration };
