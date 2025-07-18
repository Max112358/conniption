// frontend/src/components/survey/SurveyFormSection.js
import { useState } from "react";

export default function SurveyFormSection({
  includeSurvey,
  setIncludeSurvey,
  surveyData,
  setSurveyData,
  loading = false,
}) {
  // Local state if parent doesn't provide it
  const [localIncludeSurvey, setLocalIncludeSurvey] = useState(false);
  const [localSurveyData, setLocalSurveyData] = useState({
    surveyType: "single",
    surveyQuestion: "",
    surveyOptions: ["", ""],
  });

  // Use provided state or local state
  const showSurvey =
    includeSurvey !== undefined ? includeSurvey : localIncludeSurvey;
  const setShowSurvey = setIncludeSurvey || setLocalIncludeSurvey;
  const survey = surveyData || localSurveyData;
  const updateSurvey = setSurveyData || setLocalSurveyData;

  // Character limits
  const QUESTION_LIMIT = 280;
  const OPTION_LIMIT = 280;
  const SHOW_COUNTER_THRESHOLD = 50; // Show counter when remaining chars drop below this

  // Survey option management
  const addSurveyOption = () => {
    if (survey.surveyOptions.length < 16) {
      updateSurvey({
        ...survey,
        surveyOptions: [...survey.surveyOptions, ""],
      });
    }
  };

  const removeSurveyOption = (index) => {
    if (survey.surveyOptions.length > 2) {
      updateSurvey({
        ...survey,
        surveyOptions: survey.surveyOptions.filter((_, i) => i !== index),
      });
    }
  };

  const updateSurveyOption = (index, value) => {
    const newOptions = [...survey.surveyOptions];
    newOptions[index] = value;
    updateSurvey({
      ...survey,
      surveyOptions: newOptions,
    });
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

  return (
    <div className="card bg-dark border-secondary mb-3">
      <div className="card-header border-secondary">
        <div className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            id="includeSurvey"
            checked={showSurvey}
            onChange={(e) => setShowSurvey(e.target.checked)}
            disabled={loading}
          />
          <label
            className="form-check-label text-secondary"
            htmlFor="includeSurvey"
          >
            Add a survey/poll to this post
          </label>
        </div>
      </div>

      {showSurvey && (
        <div className="card-body">
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
                  checked={survey.surveyType === "single"}
                  onChange={(e) =>
                    updateSurvey({
                      ...survey,
                      surveyType: e.target.value,
                    })
                  }
                  disabled={loading}
                />
                <label
                  className="form-check-label text-secondary"
                  htmlFor="singleChoice"
                >
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
                  checked={survey.surveyType === "multiple"}
                  onChange={(e) =>
                    updateSurvey({
                      ...survey,
                      surveyType: e.target.value,
                    })
                  }
                  disabled={loading}
                />
                <label
                  className="form-check-label text-secondary"
                  htmlFor="multipleChoice"
                >
                  Multiple Choice
                </label>
              </div>
            </div>
          </div>

          {/* Survey Question */}
          <div className="mb-3">
            <label
              htmlFor="surveyQuestion"
              className="form-label text-secondary"
            >
              Survey Question
            </label>
            <input
              type="text"
              className="form-control bg-dark text-light border-secondary"
              id="surveyQuestion"
              value={survey.surveyQuestion}
              onChange={(e) =>
                updateSurvey({
                  ...survey,
                  surveyQuestion: e.target.value,
                })
              }
              placeholder="What would you like to ask?"
              maxLength={QUESTION_LIMIT}
              disabled={loading}
              required={showSurvey}
            />
            {shouldShowCounter(survey.surveyQuestion, QUESTION_LIMIT) && (
              <div className="text-end mt-1">
                <small
                  className={`text-${getCounterColorClass(
                    getRemainingChars(survey.surveyQuestion, QUESTION_LIMIT)
                  )}`}
                >
                  {getRemainingChars(survey.surveyQuestion, QUESTION_LIMIT)}{" "}
                  characters remaining
                </small>
              </div>
            )}
          </div>

          {/* Survey Options */}
          <div className="mb-3">
            <label className="form-label text-secondary">
              Options (minimum 2, maximum 16)
            </label>
            {survey.surveyOptions.map((option, index) => (
              <div key={index} className="mb-2">
                <div className="input-group">
                  <span className="input-group-text bg-dark text-secondary border-secondary">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    className="form-control bg-dark text-light border-secondary"
                    value={option}
                    onChange={(e) => updateSurveyOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    maxLength={OPTION_LIMIT}
                    disabled={loading}
                  />
                  {survey.surveyOptions.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => removeSurveyOption(index)}
                      disabled={loading}
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

            {survey.surveyOptions.length < 16 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={addSurveyOption}
                disabled={loading}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Add Option
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export validation function that can be used by parent components
export const validateSurveyData = (surveyData) => {
  if (!surveyData.surveyQuestion.trim()) {
    return { valid: false, error: "Survey question is required" };
  }

  const validOptions = surveyData.surveyOptions.filter((opt) => opt.trim());
  if (validOptions.length < 2) {
    return { valid: false, error: "Survey must have at least 2 options" };
  }

  return { valid: true, validOptions };
};
