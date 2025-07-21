// backend/utils/migrationRunner.js
const { pool } = require("../config/database");
const fs = require("fs").promises;
const path = require("path");

/**
 * Migration runner to handle database migrations
 */
class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, "..", "migrations");
  }

  /**
   * Initialize migrations table
   */
  async initMigrationsTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Migrations table ready");
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations() {
    const result = await pool.query("SELECT filename FROM migrations");
    return result.rows.map((row) => row.filename);
  }

  /**
   * Run a single migration file
   */
  async runMigration(filename) {
    const migrationPath = path.join(this.migrationsPath, filename);

    try {
      // Import and run the migration
      const migration = require(migrationPath);

      if (migration.runMigration) {
        console.log(`Running migration: ${filename}`);
        await migration.runMigration();

        // Mark migration as executed
        await pool.query("INSERT INTO migrations (filename) VALUES ($1)", [
          filename,
        ]);

        console.log(`Migration completed: ${filename}`);
        return true;
      } else {
        console.error(
          `Migration ${filename} does not export runMigration function`
        );
        return false;
      }
    } catch (error) {
      console.error(`Failed to run migration ${filename}:`, error);
      return false;
    }
  }

  /**
   * Run all pending migrations
   */
  async runPendingMigrations() {
    try {
      // Initialize migrations table
      await this.initMigrationsTable();

      // Get list of executed migrations
      const executedMigrations = await this.getExecutedMigrations();

      // Get all migration files
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter((file) => file.endsWith(".js"))
        .sort(); // Sort to ensure consistent order

      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(
        (file) => !executedMigrations.includes(file)
      );

      if (pendingMigrations.length === 0) {
        console.log("No pending migrations");
        return true;
      }

      console.log(`Found ${pendingMigrations.length} pending migrations`);

      // Run each pending migration
      let success = true;
      for (const migration of pendingMigrations) {
        const result = await this.runMigration(migration);
        if (!result) {
          success = false;
          break;
        }
      }

      return success;
    } catch (error) {
      console.error("Migration runner error:", error);
      return false;
    }
  }
}

// Export singleton instance
const migrationRunner = new MigrationRunner();
module.exports = migrationRunner;
