// frontend/src/components/shared/PageHeader.js

import { Link } from "react-router-dom";

export default function PageHeader({
  backLink,
  backText = "← Back",
  title,
  badge,
  subtitle,
  nsfw = false,
  actions = null,
}) {
  return (
    <>
      {backLink && (
        <div className="mb-4">
          <Link to={backLink} className="btn btn-outline-light btn-sm">
            {backText}
          </Link>
        </div>
      )}

      <div className="card bg-mid-dark border-secondary shadow mb-4">
        <div className="card-header border-secondary">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="h3 mb-0 text-light">
              {badge && (
                <span className="badge bg-secondary me-2">{badge}</span>
              )}
              {title}
              {nsfw && <span className="badge bg-danger ms-2">NSFW</span>}
            </h1>
            {actions && <div>{actions}</div>}
          </div>
          {subtitle && <p className="text-secondary mb-0 mt-2">{subtitle}</p>}
        </div>
      </div>
    </>
  );
}
