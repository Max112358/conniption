// backend/test/utils/db-test-utils.js
const { newDb } = require("pg-mem");
const fs = require("fs");
const path = require("path");

/**
 * Create an in-memory PostgreSQL database for testing
 * @param {Object} options - Options for the database
 * @returns {Object} Database instance and pool
 */
function createTestDatabase(options = {}) {
  // Create an in-memory instance of postgres
  const pgMem = newDb();

  // Enable foreign keys support
  pgMem.public.registerExtension("uuid-ossp", (schema) => {
    schema.registerFunction({
      name: "uuid_generate_v4",
      returns: "uuid",
      implementation: () => crypto.randomUUID(),
      impure: true,
    });
  });

  // Create a database adapter (pool)
  const pool = pgMem.adapters.createPool();

  // Create schema if a schema file is provided
  if (options.schemaFile) {
    const schemaPath = path.resolve(options.schemaFile);
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, "utf8");
      pgMem.public.query(schema);
    }
  }

  // Seed the database if seed data is provided
  if (options.seedData) {
    for (const table in options.seedData) {
      for (const row of options.seedData[table]) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns
          .map((_, index) => `$${index + 1}`)
          .join(", ");

        pgMem.public.query(
          `INSERT INTO ${table} (${columns.join(
            ", "
          )}) VALUES (${placeholders})`,
          values
        );
      }
    }
  }

  return {
    db: pgMem,
    pool,

    // Helper function to clean up the database
    cleanup: () => {
      // No cleanup needed for in-memory database
    },

    // Helper function to execute a query
    query: async (text, params) => {
      return pool.query(text, params);
    },
  };
}

module.exports = { createTestDatabase };
