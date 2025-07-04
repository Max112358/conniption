// frontend/src/components/shared/ThreadCard.js
import { Link } from "react-router-dom";
import PostHeader from "../PostHeader";
import PostContent from "../PostContent";
import MediaThumbnail from "./MediaThumbnail";
import HideButton from "../HideButton";
import { truncateText } from "../../utils/textHelpers";

export default function ThreadCard({
  thread,
  boardId,
  board, // Added board prop
  isHidden,
  isUserHidden,
  onToggleHidden,
  onToggleUserHidden,
  hiddenPosts,
  onTogglePostHidden,
}) {
  const hasReplies = thread.latestReplies && thread.latestReplies.length > 0;
  const opPost = thread.posts?.[0];

  return (
    <div className="card bg-dark border-secondary mb-3 shadow">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="d-flex align-items-center gap-2">
            <HideButton
              type="thread"
              id={thread.id}
              isHidden={isHidden}
              onToggle={onToggleHidden}
            />
            <Link
              to={`/board/${boardId}/thread/${thread.id}`}
              className="text-decoration-none"
            >
              <h5 className="mb-1 text-light text-break">{thread.topic}</h5>
            </Link>
          </div>
          <div className="d-flex flex-column align-items-end text-nowrap ms-2">
            <small className="text-secondary">
              {new Date(thread.created_at).toLocaleString()}
            </small>
            <small className="text-secondary">
              {thread.post_count} {thread.post_count === 1 ? "post" : "posts"}
            </small>
          </div>
        </div>

        {!isHidden ? (
          <>
            {/* OP Content */}
            {opPost && (
              <div className="mb-3 pb-3 border-bottom border-secondary">
                <PostHeader
                  post={opPost}
                  isOP={true}
                  boardSettings={{
                    thread_ids_enabled: board?.thread_ids_enabled,
                    country_flags_enabled: board?.country_flags_enabled,
                  }}
                  onPostNumberClick={() => {}}
                  isUserHidden={isUserHidden(opPost.thread_user_id)}
                  onToggleUserHidden={() =>
                    onToggleUserHidden(opPost.thread_user_id)
                  }
                />
                <div className="row mt-2">
                  {opPost.image_url && (
                    <div className="col-auto">
                      <MediaThumbnail
                        src={opPost.image_url}
                        alt="Thread image"
                        fileType={opPost.file_type}
                        size="150px"
                        linkTo={`/board/${boardId}/thread/${thread.id}`}
                      />
                    </div>
                  )}
                  <div className={opPost.image_url ? "col" : "col-12"}>
                    <PostContent
                      content={truncateText(opPost.content, 2000, 20)}
                      onPostLinkClick={() => {}}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Latest Replies */}
            {hasReplies && (
              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="text-secondary">
                    Latest {thread.latestReplies.length} replies:
                  </small>
                  {thread.totalReplies > 5 && (
                    <Link
                      to={`/board/${boardId}/thread/${thread.id}`}
                      className="btn btn-outline-secondary btn-sm"
                    >
                      View all {thread.totalReplies} replies
                    </Link>
                  )}
                </div>

                {thread.latestReplies.map((reply) => {
                  const postHidden = hiddenPosts.has(reply.id);
                  const userHidden = isUserHidden(reply.thread_user_id);

                  return (
                    <div
                      key={reply.id}
                      className="mb-2 p-2 bg-high-dark rounded border border-secondary"
                    >
                      <div className="mb-1">
                        <PostHeader
                          post={reply}
                          boardSettings={{
                            thread_ids_enabled: board?.thread_ids_enabled,
                            country_flags_enabled: board?.country_flags_enabled,
                          }}
                          onPostNumberClick={() => {}}
                          isUserHidden={userHidden}
                          onToggleUserHidden={() =>
                            onToggleUserHidden(reply.thread_user_id)
                          }
                        />
                      </div>

                      {!postHidden && !userHidden ? (
                        <div className="row">
                          {reply.image_url && (
                            <div className="col-auto">
                              <MediaThumbnail
                                src={reply.image_url}
                                alt="Reply"
                                fileType={reply.file_type}
                                size="80px"
                                linkTo={`/board/${boardId}/thread/${thread.id}`}
                              />
                            </div>
                          )}
                          <div className={reply.image_url ? "col" : "col-12"}>
                            <PostContent
                              content={truncateText(reply.content, 2000, 20)}
                              onPostLinkClick={() => {}}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-secondary mb-0 small">
                          <em>{userHidden ? "User hidden" : "Post hidden"}</em>
                        </p>
                      )}
                      <HideButton
                        type="post"
                        id={reply.id}
                        isHidden={postHidden}
                        onToggle={() => onTogglePostHidden(reply.id)}
                        size="sm"
                        className="mt-1"
                      />
                    </div>
                  );
                })}

                <div className="text-center mt-2">
                  <Link
                    to={`/board/${boardId}/thread/${thread.id}`}
                    className="btn btn-outline-primary btn-sm"
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
