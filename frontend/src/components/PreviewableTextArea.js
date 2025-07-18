// frontend/src/components/PreviewableTextArea.js
import { forwardRef, useState } from "react";
import PostContent from "./PostContent";

const PreviewableTextArea = forwardRef(
  (
    {
      id,
      rows = 5,
      value,
      onChange,
      placeholder,
      disabled,
      maxLength = 4000,
      showCharacterLimit = 200, // Show counter when remaining chars drop below this
    },
    ref
  ) => {
    const [showPreview, setShowPreview] = useState(false);

    // Calculate remaining characters
    const remainingChars = maxLength - (value?.length || 0);
    const showCounter = remainingChars <= showCharacterLimit;

    return (
      <div>
        <div className="position-relative">
          <textarea
            ref={ref}
            className="form-control bg-dark text-light border-secondary"
            id={id}
            rows={rows}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={maxLength}
            style={{ resize: "vertical" }}
          />

          {/* Character counter */}
          {showCounter && (
            <div className="text-end mt-1">
              <small
                className={`text-${
                  remainingChars < 50
                    ? "danger"
                    : remainingChars < 100
                    ? "warning"
                    : "secondary"
                }`}
              >
                {remainingChars} characters remaining
              </small>
            </div>
          )}
        </div>

        <div className="mt-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setShowPreview(!showPreview)}
            disabled={!value || value.trim() === ""}
          >
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
        </div>

        {showPreview && value && (
          <div className="mt-3 p-3 border border-secondary rounded bg-dark">
            <small className="text-secondary d-block mb-2">Preview:</small>
            <PostContent
              content={value}
              isPreview={true}
              boardId=""
              onPostLinkClick={() => {}}
            />
          </div>
        )}
      </div>
    );
  }
);

PreviewableTextArea.displayName = "PreviewableTextArea";

export default PreviewableTextArea;
