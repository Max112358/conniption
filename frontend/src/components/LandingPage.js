//components/LandingPage.js

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import logoSvg from "../assets/conniption_logo6.svg"; // Path may need adjustment based on your folder structure

// API constants
const API_BASE_URL = "https://conniption.onrender.com"; // Update this with your backend URL

export default function LandingPage() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNsfw, setShowNsfw] = useState(false);
  const [allBoards, setAllBoards] = useState([]);

  useEffect(() => {
    // Fetch boards from API
    const fetchBoards = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/boards`);
        if (!response.ok) {
          throw new Error("Failed to fetch boards");
        }
        const data = await response.json();
        setAllBoards(data.boards);
        // Initially filter out NSFW boards
        setBoards(data.boards.filter((board) => !board.nsfw));
        setLoading(false);
      } catch (err) {
        console.error("Error fetching boards:", err);
        setError("Failed to load boards. Please try again later.");
        setLoading(false);
      }
    };

    fetchBoards();
  }, []);

  // Toggle NSFW content visibility
  const toggleNsfw = () => {
    setShowNsfw(!showNsfw);
    if (!showNsfw) {
      // Show all boards including NSFW
      setBoards(allBoards);
    } else {
      // Hide NSFW boards
      setBoards(allBoards.filter((board) => !board.nsfw));
    }
  };

  if (loading) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
        <div className="card bg-dark text-light border-secondary p-4 shadow">
          <div className="card-body text-center">
            {/* Added logo to loading state */}
            <div className="d-flex justify-content-center mb-4">
              <img
                src={logoSvg}
                alt="Conniption Logo"
                style={{ maxHeight: "80px" }}
              />
            </div>
            <div className="spinner-border text-light" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading boards...</p>
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
            {/* Only show the logo */}
            <div className="d-flex justify-content-center mb-4">
              <img
                src={logoSvg}
                alt="Conniption Logo"
                style={{ maxHeight: "80px" }}
              />
            </div>
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
      <div
        className="card bg-dark text-light border-secondary p-4 shadow"
        style={{ maxWidth: "500px" }}
      >
        <div className="card-body">
          {/* Only show the logo */}
          <div className="d-flex justify-content-center mb-4">
            <img
              src={logoSvg}
              alt="Conniption Logo"
              style={{ maxHeight: "80px" }}
            />
          </div>

          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h4 mb-0 border-bottom pb-2">Available Boards</h2>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="nsfwToggle"
                  checked={showNsfw}
                  onChange={toggleNsfw}
                />
                <label
                  className="form-check-label text-danger"
                  htmlFor="nsfwToggle"
                >
                  Show NSFW
                </label>
              </div>
            </div>

            <div className="list-group">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  to={`/board/${board.id}`}
                  className={`list-group-item list-group-item-action bg-dark text-light border-secondary`}
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <strong>/{board.id}/</strong>
                    <span
                      className={`badge rounded-pill bg-${
                        board.nsfw ? "danger" : "primary"
                      }`}
                    >
                      {board.name}
                    </span>
                  </div>
                  <small className="text-muted">{board.description}</small>
                </Link>
              ))}
            </div>
          </div>

          <div className="text-muted text-center small mt-3">
            Select a board to view threads and posts
          </div>
        </div>
      </div>
    </div>
  );
}
