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
  isHidden,
  isUserHidden,
  onToggleHidden,
  onToggleUserHidden,
  hiddenPosts,
  onTogglePostHidden,
}) {
  const hasReplies = thread.latestReplies && thread.latestReplies.length > 0;

  return (
    <div className="card bg-dark border-secondary mb-3 shadow">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h5 className="card-title text-light mb-0">
            <Link
              to={`/board/${boardId}/thread/${thread.id}`}
              className="text-decoration-none text-light"
            >
              {thread.topic}
            </Link>
          </h5>

          <div className="d-flex gap-2">
            <span className="badge bg-secondary">
              {thread.totalReplies || 0} replies
            </span>
            <HideButton
              type="thread"
              id={thread.id}
              isHidden={isHidden}
              onToggle={onToggleHidden}
            />
          </div>
        </div>

        {!isHidden ? (
          <>
            {/* First post */}
            {thread.posts && thread.posts[0] && (
              <div className="mb-3 pb-3 border-bottom border-secondary">
                <PostHeader
                  post={thread.posts[0]}
                  isOP={true}
                  boardSettings={{}}
                  onPostNumberClick={() => {}}
                  isUserHidden={isUserHidden(thread.posts[0].thread_user_id)}
                  onToggleUserHidden={() =>
                    onToggleUserHidden(thread.posts[0].thread_user_id)
                  }
                />
                <div className="row mt-2">
                  {thread.posts[0].image_url && (
                    <div className="col-auto">
                      <MediaThumbnail
                        src={thread.posts[0].image_url}
                        alt="Thread image"
                        fileType={thread.posts[0].file_type}
                        linkTo={`/board/${boardId}/thread/${thread.id}`}
                      />
                    </div>
                  )}
                  <div className={thread.posts[0].image_url ? "col" : "col-12"}>
                    <PostContent
                      content={truncateText(thread.posts[0].content, 500, 10)}
                      truncated={true}
                      onPostLinkClick={() => {}}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Latest replies */}
            {hasReplies && (
              <div className="mt-3">
                <small className="text-secondary d-block mb-2">
                  Latest replies:
                </small>
                {thread.latestReplies.map((post) => {
                  const postHidden = hiddenPosts.has(post.id);
                  const userHidden = isUserHidden(post.thread_user_id);

                  return (
                    <div
                      key={post.id}
                      className="mb-2 ps-3 border-start border-secondary"
                    >
                      <PostHeader
                        post={post}
                        isOP={false}
                        boardSettings={{}}
                        onPostNumberClick={() => {}}
                        isUserHidden={userHidden}
                        onToggleUserHidden={() =>
                          onToggleUserHidden(post.thread_user_id)
                        }
                      />
                      {!postHidden && !userHidden ? (
                        <div className="row mt-1">
                          {post.image_url && (
                            <div className="col-auto">
                              <MediaThumbnail
                                src={post.image_url}
                                alt="Post image"
                                fileType={post.file_type}
                                size="100px"
                                linkTo={`/board/${boardId}/thread/${thread.id}`}
                              />
                            </div>
                          )}
                          <div className={post.image_url ? "col" : "col-12"}>
                            <PostContent
                              content={truncateText(post.content, 200, 3)}
                              truncated={true}
                              onPostLinkClick={() => {}}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-secondary mb-0 small">
                          <em>Post hidden</em>
                        </p>
                      )}
                      <HideButton
                        type="post"
                        id={post.id}
                        isHidden={postHidden}
                        onToggle={() => onTogglePostHidden(post.id)}
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
