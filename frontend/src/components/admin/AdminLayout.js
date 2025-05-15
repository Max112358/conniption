// frontend/src/components/admin/AdminLayout.js
import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";

// API constants
const API_BASE_URL = "https://conniption.onrender.com";

export default function AdminLayout() {
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check for admin user in localStorage
    const storedUser = localStorage.getItem("adminUser");

    if (!storedUser) {
      // No user found, redirect to login
      navigate("/admin/login");
      return;
    }

    // Parse user data
    try {
      const userData = JSON.parse(storedUser);
      setAdminUser(userData);
      setLoading(false);
    } catch (err) {
      console.error("Error parsing admin user data:", err);
      localStorage.removeItem("adminUser");
      navigate("/admin/login");
    }
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/logout`, {
        method: "GET",
        credentials: "include", // Important for cookies/session
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      // Clear admin user from localStorage
      localStorage.removeItem("adminUser");

      // Redirect to login page
      navigate("/admin/login");
    } catch (err) {
      console.error("Logout error:", err);
      setError("Failed to logout. Please try again.");

      // Even if the server-side logout fails, clear localStorage and redirect
      localStorage.removeItem("adminUser");
      setTimeout(() => navigate("/admin/login"), 2000);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 bg-dark text-light d-flex align-items-center justify-content-center">
        <div className="spinner-border text-light" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Navigation links based on user role
  const getNavigationLinks = () => {
    const links = [
      {
        to: "/admin/dashboard",
        label: "Dashboard",
        roles: ["admin", "moderator", "janitor"],
      },
      {
        to: "/admin/bans",
        label: "Bans",
        roles: ["admin", "moderator", "janitor"],
      },
      {
        to: "/admin/actions",
        label: "Actions",
        roles: ["admin", "moderator", "janitor"],
      },
    ];

    // Add admin-only links
    if (adminUser.role === "admin") {
      links.push({ to: "/admin/users", label: "Users", roles: ["admin"] });
      links.push({
        to: "/admin/settings",
        label: "Settings",
        roles: ["admin"],
      });
    }

    // Add statistical links for admins and moderators
    if (adminUser.role === "admin" || adminUser.role === "moderator") {
      links.push({
        to: "/admin/stats",
        label: "Statistics",
        roles: ["admin", "moderator"],
      });
    }

    return links.filter((link) => link.roles.includes(adminUser.role));
  };

  const links = getNavigationLinks();

  return (
    <div className="min-vh-100 bg-dark text-light d-flex flex-column">
      {/* Top Navigation Bar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-mid-dark border-bottom border-secondary">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/admin/dashboard">
            Conniption Admin
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#adminNavbar"
            aria-controls="adminNavbar"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="adminNavbar">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              {links.map((link) => (
                <li className="nav-item" key={link.to}>
                  <Link
                    className={`nav-link ${
                      location.pathname === link.to ? "active" : ""
                    }`}
                    to={link.to}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="d-flex align-items-center">
              <span className="text-light me-3">
                <small className="text-muted me-2">Logged in as:</small>
                <span className="badge bg-secondary me-1">
                  {adminUser.role}
                </span>
                {adminUser.username}
              </span>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger m-2" role="alert">
          {error}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-grow-1 p-3">
        <Outlet context={{ adminUser }} />
      </div>

      {/* Footer */}
      <footer className="bg-mid-dark text-secondary text-center py-2 border-top border-secondary">
        <div className="container">
          <small>
            Conniption Admin Panel &copy; {new Date().getFullYear()}
          </small>
        </div>
      </footer>
    </div>
  );
}
