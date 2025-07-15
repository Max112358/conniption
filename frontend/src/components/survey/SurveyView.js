// frontend/src/components/survey/SurveyView.js
import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../../config/api";
import useSocket from "../../hooks/useSocket";
import SurveyCorrelations from "./SurveyCorrelations";

export default function SurveyView({
  survey,
  postId,
  threadId,
  boardId,
  isPostOwner,
}) {
  const [surveyData, setSurveyData] = useState(null);
  const [userResponse, setUserResponse] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState(new Set());
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showCorrelations, setShowCorrelations] = useState(false);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  console.log(`=== SURVEY DEBUG: SurveyView for post ${postId} ===`);
  console.log("Survey prop received:", survey);
  console.log("Thread ID:", threadId);
  console.log("Board ID:", boardId);

  // Fetch survey data and user's response
  const fetchSurveyData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts/${postId}/survey`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch survey");
      }

      const data = await response.json();
      setSurveyData(data.survey);

      // Set user's existing response if any
      if (data.survey.user_response) {
        setUserResponse(data.survey.user_response);
        setSelectedOptions(new Set(data.survey.user_response.selected_options));
        setShowResults(true);
      }
    } catch (err) {
      console.error("Error fetching survey:", err);
      setError("Failed to load survey");
    } finally {
      setLoading(false);
    }
  }, [boardId, threadId, postId]);

  // Fetch results
  const fetchResults = useCallback(async () => {
    try {
      console.log("=== SURVEY VIEW DEBUG: Fetching results ===");
      const url = `${API_BASE_URL}/api/boards/${boardId}/surveys/${surveyData.id}/results`;
      console.log("Fetching from URL:", url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch results");
      }

      const data = await response.json();
      console.log("=== SURVEY VIEW DEBUG: Raw response from API ===");
      console.log(JSON.stringify(data, null, 2));

      console.log("=== SURVEY VIEW DEBUG: Results breakdown ===");
      if (data.results) {
        console.log("Total responses:", data.results.total_responses);
        console.log("Survey type:", data.results.survey_type);
        console.log("Results array:", data.results.results);

        if (data.results.results) {
          data.results.results.forEach((result, index) => {
            console.log(`Option ${index + 1}:`, {
              id: result.option_id,
              text: result.option_text,
              votes: result.vote_count,
              percentage: result.percentage,
            });
          });
        }
      }

      setResults(data.results);
    } catch (err) {
      console.error("Error fetching results:", err);
    }
  }, [boardId, surveyData?.id]);

  useEffect(() => {
    // Always fetch full survey data since the prop may only contain basic info
    fetchSurveyData();
  }, [fetchSurveyData]);

  // Fetch results when showing results
  useEffect(() => {
    if (showResults && surveyData) {
      fetchResults();
    }
  }, [showResults, surveyData, fetchResults]);

  // Socket event handler for vote updates
  const handleSurveyVote = useCallback(
    (data) => {
      if (data.surveyId === surveyData?.id) {
        fetchResults();
      }
    },
    [surveyData?.id, fetchResults]
  );

  // Socket configuration
  const { isConnected } = useSocket({
    room: `${boardId}-${threadId}`,
    enabled: !!surveyData,
    events: {
      survey_vote: handleSurveyVote,
    },
  });

  // Handle option selection
  const handleOptionToggle = (optionId) => {
    const newSelected = new Set(selectedOptions);

    if (surveyData.survey_type === "single") {
      // Single choice - clear all and select this one
      newSelected.clear();
      newSelected.add(optionId);
    } else {
      // Multiple choice - toggle
      if (newSelected.has(optionId)) {
        newSelected.delete(optionId);
      } else {
        newSelected.add(optionId);
      }
    }

    setSelectedOptions(newSelected);
  };

  // Submit vote
  const handleSubmitVote = async () => {
    if (selectedOptions.size === 0) {
      setError("Please select at least one option");
      return;
    }

    setVoting(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/surveys/${surveyData.id}/vote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            option_ids: Array.from(selectedOptions),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit vote");
      }

      const data = await response.json();
      setUserResponse(data.response);
      setShowResults(true);
    } catch (err) {
      console.error("Error voting:", err);
      setError(err.message || "Failed to submit vote");
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="card bg-mid-dark border-secondary">
        <div className="card-body text-center">
          <div
            className="spinner-border spinner-border-sm text-light"
            role="status"
          >
            <span className="visually-hidden">Loading survey...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!surveyData || !surveyData.options) {
    return null;
  }

  const isExpired = surveyData.is_expired;
  const canVote = !isExpired && !showResults;

  return (
    <div className="card bg-mid-dark border-secondary">
      <div className="card-header border-secondary d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <i className="bi bi-bar-chart-fill me-2 text-secondary"></i>
          {surveyData.survey_type === "single" ? "Poll" : "Multi-choice Poll"}
        </h6>
        {isExpired && <span className="badge bg-secondary">Expired</span>}
      </div>
      <div className="card-body">
        <p className="text-light mb-3">{surveyData.question}</p>

        {error && (
          <div className="alert alert-danger alert-sm" role="alert">
            {error}
          </div>
        )}

        {/* Options */}
        <div className="mb-3">
          {surveyData.options.map((option) => {
            const isSelected = selectedOptions.has(option.id);
            const voteCount =
              results?.results?.find((r) => r.option_id === option.id)
                ?.vote_count || 0;
            const percentage =
              results?.results?.find((r) => r.option_id === option.id)
                ?.percentage || 0;

            return (
              <div key={option.id} className="mb-2">
                {showResults ? (
                  <div className="position-relative">
                    <div
                      className="progress bg-dark"
                      style={{ height: "30px" }}
                    >
                      <div
                        className={`progress-bar ${
                          userResponse?.selected_options?.includes(option.id)
                            ? "bg-primary"
                            : "bg-secondary"
                        }`}
                        role="progressbar"
                        style={{ width: `${percentage}%` }}
                        aria-valuenow={percentage}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                      <div
                        className="position-absolute w-100 h-100 d-flex align-items-center px-2 text-light"
                        style={{ top: 0, left: 0 }}
                      >
                        <span className="me-auto">{option.option_text}</span>
                        <span className="small">
                          {voteCount} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`form-check p-2 rounded border ${
                      isSelected ? "border-primary bg-dark" : "border-secondary"
                    }`}
                    style={{ cursor: canVote ? "pointer" : "default" }}
                    onClick={() => canVote && handleOptionToggle(option.id)}
                  >
                    <input
                      className="form-check-input"
                      type={
                        surveyData.survey_type === "single"
                          ? "radio"
                          : "checkbox"
                      }
                      name={`survey-${surveyData.id}`}
                      id={`option-${option.id}`}
                      checked={isSelected}
                      onChange={() => {}}
                      disabled={!canVote}
                    />
                    <label
                      className="form-check-label text-light"
                      htmlFor={`option-${option.id}`}
                      style={{ cursor: canVote ? "pointer" : "default" }}
                    >
                      {option.option_text}
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="d-flex justify-content-between align-items-center">
          <div>
            {results && (
              <small className="text-secondary">
                Total votes: {results.total_responses}
              </small>
            )}
          </div>
          <div>
            {canVote && (
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSubmitVote}
                disabled={voting || selectedOptions.size === 0}
              >
                {voting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Voting...
                  </>
                ) : (
                  "Vote"
                )}
              </button>
            )}
            {!showResults && !isExpired && (
              <button
                className="btn btn-sm btn-outline-secondary ms-2"
                onClick={() => setShowResults(true)}
              >
                View Results
              </button>
            )}
            {showResults && !isExpired && !userResponse && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowResults(false)}
              >
                Back to Vote
              </button>
            )}
            {userResponse && !isExpired && (
              <button
                className="btn btn-sm btn-outline-primary ms-2"
                onClick={() => {
                  setShowResults(false);
                  setSelectedOptions(new Set(userResponse.selected_options));
                }}
              >
                Change Vote
              </button>
            )}
          </div>
        </div>

        {/* Connection status */}
        {isConnected && showResults && (
          <div className="text-center mt-2">
            <small className="text-success">
              <i
                className="bi bi-circle-fill me-1"
                style={{ fontSize: "0.5rem" }}
              ></i>
              Live results
            </small>
          </div>
        )}

        {/* Correlations for multiple choice surveys */}
        {surveyData.survey_type === "multiple" && showResults && (
          <div className="mt-3">
            {!showCorrelations ? (
              <button
                className="btn btn-sm btn-outline-info w-100"
                onClick={() => setShowCorrelations(true)}
              >
                <i className="bi bi-diagram-3 me-1"></i>
                Show Option Correlations
              </button>
            ) : (
              <>
                <button
                  className="btn btn-sm btn-outline-secondary w-100"
                  onClick={() => setShowCorrelations(false)}
                >
                  Hide Correlations
                </button>
                <SurveyCorrelations
                  surveyId={surveyData.id}
                  boardId={boardId}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
