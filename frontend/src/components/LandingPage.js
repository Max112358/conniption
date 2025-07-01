// frontend/src/components/LandingPage.js

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import logoSvg from "../assets/conniption_logo6.svg";
import LoadingSpinner from "./LoadingSpinner";

export default function LandingPage() {
  const [sfw_boards, setSfwBoards] = useState([]);
  const [nsfw_boards, setNsfwBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch boards from API
    const fetchBoards = async () => {
      try {
        // Now using the imported API_BASE_URL
        const response = await fetch(`${API_BASE_URL}/api/boards`);
        if (!response.ok) {
          throw new Error("Failed to fetch boards");
        }
        const data = await response.json();

        // Sort boards alphabetically by ID
        const sortedBoards = [...data.boards].sort((a, b) =>
          a.id.localeCompare(b.id)
        );

        // Split boards into SFW and NSFW
        const sfwBoards = sortedBoards.filter((board) => !board.nsfw);
        const nsfwBoards = sortedBoards.filter((board) => board.nsfw);

        setSfwBoards(sfwBoards);
        setNsfwBoards(nsfwBoards);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching boards:", err);
        setError("Failed to load boards. Please try again later.");
        setLoading(false);
      }
    };

    fetchBoards();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading boards..." />;
  }

  if (error) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
        <div className="card bg-dark text-light border-secondary p-4 shadow">
          <div className="card-body text-center">
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

  // Function to render a board item
  const renderBoardItem = (board) => (
    <Link
      key={board.id}
      to={`/board/${board.id}`}
      className="list-group-item list-group-item-action bg-dark text-light border-secondary p-3"
    >
      <div className="d-flex justify-content-between align-items-start mb-2">
        <strong className="h6 mb-0">/{board.id}/</strong>
        <span
          className={`badge rounded-pill bg-${
            board.nsfw ? "danger" : "primary"
          }`}
        >
          {board.name}
        </span>
      </div>
      <p
        className="text-secondary mb-0 small"
        style={{
          lineHeight: "1.4",
          display: "-webkit-box",
          WebkitLineClamp: "3",
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {board.description}
      </p>
    </Link>
  );

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-4">
      <div className="container">
        <div className="text-center mb-4">
          <img
            src={logoSvg}
            alt="Conniption Logo"
            style={{ maxHeight: "80px", maxWidth: "100%" }}
            className="img-fluid mb-3"
          />
        </div>

        <div className="row">
          {/* SFW Boards Section */}
          <div className="col-md-8 mb-4">
            <div className="card bg-dark text-light border-secondary shadow h-100">
              <div className="card-header border-secondary">
                <h2 className="h5 mb-0">Boards</h2>
              </div>
              <div className="card-body">
                <div className="row">
                  {/* Create multiple columns for SFW boards */}
                  {[0, 1].map((colIndex) => {
                    const colBoards = sfw_boards.filter(
                      (_, index) => index % 2 === colIndex
                    );
                    return (
                      <div key={colIndex} className="col-md-6 mb-3">
                        <div className="list-group">
                          {colBoards.map((board) => renderBoardItem(board))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* NSFW Boards Section */}
          <div className="col-md-4 mb-4">
            <div className="card bg-dark text-light border-secondary shadow h-100">
              <div className="card-header border-secondary bg-danger bg-opacity-25">
                <h2 className="h5 mb-0">NSFW Boards</h2>
              </div>
              <div className="card-body">
                <div className="list-group">
                  {nsfw_boards.map((board) => renderBoardItem(board))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-secondary small mt-3 pb-3">
          Select a board to view threads and posts
        </div>
      </div>
    </div>
  );
}
