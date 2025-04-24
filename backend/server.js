const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");

// Define the frontend domain in one place
const FRONTEND_DOMAIN = "https://conniption.pages.dev";

// Path to your CA certificate
const caCertPath = path.join(__dirname, "certs", "ca.pem");
const caCert = fs.readFileSync(caCertPath).toString();

// Configure PostgreSQL connection with proper CA certificate
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true, // Node will now trust the cert via the env var
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

// Limit file size to 5MB and only allow image files
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

// Initialize database
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create boards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL
      )
    `);

    // Insert default boards if they don't exist
    await client.query(`
      INSERT INTO boards (id, name, description)
      VALUES ('tech', 'Technology', 'Technology Discussion')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO boards (id, name, description)
      VALUES ('politics', 'Politics', 'Political Discussion')
      ON CONFLICT (id) DO NOTHING
    `);

    // Create threads table
    await client.query(`
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER NOT NULL,
        board_id TEXT NOT NULL,
        content TEXT NOT NULL,
        image_path TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id, board_id) REFERENCES threads(id, board_id) ON DELETE CASCADE
      )
    `);

    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Error initializing database:", err);
    throw err;
  } finally {
    client.release();
  }
}

// Initialize database on startup
initDatabase().catch(console.error);

const app = express();
// Use the shared domain variable for Express CORS
app.use(
  cors({
    origin: FRONTEND_DOMAIN,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const server = http.createServer(app);
// Use the same shared domain variable for Socket.io CORS
const io = socketIo(server, {
  cors: {
    origin: FRONTEND_DOMAIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// API endpoint to get all boards
app.get("/api/boards", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, description FROM boards");
    res.json({ boards: result.rows });
  } catch (error) {
    console.error("Error fetching boards:", error);
    res.status(500).json({ error: "Failed to fetch boards" });
  }
});

// API endpoint to get a specific board
app.get("/api/boards/:boardId", async (req, res) => {
  try {
    const { boardId } = req.params;
    const result = await pool.query(
      "SELECT id, name, description FROM boards WHERE id = $1",
      [boardId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Board not found" });
    }

    res.json({ board: result.rows[0] });
  } catch (error) {
    console.error("Error fetching board:", error);
    res.status(500).json({ error: "Failed to fetch board" });
  }
});

// API endpoint to get threads for a specific board
app.get("/api/boards/:boardId/threads", async (req, res) => {
  try {
    const { boardId } = req.params;

    // First check if board exists
    const boardResult = await pool.query(
      "SELECT id FROM boards WHERE id = $1",
      [boardId]
    );

    if (boardResult.rows.length === 0) {
      return res.status(404).json({ error: "Board not found" });
    }

    // Get threads with post count and last post time
    const result = await pool.query(
      `
      SELECT 
        t.id, 
        t.topic, 
        t.created_at,
        t.updated_at,
        p.content,
        p.image_path,
        (SELECT COUNT(*) FROM posts WHERE thread_id = t.id) as post_count
      FROM 
        threads t
      JOIN 
        posts p ON p.thread_id = t.id
      WHERE 
        t.board_id = $1 
        AND p.id = (SELECT MIN(id) FROM posts WHERE thread_id = t.id)
      ORDER BY 
        t.updated_at DESC
    `,
      [boardId]
    );

    // Transform the result to provide image_url instead of image_path
    const threadsWithImageUrls = result.rows.map((thread) => ({
      ...thread,
      image_url: thread.image_path
        ? `${req.protocol}://${req.get("host")}/uploads/${path.basename(
            thread.image_path
          )}`
        : null,
    }));

    res.json({ threads: threadsWithImageUrls });
  } catch (error) {
    console.error("Error fetching threads:", error);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// API endpoint to create a new thread with initial post
app.post(
  "/api/boards/:boardId/threads",
  upload.single("image"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { boardId } = req.params;
      const { topic, content } = req.body;

      // Validate request
      if (!topic || !content) {
        return res
          .status(400)
          .json({ error: "Topic and content are required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Image is required" });
      }

      // Check if board exists
      const boardResult = await client.query(
        "SELECT id FROM boards WHERE id = $1",
        [boardId]
      );

      if (boardResult.rows.length === 0) {
        return res.status(404).json({ error: "Board not found" });
      }

      // Start transaction
      await client.query("BEGIN");

      // Count threads in this board
      const threadCountResult = await client.query(
        "SELECT COUNT(*) FROM threads WHERE board_id = $1",
        [boardId]
      );

      const threadCount = parseInt(threadCountResult.rows[0].count);

      // If we have 100 threads, delete the oldest one
      if (threadCount >= 100) {
        const oldestThreadResult = await client.query(
          `
        SELECT id 
        FROM threads 
        WHERE board_id = $1 
        ORDER BY updated_at ASC 
        LIMIT 1
      `,
          [boardId]
        );

        if (oldestThreadResult.rows.length > 0) {
          const oldestThreadId = oldestThreadResult.rows[0].id;

          // Delete the oldest thread and its posts (should cascade delete)
          await client.query(
            "DELETE FROM threads WHERE id = $1 AND board_id = $2",
            [oldestThreadId, boardId]
          );
        }
      }

      // Create new thread
      const threadResult = await client.query(
        `
      INSERT INTO threads (board_id, topic, created_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `,
        [boardId, topic]
      );

      const threadId = threadResult.rows[0].id;

      // Create initial post with image
      await client.query(
        `
      INSERT INTO posts (thread_id, board_id, content, image_path, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `,
        [threadId, boardId, content, req.file.path]
      );

      // Commit transaction
      await client.query("COMMIT");

      // Notify connected clients about the new thread
      io.to(boardId).emit("thread_created", {
        threadId,
        boardId,
        topic,
      });

      res.status(201).json({
        message: "Thread created successfully",
        threadId,
        boardId,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error creating thread:", error);

      // Delete uploaded file if there was an error
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      res.status(500).json({ error: "Failed to create thread" });
    } finally {
      client.release();
    }
  }
);

// API endpoint to get a specific thread
app.get("/api/boards/:boardId/threads/:threadId", async (req, res) => {
  try {
    const { boardId, threadId } = req.params;

    // Check if thread exists
    const threadResult = await pool.query(
      `
      SELECT id, board_id, topic, created_at, updated_at
      FROM threads
      WHERE id = $1 AND board_id = $2
    `,
      [threadId, boardId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json({ thread: threadResult.rows[0] });
  } catch (error) {
    console.error("Error fetching thread:", error);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// API endpoint to get posts for a specific thread
app.get("/api/boards/:boardId/threads/:threadId/posts", async (req, res) => {
  try {
    const { boardId, threadId } = req.params;

    // Check if thread exists
    const threadResult = await pool.query(
      `
      SELECT id FROM threads WHERE id = $1 AND board_id = $2
    `,
      [threadId, boardId]
    );

    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: "Thread not found" });
    }

    // Get posts
    const postsResult = await pool.query(
      `
      SELECT id, content, image_path, created_at
      FROM posts
      WHERE thread_id = $1 AND board_id = $2
      ORDER BY created_at ASC
    `,
      [threadId, boardId]
    );

    // Transform the result to provide image_url instead of image_path
    const postsWithImageUrls = postsResult.rows.map((post) => ({
      ...post,
      image_url: post.image_path
        ? `${req.protocol}://${req.get("host")}/uploads/${path.basename(
            post.image_path
          )}`
        : null,
    }));

    res.json({ posts: postsWithImageUrls });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// API endpoint to create a new post in a thread
app.post(
  "/api/boards/:boardId/threads/:threadId/posts",
  upload.single("image"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { boardId, threadId } = req.params;
      const { content } = req.body;

      // Validate request
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      // Check if thread exists
      const threadResult = await client.query(
        `
      SELECT id FROM threads WHERE id = $1 AND board_id = $2
    `,
        [threadId, boardId]
      );

      if (threadResult.rows.length === 0) {
        return res.status(404).json({ error: "Thread not found" });
      }

      // Start transaction
      await client.query("BEGIN");

      // Create post
      let postQuery, postParams;

      if (req.file) {
        // Post with image
        postQuery = `
        INSERT INTO posts (thread_id, board_id, content, image_path, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING id
      `;
        postParams = [threadId, boardId, content, req.file.path];
      } else {
        // Post without image
        postQuery = `
        INSERT INTO posts (thread_id, board_id, content, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING id
      `;
        postParams = [threadId, boardId, content];
      }

      const postResult = await client.query(postQuery, postParams);
      const postId = postResult.rows[0].id;

      // Update thread's updated_at timestamp
      await client.query(
        `
      UPDATE threads
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND board_id = $2
    `,
        [threadId, boardId]
      );

      // Commit transaction
      await client.query("COMMIT");

      // Notify connected clients about the new post
      io.to(`${boardId}-${threadId}`).emit("post_created", {
        postId,
        threadId,
        boardId,
      });

      res.status(201).json({
        message: "Post created successfully",
        postId,
        threadId,
        boardId,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error creating post:", error);

      // Delete uploaded file if there was an error
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file:", err);
        });
      }

      res.status(500).json({ error: "Failed to create post" });
    } finally {
      client.release();
    }
  }
);

// Socket.io connection handling
io.on("connection", async (socket) => {
  console.log("New client connected");

  // Join board rooms for real-time updates
  socket.on("join_board", (boardId) => {
    socket.join(boardId);
    console.log(`Client joined board: ${boardId}`);
  });

  // Leave board room
  socket.on("leave_board", (boardId) => {
    socket.leave(boardId);
    console.log(`Client left board: ${boardId}`);
  });

  // Join thread room for real-time updates
  socket.on("join_thread", ({ boardId, threadId }) => {
    const roomId = `${boardId}-${threadId}`;
    socket.join(roomId);
    console.log(`Client joined thread: ${roomId}`);
  });

  // Leave thread room
  socket.on("leave_thread", ({ boardId, threadId }) => {
    const roomId = `${boardId}-${threadId}`;
    socket.leave(roomId);
    console.log(`Client left thread: ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
