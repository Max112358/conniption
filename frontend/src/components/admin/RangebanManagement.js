// frontend/src/components/admin/RangebanManagement.js
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";
import { countryList } from "../../utils/countryList";

export default function RangebanManagement() {
  const { adminUser } = useOutletContext();
  const [rangebans, setRangebans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [boards, setBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState("");
  const [stats, setStats] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    ban_type: "country",
    ban_value: "",
    board_id: "",
    reason: "",
    expires_at: "30d",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Fetch rangebans
  useEffect(() => {
    fetchRangebans();
    fetchBoards();
    fetchStats();
  }, [selectedBoard]);

  const fetchRangebans = async () => {
    try {
      setLoading(true);
      let url = `${API_BASE_URL}/api/admin/rangebans`;
      if (selectedBoard) {
        url += `?boardId=${selectedBoard}`;
      }

      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch rangebans");
      }

      const data = await response.json();
      setRangebans(data.rangebans || []);
    } catch (err) {
      console.error("Error fetching rangebans:", err);
      setError("Failed to load rangebans");
    } finally {
      setLoading(false);
    }
  };

  const fetchBoards = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/boards`);
      if (response.ok) {
        const data = await response.json();
        setBoards(data.boards || []);
      }
    } catch (err) {
      console.error("Error fetching boards:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/rangebans/stats`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const handleCreateRangeban = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      // Calculate expiration date
      let expires_at = null;
      if (formData.expires_at && formData.expires_at !== "permanent") {
        const match = formData.expires_at.match(/^(\d+)([dhmy])$/);
        if (match) {
          const [, amount, unit] = match;
          const date = new Date();
          const numAmount = parseInt(amount, 10);

          switch (unit) {
            case "d":
              date.setDate(date.getDate() + numAmount);
              break;
            case "h":
              date.setHours(date.getHours() + numAmount);
              break;
            case "m":
              date.setMonth(date.getMonth() + numAmount);
              break;
            case "y":
              date.setFullYear(date.getFullYear() + numAmount);
              break;
          }
          expires_at = date.toISOString();
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/rangebans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          board_id: formData.board_id || null,
          expires_at,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create rangeban");
      }

      // Reset form and refresh list
      setFormData({
        ban_type: "country",
        ban_value: "",
        board_id: "",
        reason: "",
        expires_at: "30d",
      });
      setShowCreateModal(false);
      fetchRangebans();
      fetchStats();
    } catch (err) {
      console.error("Error creating rangeban:", err);
      setFormError(err.message || "Failed to create rangeban");
    } finally {
      setFormLoading(false);
    }
  };

  const handleRemoveRangeban = async (rangebanId) => {
    if (!window.confirm("Are you sure you want to remove this rangeban?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/rangebans/${rangebanId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to remove rangeban");
      }

      fetchRangebans();
      fetchStats();
    } catch (err) {
      console.error("Error removing rangeban:", err);
      setError("Failed to remove rangeban");
    }
  };

  const formatExpiration = (expiresAt) => {
    if (!expiresAt) return "Never";
    return new Date(expiresAt).toLocaleString();
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Rangeban Management</h1>
        <button
          className="btn btn-danger"
          onClick={() => setShowCreateModal(true)}
        >
          Create Rangeban
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Statistics Card */}
      {stats && (
        <div className="card bg-mid-dark border-secondary mb-4">
          <div className="card-header border-secondary">
            <h2 className="h5 mb-0">Rangeban Statistics</h2>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <h6 className="text-secondary">Ban Types</h6>
                {stats.byType && stats.byType.length > 0 ? (
                  <ul className="list-unstyled">
                    {stats.byType.map((type) => (
                      <li key={type.ban_type}>
                        <strong>{type.ban_type}:</strong> {type.active_count}{" "}
                        active / {type.count} total
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">No rangebans yet</p>
                )}
              </div>
              <div className="col-md-6">
                <h6 className="text-secondary">Top Banned Countries</h6>
                {stats.topCountries && stats.topCountries.length > 0 ? (
                  <ul className="list-unstyled">
                    {stats.topCountries.slice(0, 5).map((country) => (
                      <li key={country.country_code}>
                        <strong>{country.country_name}:</strong>{" "}
                        {country.ban_count} bans
                        {country.global_bans > 0 && (
                          <span className="text-danger ms-2">
                            ({country.global_bans} global)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">No country bans yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="card bg-mid-dark border-secondary mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label
                htmlFor="boardFilter"
                className="form-label text-secondary"
              >
                Board
              </label>
              <select
                id="boardFilter"
                className="form-select bg-dark text-light border-secondary"
                value={selectedBoard}
                onChange={(e) => setSelectedBoard(e.target.value)}
              >
                <option value="">All Boards</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    /{board.id}/ - {board.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Rangebans List */}
      <div className="card bg-mid-dark border-secondary">
        <div className="card-header border-secondary">
          <h2 className="h5 mb-0">Active Rangebans</h2>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <div className="spinner-border text-light" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : rangebans.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-dark table-striped table-hover mb-0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Board</th>
                    <th>Reason</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rangebans.map((rangeban) => (
                    <tr key={rangeban.id}>
                      <td>{rangeban.id}</td>
                      <td>
                        <span className="badge bg-warning">
                          {rangeban.ban_type}
                        </span>
                      </td>
                      <td>
                        {rangeban.ban_type === "country" ? (
                          <>
                            {rangeban.ban_value} - {rangeban.country_name}
                          </>
                        ) : (
                          rangeban.ban_value
                        )}
                      </td>
                      <td>
                        {rangeban.board_id || (
                          <span className="badge bg-danger">Global</span>
                        )}
                      </td>
                      <td
                        className="text-truncate"
                        style={{ maxWidth: "200px" }}
                      >
                        {rangeban.reason}
                      </td>
                      <td>{new Date(rangeban.created_at).toLocaleString()}</td>
                      <td>{formatExpiration(rangeban.expires_at)}</td>
                      <td>{rangeban.admin_username || "Unknown"}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleRemoveRangeban(rangeban.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-muted mb-0">No active rangebans</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Rangeban Modal */}
      {showCreateModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content bg-dark text-light border-secondary">
              <div className="modal-header border-secondary">
                <h5 className="modal-title">Create Rangeban</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowCreateModal(false)}
                  disabled={formLoading}
                ></button>
              </div>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger" role="alert">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleCreateRangeban}>
                  <div className="mb-3">
                    <label className="form-label text-secondary">
                      Ban Type
                    </label>
                    <select
                      className="form-select bg-dark text-light border-secondary"
                      value={formData.ban_type}
                      onChange={(e) =>
                        setFormData({ ...formData, ban_type: e.target.value })
                      }
                      disabled={formLoading}
                    >
                      <option value="country">Country</option>
                      <option value="ip_range" disabled>
                        IP Range (Coming Soon)
                      </option>
                      <option value="asn" disabled>
                        ASN (Coming Soon)
                      </option>
                    </select>
                  </div>

                  {formData.ban_type === "country" && (
                    <div className="mb-3">
                      <label className="form-label text-secondary">
                        Country
                      </label>
                      <select
                        className="form-select bg-dark text-light border-secondary"
                        value={formData.ban_value}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ban_value: e.target.value,
                          })
                        }
                        required
                        disabled={formLoading}
                      >
                        <option value="">Select a country...</option>
                        {Object.entries(countryList).map(([code, name]) => (
                          <option key={code} value={code}>
                            {code} - {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label text-secondary">Board</label>
                    <select
                      className="form-select bg-dark text-light border-secondary"
                      value={formData.board_id}
                      onChange={(e) =>
                        setFormData({ ...formData, board_id: e.target.value })
                      }
                      disabled={formLoading}
                    >
                      <option value="">Global (All Boards)</option>
                      {boards.map((board) => (
                        <option key={board.id} value={board.id}>
                          /{board.id}/ - {board.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary">
                      Reason *
                    </label>
                    <textarea
                      className="form-control bg-dark text-light border-secondary"
                      value={formData.reason}
                      onChange={(e) =>
                        setFormData({ ...formData, reason: e.target.value })
                      }
                      rows="3"
                      placeholder="Reason for rangeban..."
                      required
                      disabled={formLoading}
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary">
                      Duration
                    </label>
                    <select
                      className="form-select bg-dark text-light border-secondary"
                      value={formData.expires_at}
                      onChange={(e) =>
                        setFormData({ ...formData, expires_at: e.target.value })
                      }
                      disabled={formLoading}
                    >
                      <option value="1h">1 Hour</option>
                      <option value="6h">6 Hours</option>
                      <option value="1d">1 Day</option>
                      <option value="7d">1 Week</option>
                      <option value="30d">1 Month</option>
                      <option value="90d">3 Months</option>
                      <option value="180d">6 Months</option>
                      <option value="365d">1 Year</option>
                      <option value="permanent">Permanent</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleCreateRangeban}
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
                    "Create Rangeban"
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
