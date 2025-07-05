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
  board,
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
    <div className="card bg-high-dark border-secondary mb-4">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="d-flex align-items-center gap-2">
            <HideButton
              isHidden={isHidden}
              onToggle={onToggleHidden}
              title={isHidden ? "Unhide this thread" : "Hide this thread"}
            />
            <Link
              to={`/board/${boardId}/thread/${thread.id}`}
              className="text-decoration-none"
            >
              <h5 className="mb-1 text-light text-break">{thread.topic}</h5>
            </Link>
          </div>
          <div className="d-flex align-items-center text-nowrap ms-2 gap-3">
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
            {opPost ? (
              <div className="mb-2 p-2 bg-dark rounded border border-secondary">
                <PostHeader
                  post={opPost}
                  onPostNumberClick={() => {}}
                  showThreadId={board?.thread_ids_enabled}
                  showCountryFlag={board?.country_flags_enabled}
                  isPostHidden={hiddenPosts.has(opPost.id)}
                  isUserHidden={
                    opPost.thread_user_id && isUserHidden(opPost.thread_user_id)
                  }
                  onTogglePostHidden={() => onTogglePostHidden(opPost.id)}
                  onToggleUserHidden={onToggleUserHidden}
                />
                {!(
                  hiddenPosts.has(opPost.id) ||
                  (opPost.thread_user_id && isUserHidden(opPost.thread_user_id))
                ) ? (
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
                      <div
                        className="text-light text-break"
                        style={{
                          whiteSpace: "pre-wrap",
                          wordWrap: "break-word",
                          wordBreak: "break-word",
                          overflowWrap: "break-word",
                        }}
                      >
                        <PostContent
                          content={truncateText(opPost.content, 2000, 20)}
                          posts={thread.posts}
                          allThreadsWithPosts={[thread]}
                          boardId={boardId}
                          onPostLinkClick={() => {}}
                          isThreadPage={false}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-secondary mb-0">
                    <em>
                      {opPost.thread_user_id &&
                      isUserHidden(opPost.thread_user_id)
                        ? "User hidden"
                        : "Post hidden"}
                    </em>
                  </p>
                )}
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
                  {/* separator line */}
                  <div className="flex-grow-1 border-top border-secondary ms-3"></div>
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
                  const userHidden =
                    reply.thread_user_id && isUserHidden(reply.thread_user_id);

                  return (
                    <div
                      key={reply.id}
                      className="mb-2 p-2 bg-dark rounded border border-secondary"
                    >
                      <div className="mb-1">
                        <PostHeader
                          post={reply}
                          onPostNumberClick={() => {}}
                          showThreadId={board?.thread_ids_enabled}
                          showCountryFlag={board?.country_flags_enabled}
                          isPostHidden={postHidden}
                          isUserHidden={userHidden}
                          onTogglePostHidden={() =>
                            onTogglePostHidden(reply.id)
                          }
                          onToggleUserHidden={onToggleUserHidden}
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
                            <div
                              className="small text-light text-break"
                              style={{
                                whiteSpace: "pre-wrap",
                                wordWrap: "break-word",
                                wordBreak: "break-word",
                                overflowWrap: "break-word",
                              }}
                            >
                              <PostContent
                                content={truncateText(reply.content, 2000, 20)}
                                posts={thread.posts}
                                allThreadsWithPosts={[thread]}
                                boardId={boardId}
                                onPostLinkClick={() => {}}
                                isThreadPage={false}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-secondary mb-0 small">
                          <em>Post hidden</em>
                        </p>
                      )}
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
