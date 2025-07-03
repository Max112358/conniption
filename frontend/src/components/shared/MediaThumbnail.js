// frontend/src/components/shared/MediaThumbnail.js

import { Link } from "react-router-dom";

export default function MediaThumbnail({
  src,
  alt,
  fileType,
  size = "150px",
  linkTo,
  onClick,
}) {
  // Determine if this is a video
  const isVideo =
    fileType === "video" ||
    (src &&
      (src.toLowerCase().endsWith(".mp4") ||
        src.toLowerCase().endsWith(".webm")));

  if (!src) return null;

  const handleClick = (e) => {
    // Handle middle click to open in new tab
    if (e.button === 1) {
      e.preventDefault();
      window.open(src, "_blank");
    }
    if (onClick) onClick(e);
  };

  const mediaElement = isVideo ? (
    <div className="position-relative d-inline-block">
      <video
        src={src}
        className="img-fluid rounded"
        style={{
          maxWidth: size,
          maxHeight: size,
          objectFit: "cover",
        }}
        muted
        playsInline
        preload="metadata"
      />
      <div
        className="position-absolute top-50 start-50 translate-middle"
        style={{
          width: "40px",
          height: "40px",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <i className="bi bi-play-fill text-white fs-4"></i>
      </div>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className="img-fluid rounded"
      style={{
        maxWidth: size,
        maxHeight: size,
        objectFit: "cover",
      }}
      loading="lazy"
    />
  );

  if (linkTo) {
    return (
      <Link
        to={linkTo}
        onMouseDown={handleClick}
        style={{ textDecoration: "none" }}
      >
        {mediaElement}
      </Link>
    );
  }

  return <div onMouseDown={handleClick}>{mediaElement}</div>;
}
