//components/BoardPage.js

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
// Remove direct import of Bootstrap CSS

// API constants
const API_BASE_URL = "https://conniption.onrender.com"; // Update this with your backend URL

export default function BoardPage() {
  const { boardId } = useParams();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch board details
    const fetchBoard = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`);
        if (!response.ok) {
          throw new Error("Board not found");
        }
        const data = await response.json();
        setBoard(data.board);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching board:", err);
        setError("Failed to load board. Please try again later.");
        setLoading(false);
      }
    };

    fetchBoard();
  }, [boardId]);

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
        <div className="card bg-dark text-light border-secondary p-4 shadow">
          <div className="card-body text-center">
            <div className="spinner-border text-light" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading board...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
        <div className="card bg-dark text-light border-secondary p-4 shadow">
          <div className="card-body text-center">
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
            <Link to="/" className="btn btn-outline-light mt-3">
              ← Back to Boards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-4">
      <div className="container">
        <div className="mb-4">
          <Link to="/" className="btn btn-outline-light btn-sm">
            ← Back to Boards
          </Link>
        </div>

        <div className="card bg-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h1 className="h3 mb-0">
              <span className="badge bg-secondary me-2">/{board.id}/</span>
              {board.name}
            </h1>
          </div>
          <div className="card-body">
            <p className="text-muted mb-0">{board.description}</p>
          </div>
        </div>

        <div className="card bg-dark border-secondary shadow">
          <div className="card-header border-secondary d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0">Threads</h2>
            <button className="btn btn-sm btn-primary">New Thread</button>
          </div>
          <div className="card-body text-center py-5">
            <p className="text-muted">
              Board content will be implemented in the next step
            </p>
            <div className="spinner-border text-secondary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
