// frontend/src/components/PostContent.js
import { useState } from "react";

// Component for post link preview
const PostLinkPreview = ({
  postId,
  posts,
  allThreadsWithPosts,
  x,
  y,
  isThreadPage,
}) => {
  let post = null;

  if (isThreadPage) {
    // On thread page, posts is the array of posts
    post = posts.find((p) => p.id === parseInt(postId));
  } else {
    // On board page, need to search through all threads
    for (const thread of allThreadsWithPosts) {
      if (thread.posts) {
        const foundPost = thread.posts.find((p) => p.id === parseInt(postId));
        if (foundPost) {
          post = foundPost;
          break;
        }
      }
    }
  }

  if (!post) return null;

  // Determine if the media is a video
  const isVideo =
    post.file_type === "video" ||
    (post.image_url &&
      (post.image_url.toLowerCase().endsWith(".mp4") ||
        post.image_url.toLowerCase().endsWith(".webm")));

  return (
    <div
      style={{
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        maxWidth: "400px",
        zIndex: 9999,
        pointerEvents: "none",
        backgroundColor: "#1a1d20",
        border: "2px solid #495057",
        borderRadius: "0.375rem",
        padding: "1rem",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
      }}
    >
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="text-secondary">Post #{post.id}</span>
        <small className="text-secondary">
          {new Date(post.created_at).toLocaleString()}
        </small>
      </div>
      {post.image_url && (
        <div className="mb-2">
          {isVideo ? (
            <div className="position-relative d-inline-block">
              <video
                src={post.image_url}
                className="img-fluid"
                style={{
                  maxHeight: "100px",
                  maxWidth: "100px",
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
                  width: "30px",
                  height: "30px",
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i className="bi bi-play-fill text-white"></i>
              </div>
            </div>
          ) : (
            <img
              src={post.image_url}
              alt="Preview"
              className="img-fluid"
              style={{
                maxHeight: "100px",
                maxWidth: "100px",
                objectFit: "cover",
                borderRadius: "4px",
              }}
            />
          )}
        </div>
      )}
      <p className="text-light mb-0 small" style={{ whiteSpace: "pre-wrap" }}>
        {post.content.length > 200
          ? post.content.substring(0, 200) + "..."
          : post.content}
      </p>
    </div>
  );
};

// Component for YouTube embed
const YouTubeEmbed = ({ videoId }) => {
  return (
    <div className="ratio ratio-16x9 mb-2" style={{ maxWidth: "560px" }}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};

// Main PostContent component
export default function PostContent({
  content,
  posts,
  allThreadsWithPosts,
  boardId,
  onPostLinkClick,
  isThreadPage = false,
  isPreview = false,
}) {
  const [hoveredPostId, setHoveredPostId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Extract YouTube video ID from various YouTube URL formats
  const extractYouTubeId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Parse spoiler tags
  const parseSpoilers = (text) => {
    // Regex to match [spoiler]...[/spoiler] tags
    const spoilerRegex = /\[spoiler\](.*?)\[\/spoiler\]/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = spoilerRegex.exec(text)) !== null) {
      // Add text before the spoiler
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: text.substring(lastIndex, match.index),
        });
      }

      // Add the spoiler
      parts.push({
        type: "spoiler",
        content: match[1],
      });

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: "text", content: text }];
  };

  // Parse content and handle >> links, > greentext, YouTube links, and spoilers
  const parseContent = (text) => {
    // First, find all YouTube links and replace them with placeholders
    const youtubeLinks = [];
    const youtubeRegex =
      /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\s\n?#]+)(?:[^\s\n]*)?/g;

    let processedText = text;
    let match;
    let linkIndex = 0;

    while ((match = youtubeRegex.exec(text)) !== null) {
      const videoId = extractYouTubeId(match[0]);
      if (videoId) {
        youtubeLinks.push({
          fullMatch: match[0],
          videoId,
          placeholder: `__YOUTUBE_${linkIndex}__`,
        });
        processedText = processedText.replace(
          match[0],
          `__YOUTUBE_${linkIndex}__`
        );
        linkIndex++;
      }
    }

    // Split by lines to handle greentext
    const lines = processedText.split("\n");

    return lines.map((line, lineIndex) => {
      // Check if this line starts with > (but not >>)
      const isGreentext = line.startsWith(">") && !line.startsWith(">>");
      // Check if this line starts with <
      const isRedtext = line.startsWith("<");

      // Check if line contains a YouTube placeholder
      const youtubePlaceholder = line.match(/__YOUTUBE_(\d+)__/);
      if (youtubePlaceholder) {
        const index = parseInt(youtubePlaceholder[1]);
        const youtubeData = youtubeLinks[index];

        // Split line around the placeholder
        const parts = line.split(youtubePlaceholder[0]);

        return (
          <div key={lineIndex}>
            {parts[0] && (
              <span
                className={
                  isGreentext ? "greentext" : isRedtext ? "redtext" : ""
                }
              >
                {parseLineContent(
                  parts[0],
                  lineIndex,
                  0,
                  isGreentext,
                  isRedtext
                )}
              </span>
            )}
            <YouTubeEmbed videoId={youtubeData.videoId} />
            {parts[1] && (
              <span
                className={
                  isGreentext ? "greentext" : isRedtext ? "redtext" : ""
                }
              >
                {parseLineContent(
                  parts[1],
                  lineIndex,
                  1,
                  isGreentext,
                  isRedtext
                )}
              </span>
            )}
          </div>
        );
      }

      // Parse the line for post links and spoilers
      const parsedLine = parseLineContent(
        line,
        lineIndex,
        0,
        isGreentext,
        isRedtext
      );

      // Add line break after each line except the last
      return (
        <span key={lineIndex}>
          {parsedLine}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  // Parse a single line for post links and spoilers
  const parseLineContent = (
    line,
    lineIndex,
    partOffset,
    isGreentext,
    isRedtext
  ) => {
    // First parse spoilers
    const spoilerParts = parseSpoilers(line);

    return spoilerParts
      .map((spoilerPart, spoilerIndex) => {
        if (spoilerPart.type === "spoiler") {
          return (
            <span
              key={`${lineIndex}-${partOffset}-spoiler-${spoilerIndex}`}
              className={isPreview ? "spoiler-preview" : "spoiler"}
            >
              {spoilerPart.content}
            </span>
          );
        }

        // Parse post links in non-spoiler content
        const parts = spoilerPart.content.split(/(>>\d+)/g);

        return parts.map((part, partIndex) => {
          const match = part.match(/^>>(\d+)$/);
          if (match) {
            const postId = match[1];

            // Find if the post exists
            let targetPost = null;
            let isOP = false;

            if (isThreadPage) {
              targetPost = posts.find((p) => p.id === parseInt(postId));
              isOP = posts[0] && posts[0].id === parseInt(postId);
            } else {
              // On board page, search through all threads
              for (const thread of allThreadsWithPosts) {
                if (thread.posts) {
                  const post = thread.posts.find(
                    (p) => p.id === parseInt(postId)
                  );
                  if (post) {
                    targetPost = post;
                    isOP =
                      thread.posts[0] &&
                      thread.posts[0].id === parseInt(postId);
                    break;
                  }
                }
              }
            }

            if (targetPost && !isPreview) {
              return (
                <span
                  key={`${lineIndex}-${partOffset}-${spoilerIndex}-${partIndex}`}
                  className="text-primary"
                  style={{ cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => onPostLinkClick(postId, targetPost.thread_id)}
                  onMouseEnter={(e) => {
                    setHoveredPostId(postId);
                    const rect = e.target.getBoundingClientRect();
                    setMousePos({
                      x: rect.left,
                      y: rect.bottom + 5,
                    });
                  }}
                  onMouseLeave={() => setHoveredPostId(null)}
                >
                  {part}
                  {isOP && "(OP)"}
                </span>
              );
            }
          }

          // Return the part, applying green or red color if applicable
          return (
            <span
              key={`${lineIndex}-${partOffset}-${spoilerIndex}-${partIndex}`}
              className={isGreentext ? "greentext" : isRedtext ? "redtext" : ""}
            >
              {part}
            </span>
          );
        });
      })
      .flat();
  };

  return (
    <>
      <p className="text-light mb-0">{parseContent(content)}</p>
      {hoveredPostId && !isPreview && (
        <PostLinkPreview
          postId={hoveredPostId}
          posts={posts}
          allThreadsWithPosts={allThreadsWithPosts}
          x={mousePos.x}
          y={mousePos.y}
          isThreadPage={isThreadPage}
        />
      )}
    </>
  );
}
