// backend/scripts/resetDatabase.js
const { pool } = require("../config/database");
const { initDatabase } = require("../utils/dbInit");

/**
 * Complete database reset script
 * WARNING: This will destroy all data!
 */
const resetDatabase = async () => {
  console.log("🚨 WARNING: This will completely wipe the database!");
  console.log("Starting database reset in 3 seconds...");

  // Give user a chance to cancel
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    console.log("🗑️  Dropping all tables...");

    // Drop all tables in the correct order
    const dropCommands = [
      "DROP TABLE IF EXISTS survey_response_options CASCADE",
      "DROP TABLE IF EXISTS survey_responses CASCADE",
      "DROP TABLE IF EXISTS survey_options CASCADE",
      "DROP TABLE IF EXISTS surveys CASCADE",
      "DROP TABLE IF EXISTS moderation_actions CASCADE",
      "DROP TABLE IF EXISTS bans CASCADE",
      "DROP TABLE IF EXISTS rangebans CASCADE",
      "DROP TABLE IF EXISTS admin_sessions CASCADE",
      "DROP TABLE IF EXISTS admin_users CASCADE",
      "DROP TABLE IF EXISTS posts CASCADE",
      "DROP TABLE IF EXISTS threads CASCADE",
      "DROP TABLE IF EXISTS boards CASCADE",
      "DROP VIEW IF EXISTS survey_results CASCADE",
    ];

    for (const command of dropCommands) {
      await pool.query(command);
      console.log(`✅ Executed: ${command}`);
    }

    console.log("🔄 Reinitializing database...");

    // Reinitialize the database
    await initDatabase();

    console.log("✅ Database reset complete!");
    console.log("📊 New database initialized with fresh tables and boards");
  } catch (error) {
    console.error("❌ Error during database reset:", error);
    throw error;
  } finally {
    // Close the pool
    await pool.end();
    console.log("🔌 Database connection closed");
  }
};

// Run the reset if this script is executed directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log("🎉 Reset completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Reset failed:", error);
      process.exit(1);
    });
}

module.exports = { resetDatabase };
