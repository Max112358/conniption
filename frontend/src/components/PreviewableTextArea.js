// frontend/src/components/PreviewableTextArea.js
import { useState } from "react";
import PostContent from "./PostContent";

export default function PreviewableTextArea({
  value,
  onChange,
  placeholder,
  rows = 5,
  maxLength,
  disabled,
  className = "",
  id,
}) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div>
      <div className="mb-2">
        <textarea
          className={`form-control bg-dark text-light border-secondary ${className}`}
          id={id}
          rows={rows}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
        />
      </div>

      {/* Preview toggle */}
      {value && value.includes("[spoiler]") && (
        <div className="mb-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setShowPreview(!showPreview)}
          >
            <i className={`bi bi-eye${showPreview ? "-slash" : ""} me-1`}></i>
            {showPreview ? "Hide" : "Show"} Preview
          </button>
        </div>
      )}

      {/* Preview panel */}
      {showPreview && value && (
        <div className="card bg-mid-dark border-secondary mb-3">
          <div className="card-header border-secondary py-2">
            <small className="text-secondary">Preview</small>
          </div>
          <div className="card-body">
            <PostContent
              content={value}
              posts={[]}
              allThreadsWithPosts={[]}
              boardId=""
              onPostLinkClick={() => {}}
              isPreview={true}
            />
          </div>
        </div>
      )}

      <small className="form-text text-secondary">
        Use [spoiler]text[/spoiler] to hide text until hovered
      </small>
    </div>
  );
}
