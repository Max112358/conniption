// backend/routes/admin/auth.js
const express = require("express");
const router = express.Router();
const adminModel = require("../../models/admin");
const adminAuth = require("../../middleware/adminAuth");
const getClientIp = require("../../utils/getClientIp");
const { pool } = require("../../config/database");
const { validatePassword } = require("../../middleware/security");
const {
  csrfProtection,
  sendCSRFToken,
} = require("../../middleware/csrfProtection");

// Apply CSRF protection to state-changing operations
const csrfMiddleware = [csrfProtection, sendCSRFToken];

/**
 * @route   GET /api/admin/csrf-token
 * @desc    Get CSRF token for forms
 * @access  Public
 */
router.get("/csrf-token", csrfMiddleware, (req, res) => {
  res.json({
    csrfToken: res.locals.csrfToken,
    message: "Include this token in your requests",
  });
});

/**
 * @route   POST /api/admin/login
 * @desc    Authenticate admin user
 * @access  Public
 */
router.post("/login", csrfMiddleware, async (req, res, next) => {
  const { username, password } = req.body;
  const ipAddress = getClientIp(req);

  console.log(`Route: POST /api/admin/login - ${username} from ${ipAddress}`);

  try {
    // Validate input
    if (!username || !password) {
      // Log failed attempt
      await pool.query(
        `INSERT INTO failed_login_attempts (username, ip_address, user_agent, attempted_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [username || "unknown", ipAddress, req.headers["user-agent"]]
      );

      return res.status(400).json({
        error: "Missing credentials",
        required: ["username", "password"],
      });
    }

    // Authenticate user
    const user = await adminModel.authenticateAdmin(username, password);

    if (!user) {
      // Log failed attempt
      await pool.query(
        `INSERT INTO failed_login_attempts (username, ip_address, user_agent, attempted_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [username, ipAddress, req.headers["user-agent"]]
      );

      console.log(`Admin Login: Failed for ${username} from ${ipAddress}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if account is locked
    if (user.is_locked) {
      console.log(`Admin Login: Locked account ${username} from ${ipAddress}`);
      return res.status(403).json({
        error: "Account is locked. Please contact an administrator.",
      });
    }

    // Create session with user info
    req.session.adminUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      boards: user.boards,
      email: user.email,
      loginTime: new Date().toISOString(),
    };

    // Clear failed login attempts for this user
    await pool.query(
      `UPDATE admin_users SET failed_login_count = 0, last_failed_login = NULL WHERE id = $1`,
      [user.id]
    );

    console.log(
      `Admin Login: Success for ${username} (${user.role}) from ${ipAddress}`
    );

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
  const username = req.session?.adminUser?.username || "unknown";
  console.log(`Route: GET /api/admin/logout - ${username}`);

  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ error: "Failed to logout" });
    }

    res.clearCookie("sessionId");
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
router.put(
  "/profile",
  adminAuth.requireAuth,
  csrfMiddleware,
  async (req, res, next) => {
    console.log(
      `Route: PUT /api/admin/profile - ${req.session.adminUser.username}`
    );

    try {
      const userId = req.session.adminUser.id;
      const { email, password } = req.body;

      // Only allow updating email and password in profile
      const updates = {};
      if (email) updates.email = email;

      if (password) {
        // Validate new password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          return res.status(400).json({ error: passwordValidation.message });
        }
        updates.password = password;
      }

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
  }
);

/**
 * @route   GET /api/admin/session-check
 * @desc    Check if session is still valid
 * @access  Public
 */
router.get("/session-check", (req, res) => {
  if (req.session && req.session.adminUser) {
    res.json({
      authenticated: true,
      user: req.session.adminUser,
    });
  } else {
    res.json({
      authenticated: false,
    });
  }
});

module.exports = router;
