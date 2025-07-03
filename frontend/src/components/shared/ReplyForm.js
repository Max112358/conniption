// frontend/src/components/shared/ReplyForm.js

import { forwardRef } from "react";

const ReplyForm = forwardRef(
  (
    {
      content,
      setContent,
      image,
      setImage,
      imagePreview,
      setImagePreview,
      onSubmit,
      loading,
      error,
      maxImageSize = "5MB",
      acceptedFormats = ".jpg, .jpeg, .png, .gif, .webp, .mp4, .webm",
    },
    ref
  ) => {
    const handleImageChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const maxSize = parseInt(maxImageSize) * 1024 * 1024;
        if (file.size > maxSize) {
          alert(`File size must be less than ${maxImageSize}`);
          e.target.value = "";
          return;
        }
        setImage(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
      }
    };

    const handleRemoveImage = () => {
      setImage(null);
      setImagePreview(null);
      const fileInput = document.getElementById("image");
      if (fileInput) {
        fileInput.value = "";
      }
    };

    return (
      <div className="card bg-dark border-secondary shadow">
        <div className="card-header border-secondary">
          <h5 className="mb-0 text-light">Reply to Thread</h5>
        </div>
        <div className="card-body">
          {error && (
            <div
              className="alert alert-danger alert-dismissible fade show"
              role="alert"
            >
              {error}
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="alert"
                aria-label="Close"
              ></button>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <label htmlFor="content" className="form-label text-secondary">
                Message
              </label>
              <textarea
                ref={ref}
                className="form-control bg-dark text-light border-secondary"
                id="content"
                rows="5"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your message..."
                required
                disabled={loading}
              />
              <small className="form-text text-muted">
                Quote posts by clicking their post number or typing
                &gt;&gt;[post number]
              </small>
            </div>

            <div className="mb-3">
              <label htmlFor="image" className="form-label text-secondary">
                Attach Image/Video (optional)
              </label>
              <input
                type="file"
                className="form-control bg-dark text-light border-secondary"
                id="image"
                accept={acceptedFormats}
                onChange={handleImageChange}
                disabled={loading}
              />
              <small className="form-text text-muted">
                Max size: {maxImageSize}. Supported formats: JPG, PNG, GIF,
                WEBP, MP4, WEBM
              </small>
            </div>

            {imagePreview && (
              <div className="mb-3">
                <label className="form-label text-secondary">Preview:</label>
                <div className="position-relative d-inline-block">
                  {image?.type?.startsWith("video/") ? (
                    <video
                      src={imagePreview}
                      className="img-thumbnail bg-dark border-secondary"
                      style={{ maxWidth: "200px", maxHeight: "200px" }}
                      controls
                    />
                  ) : (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="img-thumbnail bg-dark border-secondary"
                      style={{ maxWidth: "200px", maxHeight: "200px" }}
                    />
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                    onClick={handleRemoveImage}
                    disabled={loading}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !content.trim()}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Posting...
                </>
              ) : (
                "Post Reply"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }
);

ReplyForm.displayName = "ReplyForm";

export default ReplyForm;
