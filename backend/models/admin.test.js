// backend/models/admin.test.js
const adminModel = require("./admin");
const { pool } = require("../config/database");
const bcrypt = require("bcrypt");

// Mock dependencies
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));
jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe("Admin Model", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe("createAdminUser", () => {
    it("should create a new admin user", async () => {
      const userData = {
        username: "testadmin",
        password: "password123",
        email: "test@example.com",
        role: "admin",
        boards: ["tech", "gaming"],
      };

      const hashedPassword = "hashedpassword123";
      const mockUser = {
        id: 1,
        username: "testadmin",
        email: "test@example.com",
        role: "admin",
        boards: ["tech", "gaming"],
        created_at: new Date(),
        is_active: true,
      };

      bcrypt.hash.mockResolvedValue(hashedPassword);
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUser] }) // INSERT user
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await adminModel.createAdminUser(userData);

      expect(result).toEqual(mockUser);
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should handle database errors with rollback", async () => {
      const userData = {
        username: "testadmin",
        password: "password123",
        email: "test@example.com",
        role: "admin",
      };

      bcrypt.hash.mockResolvedValue("hashedpassword");
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error("Database error")); // INSERT fails

      await expect(adminModel.createAdminUser(userData)).rejects.toThrow(
        "Database error"
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("authenticateAdmin", () => {
    it("should authenticate admin with valid credentials", async () => {
      const mockUser = {
        id: 1,
        username: "admin",
        password_hash: "hashedpassword",
        email: "admin@example.com",
        role: "admin",
        boards: [],
        is_active: true,
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // SELECT user
        .mockResolvedValueOnce(undefined); // UPDATE last_login

      bcrypt.compare.mockResolvedValue(true);

      const result = await adminModel.authenticateAdmin("admin", "password123");

      expect(result).toEqual({
        id: 1,
        username: "admin",
        email: "admin@example.com",
        role: "admin",
        boards: [],
        is_active: true,
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password123",
        "hashedpassword"
      );
    });

    it("should return null for non-existent user", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await adminModel.authenticateAdmin(
        "nonexistent",
        "password"
      );

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("should return null for inactive user", async () => {
      const mockUser = {
        id: 1,
        username: "admin",
        password_hash: "hashedpassword",
        is_active: false,
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await adminModel.authenticateAdmin("admin", "password123");

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("should return null for invalid password", async () => {
      const mockUser = {
        id: 1,
        username: "admin",
        password_hash: "hashedpassword",
        is_active: true,
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(false);

      const result = await adminModel.authenticateAdmin(
        "admin",
        "wrongpassword"
      );

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "wrongpassword",
        "hashedpassword"
      );
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(
        adminModel.authenticateAdmin("admin", "password")
      ).rejects.toThrow("Database error");
    });
  });

  describe("getAdminUserById", () => {
    it("should return admin user when found", async () => {
      const mockUser = {
        id: 1,
        username: "admin",
        email: "admin@example.com",
        role: "admin",
        boards: [],
        created_at: new Date(),
        last_login: new Date(),
        is_active: true,
      };

      pool.query.mockResolvedValue({ rows: [mockUser] });

      const result = await adminModel.getAdminUserById(1);

      expect(result).toEqual(mockUser);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [1]);
    });

    it("should return null when user not found", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await adminModel.getAdminUserById(999);

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(adminModel.getAdminUserById(1)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("getAllAdminUsers", () => {
    it("should return all admin users", async () => {
      const mockUsers = [
        {
          id: 1,
          username: "admin",
          email: "admin@example.com",
          role: "admin",
          boards: [],
          created_at: new Date(),
          last_login: new Date(),
          is_active: true,
        },
        {
          id: 2,
          username: "moderator",
          email: "mod@example.com",
          role: "moderator",
          boards: ["tech"],
          created_at: new Date(),
          last_login: null,
          is_active: true,
        },
      ];

      pool.query.mockResolvedValue({ rows: mockUsers });

      const result = await adminModel.getAllAdminUsers();

      expect(result).toEqual(mockUsers);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT id, username, email, role, boards")
      );
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(adminModel.getAllAdminUsers()).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("updateAdminUser", () => {
    it("should update admin user successfully", async () => {
      const updates = {
        username: "newusername",
        email: "newemail@example.com",
        role: "moderator",
        boards: ["tech", "gaming"],
        is_active: true,
      };

      const mockUpdatedUser = {
        id: 1,
        username: "newusername",
        email: "newemail@example.com",
        role: "moderator",
        boards: ["tech", "gaming"],
        created_at: new Date(),
        last_login: new Date(),
        is_active: true,
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUpdatedUser] }) // UPDATE
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await adminModel.updateAdminUser(1, updates);

      expect(result).toEqual(mockUpdatedUser);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should update password with hashing", async () => {
      const updates = { password: "newpassword123" };
      const hashedPassword = "newhashed123";

      bcrypt.hash.mockResolvedValue(hashedPassword);
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // UPDATE
        .mockResolvedValueOnce(undefined); // COMMIT

      await adminModel.updateAdminUser(1, updates);

      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 10);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("password_hash"),
        expect.arrayContaining([hashedPassword, 1])
      );
    });

    it("should return current user when no updates provided", async () => {
      // Mock getAdminUserById call
      adminModel.getAdminUserById = jest
        .fn()
        .mockResolvedValue({ id: 1, username: "admin" });

      mockClient.query.mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await adminModel.updateAdminUser(1, {});

      expect(result).toEqual({ id: 1, username: "admin" });
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should return null when user not found", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE returns no rows
        .mockResolvedValueOnce(undefined); // ROLLBACK

      const result = await adminModel.updateAdminUser(999, {
        username: "test",
      });

      expect(result).toBeNull();
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should handle database errors with rollback", async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error("Database error")); // UPDATE fails

      await expect(
        adminModel.updateAdminUser(1, { username: "test" })
      ).rejects.toThrow("Database error");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("deleteAdminUser", () => {
    it("should delete admin user successfully", async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await adminModel.deleteAdminUser(1);

      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(
        "DELETE FROM admin_users WHERE id = $1 RETURNING id",
        [1]
      );
    });

    it("should return false when user not found", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const result = await adminModel.deleteAdminUser(999);

      expect(result).toBe(false);
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(adminModel.deleteAdminUser(1)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("canModerateBoard", () => {
    it("should return true for admin users", () => {
      const user = { role: "admin", boards: [] };

      const result = adminModel.canModerateBoard(user, "tech");

      expect(result).toBe(true);
    });

    it("should return true when user has specific board permission", () => {
      const user = { role: "moderator", boards: ["tech", "gaming"] };

      const result = adminModel.canModerateBoard(user, "tech");

      expect(result).toBe(true);
    });

    it("should return false when user lacks board permission", () => {
      const user = { role: "moderator", boards: ["gaming"] };

      const result = adminModel.canModerateBoard(user, "tech");

      expect(result).toBe(false);
    });

    it("should return true when user has empty boards array", () => {
      const user = { role: "moderator", boards: [] };

      const result = adminModel.canModerateBoard(user, "tech");

      expect(result).toBe(true);
    });

    it("should return true when user has no boards property", () => {
      const user = { role: "moderator" };

      const result = adminModel.canModerateBoard(user, "tech");

      expect(result).toBe(true);
    });
  });
});
