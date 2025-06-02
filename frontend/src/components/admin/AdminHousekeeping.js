// frontend/src/components/admin/AdminHousekeeping.js
import { useState, useEffect } from "react";

// API constants
const API_BASE_URL = "https://conniption.onrender.com";

export default function AdminHousekeeping({ adminUser }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Fetch housekeeping status
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/admin/housekeeping/status`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch housekeeping status");
      }

      const data = await response.json();
      setStatus(data.status);
    } catch (err) {
      console.error("Error fetching status:", err);
      setError("Failed to load housekeeping status");
    } finally {
      setLoading(false);
    }
  };

  const runHousekeeping = async () => {
    if (
      !window.confirm(
        "Are you sure you want to run housekeeping now? This will clean up orphaned files and excess threads."
      )
    ) {
      return;
    }

    try {
      setRunning(true);
      setError(null);
      setResults(null);

      const response = await fetch(
        `${API_BASE_URL}/api/admin/housekeeping/run`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to run housekeeping");
      }

      const data = await response.json();
      setResults(data.results);

      // Refresh status
      await fetchStatus();
    } catch (err) {
      console.error("Error running housekeeping:", err);
      setError("Failed to run housekeeping. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="container-fluid">
      <h1 className="h3 mb-4">Housekeeping Management</h1>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Status Card */}
      <div className="card bg-mid-dark border-secondary mb-4">
        <div className="card-header border-secondary">
          <h2 className="h5 mb-0">Housekeeping Status</h2>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-3">
              <div className="spinner-border text-light" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : status ? (
            <div>
              <div className="row">
                <div className="col-md-6">
                  <h6 className="text-secondary">Scheduled Job Status</h6>
                  {status.jobs && status.jobs.housekeeping ? (
                    <div>
                      <p className="mb-1">
                        <strong>Status:</strong>{" "}
                        <span
                          className={`badge bg-${
                            status.jobs.housekeeping.running
                              ? "success"
                              : "danger"
                          }`}
                        >
                          {status.jobs.housekeeping.running
                            ? "Running"
                            : "Stopped"}
                        </span>
                      </p>
                      {status.jobs.housekeeping.lastRun && (
                        <p className="mb-0">
                          <strong>Last Run:</strong>{" "}
                          {new Date(
                            status.jobs.housekeeping.lastRun
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted">No job information available</p>
                  )}
                </div>
                <div className="col-md-6">
                  <h6 className="text-secondary">Schedule</h6>
                  <p className="mb-0">
                    Housekeeping runs automatically every hour and on server
                    startup.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted">No status information available</p>
          )}
        </div>
      </div>

      {/* Manual Run Card */}
      <div className="card bg-mid-dark border-secondary mb-4">
        <div className="card-header border-secondary">
          <h2 className="h5 mb-0">Manual Housekeeping</h2>
        </div>
        <div className="card-body">
          <p className="text-muted mb-3">
            Manually trigger housekeeping to clean up orphaned files in R2 and
            remove excess threads.
          </p>

          <button
            className="btn btn-primary"
            onClick={runHousekeeping}
            disabled={running}
          >
            {running ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Running Housekeeping...
              </>
            ) : (
              "Run Housekeeping Now"
            )}
          </button>
        </div>
      </div>

      {/* Results Card */}
      {results && (
        <div className="card bg-mid-dark border-secondary">
          <div className="card-header border-secondary">
            <h2 className="h5 mb-0">Housekeeping Results</h2>
          </div>
          <div className="card-body">
            <div className="alert alert-success mb-3">
              Housekeeping completed successfully on{" "}
              {new Date(results.timestamp).toLocaleString()}
            </div>

            <div className="row">
              {/* Thread Cleanup Results */}
              <div className="col-md-6 mb-3">
                <h6 className="text-secondary">Thread Cleanup</h6>
                {results.tasks.threadCleanup ? (
                  results.tasks.threadCleanup.error ? (
                    <div className="alert alert-danger">
                      Error: {results.tasks.threadCleanup.error}
                    </div>
                  ) : (
                    <div className="card bg-dark border-secondary">
                      <div className="card-body">
                        <p className="mb-1">
                          <strong>Boards Checked:</strong>{" "}
                          {results.tasks.threadCleanup.boardsChecked}
                        </p>
                        <p className="mb-0">
                          <strong>Threads Deleted:</strong>{" "}
                          {results.tasks.threadCleanup.threadsDeleted}
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-muted">No thread cleanup data</p>
                )}
              </div>

              {/* File Cleanup Results */}
              <div className="col-md-6 mb-3">
                <h6 className="text-secondary">File Cleanup</h6>
                {results.tasks.fileCleanup ? (
                  results.tasks.fileCleanup.error ? (
                    <div className="alert alert-danger">
                      Error: {results.tasks.fileCleanup.error}
                    </div>
                  ) : (
                    <div className="card bg-dark border-secondary">
                      <div className="card-body">
                        <p className="mb-1">
                          <strong>Total Files in R2:</strong>{" "}
                          {results.tasks.fileCleanup.totalFiles}
                        </p>
                        <p className="mb-1">
                          <strong>Database References:</strong>{" "}
                          {results.tasks.fileCleanup.databaseImages}
                        </p>
                        <p className="mb-1">
                          <strong>Orphaned Files Found:</strong>{" "}
                          {results.tasks.fileCleanup.orphanedFiles}
                        </p>
                        <p className="mb-1">
                          <strong>Files Deleted:</strong>{" "}
                          {results.tasks.fileCleanup.deletedFiles}
                        </p>
                        {results.tasks.fileCleanup.errors > 0 && (
                          <p className="mb-1 text-danger">
                            <strong>Errors:</strong>{" "}
                            {results.tasks.fileCleanup.errors}
                          </p>
                        )}
                        <p className="mb-0">
                          <strong>Duration:</strong>{" "}
                          {formatDuration(results.tasks.fileCleanup.duration)}
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-muted">No file cleanup data</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Card */}
      <div className="card bg-mid-dark border-secondary mt-4">
        <div className="card-header border-secondary">
          <h2 className="h5 mb-0">About Housekeeping</h2>
        </div>
        <div className="card-body">
          <h6 className="text-secondary">What does housekeeping do?</h6>
          <ul className="mb-3">
            <li>Removes threads that exceed the 100 thread limit per board</li>
            <li>
              Deletes orphaned images from R2 that are no longer referenced in
              the database
            </li>
            <li>
              Skips files that are less than 1 hour old to avoid race conditions
            </li>
            <li>Runs automatically every hour and on server startup</li>
          </ul>

          <h6 className="text-secondary">When should I run it manually?</h6>
          <ul className="mb-0">
            <li>After database maintenance or migrations</li>
            <li>If you suspect orphaned files are taking up storage space</li>
            <li>
              After fixing any issues that may have prevented automatic cleanup
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
