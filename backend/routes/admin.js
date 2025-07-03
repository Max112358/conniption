// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const adminModel = require("../models/admin");
const banModel = require("../models/ban");
const moderationModel = require("../models/moderation");
const adminAuth = require("../middleware/adminAuth");
const rangebanRoutes = require("./admin/rangebans");

// Register sub-routes
router.use("/rangebans", rangebanRoutes);

/**
 * @route   POST /api/admin/login
 * @desc    Authenticate admin user
 * @access  Public
 */
router.post("/login", async (req, res, next) => {
  const { username, password } = req.body;
  console.log(`Route: POST /api/admin/login - ${username}`);

  try {
    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        error: "Missing credentials",
        required: ["username", "password"],
      });
    }

    // Authenticate user
    const user = await adminModel.authenticateAdmin(username, password);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create session with user info
    req.session.adminUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      boards: user.boards,
    };

    res.json({
      message: "Authentication successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        boards: user.boards,
      },
    });
  } catch (error) {
    console.error("Route Error - POST /api/admin/login:", error);
    next(error);
  }
});

/**
 * @route   GET /api/admin/logout
 * @desc    Logout admin user
 * @access  Private
 */
router.get("/logout", adminAuth.requireAuth, (req, res) => {
  console.log(
    `Route: GET /api/admin/logout - ${req.session.adminUser.username}`
  );

  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ error: "Failed to logout" });
    }

    res.json({ message: "Logout successful" });
  });
});

/**
 * @route   GET /api/admin/profile
 * @desc    Get admin user profile
 * @access  Private
 */
router.get("/profile", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/profile - ${req.session.adminUser.username}`
  );

  try {
    const userId = req.session.adminUser.id;
    const user = await adminModel.getAdminUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Route Error - GET /api/admin/profile:", error);
    next(error);
  }
});

/**
 * @route   PUT /api/admin/profile
 * @desc    Update admin user profile
 * @access  Private
 */
router.put("/profile", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: PUT /api/admin/profile - ${req.session.adminUser.username}`
  );

  try {
    const userId = req.session.adminUser.id;
    const { email, password } = req.body;

    // Only allow updating email and password in profile
    const updates = {};
    if (email) updates.email = email;
    if (password) updates.password = password;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const updatedUser = await adminModel.updateAdminUser(userId, updates);

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Route Error - PUT /api/admin/profile:", error);
    next(error);
  }
});

/**
 * Admin Users Management Routes - Admin only
 */

/**
 * @route   GET /api/admin/users
 * @desc    Get all admin users
 * @access  Admin only
 */
router.get("/users", adminAuth.requireAdmin, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/users - by ${req.session.adminUser.username}`
  );

  try {
    const users = await adminModel.getAllAdminUsers();
    res.json({ users });
  } catch (error) {
    console.error("Route Error - GET /api/admin/users:", error);
    next(error);
  }
});

/**
 * @route   POST /api/admin/users
 * @desc    Create a new admin user
 * @access  Admin only
 */
router.post("/users", adminAuth.requireAdmin, async (req, res, next) => {
  console.log(
    `Route: POST /api/admin/users - by ${req.session.adminUser.username}`
  );

  try {
    const { username, password, email, role, boards } = req.body;

    // Validate input
    if (!username || !password || !email || !role) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["username", "password", "email", "role"],
      });
    }

    // Validate role
    if (!["janitor", "moderator", "admin"].includes(role)) {
      return res.status(400).json({
        error: "Invalid role",
        allowed: ["janitor", "moderator", "admin"],
      });
    }

    const user = await adminModel.createAdminUser({
      username,
      password,
      email,
      role,
      boards: boards || [],
    });

    res.status(201).json({
      message: "Admin user created successfully",
      user,
    });
  } catch (error) {
    console.error("Route Error - POST /api/admin/users:", error);

    // Check for duplicate key error
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Username or email already exists" });
    }

    next(error);
  }
});

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get admin user by ID
 * @access  Admin only
 */
router.get("/users/:userId", adminAuth.requireAdmin, async (req, res, next) => {
  const { userId } = req.params;
  console.log(
    `Route: GET /api/admin/users/${userId} - by ${req.session.adminUser.username}`
  );

  try {
    const user = await adminModel.getAdminUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error(`Route Error - GET /api/admin/users/${userId}:`, error);
    next(error);
  }
});

/**
 * @route   PUT /api/admin/users/:userId
 * @desc    Update admin user
 * @access  Admin only
 */
router.put("/users/:userId", adminAuth.requireAdmin, async (req, res, next) => {
  const { userId } = req.params;
  console.log(
    `Route: PUT /api/admin/users/${userId} - by ${req.session.adminUser.username}`
  );

  try {
    const { username, password, email, role, boards, is_active } = req.body;

    const updates = {};
    if (username !== undefined) updates.username = username;
    if (password !== undefined) updates.password = password;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) {
      // Validate role
      if (!["janitor", "moderator", "admin"].includes(role)) {
        return res.status(400).json({
          error: "Invalid role",
          allowed: ["janitor", "moderator", "admin"],
        });
      }
      updates.role = role;
    }
    if (boards !== undefined) updates.boards = boards;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const updatedUser = await adminModel.updateAdminUser(userId, updates);

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(`Route Error - PUT /api/admin/users/${userId}:`, error);

    // Check for duplicate key error
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Username or email already exists" });
    }

    next(error);
  }
});

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Delete admin user
 * @access  Admin only
 */
router.delete(
  "/users/:userId",
  adminAuth.requireAdmin,
  async (req, res, next) => {
    const { userId } = req.params;
    console.log(
      `Route: DELETE /api/admin/users/${userId} - by ${req.session.adminUser.username}`
    );

    // Prevent deleting yourself
    if (userId === req.session.adminUser.id.toString()) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    try {
      const deleted = await adminModel.deleteAdminUser(userId);

      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error(`Route Error - DELETE /api/admin/users/${userId}:`, error);
      next(error);
    }
  }
);

/**
 * Bans Management Routes
 */

/**
 * @route   GET /api/admin/bans
 * @desc    Get active bans
 * @access  Private (any admin role)
 */
router.get("/bans", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/bans - by ${req.session.adminUser.username}`
  );

  try {
    // Filter by board ID if provided
    const boardId = req.query.boardId;

    // If board ID specified, check permission
    if (boardId && req.session.adminUser.role !== "admin") {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        boardId
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to moderate this board" });
      }
    }

    const bans = await banModel.getActiveBans(boardId);
    res.json({ bans });
  } catch (error) {
    console.error("Route Error - GET /api/admin/bans:", error);
    next(error);
  }
});

/**
 * @route   POST /api/admin/bans
 * @desc    Create a new ban
 * @access  Private (any admin role)
 */
router.post("/bans", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: POST /api/admin/bans - by ${req.session.adminUser.username}`
  );

  try {
    const { ip_address, board_id, reason, expires_at } = req.body;

    // Validate input
    if (!ip_address || !reason) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["ip_address", "reason"],
      });
    }

    // Check board permission if board_id provided
    if (board_id && req.session.adminUser.role !== "admin") {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        board_id
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to moderate this board" });
      }
    }

    const ban = await banModel.createBan({
      ip_address,
      board_id,
      reason,
      expires_at: expires_at || null,
      admin_user_id: req.session.adminUser.id,
    });

    res.status(201).json({
      message: "Ban created successfully",
      ban,
    });
  } catch (error) {
    console.error("Route Error - POST /api/admin/bans:", error);
    next(error);
  }
});

/**
 * @route   GET /api/admin/bans/:banId
 * @desc    Get ban by ID
 * @access  Private (any admin role)
 */
router.get("/bans/:banId", adminAuth.requireAuth, async (req, res, next) => {
  const { banId } = req.params;
  console.log(
    `Route: GET /api/admin/bans/${banId} - by ${req.session.adminUser.username}`
  );

  try {
    const ban = await banModel.getBanById(banId);

    if (!ban) {
      return res.status(404).json({ error: "Ban not found" });
    }

    // Check permission if not admin
    if (req.session.adminUser.role !== "admin" && ban.board_id) {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        ban.board_id
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to view this ban" });
      }
    }

    res.json({ ban });
  } catch (error) {
    console.error(`Route Error - GET /api/admin/bans/${banId}:`, error);
    next(error);
  }
});

/**
 * @route   PUT /api/admin/bans/:banId
 * @desc    Update ban
 * @access  Private (any admin role)
 */
router.put("/bans/:banId", adminAuth.requireAuth, async (req, res, next) => {
  const { banId } = req.params;
  console.log(
    `Route: PUT /api/admin/bans/${banId} - by ${req.session.adminUser.username}`
  );

  try {
    // First get the ban to check permissions
    const existingBan = await banModel.getBanById(banId);

    if (!existingBan) {
      return res.status(404).json({ error: "Ban not found" });
    }

    // Check permission if not admin
    if (req.session.adminUser.role !== "admin" && existingBan.board_id) {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        existingBan.board_id
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to modify this ban" });
      }
    }

    const { reason, expires_at, is_active, appeal_status } = req.body;

    const updates = {
      admin_user_id: req.session.adminUser.id, // For action logging
    };

    if (reason !== undefined) updates.reason = reason;
    if (expires_at !== undefined) updates.expires_at = expires_at;
    if (is_active !== undefined) updates.is_active = is_active;
    if (appeal_status !== undefined) {
      // Validate appeal status
      if (!["none", "pending", "approved", "denied"].includes(appeal_status)) {
        return res.status(400).json({
          error: "Invalid appeal status",
          allowed: ["none", "pending", "approved", "denied"],
        });
      }
      updates.appeal_status = appeal_status;
    }

    const updatedBan = await banModel.updateBan(banId, updates);

    res.json({
      message: "Ban updated successfully",
      ban: updatedBan,
    });
  } catch (error) {
    console.error(`Route Error - PUT /api/admin/bans/${banId}:`, error);
    next(error);
  }
});

/**
 * Moderation Actions Routes
 */

/**
 * @route   GET /api/admin/actions
 * @desc    Get moderation actions
 * @access  Private (any admin role)
 */
router.get("/actions", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/actions - by ${req.session.adminUser.username}`
  );

  try {
    // Get query parameters for filtering
    const {
      admin_user_id,
      action_type,
      board_id,
      thread_id,
      post_id,
      ban_id,
      ip_address,
      start_date,
      end_date,
      limit,
      offset,
    } = req.query;

    // Check board permission if board_id provided
    if (board_id && req.session.adminUser.role !== "admin") {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        board_id
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to view actions for this board" });
      }
    }

    // For non-admins, limit to their own actions or boards they can moderate
    let filters = {};

    if (req.session.adminUser.role !== "admin") {
      // If board specified, they must be able to moderate it (already checked above)
      if (board_id) {
        filters.board_id = board_id;
      } else {
        // Limit to their assigned boards if they have specific boards
        if (
          req.session.adminUser.boards &&
          req.session.adminUser.boards.length > 0
        ) {
          // For now just filter by their user ID - this is simpler
          filters.admin_user_id = req.session.adminUser.id;
        }
      }
    } else {
      // Admins can see everything but still apply filters if provided
      if (admin_user_id) filters.admin_user_id = admin_user_id;
      if (board_id) filters.board_id = board_id;
    }

    // Apply other filters
    if (action_type) filters.action_type = action_type;
    if (thread_id) filters.thread_id = thread_id;
    if (post_id) filters.post_id = post_id;
    if (ban_id) filters.ban_id = ban_id;
    if (ip_address) filters.ip_address = ip_address;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const actions = await moderationModel.getModerationActions(filters);

    res.json({ actions });
  } catch (error) {
    console.error("Route Error - GET /api/admin/actions:", error);
    next(error);
  }
});

/**
 * @route   GET /api/admin/actions/stats
 * @desc    Get moderation action statistics
 * @access  Private (admin and moderator)
 */
router.get("/actions/stats", adminAuth.requireAuth, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/actions/stats - by ${req.session.adminUser.username}`
  );

  // Only admins and moderators can view stats
  if (req.session.adminUser.role === "janitor") {
    return res.status(403).json({ error: "Not authorized to view statistics" });
  }

  try {
    // Get query parameters for filtering
    const { admin_user_id, board_id, start_date, end_date } = req.query;

    // Admins can see all stats, moderators see only their assigned boards
    const filters = {};

    if (req.session.adminUser.role !== "admin") {
      // Moderators only see stats for their boards or their own actions
      if (board_id) {
        const canModerate = adminModel.canModerateBoard(
          req.session.adminUser,
          board_id
        );
        if (!canModerate) {
          return res
            .status(403)
            .json({ error: "Not authorized to view stats for this board" });
        }
        filters.board_id = board_id;
      } else {
        // Only see own actions if no specific board
        filters.admin_user_id = req.session.adminUser.id;
      }
    } else {
      // Admins can filter by user or board
      if (admin_user_id) filters.admin_user_id = admin_user_id;
      if (board_id) filters.board_id = board_id;
    }

    // Apply date filters
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const stats = await moderationModel.getModerationStats(filters);

    res.json({ stats });
  } catch (error) {
    console.error("Route Error - GET /api/admin/actions/stats:", error);
    next(error);
  }
});

/**
 * Content Moderation Routes
 */

/**
 * @route   DELETE /api/admin/threads/:threadId
 * @desc    Delete a thread
 * @access  Private (any admin role)
 */
router.delete(
  "/threads/:threadId",
  adminAuth.requireAuth,
  async (req, res, next) => {
    const { threadId } = req.params;
    const { boardId, reason, ip_address } = req.body;

    console.log(
      `Route: DELETE /api/admin/threads/${threadId} - by ${req.session.adminUser.username}`
    );

    try {
      // Validate input
      if (!boardId || !reason) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["boardId", "reason"],
        });
      }

      // Check permission if not admin
      if (req.session.adminUser.role !== "admin") {
        const canModerate = adminModel.canModerateBoard(
          req.session.adminUser,
          boardId
        );
        if (!canModerate) {
          return res
            .status(403)
            .json({ error: "Not authorized to moderate this board" });
        }
      }

      const deleted = await moderationModel.deleteThread({
        thread_id: threadId,
        board_id: boardId,
        reason,
        ip_address: ip_address || "Unknown",
        admin_user_id: req.session.adminUser.id,
      });

      if (!deleted) {
        return res.status(404).json({ error: "Thread not found" });
      }

      res.json({ message: "Thread deleted successfully" });
    } catch (error) {
      console.error(
        `Route Error - DELETE /api/admin/threads/${threadId}:`,
        error
      );
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/admin/posts/:postId
 * @desc    Delete a post
 * @access  Private (any admin role)
 */
router.delete(
  "/posts/:postId",
  adminAuth.requireAuth,
  async (req, res, next) => {
    const { postId } = req.params;
    const { boardId, threadId, reason } = req.body;

    console.log(
      `Route: DELETE /api/admin/posts/${postId} - by ${req.session.adminUser.username}`
    );

    try {
      // Validate input
      if (!boardId || !threadId || !reason) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["boardId", "threadId", "reason"],
        });
      }

      // Check permission if not admin
      if (req.session.adminUser.role !== "admin") {
        const canModerate = adminModel.canModerateBoard(
          req.session.adminUser,
          boardId
        );
        if (!canModerate) {
          return res
            .status(403)
            .json({ error: "Not authorized to moderate this board" });
        }
      }

      const result = await moderationModel.deletePost({
        post_id: postId,
        thread_id: threadId,
        board_id: boardId,
        reason,
        admin_user_id: req.session.adminUser.id,
      });

      if (!result.success) {
        return res.status(404).json({ error: "Post not found" });
      }

      res.json({
        message: "Post deleted successfully",
        ipAddress: result.ipAddress,
        postContent: result.postContent,
        imageUrl: result.imageUrl,
      });
    } catch (error) {
      console.error(`Route Error - DELETE /api/admin/posts/${postId}:`, error);
      next(error);
    }
  }
);

/**
 * @route   PUT /api/admin/posts/:postId
 * @desc    Edit a post
 * @access  Private (any admin role)
 */
router.put("/posts/:postId", adminAuth.requireAuth, async (req, res, next) => {
  const { postId } = req.params;
  const { boardId, threadId, content, reason, ip_address } = req.body;

  console.log(
    `Route: PUT /api/admin/posts/${postId} - by ${req.session.adminUser.username}`
  );

  try {
    // Validate input
    if (!boardId || !threadId || !content || !reason) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["boardId", "threadId", "content", "reason"],
      });
    }

    // Check permission if not admin
    if (req.session.adminUser.role !== "admin") {
      const canModerate = adminModel.canModerateBoard(
        req.session.adminUser,
        boardId
      );
      if (!canModerate) {
        return res
          .status(403)
          .json({ error: "Not authorized to moderate this board" });
      }
    }

    const updatedPost = await moderationModel.editPost({
      post_id: postId,
      thread_id: threadId,
      board_id: boardId,
      content,
      reason,
      ip_address: ip_address || "Unknown",
      admin_user_id: req.session.adminUser.id,
    });

    if (!updatedPost) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({
      message: "Post edited successfully",
      post: updatedPost,
    });
  } catch (error) {
    console.error(`Route Error - PUT /api/admin/posts/${postId}:`, error);
    next(error);
  }
});

// Housekeeping Routes
const scheduledJobs = require("../utils/scheduledJobs");

// Add these routes after the existing admin routes

/**
 * @route   GET /api/admin/housekeeping/status
 * @desc    Get housekeeping job status
 * @access  Admin only
 */
router.get("/housekeeping/status", adminAuth.requireAdmin, (req, res) => {
  console.log(
    `Route: GET /api/admin/housekeeping/status - by ${req.session.adminUser.username}`
  );

  const status = scheduledJobs.getStatus();
  res.json({ status });
});

/**
 * @route   POST /api/admin/housekeeping/run
 * @desc    Manually trigger housekeeping
 * @access  Admin only
 */
router.post(
  "/housekeeping/run",
  adminAuth.requireAdmin,
  async (req, res, next) => {
    console.log(
      `Route: POST /api/admin/housekeeping/run - by ${req.session.adminUser.username}`
    );

    try {
      const results = await scheduledJobs.runHousekeepingNow();
      res.json({
        message: "Housekeeping completed successfully",
        results,
      });
    } catch (error) {
      console.error("Route Error - POST /api/admin/housekeeping/run:", error);
      next(error);
    }
  }
);

module.exports = router;
