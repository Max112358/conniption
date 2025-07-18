// frontend/src/components/survey/CreateSurvey.js
import { useState } from "react";
import { API_BASE_URL } from "../../config/api";

export default function CreateSurvey({
  postId,
  threadId,
  boardId,
  onSurveyCreated,
  onCancel,
}) {
  const [surveyType, setSurveyType] = useState("single");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [expiresIn, setExpiresIn] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Character limits
  const QUESTION_LIMIT = 280;
  const OPTION_LIMIT = 280;
  const SHOW_COUNTER_THRESHOLD = 50;

  // Add a new option
  const addOption = () => {
    if (options.length < 16) {
      setOptions([...options, ""]);
    }
  };

  // Remove an option
  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  // Update option text
  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  // Helper to get remaining characters
  const getRemainingChars = (text, limit) => {
    return limit - (text?.length || 0);
  };

  // Helper to determine if counter should be shown
  const shouldShowCounter = (text, limit) => {
    return getRemainingChars(text, limit) <= SHOW_COUNTER_THRESHOLD;
  };

  // Helper to get counter color class
  const getCounterColorClass = (remaining) => {
    if (remaining < 10) return "danger";
    if (remaining < 25) return "warning";
    return "secondary";
  };

  // Calculate expiration date
  const calculateExpiresAt = () => {
    if (!expiresIn) return null;

    const now = new Date();
    const [value, unit] = expiresIn.split("-");
    const amount = parseInt(value);

    switch (unit) {
      case "hours":
        now.setHours(now.getHours() + amount);
        break;
      case "days":
        now.setDate(now.getDate() + amount);
        break;
      case "weeks":
        now.setDate(now.getDate() + amount * 7);
        break;
      default:
        return null;
    }

    return now.toISOString();
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate
    if (!question.trim()) {
      setError("Question is required");
      return;
    }

    const validOptions = options.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      setError("At least 2 options are required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts/${postId}/survey`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            survey_type: surveyType,
            question: question.trim(),
            options: validOptions,
            expires_at: calculateExpiresAt(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create survey");
      }

      const data = await response.json();

      if (onSurveyCreated) {
        onSurveyCreated(data.survey);
      }
    } catch (err) {
      console.error("Error creating survey:", err);
      setError(err.message || "Failed to create survey");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="card bg-mid-dark border-secondary">
      <div className="card-header border-secondary">
        <h6 className="mb-0">Create Survey</h6>
      </div>
      <div className="card-body">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <div>
          {/* Survey Type */}
          <div className="mb-3">
            <label className="form-label text-secondary">Survey Type</label>
            <div>
              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="surveyType"
                  id="singleChoice"
                  value="single"
                  checked={surveyType === "single"}
                  onChange={(e) => setSurveyType(e.target.value)}
                />
                <label className="form-check-label" htmlFor="singleChoice">
                  Single Choice
                </label>
              </div>
              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name="surveyType"
                  id="multipleChoice"
                  value="multiple"
                  checked={surveyType === "multiple"}
                  onChange={(e) => setSurveyType(e.target.value)}
                />
                <label className="form-check-label" htmlFor="multipleChoice">
                  Multiple Choice
                </label>
              </div>
            </div>
          </div>

          {/* Question */}
          <div className="mb-3">
            <label htmlFor="question" className="form-label text-secondary">
              Question *
            </label>
            <input
              type="text"
              className="form-control bg-dark text-light border-secondary"
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to ask?"
              maxLength={QUESTION_LIMIT}
              required
            />
            {shouldShowCounter(question, QUESTION_LIMIT) && (
              <div className="text-end mt-1">
                <small
                  className={`text-${getCounterColorClass(
                    getRemainingChars(question, QUESTION_LIMIT)
                  )}`}
                >
                  {getRemainingChars(question, QUESTION_LIMIT)} characters
                  remaining
                </small>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="mb-3">
            <label className="form-label text-secondary">
              Options * (minimum 2, maximum 16)
            </label>
            {options.map((option, index) => (
              <div key={index} className="mb-2">
                <div className="input-group">
                  <span className="input-group-text bg-dark text-secondary border-secondary">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    className="form-control bg-dark text-light border-secondary"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    maxLength={OPTION_LIMIT}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => removeOption(index)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  )}
                </div>
                {shouldShowCounter(option, OPTION_LIMIT) && (
                  <div className="text-end mt-1">
                    <small
                      className={`text-${getCounterColorClass(
                        getRemainingChars(option, OPTION_LIMIT)
                      )}`}
                    >
                      {getRemainingChars(option, OPTION_LIMIT)} characters
                      remaining
                    </small>
                  </div>
                )}
              </div>
            ))}

            {options.length < 16 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={addOption}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Add Option
              </button>
            )}
          </div>

          {/* Expiration */}
          <div className="mb-3">
            <label htmlFor="expiresIn" className="form-label text-secondary">
              Expires In (optional)
            </label>
            <select
              className="form-select bg-dark text-light border-secondary"
              id="expiresIn"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
            >
              <option value="">Never</option>
              <option value="1-hours">1 Hour</option>
              <option value="6-hours">6 Hours</option>
              <option value="12-hours">12 Hours</option>
              <option value="1-days">1 Day</option>
              <option value="3-days">3 Days</option>
              <option value="7-days">1 Week</option>
              <option value="14-days">2 Weeks</option>
              <option value="30-days">1 Month</option>
            </select>
          </div>

          {/* Actions */}
          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onCancel}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={
                creating ||
                !question.trim() ||
                options.filter((o) => o.trim()).length < 2
              }
            >
              {creating ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Creating...
                </>
              ) : (
                "Create Survey"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
