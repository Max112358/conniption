// frontend/src/components/survey/SurveyCorrelations.js
import { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config/api";

export default function SurveyCorrelations({ surveyId, boardId }) {
  const [correlations, setCorrelations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCorrelations = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/surveys/${surveyId}/correlations`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch correlations");
        }

        const data = await response.json();
        setCorrelations(data);
      } catch (err) {
        console.error("Error fetching correlations:", err);
        setError("Failed to load correlations");
      } finally {
        setLoading(false);
      }
    };

    fetchCorrelations();
  }, [surveyId, boardId]);

  if (loading) {
    return (
      <div className="text-center p-3">
        <div
          className="spinner-border spinner-border-sm text-light"
          role="status"
        >
          <span className="visually-hidden">Loading correlations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!correlations || correlations.correlations.length === 0) {
    return (
      <div className="text-secondary text-center p-3">
        No correlations data available yet.
      </div>
    );
  }

  return (
    <div className="card bg-dark border-secondary mt-3">
      <div className="card-header border-secondary">
        <h6 className="mb-0">
          <i className="bi bi-diagram-3 text-secondary me-2"></i>
          Option Correlations
        </h6>
      </div>
      <div className="card-body">
        <p className="text-secondary small mb-3">
          Shows how often different options are selected together
        </p>

        <div className="table-responsive">
          <table className="table table-dark table-sm">
            <thead>
              <tr>
                <th>Options</th>
                <th className="text-end">Co-selections</th>
                <th className="text-end">Correlation</th>
              </tr>
            </thead>
            <tbody>
              {correlations.correlations.map((corr, index) => (
                <tr key={index}>
                  <td>
                    <div>
                      <span className="text-primary">{corr.option1.text}</span>
                      <span className="text-secondary mx-2">×</span>
                      <span className="text-info">{corr.option2.text}</span>
                    </div>
                  </td>
                  <td className="text-end">{corr.co_occurrence_count}</td>
                  <td className="text-end">
                    <div className="d-flex align-items-center justify-content-end">
                      <div
                        className="progress bg-dark me-2"
                        style={{ width: "60px", height: "10px" }}
                      >
                        <div
                          className="progress-bar bg-success"
                          role="progressbar"
                          style={{ width: `${corr.correlation_percentage}%` }}
                          aria-valuenow={corr.correlation_percentage}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        />
                      </div>
                      <span className="small">
                        {corr.correlation_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-secondary small mt-2">
          <i className="bi bi-info-circle me-1"></i>
          Percentage shows how often option 2 is selected when option 1 is
          selected
        </div>
      </div>
    </div>
  );
}
