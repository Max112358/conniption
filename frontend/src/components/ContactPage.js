// frontend/src/components/ContactPage.js

import { Link } from "react-router-dom";
import logoSvg from "../assets/conniption_logo6.svg";

export default function ContactPage() {
  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-4">
      <div className="container">
        <div className="text-center mb-4">
          <img
            src={logoSvg}
            alt="Conniption Logo"
            style={{ maxHeight: "80px", maxWidth: "100%" }}
            className="img-fluid mb-3"
          />
        </div>

        {/* Back to Home button */}
        <div className="mb-4">
          <Link to="/" className="btn btn-outline-light btn-sm">
            ← Back to Home
          </Link>
        </div>

        {/* Contact Information Section */}
        <div className="card bg-mid-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h2 className="h4 mb-0 text-light">How to Reach Us</h2>
          </div>
          <div className="card-body">
            <p className="text-secondary mb-4">
              For questions, concerns, or support, please use one of the
              following methods:
            </p>

            <div className="mb-4">
              <h5 className="text-info">
                <i className="bi bi-discord me-2"></i>Discord
              </h5>
              <p className="text-light ms-3">
                Join our Discord server:{" "}
                <a
                  href="https://discord.gg/example"
                  className="text-warning"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  discord.gg/conniption
                </a>
              </p>
            </div>

            <div className="mb-4">
              <h5 className="text-info">
                <i className="bi bi-envelope me-2"></i>Email
              </h5>
              <p className="text-light ms-3">
                Email us at:{" "}
                <a
                  href="mailto:contact@conniption.com"
                  className="text-warning"
                >
                  contact@conniption.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-secondary mt-4 pb-3">
          <p className="mb-0">
            <small>
              We'll do our best to respond promptly to all inquiries.
            </small>
          </p>
        </div>
      </div>
    </div>
  );
}
