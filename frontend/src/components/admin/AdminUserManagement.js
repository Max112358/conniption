// frontend/src/components/admin/AdminUserManagement.js
import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";

export default function AdminUserManagement() {
  const { adminUser } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "janitor",
    boards: [],
  });
  const [availableBoards, setAvailableBoards] = useState([]);
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Fetch admin users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.status}`);
        }

        const data = await response.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError(err.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Fetch available boards
  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/boards`);

        if (response.ok) {
          const data = await response.json();
          setAvailableBoards(data.boards || []);
        }
      } catch (err) {
        console.error("Error fetching boards:", err);
        // Don't set error state here, as it's not critical
      }
    };

    fetchBoards();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle board selection in the form
  const handleBoardSelection = (e) => {
    const options = e.target.options;
    const selectedBoards = [];

    for (let i = 0; i < options.length; i++) {
      if (options[i].selected) {
        selectedBoards.push(options[i].value);
      }
    }

    setFormData({
      ...formData,
      boards: selectedBoards,
    });
  };

  // Handle form submission (create new user)
  const handleCreateUser = async (e) => {
    e.preventDefault();

    // Validate form
    if (
      !formData.username ||
      !formData.email ||
      !formData.password ||
      !formData.role
    ) {
      setFormError("All fields are required");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create user");
      }

      const data = await response.json();

      // Add new user to the list
      setUsers([...users, data.user]);

      // Reset form and close modal
      setFormData({
        username: "",
        email: "",
        password: "",
        role: "janitor",
        boards: [],
      });

      setModalVisible(false);
    } catch (err) {
      console.error("Error creating user:", err);
      setFormError(err.message || "Failed to create user. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  // Handle user deactivation
  const handleToggleUserStatus = async (userId, isActive) => {
    const action = isActive ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !isActive,
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${action} user`);
      }

      // Update user status in the list
      setUsers(
        users.map((user) => {
          if (user.id === userId) {
            return {
              ...user,
              is_active: !isActive,
            };
          }
          return user;
        })
      );
    } catch (err) {
      console.error(`Error ${action}ing user:`, err);
      setError(`Failed to ${action} user. Please try again.`);
    }
  };

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "admin":
        return "danger";
      case "moderator":
        return "warning";
      case "janitor":
        return "info";
      default:
        return "secondary";
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Admin User Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => setModalVisible(true)}
        >
          Add New Admin User
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Users List */}
      <div className="card bg-mid-dark border-secondary">
        <div className="card-header border-secondary">
          <h2 className="h5 mb-0">Admin Users</h2>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <div className="spinner-border text-light" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : users.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-dark table-striped table-hover mb-0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Last Login</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={!user.is_active ? "text-light" : ""}
                    >
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td>
                        <span
                          className={`badge bg-${getRoleBadgeColor(user.role)}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td>{new Date(user.created_at).toLocaleString()}</td>
                      <td>
                        {user.last_login
                          ? new Date(user.last_login).toLocaleString()
                          : "Never"}
                      </td>
                      <td>
                        <span
                          className={`badge bg-${
                            user.is_active ? "success" : "secondary"
                          }`}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <Link
                            to={`/admin/users/${user.id}`}
                            className="btn btn-outline-primary"
                          >
                            Edit
                          </Link>

                          {/* Prevent deactivating yourself or the viewing user */}
                          {user.id !== adminUser.id && (
                            <button
                              className={`btn btn-outline-${
                                user.is_active ? "danger" : "success"
                              }`}
                              onClick={() =>
                                handleToggleUserStatus(user.id, user.is_active)
                              }
                            >
                              {user.is_active ? "Deactivate" : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-light mb-0">No admin users found</p>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {modalVisible && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="modal-dialog modal-lg" role="document">
            <div className="modal-content bg-dark text-light border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">Create New Admin User</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setModalVisible(false)}
                  disabled={formLoading}
                ></button>
              </div>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger" role="alert">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleCreateUser}>
                  <div className="mb-3">
                    <label
                      htmlFor="username"
                      className="form-label text-secondary"
                    >
                      Username *
                    </label>
                    <input
                      type="text"
                      className="form-control bg-dark text-light border-secondary"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder="Username"
                      required
                      disabled={formLoading}
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="email"
                      className="form-label text-secondary"
                    >
                      Email *
                    </label>
                    <input
                      type="email"
                      className="form-control bg-dark text-light border-secondary"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Email address"
                      required
                      disabled={formLoading}
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="password"
                      className="form-label text-secondary"
                    >
                      Password *
                    </label>
                    <input
                      type="password"
                      className="form-control bg-dark text-light border-secondary"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Password"
                      required
                      disabled={formLoading}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="role" className="form-label text-secondary">
                      Role *
                    </label>
                    <select
                      className="form-select bg-dark text-light border-secondary"
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      required
                      disabled={formLoading}
                    >
                      <option value="janitor">Janitor</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                    <div className="form-text text-secondary">
                      <strong>Janitor:</strong> Can delete posts and threads
                      <br />
                      <strong>Moderator:</strong> Can manage bans and appeals
                      <br />
                      <strong>Admin:</strong> Full access to all features
                    </div>
                  </div>

                  <div className="mb-3">
                    <label
                      htmlFor="boards"
                      className="form-label text-secondary"
                    >
                      Assigned Boards
                    </label>
                    <select
                      multiple
                      className="form-select bg-dark text-light border-secondary"
                      id="boards"
                      name="boards"
                      value={formData.boards}
                      onChange={handleBoardSelection}
                      disabled={formLoading}
                      size="6"
                    >
                      {availableBoards.map((board) => (
                        <option key={board.id} value={board.id}>
                          /{board.id}/ - {board.name}
                        </option>
                      ))}
                    </select>
                    <div className="form-text text-secondary">
                      Hold Ctrl/Cmd to select multiple boards. Leave empty to
                      grant access to all boards.
                    </div>
                  </div>
                </form>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setModalVisible(false)}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateUser}
                  disabled={formLoading}
                >
                  {formLoading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
