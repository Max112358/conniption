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
  isThreadDead = false,
}) {
  const [surveyData, setSurveyData] = useState(null);
  const [userResponse, setUserResponse] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState(new Set());
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showCorrelations, setShowCorrelations] = useState(false);
  const [voting, setVoting] = useState(false);
  const [rescinding, setRescinding] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isChangingVote, setIsChangingVote] = useState(false); // Track if user is changing vote

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
      const url = `${API_BASE_URL}/api/boards/${boardId}/surveys/${surveyData.id}/results`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch results");
      }

      const data = await response.json();
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
    enabled: !!surveyData && !isThreadDead, // Disable socket for dead threads
    events: {
      survey_vote: handleSurveyVote,
    },
  });

  // Handle option selection
  const handleOptionToggle = (optionId) => {
    if (isThreadDead) return; // Don't allow selection in dead threads

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
    if (isThreadDead) {
      setError("Cannot vote in archived threads");
      return;
    }

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
      setIsChangingVote(false); // Reset changing vote state
    } catch (err) {
      console.error("Error voting:", err);
      setError(err.message || "Failed to submit vote");
    } finally {
      setVoting(false);
    }
  };

  // Handle change vote button click
  const handleChangeVote = () => {
    if (isThreadDead) return;
    setShowResults(false);
    setIsChangingVote(true);
    setSelectedOptions(new Set(userResponse.selected_options));
  };

  // Handle "Vote" button click (for users who haven't voted yet)
  const handleGoToVote = () => {
    if (isThreadDead) return;
    setShowResults(false);
    setSelectedOptions(new Set()); // Clear any selections
  };

  // Handle rescind vote
  const handleRescindVote = async () => {
    if (isThreadDead) {
      setError("Cannot change votes in archived threads");
      return;
    }

    setRescinding(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/surveys/${surveyData.id}/vote`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to rescind vote");
      }

      // Reset state
      setUserResponse(null);
      setSelectedOptions(new Set());
      setShowResults(false);
      setIsChangingVote(false);

      // Refresh results
      await fetchResults();
    } catch (err) {
      console.error("Error rescinding vote:", err);
      setError(err.message || "Failed to rescind vote");
    } finally {
      setRescinding(false);
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

  // Surveys never expire, but voting is disabled in dead threads
  const canVote = !isThreadDead && (!showResults || isChangingVote);
  const hasUserVoted = !!userResponse;

  return (
    <div
      className={`card bg-mid-dark border-secondary ${
        isThreadDead ? "dead-thread-disabled" : ""
      }`}
    >
      <div className="card-header border-secondary d-flex justify-content-between align-items-center">
        <h6 className="mb-0 text-secondary">
          <i className="bi bi-clipboard-check me-2 text-secondary"></i>
          {surveyData.survey_type === "single" ? "Poll" : "Multi-choice Poll"}
          {isThreadDead && <span className="text-danger ms-2">(Archived)</span>}
        </h6>
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
                {showResults && !isChangingVote ? (
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
                    } ${isThreadDead ? "opacity-50" : ""}`}
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
                      disabled={!canVote || isThreadDead}
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
            {canVote && !isThreadDead && (
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
                    {isChangingVote ? "Updating..." : "Voting..."}
                  </>
                ) : isChangingVote ? (
                  "Update Vote"
                ) : (
                  "Vote"
                )}
              </button>
            )}

            {/* Show "View Results" button if not showing results and not changing vote */}
            {!showResults && !isChangingVote && !isThreadDead && (
              <button
                className="btn btn-sm btn-outline-secondary ms-2"
                onClick={() => setShowResults(true)}
              >
                View Results
              </button>
            )}

            {/* Always show View Results for dead threads */}
            {!showResults && isThreadDead && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowResults(true)}
              >
                View Results
              </button>
            )}

            {/* Show "Vote" button if showing results, haven't voted, and not changing vote */}
            {showResults &&
              !hasUserVoted &&
              !isChangingVote &&
              !isThreadDead && (
                <button
                  className="btn btn-sm btn-primary ms-2"
                  onClick={handleGoToVote}
                >
                  Back to Voting
                </button>
              )}

            {/* Show "Change Vote" button if have voted, showing results, and not changing vote */}
            {hasUserVoted &&
              showResults &&
              !isChangingVote &&
              !isThreadDead && (
                <button
                  className="btn btn-sm btn-outline-primary ms-2"
                  onClick={handleChangeVote}
                >
                  Change Vote
                </button>
              )}

            {/* Show "Rescind Vote" button if user has voted */}
            {hasUserVoted &&
              showResults &&
              !isChangingVote &&
              !isThreadDead && (
                <button
                  className="btn btn-sm btn-outline-danger ms-2"
                  onClick={handleRescindVote}
                  disabled={rescinding}
                  title="Remove your vote from this poll"
                >
                  {rescinding ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Rescinding...
                    </>
                  ) : (
                    "Rescind Vote"
                  )}
                </button>
              )}

            {/* Buttons for when user is changing vote */}
            {isChangingVote && !isThreadDead && (
              <>
                <button
                  className="btn btn-sm btn-outline-secondary ms-2"
                  onClick={() => {
                    setIsChangingVote(false);
                    setShowResults(true);
                    setSelectedOptions(new Set(userResponse.selected_options));
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-outline-danger ms-2"
                  onClick={handleRescindVote}
                  disabled={rescinding}
                  title="Remove your vote from this poll"
                >
                  {rescinding ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Rescinding...
                    </>
                  ) : (
                    "Rescind Vote"
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Connection status */}
        {isConnected && showResults && !isChangingVote && !isThreadDead && (
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
        {surveyData.survey_type === "multiple" &&
          showResults &&
          !isChangingVote && (
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
