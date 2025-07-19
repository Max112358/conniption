// frontend/src/components/shared/PostCard.js
import { useState } from "react";
import PostModMenu from "../admin/PostModMenu";
import PostDeleteButton from "../PostDeleteButton";
import PostHeader from "../PostHeader";
import PostContent from "../PostContent";
import MediaViewer from "../MediaViewer";
import SurveyView from "../survey/SurveyView";
import usePostOwnership from "../../hooks/usePostOwnership";

export default function PostCard({
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
  adminUser = null,
  className = "",
  posts = [],
  allThreadsWithPosts = [],
  isThreadPage = false,
  onPostDeleted,
  onPostColorChanged,
  isThreadDead = false,
}) {
  const { isOwnPost, removeOwnPost } = usePostOwnership();
  const [postColor, setPostColor] = useState(post.color || "black");
  const isModerator =
    adminUser?.role === "moderator" || adminUser?.role === "admin";

  const showModMenu =
    isModerator && !isHidden && !isUserHidden && !isThreadDead;
  const isUserOwnPost = isOwnPost(post.id);

  const handlePostDeleted = (postId) => {
    removeOwnPost(postId);
    if (onPostDeleted) {
      onPostDeleted(postId);
    }
  };

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

          {isUserOwnPost && !isHidden && !isUserHidden && !isThreadDead && (
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

            {/* Survey Component - Only show if survey exists */}
            {post.survey && (
              <div className="mt-3">
                <SurveyView
                  survey={post.survey}
                  postId={post.id}
                  threadId={thread?.id || post.thread_id}
                  boardId={boardId}
                  isPostOwner={isUserOwnPost}
                  isThreadDead={isThreadDead}
                />
              </div>
            )}
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
