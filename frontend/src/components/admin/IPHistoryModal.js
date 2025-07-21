// frontend/src/components/admin/IPHistoryModal.js
import { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config/api";

export default function IPHistoryModal({ ipAddress, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [actions, setActions] = useState([]);
  const [boardFilter, setBoardFilter] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState("");

  useEffect(() => {
    if (ipAddress) {
      fetchIPHistory();
    }
  }, [ipAddress, boardFilter, actionTypeFilter]);

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

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-xl">
        <div className="modal-content bg-dark text-light border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title">Moderation History: {ipAddress}</h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          <div className="modal-body">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-light" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : error ? (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            ) : (
              <>
                {/* Summary */}
                {summary && (
                  <div className="card bg-mid-dark border-secondary mb-4">
                    <div className="card-body">
                      <div className="row g-3">
                        <div className="col-6 col-md-3">
                          <div className="text-center">
                            <h4 className="mb-0">
                              {summary.total_actions || 0}
                            </h4>
                            <small className="text-secondary">
                              Total Actions
                            </small>
                          </div>
                        </div>
                        <div className="col-6 col-md-3">
                          <div className="text-center">
                            <h4 className="mb-0 text-danger">
                              {summary.ban_count || 0}
                            </h4>
                            <small className="text-secondary">Bans</small>
                          </div>
                        </div>
                        <div className="col-6 col-md-3">
                          <div className="text-center">
                            <h4 className="mb-0 text-warning">
                              {summary.posts_deleted || 0}
                            </h4>
                            <small className="text-secondary">
                              Posts Deleted
                            </small>
                          </div>
                        </div>
                        <div className="col-6 col-md-3">
                          <div className="text-center">
                            <h4 className="mb-0">
                              {summary.boards_affected || 0}
                            </h4>
                            <small className="text-secondary">Boards</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filters */}
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
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

                {/* Actions Table */}
                <div className="table-responsive">
                  <table className="table table-dark table-striped table-sm">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Action</th>
                        <th>Board</th>
                        <th>Admin</th>
                        <th>Reason</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.length > 0 ? (
                        actions.map((action) => (
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
                                <span>/{action.board_id}/</span>
                              ) : (
                                <span className="text-secondary">Global</span>
                              )}
                            </td>
                            <td className="text-info">
                              {action.admin_username ||
                                action.current_admin_username ||
                                "Unknown"}
                            </td>
                            <td
                              className="text-truncate"
                              style={{ maxWidth: "200px" }}
                              title={action.reason || ""}
                            >
                              {action.reason || "-"}
                            </td>
                            <td>
                              {action.thread_id && (
                                <span className="badge bg-secondary me-1">
                                  T#{action.thread_id}
                                </span>
                              )}
                              {action.post_id && (
                                <span className="badge bg-secondary me-1">
                                  P#{action.post_id}
                                </span>
                              )}
                              {action.ban_id && (
                                <span className="badge bg-danger">
                                  Ban#{action.ban_id}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center py-4">
                            <span className="text-secondary">
                              No moderation actions found
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer border-secondary">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
