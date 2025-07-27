// backend/routes/admin/auth.test.js
const request = require("supertest");
const express = require("express");
const session = require("express-session");
const authRouter = require("./auth");
const adminModel = require("../../models/admin");
const adminAuth = require("../../middleware/adminAuth");

// Mock dependencies
jest.mock("../../models/admin");
jest.mock("../../middleware/adminAuth", () => ({
  requireAuth: (req, res, next) => {
    if (req.session && req.session.adminUser) {
      next();
    } else {
      res.status(401).json({ error: "Unauthorized - Login required" });
    }
  },
}));
jest.mock("../../config/database", () => ({
  pool: {
    query: jest.fn(),
  },
}));
jest.mock("../../utils/getClientIp", () => () => "127.0.0.1");
jest.mock("../../middleware/security", () => ({
  validatePassword: () => ({ valid: true }),
}));

// Mock CSRF middleware to bypass in tests
jest.mock("../../middleware/csrfProtection", () => ({
  csrfProtection: (req, res, next) => next(),
  sendCSRFToken: (req, res, next) => {
    res.locals.csrfToken = "test-csrf-token";
    next();
  },
}));

describe("Admin Auth Routes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Setup session middleware
    app.use(
      session({
        secret: "test-secret",
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
      })
    );

    app.use("/api/admin", authRouter);
    jest.clearAllMocks();
  });

  describe("POST /api/admin/login", () => {
    it("should login successfully with valid credentials", async () => {
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: false,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Authentication successful"
      );
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("username", "admin");
      expect(adminModel.authenticateAdmin).toHaveBeenCalledWith(
        "admin",
        "password123"
      );
    });

    it("should return 400 when username is missing", async () => {
      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).post("/api/admin/login").send({
        password: "password123",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Missing credentials");
      expect(response.body).toHaveProperty("required", [
        "username",
        "password",
      ]);
    });

    it("should return 400 when password is missing", async () => {
      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).post("/api/admin/login").send({
        username: "admin",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Missing credentials");
    });

    it("should return 401 when credentials are invalid", async () => {
      adminModel.authenticateAdmin.mockResolvedValue(null);

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).post("/api/admin/login").send({
        username: "admin",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "Invalid credentials");
    });

    it("should return 403 when account is locked", async () => {
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: true,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app).post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty(
        "error",
        "Account is locked. Please contact an administrator."
      );
    });

    it("should handle database errors", async () => {
      adminModel.authenticateAdmin.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app).post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      expect(response.status).toBe(500);
    });
  });

  describe("GET /api/admin/logout", () => {
    it("should logout successfully when authenticated", async () => {
      const agent = request.agent(app);

      // First login
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: false,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      await agent.post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      // Then logout
      const response = await agent.get("/api/admin/logout");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Logout successful");
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request(app).get("/api/admin/logout");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        "error",
        "Unauthorized - Login required"
      );
    });
  });

  describe("GET /api/admin/profile", () => {
    it("should return user profile when authenticated", async () => {
      const agent = request.agent(app);

      // First login
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: false,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      await agent.post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      // Mock getAdminUserById
      adminModel.getAdminUserById.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        created_at: new Date(),
        last_login: new Date(),
        is_active: true,
      });

      // Get profile
      const response = await agent.get("/api/admin/profile");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("username", "admin");
      expect(adminModel.getAdminUserById).toHaveBeenCalledWith(1);
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request(app).get("/api/admin/profile");

      expect(response.status).toBe(401);
    });

    it("should return 404 when user not found", async () => {
      const agent = request.agent(app);

      // First login
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: false,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      await agent.post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      // Mock user not found
      adminModel.getAdminUserById.mockResolvedValue(null);

      const response = await agent.get("/api/admin/profile");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "User not found");
    });
  });

  describe("PUT /api/admin/profile", () => {
    it("should update email successfully", async () => {
      const agent = request.agent(app);

      // First login
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: false,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      await agent.post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      // Mock updateAdminUser
      adminModel.updateAdminUser.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "newemail@test.com",
        role: "admin",
        boards: [],
      });

      const response = await agent.put("/api/admin/profile").send({
        email: "newemail@test.com",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Profile updated successfully"
      );
      expect(response.body.user).toHaveProperty("email", "newemail@test.com");
      expect(adminModel.updateAdminUser).toHaveBeenCalledWith(1, {
        email: "newemail@test.com",
      });
    });

    it("should update password successfully", async () => {
      const agent = request.agent(app);

      // First login
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: false,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      await agent.post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      // Mock updateAdminUser
      adminModel.updateAdminUser.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
      });

      const response = await agent.put("/api/admin/profile").send({
        password: "newpassword123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Profile updated successfully"
      );
      expect(adminModel.updateAdminUser).toHaveBeenCalledWith(1, {
        password: "newpassword123",
      });
    });

    it("should return 400 when no valid fields provided", async () => {
      const agent = request.agent(app);

      // First login
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: false,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      await agent.post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      const response = await agent.put("/api/admin/profile").send({
        invalidField: "value",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "No valid fields to update"
      );
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request(app).put("/api/admin/profile").send({
        email: "newemail@test.com",
      });

      expect(response.status).toBe(401);
    });

    it("should return 404 when user not found during update", async () => {
      const agent = request.agent(app);

      // First login
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: false,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      await agent.post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      // Mock user not found
      adminModel.updateAdminUser.mockResolvedValue(null);

      const response = await agent.put("/api/admin/profile").send({
        email: "newemail@test.com",
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "User not found");
    });
  });

  describe("GET /api/admin/session-check", () => {
    it("should return authenticated true when logged in", async () => {
      const agent = request.agent(app);

      // First login
      adminModel.authenticateAdmin.mockResolvedValue({
        id: 1,
        username: "admin",
        email: "admin@test.com",
        role: "admin",
        boards: [],
        is_locked: false,
      });

      const { pool } = require("../../config/database");
      pool.query.mockResolvedValue({ rows: [] });

      await agent.post("/api/admin/login").send({
        username: "admin",
        password: "password123",
      });

      const response = await agent.get("/api/admin/session-check");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("authenticated", true);
      expect(response.body).toHaveProperty("user");
    });

    it("should return authenticated false when not logged in", async () => {
      const response = await request(app).get("/api/admin/session-check");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("authenticated", false);
    });
  });

  describe("GET /api/admin/csrf-token", () => {
    it("should return CSRF token", async () => {
      const response = await request(app).get("/api/admin/csrf-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("csrfToken", "test-csrf-token");
      expect(response.body).toHaveProperty(
        "message",
        "Include this token in your requests"
      );
    });
  });
});
