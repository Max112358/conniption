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
  // Determine media type
  const isVideo =
    fileType === "video" ||
    (src &&
      (src.toLowerCase().endsWith(".mp4") ||
        src.toLowerCase().endsWith(".webm")));

  const isAudio =
    fileType === "audio" || (src && src.toLowerCase().endsWith(".mp3"));

  if (!src) return null;

  const handleClick = (e) => {
    // Handle middle click to open in new tab
    if (e.button === 1) {
      e.preventDefault();
      window.open(src, "_blank");
    }
    if (onClick) onClick(e);
  };

  const mediaElement = isAudio ? (
    <div
      className="d-flex align-items-center justify-content-center bg-dark border border-secondary rounded"
      style={{
        width: size,
        height: size,
      }}
    >
      <div className="text-center">
        <i
          className="bi bi-music-note-beamed text-primary"
          style={{ fontSize: "3rem" }}
        ></i>
        <div className="text-light small mt-1">MP3</div>
      </div>
    </div>
  ) : isVideo ? (
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
