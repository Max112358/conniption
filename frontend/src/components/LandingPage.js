import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

// API constants
const API_BASE_URL = "https://conniption.onrender.com"; // Update this with your backend URL

export default function LandingPage() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch boards from API
    const fetchBoards = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/boards`);
        if (!response.ok) {
          throw new Error("Failed to fetch boards");
        }
        const data = await response.json();
        setBoards(data.boards);
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
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-lg text-center">
          <h1 className="text-3xl font-bold mb-6">Image Board</h1>
          <div className="text-gray-600">Loading boards...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-lg text-center">
          <h1 className="text-3xl font-bold mb-6">Image Board</h1>
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-lg text-center w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6">Image Board</h1>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Available Boards</h2>

          <div className="grid grid-cols-1 gap-4">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                className={`block p-4 bg-${
                  board.id === "tech" ? "blue" : "red"
                }-50 hover:bg-${
                  board.id === "tech" ? "blue" : "red"
                }-100 rounded-lg border border-${
                  board.id === "tech" ? "blue" : "red"
                }-200 transition-colors`}
              >
                <div className="font-bold text-lg">/{board.id}/</div>
                <div className="text-sm text-gray-600">{board.description}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          Select a board to view threads and posts
        </div>
      </div>
    </div>
  );
}
