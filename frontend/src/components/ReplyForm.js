// frontend/src/components/ReplyForm.js
import { forwardRef, useState } from "react";
import PreviewableTextArea from "./PreviewableTextArea";
import SurveyFormSection, {
  validateSurveyData,
} from "./survey/SurveyFormSection";

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
      maxImageSize = "4MB",
      acceptedFormats = ".jpg, .jpeg, .png, .gif, .webp, .mp4, .webm, .mp3",
      currentPostCount = 0,
      bumpLimit = null,
    },
    ref
  ) => {
    // Survey state
    const [includeSurvey, setIncludeSurvey] = useState(false);
    const [surveyData, setSurveyData] = useState({
      surveyType: "single",
      surveyQuestion: "",
      surveyOptions: ["", ""],
    });

    // Don't bump state
    const [dontBump, setDontBump] = useState(false);

    // Check if thread has reached bump limit
    const hasReachedBumpLimit = bumpLimit && currentPostCount >= bumpLimit;

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

    const handleFormSubmit = (e) => {
      e.preventDefault();

      console.log("=== REPLY FORM DEBUG: Form submission ===");
      console.log("Content:", content);
      console.log("Has image:", !!image);
      console.log("Include survey:", includeSurvey);
      console.log("Don't bump:", dontBump);
      console.log("Has reached bump limit:", hasReachedBumpLimit);
      console.log("Raw survey data:", JSON.stringify(surveyData, null, 2));

      // Validate survey if enabled
      if (includeSurvey) {
        console.log("=== REPLY FORM DEBUG: Validating survey ===");
        const validation = validateSurveyData(surveyData);
        console.log("Survey validation result:", validation);

        if (!validation.valid) {
          console.error("Survey validation failed:", validation.error);
          alert(validation.error);
          return;
        }
      }

      // Prepare survey data for submission
      const processedSurveyData = includeSurvey
        ? {
            ...surveyData,
            surveyOptions: surveyData.surveyOptions.filter((opt) => opt.trim()),
          }
        : null;

      console.log("=== REPLY FORM DEBUG: Processed survey data ===");
      console.log(
        "Processed survey data:",
        JSON.stringify(processedSurveyData, null, 2)
      );

      const submitData = {
        content,
        image,
        includeSurvey,
        surveyData: processedSurveyData,
        dontBump: dontBump || hasReachedBumpLimit, // Force don't bump if bump limit reached
      };

      console.log("=== REPLY FORM DEBUG: Final submit data ===");
      console.log(
        "Submit data:",
        JSON.stringify(
          {
            ...submitData,
            image: image ? `[File: ${image.name}, ${image.size} bytes]` : null,
          },
          null,
          2
        )
      );

      // Pass all data to parent handler
      onSubmit(submitData);
    };

    return (
      <div className="card bg-dark border-secondary shadow">
        <div className="card-header border-secondary">
          <h5 className="mb-0 text-light">Reply to Thread</h5>
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {hasReachedBumpLimit && (
            <div className="alert alert-warning" role="alert">
              <i className="bi bi-info-circle me-2"></i>
              This thread has reached the bump limit ({bumpLimit} posts) and
              will no longer be bumped to the top.
            </div>
          )}

          <form onSubmit={handleFormSubmit}>
            <div className="mb-3">
              <label htmlFor="content" className="form-label text-secondary">
                Message
              </label>
              <PreviewableTextArea
                ref={ref}
                id="content"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your message..."
                disabled={loading}
              />
              <small className="form-text text-secondary">
                Quote posts by clicking their post number or typing
                &gt;&gt;[post number]
              </small>
            </div>

            <div className="mb-3">
              <label htmlFor="image" className="form-label text-secondary">
                Attach Image/Video/Audio (optional)
              </label>
              <input
                type="file"
                className="form-control bg-dark text-light border-secondary"
                id="image"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,audio/mpeg"
                onChange={handleImageChange}
                disabled={loading}
              />
              <small className="form-text text-secondary">
                Max size: {maxImageSize}. Supported formats: JPG, PNG, GIF,
                WEBP, MP4, WEBM, MP3
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
                  ) : image?.type?.startsWith("audio/") ? (
                    <div className="p-3 bg-dark border border-secondary rounded">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <i className="bi bi-music-note-beamed text-primary fs-4"></i>
                        <span className="text-light">{image.name}</span>
                      </div>
                      <audio
                        src={imagePreview}
                        controls
                        className="w-100"
                        style={{ minWidth: "250px" }}
                      />
                    </div>
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

            {/* Don't Bump Checkbox - Only show if not at bump limit */}
            {!hasReachedBumpLimit && (
              <div className="mb-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="dontBump"
                    checked={dontBump}
                    onChange={(e) => setDontBump(e.target.checked)}
                    disabled={loading}
                  />
                  <label
                    className="form-check-label text-secondary"
                    htmlFor="dontBump"
                  >
                    Don't bump thread (sage)
                  </label>
                  <small className="form-text text-secondary d-block">
                    Post without bumping the thread to the top of the board
                  </small>
                </div>
              </div>
            )}

            {/* Survey Section - Using shared component */}
            <SurveyFormSection
              includeSurvey={includeSurvey}
              setIncludeSurvey={setIncludeSurvey}
              surveyData={surveyData}
              setSurveyData={setSurveyData}
              loading={loading}
            />

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (!content.trim() && !image)}
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
