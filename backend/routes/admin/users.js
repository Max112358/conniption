// backend/routes/admin/users.js
const express = require("express");
const router = express.Router();
const adminModel = require("../../models/admin");
const adminAuth = require("../../middleware/adminAuth");

/**
 * @route   GET /api/admin/users
 * @desc    Get all admin users
 * @access  Admin only
 */
router.get("/", adminAuth.requireAdmin, async (req, res, next) => {
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
router.post("/", adminAuth.requireAdmin, async (req, res, next) => {
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
router.get("/:userId", adminAuth.requireAdmin, async (req, res, next) => {
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
router.put("/:userId", adminAuth.requireAdmin, async (req, res, next) => {
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
router.delete("/:userId", adminAuth.requireAdmin, async (req, res, next) => {
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
});

module.exports = router;
