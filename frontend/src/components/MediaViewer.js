// frontend/src/components/MediaViewer.js
import { useState, useRef, useEffect } from "react";

export default function MediaViewer({ src, alt, postId, fileType }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Determine media type based on extension or fileType
  const isVideo =
    fileType === "video" ||
    (src &&
      (src.toLowerCase().endsWith(".mp4") ||
        src.toLowerCase().endsWith(".webm")));

  const isAudio =
    fileType === "audio" || (src && src.toLowerCase().endsWith(".mp3"));

  useEffect(() => {
    // Set initial volume on video/audio elements
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, isMuted]);

  const handleMediaClick = (e) => {
    e.preventDefault();

    // Check if middle mouse button (button === 1)
    if (e.button === 1) {
      // Middle click - open in new tab
      window.open(src, "_blank");
      return;
    }

    // Left click - expand/collapse
    if (e.button === 0) {
      setIsExpanded(!isExpanded);

      // If expanding a video, start playing
      if (!isExpanded && isVideo && videoRef.current) {
        videoRef.current.play().catch((err) => {
          console.log("Video autoplay failed:", err);
        });
      } else if (isExpanded && isVideo && videoRef.current) {
        videoRef.current.pause();
      }
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  if (!src) return null;

  // For audio files
  if (isAudio) {
    return (
      <div className="mb-3">
        <div className="bg-dark border border-secondary rounded p-3">
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-music-note-beamed text-primary fs-4"></i>
            <span className="text-light">Audio File</span>
          </div>
          <audio
            ref={audioRef}
            src={src}
            controls
            className="w-100"
            preload="metadata"
          />
          <div className="mt-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline-primary"
            >
              <i className="bi bi-download me-1"></i>
              Download MP3
            </a>
          </div>
        </div>
      </div>
    );
  }

  // For videos
  if (isVideo) {
    return (
      <div className="mb-3">
        {!isExpanded ? (
          // Thumbnail view for video
          <div
            className="position-relative d-inline-block"
            style={{ cursor: "pointer" }}
            onMouseDown={handleMediaClick}
          >
            <video
              src={src}
              className="img-fluid"
              style={{
                maxHeight: "150px",
                maxWidth: "150px",
                objectFit: "cover",
                borderRadius: "4px",
              }}
              muted
              playsInline
              preload="metadata"
            />
            <div
              className="position-absolute top-50 start-50 translate-middle"
              style={{
                width: "50px",
                height: "50px",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <i className="bi bi-play-fill text-white fs-3"></i>
            </div>
          </div>
        ) : (
          // Expanded video view
          <div className="position-relative">
            <video
              ref={videoRef}
              src={src}
              className="img-fluid mb-2"
              style={{
                maxHeight: "600px",
                maxWidth: "100%",
                borderRadius: "4px",
                cursor: "pointer",
              }}
              controls
              autoPlay
              loop
              muted={isMuted}
              playsInline
              onMouseDown={handleMediaClick}
            />

            {/* Custom controls overlay */}
            <div className="bg-dark p-2 rounded d-flex align-items-center gap-2">
              <button
                className="btn btn-sm btn-outline-light"
                onClick={(e) => {
                  e.preventDefault();
                  setIsExpanded(false);
                }}
                title="Collapse video"
              >
                <i className="bi bi-arrows-angle-contract"></i>
              </button>

              <button
                className="btn btn-sm btn-outline-light"
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                <i
                  className={`bi bi-volume-${isMuted ? "mute" : "up"}-fill`}
                ></i>
              </button>

              <input
                type="range"
                className="form-range flex-grow-1"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                disabled={isMuted}
                style={{ maxWidth: "100px" }}
              />

              <small className="text-secondary">
                Volume: {Math.round(volume * 100)}%
              </small>
            </div>
          </div>
        )}
      </div>
    );
  }

  // For images (including GIFs)
  return (
    <div className="mb-3">
      <img
        src={src}
        alt={alt}
        className="img-fluid"
        style={{
          maxHeight: isExpanded ? "800px" : "150px",
          maxWidth: isExpanded ? "100%" : "150px",
          objectFit: isExpanded ? "contain" : "cover",
          cursor: "pointer",
          borderRadius: "4px",
          transition:
            "max-height 0.3s ease, max-width 0.3s ease, object-fit 0.3s ease",
        }}
        onMouseDown={handleMediaClick}
        title={
          isExpanded
            ? "Click to collapse, middle-click to open in new tab"
            : "Click to expand, middle-click to open in new tab"
        }
        loading="lazy"
      />
    </div>
  );
}
