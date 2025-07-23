// backend/migrations/add_statistics_tables.js
const { pool } = require("../config/database");
const crypto = require("crypto");

/**
 * Hash an IP address for privacy
 * @param {string} ipAddress - The IP address to hash
 * @returns {string} Hashed IP address
 */
const hashIpAddress = (ipAddress) => {
  if (!ipAddress || ipAddress === "unknown") return "unknown";
  return crypto.createHash("sha256").update(ipAddress).digest("hex");
};

/**
 * Migration to add statistics tracking tables
 */
const runMigration = async () => {
  console.log("Running migration: Add Statistics Tables");

  try {
    // Create page_views table for tracking unique visitors
    await pool.query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id SERIAL PRIMARY KEY,
        hashed_ip TEXT NOT NULL,
        country_code VARCHAR(2),
        board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
        viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Created page_views table");

    // Create post_stats table for tracking post creation
    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_stats (
        id SERIAL PRIMARY KEY,
        hashed_ip TEXT NOT NULL,
        country_code VARCHAR(2),
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Created post_stats table");

    // Create indexes for better query performance
    await pool.query(`
      -- Indexes for page_views
      CREATE INDEX IF NOT EXISTS idx_page_views_hashed_ip ON page_views(hashed_ip);
      CREATE INDEX IF NOT EXISTS idx_page_views_country_code ON page_views(country_code);
      CREATE INDEX IF NOT EXISTS idx_page_views_board_id ON page_views(board_id);
      CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at);
      CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at_desc ON page_views(viewed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_page_views_board_viewed ON page_views(board_id, viewed_at);
      
      -- Indexes for post_stats
      CREATE INDEX IF NOT EXISTS idx_post_stats_hashed_ip ON post_stats(hashed_ip);
      CREATE INDEX IF NOT EXISTS idx_post_stats_country_code ON post_stats(country_code);
      CREATE INDEX IF NOT EXISTS idx_post_stats_board_id ON post_stats(board_id);
      CREATE INDEX IF NOT EXISTS idx_post_stats_created_at ON post_stats(created_at);
      CREATE INDEX IF NOT EXISTS idx_post_stats_created_at_desc ON post_stats(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_post_stats_board_created ON post_stats(board_id, created_at);
    `);

    console.log("Created indexes for statistics tables");

    // Create materialized views for faster aggregate queries (optional)
    await pool.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS stats_summary AS
      SELECT 
        -- Overall unique visitors
        (SELECT COUNT(DISTINCT hashed_ip) FROM page_views) as total_unique_visitors,
        (SELECT COUNT(DISTINCT hashed_ip) FROM page_views 
         WHERE viewed_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as visitors_last_month,
        (SELECT COUNT(DISTINCT hashed_ip) FROM page_views 
         WHERE viewed_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as visitors_last_day,
        (SELECT COUNT(DISTINCT hashed_ip) FROM page_views 
         WHERE viewed_at > CURRENT_TIMESTAMP - INTERVAL '1 hour') as visitors_last_hour,
        
        -- Overall posts
        (SELECT COUNT(*) FROM post_stats) as total_posts,
        (SELECT COUNT(*) FROM post_stats 
         WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as posts_last_month,
        (SELECT COUNT(*) FROM post_stats 
         WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as posts_last_day,
        (SELECT COUNT(*) FROM post_stats 
         WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour') as posts_last_hour,
        
        -- Last update time
        CURRENT_TIMESTAMP as last_updated
    `);

    console.log("Created materialized view for stats summary");

    // Create refresh function for materialized view
    await pool.query(`
      CREATE OR REPLACE FUNCTION refresh_stats_summary()
      RETURNS void AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY stats_summary;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create unique index for concurrent refresh
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_summary_unique 
      ON stats_summary(last_updated);
    `);

    console.log("Created refresh function for materialized view");

    // Import historical data from existing posts table
    console.log("Importing historical post data...");

    // Fetch existing posts and hash IPs in Node.js
    const postsResult = await pool.query(`
      SELECT ip_address, country_code, board_id, created_at
      FROM posts
      WHERE ip_address IS NOT NULL
    `);

    if (postsResult.rows.length > 0) {
      // Prepare batch insert values
      const values = postsResult.rows.map((post) => [
        hashIpAddress(post.ip_address),
        post.country_code,
        post.board_id,
        post.created_at,
      ]);

      // Insert in batches of 1000
      const batchSize = 1000;
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);

        // Create placeholders for the query
        const placeholders = batch
          .map(
            (_, index) =>
              `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${
                index * 4 + 4
              })`
          )
          .join(", ");

        // Flatten the values array
        const flatValues = batch.flat();

        await pool.query(
          `
          INSERT INTO post_stats (hashed_ip, country_code, board_id, created_at)
          VALUES ${placeholders}
          ON CONFLICT DO NOTHING
        `,
          flatValues
        );
      }

      console.log(
        `Imported ${postsResult.rows.length} historical post records`
      );
    } else {
      console.log("No historical post data to import");
    }

    console.log("Migration completed successfully");
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
