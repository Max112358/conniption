// frontend/src/components/HideButton.js

export default function HideButton({
  isHidden,
  onToggle,
  title = "Hide/Unhide",
}) {
  return (
    <button
      className="btn btn-sm btn-outline-secondary p-1"
      onClick={onToggle}
      title={title}
      style={{
        width: "24px",
        height: "24px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        lineHeight: "1",
      }}
    >
      {isHidden ? "+" : "−"}
    </button>
  );
}
