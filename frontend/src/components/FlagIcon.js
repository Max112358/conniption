// frontend/src/components/FlagIcon.js
import { useState, useEffect } from "react";
import {
  getFlagUrl,
  getFlagUrlLarge,
  getCountryName,
} from "../utils/countryFlags";

export default function FlagIcon({
  countryCode,
  size = "small",
  showTooltip = true,
  className = "",
}) {
  const [flagError, setFlagError] = useState(false);
  const [showCountryTooltip, setShowCountryTooltip] = useState(false);
  const [flagExists, setFlagExists] = useState(true);

  // Reset error state when country code changes
  useEffect(() => {
    setFlagError(false);
    setFlagExists(true);
  }, [countryCode]);

  if (!countryCode) return null;

  const flagUrl =
    size === "large" ? getFlagUrlLarge(countryCode) : getFlagUrl(countryCode);
  const countryName = getCountryName(countryCode);

  // Handle special cases with icons
  if (countryCode === "LO") {
    return (
      <span
        className={`d-inline-flex align-items-center ${className}`}
        title={showTooltip ? "Local Network" : undefined}
      >
        <i
          className="bi bi-house-fill text-secondary"
          style={{ fontSize: "1rem" }}
        ></i>
      </span>
    );
  }

  if (countryCode === "CF") {
    return (
      <span
        className={`d-inline-flex align-items-center ${className}`}
        title={showTooltip ? "Cloudflare Proxy" : undefined}
      >
        <i
          className="bi bi-cloud-fill text-info"
          style={{ fontSize: "1rem" }}
        ></i>
      </span>
    );
  }

  // If flag doesn't exist or has error, show fallback
  if (!flagUrl || flagError || !flagExists) {
    return (
      <span
        className={`d-inline-flex align-items-center ${className}`}
        title={showTooltip ? countryName : undefined}
      >
        <span
          className="d-inline-flex align-items-center justify-content-center bg-secondary text-white"
          style={{
            width: size === "large" ? "24px" : "16px",
            height: size === "large" ? "18px" : "12px",
            fontSize: "0.625rem",
            fontWeight: "bold",
            borderRadius: "2px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          {countryCode.toUpperCase()}
        </span>
      </span>
    );
  }

  // Regular flag display
  return (
    <span
      className={`position-relative d-inline-flex align-items-center ${className}`}
      style={{ cursor: showTooltip ? "help" : "default" }}
      onMouseEnter={() => showTooltip && setShowCountryTooltip(true)}
      onMouseLeave={() => showTooltip && setShowCountryTooltip(false)}
    >
      <img
        src={flagUrl}
        alt={countryCode}
        width={size === "large" ? "24" : "16"}
        height={size === "large" ? "18" : "12"}
        style={{
          objectFit: "contain",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "2px",
        }}
        onError={() => {
          setFlagError(true);
          // Check if it's a 404 by trying to fetch
          fetch(flagUrl)
            .then((res) => {
              if (res.status === 404) {
                setFlagExists(false);
              }
            })
            .catch(() => setFlagExists(false));
        }}
        loading="lazy"
      />

      {showTooltip && showCountryTooltip && (
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
          {size === "small" && getFlagUrlLarge(countryCode) && !flagError && (
            <img
              src={getFlagUrlLarge(countryCode)}
              alt={countryCode}
              width="24"
              height="18"
              style={{
                objectFit: "contain",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "2px",
              }}
            />
          )}
          <span>{countryName}</span>
        </span>
      )}
    </span>
  );
}
