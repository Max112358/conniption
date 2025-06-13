// frontend/src/components/admin/AdminDashboard.js
import { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";

export default function AdminDashboard() {
  const { adminUser } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [recentActions, setRecentActions] = useState([]);
  const [pendingAppeals, setPendingAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch dashboard data
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch recent moderation actions
        const actionsResponse = await fetch(
          `${API_BASE_URL}/api/admin/actions?limit=5`,
          { credentials: "include" }
        );

        if (!actionsResponse.ok) {
          throw new Error("Failed to fetch recent actions");
        }

        const actionsData = (await actionsResponse.ok)
          ? await actionsResponse.json()
          : { actions: [] };

        // Fetch pending ban appeals if user is moderator or admin
        if (adminUser.role === "admin" || adminUser.role === "moderator") {
          const appealsResponse = await fetch(
            `${API_BASE_URL}/api/admin/bans?appeal_status=pending`,
            { credentials: "include" }
          );

          if (appealsResponse.ok) {
            const appealsData = await appealsResponse.json();
            setPendingAppeals(appealsData.bans || []);
          }
        }

        // Fetch moderation stats if user is moderator or admin
        if (adminUser.role === "admin" || adminUser.role === "moderator") {
          const statsResponse = await fetch(
            `${API_BASE_URL}/api/admin/actions/stats`,
            { credentials: "include" }
          );

          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            setStats(statsData.stats);
          }
        }

        setRecentActions(actionsData.actions || []);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data. Please try again.");
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [adminUser.role]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-light" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <h1 className="h3 mb-4">Admin Dashboard</h1>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="row">
        {/* Main Stats Cards */}
        {(adminUser.role === "admin" || adminUser.role === "moderator") &&
          stats && (
            <div className="col-md-4 mb-4">
              <div className="card bg-mid-dark border-secondary h-100">
                <div className="card-header border-secondary">
                  <h2 className="h5 mb-0">Moderation Statistics</h2>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-6 mb-3">
                      <div className="card bg-dark border-secondary">
                        <div className="card-body text-center py-3">
                          <h3 className="h2 mb-1">{stats.total || 0}</h3>
                          <p className="small text-muted mb-0">Total Actions</p>
                        </div>
                      </div>
                    </div>

                    {stats.byActionType &&
                      stats.byActionType.map((stat, index) => (
                        <div className="col-6 mb-3" key={index}>
                          <div className="card bg-dark border-secondary">
                            <div className="card-body text-center py-3">
                              <h3 className="h2 mb-1">{stat.count}</h3>
                              <p className="small text-muted mb-0">
                                {stat.action_type.charAt(0).toUpperCase() +
                                  stat.action_type.slice(1).replace("_", " ")}
                                s
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="text-center mt-2">
                    <Link
                      to="/admin/stats"
                      className="btn btn-sm btn-outline-primary"
                    >
                      View Detailed Stats
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Recent Actions */}
        <div className="col-md-4 mb-4">
          <div className="card bg-mid-dark border-secondary h-100">
            <div className="card-header border-secondary d-flex justify-content-between align-items-center">
              <h2 className="h5 mb-0">Recent Actions</h2>
              <Link
                to="/admin/actions"
                className="btn btn-sm btn-outline-primary"
              >
                View All
              </Link>
            </div>
            <div className="card-body">
              {recentActions.length > 0 ? (
                <div className="list-group bg-transparent">
                  {recentActions.map((action) => (
                    <div
                      key={action.id}
                      className="list-group-item bg-dark border-secondary"
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <span className="badge bg-secondary me-2">
                            {action.action_type.replace("_", " ")}
                          </span>
                          <small className="text-muted">
                            /{action.board_id}/
                          </small>
                        </div>
                        <small className="text-muted">
                          {new Date(action.created_at).toLocaleString()}
                        </small>
                      </div>
                      <div className="mt-1 small">
                        <span className="text-muted">By: </span>
                        {action.admin_username}
                      </div>
                      <div className="mt-1 small text-truncate">
                        {action.reason}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted py-4">
                  No recent actions found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pending Appeals */}
        {(adminUser.role === "admin" || adminUser.role === "moderator") && (
          <div className="col-md-4 mb-4">
            <div className="card bg-mid-dark border-secondary h-100">
              <div className="card-header border-secondary d-flex justify-content-between align-items-center">
                <h2 className="h5 mb-0">Pending Appeals</h2>
                <Link
                  to="/admin/bans?filter=pending"
                  className="btn btn-sm btn-outline-primary"
                >
                  View All
                </Link>
              </div>
              <div className="card-body">
                {pendingAppeals.length > 0 ? (
                  <div className="list-group bg-transparent">
                    {pendingAppeals.map((ban) => (
                      <div
                        key={ban.id}
                        className="list-group-item bg-dark border-secondary"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <span className="badge bg-danger me-2">
                              Ban #{ban.id}
                            </span>
                            <small className="text-muted">
                              {ban.board_id ? `/${ban.board_id}/` : "Global"}
                            </small>
                          </div>
                          <small className="text-muted">
                            {new Date(ban.created_at).toLocaleString()}
                          </small>
                        </div>
                        <div className="mt-1 small">
                          <span className="text-muted">IP: </span>
                          {ban.ip_address}
                        </div>
                        <div className="mt-1 small text-truncate">
                          <span className="text-muted">Reason: </span>
                          {ban.reason}
                        </div>
                        <div className="mt-2">
                          <Link
                            to={`/admin/bans/${ban.id}`}
                            className="btn btn-sm btn-outline-warning"
                          >
                            Review Appeal
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted py-4">
                    No pending appeals
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions Row */}
      <div className="row mt-2">
        <div className="col-12">
          <div className="card bg-mid-dark border-secondary">
            <div className="card-header border-secondary">
              <h2 className="h5 mb-0">Quick Actions</h2>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2">
                <Link
                  to="/admin/bans/create"
                  className="btn btn-outline-danger"
                >
                  Create Ban
                </Link>

                {adminUser.role === "admin" && (
                  <Link
                    to="/admin/users/create"
                    className="btn btn-outline-primary"
                  >
                    Add Admin User
                  </Link>
                )}

                <Link to="/admin/actions" className="btn btn-outline-secondary">
                  View Action Log
                </Link>

                {(adminUser.role === "admin" ||
                  adminUser.role === "moderator") && (
                  <Link to="/admin/stats" className="btn btn-outline-info">
                    View Statistics
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Board List for Quick Access */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card bg-mid-dark border-secondary">
            <div className="card-header border-secondary">
              <h2 className="h5 mb-0">Board Quick Access</h2>
            </div>
            <div className="card-body">
              <div className="row">
                {/* This would ideally be populated with the board list */}
                <div className="col-md-3 col-sm-4 col-6 mb-3">
                  <Link
                    to="/admin/bans?boardId=random"
                    className="btn btn-dark border-secondary w-100 text-start"
                  >
                    /random/
                  </Link>
                </div>
                <div className="col-md-3 col-sm-4 col-6 mb-3">
                  <Link
                    to="/admin/bans?boardId=tech"
                    className="btn btn-dark border-secondary w-100 text-start"
                  >
                    /tech/
                  </Link>
                </div>
                <div className="col-md-3 col-sm-4 col-6 mb-3">
                  <Link
                    to="/admin/bans?boardId=politics"
                    className="btn btn-dark border-secondary w-100 text-start"
                  >
                    /politics/
                  </Link>
                </div>
                <div className="col-md-3 col-sm-4 col-6 mb-3">
                  <Link
                    to="/admin/bans?boardId=gaming"
                    className="btn btn-dark border-secondary w-100 text-start"
                  >
                    /gaming/
                  </Link>
                </div>
                {/* Add more board links here */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
