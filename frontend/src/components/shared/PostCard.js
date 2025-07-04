// frontend/src/components/shared/PostCard.js
import PostModMenu from "../admin/PostModMenu";
import PostHeader from "../PostHeader";
import PostContent from "../PostContent";
import MediaViewer from "../MediaViewer";

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
}) {
  const isModerator =
    adminUser?.role === "moderator" || adminUser?.role === "admin";

  // Determine if we should show the mod menu
  const showModMenu = isModerator && !isHidden && !isUserHidden;

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

        {showModMenu && (
          <PostModMenu
            post={post}
            thread={thread}
            board={board || { id: boardId }}
            isAdmin={adminUser?.role === "admin"}
            isMod={isModerator}
          />
        )}
      </div>

      <div className="card-body">
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
