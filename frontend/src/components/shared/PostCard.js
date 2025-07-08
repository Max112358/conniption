// frontend/src/components/shared/PostCard.js
import { useState } from "react";
import PostModMenu from "../admin/PostModMenu";
import PostDeleteButton from "../PostDeleteButton";
import PostHeader from "../PostHeader";
import PostContent from "../PostContent";
import MediaViewer from "../MediaViewer";
import usePostOwnership from "../../hooks/usePostOwnership";

export default function PostCard({
  post,
  thread,
  boardId,
  board, // Full board object (optional)
  isOP,
  isHidden,
  isUserHidden,
  onToggleHidden,
  onToggleUserHidden,
  onPostNumberClick,
  onPostLinkClick,
  boardSettings = {},
  adminUser = null,
  className = "",
  posts = [], // All posts in thread (for thread page)
  allThreadsWithPosts = [], // For board page
  isThreadPage = false,
  onPostDeleted, // Callback when post is deleted
  onPostColorChanged, // Callback when post color is changed
}) {
  const { isOwnPost, removeOwnPost } = usePostOwnership();
  const [postColor, setPostColor] = useState(post.color || "black");
  const isModerator =
    adminUser?.role === "moderator" || adminUser?.role === "admin";

  // Determine if we should show the mod menu
  const showModMenu = isModerator && !isHidden && !isUserHidden;

  // Check if this is user's own post
  const isUserOwnPost = isOwnPost(post.id);

  // Handle successful deletion
  const handlePostDeleted = (postId) => {
    removeOwnPost(postId);
    if (onPostDeleted) {
      onPostDeleted(postId);
    }
  };

  // Handle color change
  const handleColorChanged = (postId, newColor) => {
    setPostColor(newColor);
    if (onPostColorChanged) {
      onPostColorChanged(postId, newColor);
    }
  };

  return (
    <div
      id={`post-${post.id}`}
      className={`card bg-dark border-secondary mb-3 shadow ${
        post.isNew ? "new-post" : ""
      } ${postColor !== "black" ? `post-color-${postColor}` : ""} ${className}`}
    >
      <div className="card-header border-secondary d-flex justify-content-between align-items-center">
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

        <div className="d-flex gap-2 align-items-center">
          {/* Color indicator for non-black posts */}
          {postColor !== "black" && (
            <span
              className="post-color-indicator"
              style={{
                backgroundColor:
                  postColor === "red"
                    ? "#dc3545"
                    : postColor === "orange"
                    ? "#fd7e14"
                    : postColor === "yellow"
                    ? "#ffc107"
                    : postColor === "green"
                    ? "#28a745"
                    : postColor === "blue"
                    ? "#007bff"
                    : postColor === "purple"
                    ? "#6f42c1"
                    : postColor === "brown"
                    ? "#795548"
                    : "#212529",
              }}
              title={`Post marked as ${postColor}`}
            ></span>
          )}

          {showModMenu && (
            <PostModMenu
              post={{ ...post, color: postColor }}
              thread={thread}
              board={board || { id: boardId }}
              isAdmin={adminUser?.role === "admin"}
              isMod={isModerator}
              adminUser={adminUser}
              onColorChanged={handleColorChanged}
            />
          )}

          {/* Show delete button for user's own posts */}
          {isUserOwnPost && !isHidden && !isUserHidden && (
            <PostDeleteButton
              post={post}
              boardId={boardId}
              threadId={thread?.id || post.thread_id}
              onDeleted={handlePostDeleted}
            />
          )}
        </div>
      </div>

      <div className="card-body">
        {/* Ban Warning Message */}
        {post.isBanned && post.banInfo && (
          <div className="alert alert-danger mb-3 fw-bold text-center">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            USER WAS BANNED FOR THIS POST
            {post.banInfo.reason && (
              <div className="mt-2 small fw-normal">
                Reason: {post.banInfo.reason}
              </div>
            )}
          </div>
        )}

        {!isHidden && !isUserHidden ? (
          <div>
            {post.image_url && (
              <div className="mb-3">
                <MediaViewer
                  src={post.image_url}
                  alt="Post image"
                  fileType={post.file_type}
                  postId={post.id}
                />
              </div>
            )}
            <PostContent
              content={post.content}
              posts={isThreadPage ? posts : undefined}
              allThreadsWithPosts={
                !isThreadPage ? allThreadsWithPosts : undefined
              }
              boardId={boardId}
              onPostLinkClick={onPostLinkClick}
              isThreadPage={isThreadPage}
            />
          </div>
        ) : (
          <p className="text-secondary mb-0">
            <em>{isUserHidden ? "User hidden" : "Post hidden"}</em>
          </p>
        )}
      </div>
    </div>
  );
}
