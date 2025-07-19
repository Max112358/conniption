// frontend/src/components/shared/ThreadCard.js
import { Link, useNavigate } from "react-router-dom";
import PostPreview from "./PostPreview";
import HideButton from "../HideButton";
import ThreadDeleteButton from "../ThreadDeleteButton";
import StickyToggle from "../admin/StickyToggle";
import useThreadOwnership from "../../hooks/useThreadOwnership";
import useAdminStatus from "../../hooks/useAdminStatus";
import { truncateText } from "../../utils/textHelpers";

export default function ThreadCard({
  thread,
  boardId,
  board,
  isHidden,
  isUserHidden,
  onToggleHidden,
  onToggleUserHidden,
  hiddenPosts,
  onTogglePostHidden,
  onStickyChanged,
}) {
  const navigate = useNavigate();
  const hasReplies = thread.latestReplies && thread.latestReplies.length > 0;
  const opPost = thread.posts?.[0];

  const { isOwnThread, removeOwnThread } = useThreadOwnership();
  const { adminUser, isModerator } = useAdminStatus();

  // Handle clicking anywhere on the card to navigate to thread
  const handleCardClick = (e) => {
    // Don't navigate if clicking on interactive elements
    if (
      e.target.closest("button") ||
      e.target.closest("a") ||
      e.target.closest(".btn") ||
      e.target.closest(".form-check") ||
      e.target.closest('[role="button"]') ||
      e.target.closest(".dropdown")
    ) {
      return;
    }

    navigate(`/board/${boardId}/thread/${thread.id}`);
  };

  // Handle post number click to navigate with quote
  const handlePostNumberClick = (postId) => {
    navigate(`/board/${boardId}/thread/${thread.id}?quote=${postId}`);
  };

  return (
    <div className="card bg-high-dark border-secondary mb-4 thread-card-hover position-relative">
      {/* Invisible clickable overlay */}
      <div
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{
          zIndex: 1,
          cursor: "pointer",
          backgroundColor: "transparent",
        }}
        onClick={handleCardClick}
        aria-label={`Go to thread: ${thread.topic}`}
      />

      <div className="card-body" style={{ position: "relative", zIndex: 2 }}>
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start mb-2 gap-2">
          <div className="d-flex align-items-center gap-2 w-100 w-sm-auto">
            <HideButton
              isHidden={isHidden}
              onToggle={onToggleHidden}
              title={isHidden ? "Unhide this thread" : "Hide this thread"}
            />
            <Link
              to={`/board/${boardId}/thread/${thread.id}`}
              className="text-decoration-none flex-grow-1"
              style={{ zIndex: 3 }}
            >
              <h5
                className="mb-0 text-light text-break"
                style={{ minWidth: 0 }}
              >
                {thread.is_sticky && (
                  <i
                    className="bi bi-pin-fill text-warning me-2"
                    title="Sticky thread"
                  ></i>
                )}
                {thread.topic}
              </h5>
            </Link>
          </div>

          <div className="d-flex align-items-center flex-wrap gap-2 gap-sm-3 ms-sm-2 w-100 w-sm-auto justify-content-end">
            <small className="text-secondary text-nowrap">
              {new Date(thread.created_at).toLocaleString()}
            </small>

            <small className="text-secondary text-nowrap">
              {thread.post_count} {thread.post_count === 1 ? "post" : "posts"}
            </small>

            <div style={{ zIndex: 3 }}>
              <StickyToggle
                threadId={thread.id}
                boardId={boardId}
                isSticky={thread.is_sticky}
                adminUser={adminUser}
                onStickyChanged={onStickyChanged}
              />
            </div>

            <div style={{ zIndex: 3 }}>
              <ThreadDeleteButton
                threadId={thread.id}
                boardId={boardId}
                isOwnThread={isOwnThread(thread.id)}
                isModerator={isModerator}
                adminUser={adminUser}
                onDeleted={() => {
                  removeOwnThread(thread.id);
                }}
              />
            </div>
          </div>
        </div>

        {!isHidden ? (
          <>
            {/* OP Content - Using PostPreview */}
            {opPost ? (
              <div className="mb-3">
                <PostPreview
                  post={{
                    ...opPost,
                    content: truncateText(opPost.content, 2000, 20),
                  }}
                  thread={thread}
                  boardId={boardId}
                  board={board}
                  isOP={true}
                  isHidden={hiddenPosts.has(opPost.id)}
                  isUserHidden={
                    opPost.thread_user_id && isUserHidden(opPost.thread_user_id)
                  }
                  onToggleHidden={() => onTogglePostHidden(opPost.id)}
                  onToggleUserHidden={onToggleUserHidden}
                  onPostNumberClick={handlePostNumberClick}
                  onPostLinkClick={() => {}}
                  boardSettings={{
                    thread_ids_enabled: board?.thread_ids_enabled,
                    country_flags_enabled: board?.country_flags_enabled,
                  }}
                  posts={thread.posts || []}
                  allThreadsWithPosts={[thread]}
                  compact={false}
                />
              </div>
            ) : (
              <div className="text-secondary mb-3">
                <em>Loading thread content...</em>
              </div>
            )}

            {/* Latest Replies */}
            {hasReplies && (
              <div className="mt-1">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="text-secondary">
                    Latest {thread.latestReplies.length} replies:
                  </small>
                  <div className="flex-grow-1 border-top border-secondary ms-3"></div>
                  {thread.totalReplies > 5 && (
                    <Link
                      to={`/board/${boardId}/thread/${thread.id}`}
                      className="btn btn-outline-secondary btn-sm"
                      style={{ zIndex: 3 }}
                    >
                      View all {thread.totalReplies} replies
                    </Link>
                  )}
                </div>

                <div className="ms-3">
                  {thread.latestReplies.map((reply) => (
                    <PostPreview
                      key={reply.id}
                      post={{
                        ...reply,
                        content: truncateText(reply.content, 500, 10),
                      }}
                      thread={thread}
                      boardId={boardId}
                      board={board}
                      isOP={false}
                      isHidden={hiddenPosts.has(reply.id)}
                      isUserHidden={
                        reply.thread_user_id &&
                        isUserHidden(reply.thread_user_id)
                      }
                      onToggleHidden={() => onTogglePostHidden(reply.id)}
                      onToggleUserHidden={onToggleUserHidden}
                      onPostNumberClick={handlePostNumberClick}
                      onPostLinkClick={() => {}}
                      boardSettings={{
                        thread_ids_enabled: board?.thread_ids_enabled,
                        country_flags_enabled: board?.country_flags_enabled,
                      }}
                      posts={thread.posts || []}
                      allThreadsWithPosts={[thread]}
                      compact={true}
                    />
                  ))}
                </div>

                <div className="text-center mt-2">
                  <Link
                    to={`/board/${boardId}/thread/${thread.id}`}
                    className="btn btn-outline-primary btn-sm"
                    style={{ zIndex: 3 }}
                  >
                    View Thread →
                  </Link>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-secondary mb-0">
            <em>Thread hidden</em>
          </p>
        )}
      </div>
    </div>
  );
}
