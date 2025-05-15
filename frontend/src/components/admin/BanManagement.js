// frontend/src/components/admin/BanManagement.js
import { useState, useEffect } from "react";
import { useOutletContext, useSearchParams, Link } from "react-router-dom";

// API constants
const API_BASE_URL = "https://conniption.onrender.com";

export default function BanManagement() {
  const { adminUser } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bans, setBans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBoard, setSelectedBoard] = useState(
    searchParams.get("boardId") || ""
  );
  const [filter, setFilter] = useState(searchParams.get("filter") || "active");
  const [boards, setBoards] = useState([]);

  // Fetch bans based on filters
  useEffect(() => {
    const fetchBans = async () => {
      try {
        setLoading(true);
        setError(null);

        // Construct API URL with filters
        let url = `${API_BASE_URL}/api/admin/bans?`;

        if (selectedBoard) {
          url += `boardId=${selectedBoard}&`;
        }

        if (filter === "pending") {
          url += "appeal_status=pending";
        }

        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch bans: ${response.status}`);
        }

        const data = await response.json();
        setBans(data.bans || []);
      } catch (err) {
        console.error("Error fetching bans:", err);
        setError(err.message || "Failed to load bans");
      } finally {
        setLoading(false);
      }
    };

    fetchBans();

    // Update search params when filters change
    const params = {};
    if (selectedBoard) params.boardId = selectedBoard;
    if (filter) params.filter = filter;
    setSearchParams(params, { replace: true });
  }, [selectedBoard, filter, setSearchParams]);

  // Fetch available boards
  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/boards`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setBoards(data.boards || []);
        }
      } catch (err) {
        console.error("Error fetching boards:", err);
        // Don't set error state here, as it's not critical
      }
    };

    fetchBoards();
  }, []);

  // Handle removing a ban
  const handleRemoveBan = async (banId) => {
    if (!window.confirm("Are you sure you want to remove this ban?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/bans/${banId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: false,
          reason: "Ban removed by admin",
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to remove ban");
      }

      // Remove the ban from the list or update its status
      setBans(bans.filter((ban) => ban.id !== banId));
    } catch (err) {
      console.error("Error removing ban:", err);
      setError("Failed to remove ban. Please try again.");
    }
  };

  // Handle responding to an appeal
  const handleAppealResponse = async (banId, approved) => {
    const status = approved ? "approved" : "denied";
    const reason = approved
      ? "Appeal approved by admin"
      : "Appeal denied by admin";

    if (!window.confirm(`Are you sure you want to ${status} this appeal?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/bans/${banId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appeal_status: status,
          is_active: approved ? false : true,
          reason,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to ${status} appeal`);
      }

      // Remove the ban from the list if filter is "pending"
      if (filter === "pending") {
        setBans(bans.filter((ban) => ban.id !== banId));
      } else {
        // Update ban in the list
        setBans(
          bans.map((ban) => {
            if (ban.id === banId) {
              return {
                ...ban,
                appeal_status: status,
                is_active: !approved,
              };
            }
            return ban;
          })
        );
      }
    } catch (err) {
      console.error(`Error ${status} appeal:`, err);
      setError(`Failed to ${status} appeal. Please try again.`);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Ban Management</h1>
        <Link to="/admin/bans/create" className="btn btn-danger">
          Create New Ban
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
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

            <div className="col-md-6">
              <label
                htmlFor="statusFilter"
                className="form-label text-secondary"
              >
                Status
              </label>
              <select
                id="statusFilter"
                className="form-select bg-dark text-light border-secondary"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="active">Active Bans</option>
                <option value="pending">Pending Appeals</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bans List */}
      <div className="card bg-mid-dark border-secondary">
        <div className="card-header border-secondary">
          <h2 className="h5 mb-0">Bans List</h2>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <div className="spinner-border text-light" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : bans.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-dark table-striped table-hover mb-0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>IP Address</th>
                    <th>Board</th>
                    <th>Reason</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bans.map((ban) => (
                    <tr key={ban.id}>
                      <td>{ban.id}</td>
                      <td>{ban.ip_address}</td>
                      <td>{ban.board_id || "Global"}</td>
                      <td
                        className="text-truncate"
                        style={{ maxWidth: "200px" }}
                      >
                        {ban.reason}
                      </td>
                      <td>{new Date(ban.created_at).toLocaleString()}</td>
                      <td>
                        {ban.expires_at
                          ? new Date(ban.expires_at).toLocaleString()
                          : "Never"}
                      </td>
                      <td>{ban.admin_username || "Unknown"}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <Link
                            to={`/admin/bans/${ban.id}`}
                            className="btn btn-outline-primary"
                          >
                            View
                          </Link>

                          {ban.appeal_status === "pending" ? (
                            <>
                              <button
                                className="btn btn-outline-success"
                                onClick={() =>
                                  handleAppealResponse(ban.id, true)
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-outline-danger"
                                onClick={() =>
                                  handleAppealResponse(ban.id, false)
                                }
                              >
                                Deny
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => handleRemoveBan(ban.id)}
                            >
                              Remove
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
              <p className="text-muted mb-0">No bans found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
