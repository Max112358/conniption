// frontend/src/components/admin/IPHistoryPage.js
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";
import PageHeader from "../shared/PageHeader";
import LoadingSpinner from "../LoadingSpinner";
import ErrorDisplay from "../shared/ErrorDisplay";

export default function IPHistoryPage() {
  const { ipAddress } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [actions, setActions] = useState([]);
  const [boardFilter, setBoardFilter] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState("");

  useEffect(() => {
    const fetchIPHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (boardFilter) params.append("board_id", boardFilter);
        if (actionTypeFilter) params.append("action_type", actionTypeFilter);

        const response = await fetch(
          `${API_BASE_URL}/api/admin/ip-history/${ipAddress}?${params}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            navigate("/admin/login");
            return;
          }
          if (response.status === 403) {
            throw new Error("Not authorized to view IP history");
          }
          throw new Error("Failed to fetch IP history");
        }

        const data = await response.json();
        setSummary(data.summary);
        setActions(data.actions || []);
      } catch (err) {
        console.error("Error fetching IP history:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchIPHistory();
  }, [ipAddress, boardFilter, actionTypeFilter, navigate]);

  const getActionBadgeColor = (actionType) => {
    switch (actionType) {
      case "banned":
        return "danger";
      case "unbanned":
        return "success";
      case "post_deleted":
      case "thread_deleted":
        return "warning";
      case "color_changed":
        return "info";
      case "appeal_submitted":
        return "primary";
      case "appeal_response":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const formatActionType = (actionType) => {
    return actionType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading) {
    return <LoadingSpinner message="Loading IP history..." />;
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        backLink="/admin/dashboard"
        backText="← Back to Dashboard"
      />
    );
  }

  return (
    <div className="container-fluid">
      <PageHeader
        backLink="/admin/dashboard"
        backText="← Back to Dashboard"
        title={`IP History: ${ipAddress}`}
      />

      {/* Summary Card */}
      {summary && (
        <div className="card bg-mid-dark border-secondary mb-4">
          <div className="card-header border-secondary">
            <h2 className="h5 mb-0">Summary</h2>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-3 col-6 mb-3">
                <div className="card bg-dark border-secondary">
                  <div className="card-body text-center">
                    <h3 className="h4 mb-1">{summary.total_actions || 0}</h3>
                    <small className="text-secondary">Total Actions</small>
                  </div>
                </div>
              </div>
              <div className="col-md-3 col-6 mb-3">
                <div className="card bg-dark border-secondary">
                  <div className="card-body text-center">
                    <h3 className="h4 mb-1 text-danger">
                      {summary.ban_count || 0}
                    </h3>
                    <small className="text-secondary">Bans</small>
                  </div>
                </div>
              </div>
              <div className="col-md-3 col-6 mb-3">
                <div className="card bg-dark border-secondary">
                  <div className="card-body text-center">
                    <h3 className="h4 mb-1 text-warning">
                      {summary.posts_deleted || 0}
                    </h3>
                    <small className="text-secondary">Posts Deleted</small>
                  </div>
                </div>
              </div>
              <div className="col-md-3 col-6 mb-3">
                <div className="card bg-dark border-secondary">
                  <div className="card-body text-center">
                    <h3 className="h4 mb-1">{summary.boards_affected || 0}</h3>
                    <small className="text-secondary">Boards Affected</small>
                  </div>
                </div>
              </div>
            </div>

            {summary.first_action && (
              <div className="mt-3">
                <small className="text-secondary">
                  First Action:{" "}
                  {new Date(summary.first_action).toLocaleString()}
                </small>
                {summary.last_action && (
                  <>
                    {" | "}
                    <small className="text-secondary">
                      Last Action:{" "}
                      {new Date(summary.last_action).toLocaleString()}
                    </small>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card bg-mid-dark border-secondary mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label text-secondary">Board</label>
              <select
                className="form-select bg-dark text-light border-secondary"
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value)}
              >
                <option value="">All Boards</option>
                {summary?.boards_list?.map((board) => (
                  <option key={board} value={board}>
                    /{board}/
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label text-secondary">Action Type</label>
              <select
                className="form-select bg-dark text-light border-secondary"
                value={actionTypeFilter}
                onChange={(e) => setActionTypeFilter(e.target.value)}
              >
                <option value="">All Actions</option>
                <option value="banned">Banned</option>
                <option value="unbanned">Unbanned</option>
                <option value="post_deleted">Post Deleted</option>
                <option value="thread_deleted">Thread Deleted</option>
                <option value="color_changed">Color Changed</option>
                <option value="appeal_submitted">Appeal Submitted</option>
                <option value="appeal_response">Appeal Response</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Action History */}
      <div className="card bg-mid-dark border-secondary">
        <div className="card-header border-secondary">
          <h2 className="h5 mb-0">Action History</h2>
        </div>
        <div className="card-body p-0">
          {actions.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-dark table-striped mb-0">
                <thead>
                  <tr>
                    <th>Date/Time</th>
                    <th>Action</th>
                    <th>Board</th>
                    <th>Admin</th>
                    <th>Reason</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => (
                    <tr key={action.id}>
                      <td className="text-nowrap">
                        {new Date(action.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge bg-${getActionBadgeColor(
                            action.action_type
                          )}`}
                        >
                          {formatActionType(action.action_type)}
                        </span>
                      </td>
                      <td>
                        {action.board_id ? (
                          <Link
                            to={`/board/${action.board_id}`}
                            className="text-decoration-none"
                          >
                            /{action.board_id}/
                          </Link>
                        ) : (
                          <span className="text-secondary">Global</span>
                        )}
                      </td>
                      <td>
                        <span className="text-info">
                          {action.admin_username ||
                            action.current_admin_username ||
                            "Unknown"}
                        </span>
                      </td>
                      <td
                        className="text-truncate"
                        style={{ maxWidth: "200px" }}
                      >
                        {action.reason || "-"}
                      </td>
                      <td>
                        {action.thread_id && (
                          <span className="badge bg-secondary me-1">
                            Thread: {action.thread_id}
                          </span>
                        )}
                        {action.post_id && (
                          <span className="badge bg-secondary me-1">
                            Post: {action.post_id}
                          </span>
                        )}
                        {action.ban_id && (
                          <Link
                            to={`/admin/bans/${action.ban_id}`}
                            className="badge bg-danger text-decoration-none"
                          >
                            Ban #{action.ban_id}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-secondary mb-0">
                No actions found for this IP
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
