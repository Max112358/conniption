// frontend/src/components/PostHeader.js
import { useState } from "react";
import {
  getFlagUrl,
  getFlagUrlLarge,
  getCountryName,
} from "../utils/countryFlags";
import { getThreadIdColor } from "../utils/threadIdColors";

export default function PostHeader({
  post,
  onPostNumberClick,
  showThreadId = false,
  showCountryFlag = false,
}) {
  const [showCountryTooltip, setShowCountryTooltip] = useState(false);
  const [flagError, setFlagError] = useState(false);

  // Get thread ID color if applicable
  const threadIdColor = post.thread_user_id
    ? getThreadIdColor(post.thread_user_id)
    : null;

  // Get flag URLs
  const flagUrl = post.country_code ? getFlagUrl(post.country_code) : null;
  const flagUrlLarge = post.country_code
    ? getFlagUrlLarge(post.country_code)
    : null;

  return (
    <div className="d-flex align-items-center gap-2">
      <div>
        <span className="text-secondary">Post #</span>
        <span
          className="text-primary"
          style={{ cursor: "pointer" }}
          onClick={() => onPostNumberClick(post.id)}
          title="Click to reply to this post"
        >
          {post.id}
        </span>
      </div>

      {/* Thread ID */}
      {showThreadId && post.thread_user_id && (
        <span
          className="badge"
          style={{
            backgroundColor: threadIdColor,
            color: "#fff",
            fontFamily: "monospace",
            fontSize: "0.75rem",
          }}
          title="Thread ID - unique per user in this thread"
        >
          {post.thread_user_id}
        </span>
      )}

      {/* Country Flag */}
      {showCountryFlag && post.country_code && (
        <span
          className="position-relative d-inline-flex align-items-center"
          style={{ cursor: "help" }}
          onMouseEnter={() => setShowCountryTooltip(true)}
          onMouseLeave={() => setShowCountryTooltip(false)}
        >
          {/* Special handling for local network and Cloudflare */}
          {post.country_code === "LO" ? (
            <i
              className="bi bi-house-fill text-secondary"
              style={{ fontSize: "1rem" }}
              title="Local Network"
            ></i>
          ) : post.country_code === "CF" ? (
            <i
              className="bi bi-cloud-fill text-info"
              style={{ fontSize: "1rem" }}
              title="Cloudflare Proxy"
            ></i>
          ) : flagUrl && !flagError ? (
            <img
              src={flagUrl}
              alt={post.country_code}
              width="16"
              height="12"
              style={{
                objectFit: "contain",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "2px",
              }}
              onError={() => setFlagError(true)}
            />
          ) : (
            <i
              className="bi bi-question-circle text-muted"
              style={{ fontSize: "1rem" }}
              title="Unknown Country"
            ></i>
          )}

          {showCountryTooltip && (
            <span
              className="position-absolute bg-dark text-light px-2 py-1 rounded d-flex align-items-center gap-2"
              style={{
                top: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                marginTop: "0.25rem",
                fontSize: "0.75rem",
                whiteSpace: "nowrap",
                zIndex: 1000,
                border: "1px solid #495057",
                minWidth: "120px",
              }}
            >
              {/* Show larger flag in tooltip if available */}
              {flagUrlLarge &&
                !flagError &&
                post.country_code !== "LO" &&
                post.country_code !== "CF" && (
                  <img
                    src={flagUrlLarge}
                    alt={post.country_code}
                    width="24"
                    height="18"
                    style={{
                      objectFit: "contain",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "2px",
                    }}
                  />
                )}
              <span>{getCountryName(post.country_code)}</span>
            </span>
          )}
        </span>
      )}

      <small className="text-secondary">
        {new Date(post.created_at).toLocaleString()}
      </small>
    </div>
  );
}
