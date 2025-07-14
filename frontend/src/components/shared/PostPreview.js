// frontend/src/components/shared/PostPreview.js
import { useState } from "react";
import PostHeader from "../PostHeader";
import PostContent from "../PostContent";
import MediaThumbnail from "./MediaThumbnail";
import usePostOwnership from "../../hooks/usePostOwnership";

export default function PostPreview({
  post,
  thread,
  boardId,
  board,
  isOP,
  isHidden,
  isUserHidden,
  onToggleHidden,
  onToggleUserHidden,
  onPostNumberClick,
  onPostLinkClick,
  boardSettings = {},
  posts = [],
  allThreadsWithPosts = [],
  compact = false,
}) {
  const { isOwnPost } = usePostOwnership();
  const [postColor] = useState(post.color || "black");
  const isUserOwnPost = isOwnPost(post.id);

  const containerClass = compact
    ? "border border-secondary rounded p-2 mb-2"
    : "card bg-dark border-secondary mb-3 shadow";

  return (
    <div
      id={`post-${post.id}`}
      className={`${containerClass} ${
        postColor !== "black" ? `post-color-${postColor}` : ""
      }`}
    >
      {!compact && (
        <div className="card-header border-secondary">
          <PostHeader
            post={post}
            posts={posts}
            isOP={isOP}
            boardSettings={boardSettings}
            onPostNumberClick={onPostNumberClick}
            onPostLinkClick={onPostLinkClick}
            showThreadId={boardSettings.thread_ids_enabled}
            showCountryFlag={boardSettings.country_flags_enabled}
            isPostHidden={isHidden}
            isUserHidden={isUserHidden}
            onTogglePostHidden={onToggleHidden}
            onToggleUserHidden={onToggleUserHidden}
          />
        </div>
      )}

      <div className={compact ? "" : "card-body"}>
        {compact && (
          <div className="mb-2">
            <PostHeader
              post={post}
              posts={posts}
              isOP={isOP}
              boardSettings={boardSettings}
              onPostNumberClick={onPostNumberClick}
              onPostLinkClick={onPostLinkClick}
              showThreadId={boardSettings.thread_ids_enabled}
              showCountryFlag={boardSettings.country_flags_enabled}
              isPostHidden={isHidden}
              isUserHidden={isUserHidden}
              onTogglePostHidden={onToggleHidden}
              onToggleUserHidden={onToggleUserHidden}
            />
          </div>
        )}

        {post.isBanned && post.banInfo && (
          <div className="alert alert-danger mb-2 py-1 px-2 small text-center">
            <i className="bi bi-exclamation-triangle-fill me-1"></i>
            USER WAS BANNED FOR THIS POST
          </div>
        )}

        {!isHidden && !isUserHidden ? (
          <div>
            <div className="row">
              {post.image_url && (
                <div className="col-auto">
                  <MediaThumbnail
                    src={post.image_url}
                    alt="Post image"
                    fileType={post.file_type}
                    size={compact ? "80px" : "150px"}
                  />
                </div>
              )}
              <div className={post.image_url ? "col" : "col-12"}>
                <div
                  className={`text-light text-break ${compact ? "small" : ""}`}
                  style={{
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  <PostContent
                    content={post.content}
                    posts={posts}
                    allThreadsWithPosts={allThreadsWithPosts}
                    boardId={boardId}
                    onPostLinkClick={onPostLinkClick}
                    isThreadPage={false}
                  />
                </div>
              </div>
            </div>

            {/* Survey Component - Compact version for previews */}
            {post.survey && (
              <div className={`mt-2 ${compact ? "small" : ""}`}>
                <div className="alert alert-info py-1 px-2 mb-0">
                  <i className="bi bi-bar-chart-fill me-1"></i>
                  <strong>Poll:</strong> {post.survey.question}
                  {post.survey.response_count > 0 && (
                    <span className="ms-2 badge bg-primary">
                      {post.survey.response_count} votes
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-secondary mb-0 small">
            <em>{isUserHidden ? "User hidden" : "Post hidden"}</em>
          </p>
        )}
      </div>
    </div>
  );
}
