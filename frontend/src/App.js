import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import BoardPage from "./components/BoardPage";
import CreateThreadPage from "./components/CreateThreadPage";
import ThreadPage from "./components/ThreadPage";
import "./colors.css";

// Main app with routing
export default function App() {
  // Log routes for debugging
  console.log("App rendering with routes:");
  console.log("/ -> LandingPage");
  console.log("/board/:boardId -> BoardPage");
  console.log("/board/:boardId/create-thread -> CreateThreadPage");
  console.log("/board/:boardId/thread/:threadId -> ThreadPage");

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/board/:boardId" element={<BoardPage />} />
        <Route
          path="/board/:boardId/create-thread"
          element={<CreateThreadPage />}
        />
        <Route
          path="/board/:boardId/thread/:threadId"
          element={<ThreadPage />}
        />

        {/* Add a fallback route to catch invalid URLs */}
        <Route
          path="*"
          element={
            <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
              <div className="card bg-dark text-light border-secondary p-4 shadow">
                <div className="card-body text-center">
                  <h2>Page Not Found</h2>
                  <p>The page you're looking for doesn't exist.</p>
                  <a href="/" className="btn btn-outline-light mt-3">
                    Go to Home
                  </a>
                </div>
              </div>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}
