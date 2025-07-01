// frontend/src/components/LoadingSpinner.js

import { useState, useEffect } from "react";

export default function LoadingSpinner({ message = "Loading..." }) {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Show warning after 5 seconds
    const timer = setTimeout(() => {
      setShowWarning(true);
    }, 5000);

    // Cleanup timer on unmount
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
      <div className="card bg-dark text-light border-secondary p-4 shadow">
        <div className="card-body text-center">
          <div className="spinner-border text-light mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mb-3">{message}</p>

          {showWarning && (
            <div className="alert alert-warning" role="alert">
              <h6 className="alert-heading">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Server may be waking up
              </h6>
              <p className="mb-0">
                <small>
                  The free server hibernates after periods of inactivity. If
                  this is taking longer than usual, please wait up to 50 seconds
                  for the server to fully wake up. Thank you for your patience!
                </small>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
