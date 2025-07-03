// frontend/src/components/shared/PostCard.js

import PostModMenu from "../admin/PostModMenu";
import PostHeader from "../PostHeader";
import PostContent from "../PostContent";
import MediaViewer from "../MediaViewer";
import HideButton from "../HideButton";

export default function PostCard({
  post,
  thread,
  boardId,
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
}) {
  const isModerator =
    adminUser?.role === "moderator" || adminUser?.role === "admin";

  return (
    <div
      id={`post-${post.id}`}
      className={`card bg-dark border-secondary mb-3 shadow ${
        post.isNew ? "new-post" : ""
      } ${className}`}
    >
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <PostHeader
            post={post}
            isOP={isOP}
            boardSettings={boardSettings}
            onPostNumberClick={onPostNumberClick}
            isUserHidden={isUserHidden}
            onToggleUserHidden={onToggleUserHidden}
          />

          <div className="d-flex gap-2">
            <HideButton
              type="post"
              id={post.id}
              isHidden={isHidden}
              onToggle={onToggleHidden}
            />
            {isModerator && (
              <PostModMenu
                post={post}
                thread={thread}
                boardId={boardId}
                onPostDeleted={() => window.location.reload()}
                onThreadDeleted={() =>
                  (window.location.href = `/board/${boardId}`)
                }
                onBanCreated={() => window.location.reload()}
              />
            )}
          </div>
        </div>

        {!isHidden && !isUserHidden ? (
          <div className="mt-3">
            {post.image_url && (
              <div className="mb-3">
                <MediaViewer
                  src={post.image_url}
                  alt="Post image"
                  fileType={post.file_type}
                  fileName={post.file_name}
                  maxWidth="300px"
                />
              </div>
            )}
            <PostContent
              content={post.content}
              onPostLinkClick={onPostLinkClick}
            />
          </div>
        ) : (
          <p className="text-secondary mb-0 mt-2">
            <em>{isUserHidden ? "User hidden" : "Post hidden"}</em>
          </p>
        )}
      </div>
    </div>
  );
}
