//components/BoardPage.js

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

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
    return <div className="p-8 text-center">Loading board...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-4">
        <Link to="/" className="text-blue-500 hover:underline">
          ← Back to Boards
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">
        /{board.id}/ - {board.name}
      </h1>
      <p className="text-gray-600 mb-6">{board.description}</p>

      <div className="text-center p-8 bg-gray-50 rounded-lg">
        Board content will be implemented in the next step
      </div>
    </div>
  );
}
