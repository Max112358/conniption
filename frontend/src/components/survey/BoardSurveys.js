// frontend/src/components/survey/BoardSurveys.js
import { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config/api";

// Mock Link component for artifact
const Link = ({ to, children, className }) => (
  <a href={to} className={className}>
    {children}
  </a>
);

export default function BoardSurveys({ boardId }) {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSurveys, setShowSurveys] = useState(false);

  useEffect(() => {
    if (showSurveys) {
      fetchSurveys();
    }
  }, [showSurveys, boardId]);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/surveys`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch surveys");
      }

      const data = await response.json();
      setSurveys(data.surveys || []);
    } catch (err) {
      console.error("Error fetching surveys:", err);
      setError("Failed to load surveys");
    } finally {
      setLoading(false);
    }
  };

  if (!showSurveys) {
    return (
      <div className="card bg-mid-dark border-secondary mb-4">
        <div className="card-body text-center">
          <button
            className="btn btn-outline-primary"
            onClick={() => setShowSurveys(true)}
          >
            <i className="bi bi-bar-chart-fill me-2"></i>
            View Active Surveys ({surveys.length || "?"})
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-mid-dark border-secondary mb-4">
      <div className="card-header border-secondary d-flex justify-content-between align-items-center">
        <h5 className="mb-0">
          <i className="bi bi-bar-chart-fill me-2"></i>
          Active Surveys
        </h5>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setShowSurveys(false)}
        >
          Hide
        </button>
      </div>
      <div className="card-body">
        {loading ? (
          <div className="text-center p-3">
            <div className="spinner-border text-light" role="status">
              <span className="visually-hidden">Loading surveys...</span>
            </div>
          </div>
        ) : error ? (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        ) : surveys.length === 0 ? (
          <p className="text-muted text-center mb-0">
            No active surveys on this board
          </p>
        ) : (
          <div className="list-group">
            {surveys.map((survey) => (
              <Link
                key={survey.id}
                to={`/board/${boardId}/thread/${survey.thread_id}#post-${survey.post_id}`}
                className="list-group-item list-group-item-action bg-dark text-light border-secondary"
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <h6 className="mb-1">{survey.question}</h6>
                    <p className="mb-1 small">
                      <span className="badge bg-secondary me-2">
                        {survey.survey_type === "single"
                          ? "Single Choice"
                          : "Multiple Choice"}
                      </span>
                      <span className="text-muted">
                        Thread #{survey.thread_id} • Post #{survey.post_id}
                      </span>
                    </p>
                  </div>
                  <div className="text-end">
                    <span className="badge bg-primary">
                      {survey.response_count}{" "}
                      {survey.response_count === 1 ? "vote" : "votes"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
