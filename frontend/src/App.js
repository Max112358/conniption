import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import BoardPage from "./components/BoardPage";
import CreateThreadPage from "./components/CreateThreadPage";
import ThreadPage from "./components/ThreadPage";

// Main app with routing
export default function App() {
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
      </Routes>
    </Router>
  );
}
