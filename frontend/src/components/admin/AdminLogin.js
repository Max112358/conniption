// frontend/src/components/admin/AdminLogin.js
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [fetchingCsrf, setFetchingCsrf] = useState(true);
  const navigate = useNavigate();

  // Fetch CSRF token on component mount
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        setFetchingCsrf(true);
        const response = await fetch(`${API_BASE_URL}/api/admin/csrf-token`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch CSRF token");
        }

        const data = await response.json();
        setCsrfToken(data.csrfToken);
      } catch (err) {
        console.error("Error fetching CSRF token:", err);
        setError("Failed to initialize login form. Please refresh the page.");
      } finally {
        setFetchingCsrf(false);
      }
    };

    fetchCsrfToken();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!username.trim() || !password) {
      setError("Username and password are required");
      return;
    }

    if (!csrfToken) {
      setError("Security token not available. Please refresh the page.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken, // Include CSRF token in headers
        },
        body: JSON.stringify({
          username,
          password,
          _csrf: csrfToken, // Also include in body as fallback
        }),
        credentials: "include", // Important for cookies/session
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store user info in localStorage (except the sensitive info)
      localStorage.setItem(
        "adminUser",
        JSON.stringify({
          id: data.user.id,
          username: data.user.username,
          role: data.user.role,
        })
      );

      // Redirect to admin dashboard
      navigate("/admin/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while fetching CSRF token
  if (fetchingCsrf) {
    return (
      <div className="container-fluid min-vh-100 bg-dark text-light d-flex align-items-center justify-content-center py-5">
        <div
          className="card bg-mid-dark border-secondary shadow"
          style={{ maxWidth: "400px", width: "100%" }}
        >
          <div className="card-body text-center">
            <div className="spinner-border text-light mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-secondary mb-0">Initializing login form...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light d-flex align-items-center justify-content-center py-5">
      <div
        className="card bg-mid-dark border-secondary shadow"
        style={{ maxWidth: "400px", width: "100%" }}
      >
        <div className="card-header border-secondary">
          <h1 className="h4 mb-0 text-light text-center">Admin Login</h1>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label text-secondary">
                Username
              </label>
              <input
                type="text"
                className="form-control bg-dark text-light border-secondary"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label text-secondary">
                Password
              </label>
              <input
                type="password"
                className="form-control bg-dark text-light border-secondary"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <div className="d-grid gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !csrfToken}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </div>
          </form>
        </div>
        <div className="card-footer border-secondary text-center">
          <a href="/" className="text-secondary small">
            Return to main site
          </a>
        </div>
      </div>
    </div>
  );
}
