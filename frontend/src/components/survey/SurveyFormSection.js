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
    surveyExpiresIn: "",
  });

  // Use provided state or local state
  const showSurvey =
    includeSurvey !== undefined ? includeSurvey : localIncludeSurvey;
  const setShowSurvey = setIncludeSurvey || setLocalIncludeSurvey;
  const survey = surveyData || localSurveyData;
  const updateSurvey = setSurveyData || setLocalSurveyData;

  console.log("=== SURVEY FORM DEBUG ===");
  console.log("includeSurvey prop:", includeSurvey);
  console.log("surveyData prop:", JSON.stringify(surveyData, null, 2));
  console.log("showSurvey (computed):", showSurvey);
  console.log("survey (computed):", JSON.stringify(survey, null, 2));
  console.log("loading:", loading);

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
          <label className="form-check-label" htmlFor="includeSurvey">
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
                  checked={survey.surveyType === "multiple"}
                  onChange={(e) =>
                    updateSurvey({
                      ...survey,
                      surveyType: e.target.value,
                    })
                  }
                  disabled={loading}
                />
                <label className="form-check-label" htmlFor="multipleChoice">
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
              Survey Question *
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
              maxLength="200"
              disabled={loading}
              required={showSurvey}
            />
          </div>

          {/* Survey Options */}
          <div className="mb-3">
            <label className="form-label text-secondary">
              Options * (minimum 2, maximum 16)
            </label>
            {survey.surveyOptions.map((option, index) => (
              <div key={index} className="input-group mb-2">
                <span className="input-group-text bg-dark text-secondary border-secondary">
                  {index + 1}
                </span>
                <input
                  type="text"
                  className="form-control bg-dark text-light border-secondary"
                  value={option}
                  onChange={(e) => updateSurveyOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  maxLength="100"
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

          {/* Survey Expiration */}
          <div className="mb-3">
            <label
              htmlFor="surveyExpiresIn"
              className="form-label text-secondary"
            >
              Expires In (optional)
            </label>
            <select
              className="form-select bg-dark text-light border-secondary"
              id="surveyExpiresIn"
              value={survey.surveyExpiresIn}
              onChange={(e) =>
                updateSurvey({
                  ...survey,
                  surveyExpiresIn: e.target.value,
                })
              }
              disabled={loading}
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

// Export function to calculate expiration date
export const calculateSurveyExpiresAt = (expiresIn) => {
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
