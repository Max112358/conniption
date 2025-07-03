// frontend/src/components/shared/ErrorDisplay.js

import { Link } from "react-router-dom";

export default function ErrorDisplay({
  error,
  backLink = "/",
  backText = "← Back to Boards",
}) {
  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
      <div className="card bg-dark text-light border-secondary p-4 shadow">
        <div className="card-body text-center">
          <div className="alert alert-danger" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
          <Link to={backLink} className="btn btn-outline-light mt-3">
            {backText}
          </Link>
        </div>
      </div>
    </div>
  );
}
