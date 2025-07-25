// backend/migrations/add_view_ip_action_type.js
const { pool } = require("../config/database");

/**
 * Migration to add 'view_ip' action type to ip_action_history constraint
 */
const runMigration = async () => {
  console.log(
    "Running migration: Add view_ip action type to ip_action_history"
  );

  try {
    // First, drop the existing constraint
    await pool.query(`
      ALTER TABLE ip_action_history 
      DROP CONSTRAINT IF EXISTS ip_action_history_action_type_check
    `);

    console.log("Dropped existing action_type constraint");

    // Add the new constraint with 'view_ip' included
    await pool.query(`
      ALTER TABLE ip_action_history 
      ADD CONSTRAINT ip_action_history_action_type_check 
      CHECK (action_type IN (
        'post_deleted', 
        'thread_deleted', 
        'banned', 
        'unbanned', 
        'rangebanned', 
        'post_edited', 
        'color_changed', 
        'appeal_submitted', 
        'appeal_response', 
        'view_ip',
        'ip_viewed'
      ))
    `);

    console.log("Added new action_type constraint with 'view_ip' action type");

    // Update any existing 'ip_viewed' entries to 'view_ip' for consistency
    const updateResult = await pool.query(`
      UPDATE ip_action_history 
      SET action_type = 'view_ip' 
      WHERE action_type = 'ip_viewed'
    `);

    if (updateResult.rowCount > 0) {
      console.log(
        `Updated ${updateResult.rowCount} rows from 'ip_viewed' to 'view_ip'`
      );
    }

    // Verify the migration
    const result = await pool.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'ip_action_history'::regclass
      AND conname = 'ip_action_history_action_type_check'
    `);

    if (result.rows.length > 0) {
      console.log("Migration completed successfully");
      console.log(
        "New constraint definition:",
        result.rows[0].constraint_definition
      );
    } else {
      throw new Error("Failed to verify constraint after migration");
    }
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
