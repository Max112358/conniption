// frontend/src/components/shared/PostCard.js
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
}) {
  const { isOwnPost, removeOwnPost } = usePostOwnership();
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

  return (
    <div
      id={`post-${post.id}`}
      className={`card bg-dark border-secondary mb-3 shadow ${
        post.isNew ? "new-post" : ""
      } ${className}`}
    >
      <div className="card-header border-secondary d-flex justify-content-between align-items-center">
        <PostHeader
          post={post}
          isOP={isOP}
          boardSettings={boardSettings}
          onPostNumberClick={onPostNumberClick}
          showThreadId={boardSettings.thread_ids_enabled}
          showCountryFlag={boardSettings.country_flags_enabled}
          isPostHidden={isHidden}
          isUserHidden={isUserHidden}
          onTogglePostHidden={onToggleHidden}
          onToggleUserHidden={onToggleUserHidden}
        />

        <div className="d-flex gap-2">
          {showModMenu && (
            <PostModMenu
              post={post}
              thread={thread}
              board={board || { id: boardId }}
              isAdmin={adminUser?.role === "admin"}
              isMod={isModerator}
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
