// backend/routes/admin/auth.js
const express = require("express");
const router = express.Router();
const adminModel = require("../../models/admin");
const adminAuth = require("../../middleware/adminAuth");

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

module.exports = router;
