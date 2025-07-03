// frontend/src/components/shared/ConnectionStatus.js

export default function ConnectionStatus({ connected, className = "" }) {
  return (
    <small className={`text-${connected ? "success" : "warning"} ${className}`}>
      {connected ? "● Live updates enabled" : "○ Connecting..."}
    </small>
  );
}
