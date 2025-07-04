// frontend/src/components/ThreadPage.js
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useParams } from "react-router-dom";
import BanNotification from "./BanNotification";
import LoadingSpinner from "./LoadingSpinner";
import PageHeader from "./shared/PageHeader";
import ErrorDisplay from "./shared/ErrorDisplay";
import ConnectionStatus from "./shared/ConnectionStatus";
import PostCard from "./shared/PostCard";
import ReplyForm from "./ReplyForm";
import useSocket from "../hooks/useSocket";
import useHideManager from "../hooks/useHideManager";
import useBanCheck from "../hooks/useBanCheck";
import useAdminStatus from "../hooks/useAdminStatus";
import { API_BASE_URL } from "../config/api";

function ThreadPage() {
  const { boardId, threadId } = useParams();
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [threadNotFound, setThreadNotFound] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [board, setBoard] = useState(null);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);

  // Reply form state
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState(null);

  const contentTextareaRef = useRef(null);
  const postsRef = useRef(posts);

  const { togglePostHidden, toggleUserHidden, isPostHidden, isUserHidden } =
    useHideManager();

  const { banned, banInfo, checkBanStatus, resetBanStatus } = useBanCheck();
  const { adminUser, isModerator } = useAdminStatus();

  // Update postsRef when posts change
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // Add custom CSS for highlight animation
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes postHighlight {
        0% { background-color: rgba(255, 193, 7, 0.5) !important; }
        100% { background-color: transparent; }
      }
      .post-highlight {
        animation: postHighlight 2s ease-in-out;
      }
      @keyframes newPostAnimation {
        0% { 
          opacity: 0;
          transform: translateY(-20px);
        }
        100% { 
          opacity: 1;
          transform: translateY(0);
        }
      }
      .new-post {
        animation: newPostAnimation 0.5s ease-out;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Fetch board details
  const fetchBoard = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`);
      if (response.ok) {
        const data = await response.json();
        setBoard(data.board);
      }
    } catch (err) {
      console.error("Error fetching board:", err);
    }
  }, [boardId]);

  // Fetch thread details
  const fetchThread = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}`
      );
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setThreadNotFound(true);
          return;
        }
        throw new Error(data.error || "Failed to fetch thread");
      }

      setThread(data.thread);
      setThreadNotFound(false);
    } catch (err) {
      console.error("Error fetching thread:", err);
      setError(err.message);
    }
  }, [boardId, threadId]);

  // Fetch posts with socket update support
  const fetchPosts = useCallback(
    async (isSocketUpdate = false) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts`
        );
        const data = await response.json();

        if (!response.ok) {
          // Check for ban
          if (response.status === 403) {
            const isBanned = await checkBanStatus(response);
            if (isBanned) return false;
          }
          throw new Error(data.error || "Failed to fetch posts");
        }

        const newPosts = data.posts || [];

        // If this is a socket update and we have existing posts, mark new ones
        if (isSocketUpdate && postsRef.current.length > 0) {
          const existingPostIds = new Set(postsRef.current.map((p) => p.id));
          const actualNewPosts = newPosts.filter(
            (p) => !existingPostIds.has(p.id)
          );

          if (actualNewPosts.length > 0) {
            // Mark the new posts for animation
            const markedPosts = newPosts.map((post) => ({
              ...post,
              isNew: !existingPostIds.has(post.id),
            }));
            setPosts(markedPosts);

            // Remove the "new" flag after animation completes
            setTimeout(() => {
              setPosts((current) =>
                current.map((post) => ({
                  ...post,
                  isNew: false,
                }))
              );
            }, 500);

            // Show notification if user is scrolled up
            const scrollPosition = window.scrollY + window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            if (scrollPosition < documentHeight - 100) {
              setNewPostsAvailable(true);
            }
          } else {
            setPosts(newPosts);
          }
        } else {
          setPosts(newPosts);
        }

        return true;
      } catch (err) {
        console.error("Error fetching posts:", err);
        setError(err.message);
        return false;
      }
    },
    [boardId, threadId, checkBanStatus]
  );

  // Combined fetch function
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    resetBanStatus();
    try {
      await Promise.all([fetchBoard(), fetchThread(), fetchPosts(false)]);
    } finally {
      setLoading(false);
    }
  }, [fetchBoard, fetchThread, fetchPosts, resetBanStatus]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket event handler
  const handlePostCreated = useCallback(
    (data) => {
      console.log("Post created event received:", data);
      if (
        data.boardId === boardId &&
        data.threadId === parseInt(threadId, 10)
      ) {
        fetchPosts(true);
      }
    },
    [boardId, threadId, fetchPosts]
  );

  // Socket configuration
  const socketConfig = useMemo(
    () => ({
      room: `${boardId}-${threadId}`,
      enabled: !loading && !error && !threadNotFound && !banned,
      events: {
        post_created: handlePostCreated,
      },
    }),
    [
      boardId,
      threadId,
      loading,
      error,
      threadNotFound,
      banned,
      handlePostCreated,
    ]
  );

  const { isConnected } = useSocket(socketConfig);

  // Handle scroll to dismiss new posts notification
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      if (scrollPosition >= documentHeight - 100) {
        setNewPostsAvailable(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle post submission
  const handleSubmitPost = useCallback(
    async (e) => {
      e.preventDefault();

      // Validation
      if (!content.trim() && !image) {
        setPostError("Either content or an image/video is required");
        return;
      }

      setPostLoading(true);
      setPostError(null);

      const formData = new FormData();
      formData.append("content", content);
      if (image) {
        formData.append("image", image);
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create post");
        }

        // Reset form
        setContent("");
        setImage(null);
        setImagePreview(null);
        setShowReplyForm(false);

        // Fetch updated posts
        await fetchPosts(false);

        // Scroll to bottom to see new post
        setTimeout(() => {
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          });
        }, 100);
      } catch (err) {
        console.error("Error creating post:", err);
        setPostError(
          err.message || "Failed to create post. Please try again later."
        );
      } finally {
        setPostLoading(false);
      }
    },
    [content, image, boardId, threadId, fetchPosts]
  );

  // Handle clicking on a post number to quote it
  const handlePostNumberClick = useCallback(
    (postId) => {
      const textarea = contentTextareaRef.current;
      if (!textarea) {
        // If reply form is not open, open it first
        setShowReplyForm(true);
      }

      const replyLink = `>>${postId}`;
      const currentContent = content;

      // If content is empty or ends with a newline, just add the link
      if (!currentContent || currentContent.endsWith("\n")) {
        setContent(currentContent + replyLink + "\n");
      } else {
        // Otherwise add a newline before the link
        setContent(currentContent + "\n" + replyLink + "\n");
      }

      // Focus textarea after a short delay if form was just opened
      setTimeout(() => {
        if (contentTextareaRef.current) {
          contentTextareaRef.current.focus();
          contentTextareaRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
    },
    [content]
  );

  // Handle clicking on a post link to scroll to that post
  const handlePostLinkClick = useCallback(
    (postId, targetThreadId) => {
      // If linking to a post in a different thread, navigate there
      if (targetThreadId && targetThreadId !== parseInt(threadId)) {
        window.location.href = `/board/${boardId}/thread/${targetThreadId}#post-${postId}`;
        return;
      }

      const postElement = document.getElementById(`post-${postId}`);
      if (postElement) {
        const headerOffset = 80;
        const elementPosition = postElement.getBoundingClientRect().top;
        const offsetPosition =
          elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });

        // Add highlight effect
        postElement.classList.add("post-highlight");

        // Remove highlight after animation
        setTimeout(() => {
          postElement.classList.remove("post-highlight");
        }, 2000);
      }
    },
    [threadId, boardId]
  );

  // Scroll to new posts when notification is clicked
  const scrollToNewPosts = useCallback(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
    setNewPostsAvailable(false);
  }, []);

  if (banned && banInfo) {
    return <BanNotification ban={banInfo} boardId={boardId} />;
  }

  if (loading) {
    return <LoadingSpinner message="Loading thread..." />;
  }

  if (threadNotFound) {
    return (
      <ErrorDisplay
        error="Thread not found"
        backLink={`/board/${boardId}`}
        backText={`← Back to /${boardId}/`}
      />
    );
  }

  if (error) {
    return <ErrorDisplay error={error} backLink={`/board/${boardId}`} />;
  }

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-4">
      <div className="container">
        <PageHeader
          backLink={`/board/${boardId}`}
          backText={`← Back to /${boardId}/`}
          badge={`/${boardId}/`}
          title={thread?.topic || "Loading..."}
          subtitle={
            <div className="d-flex justify-content-between align-items-center">
              <span>
                Thread created: {new Date(thread.created_at).toLocaleString()}
              </span>
              <div className="d-flex align-items-center gap-2">
                <ConnectionStatus connected={isConnected} />
                {adminUser && (
                  <span
                    className={`badge bg-${
                      adminUser.role === "admin"
                        ? "danger"
                        : adminUser.role === "moderator"
                        ? "warning"
                        : "info"
                    }`}
                  >
                    {adminUser.role.charAt(0).toUpperCase() +
                      adminUser.role.slice(1)}
                  </span>
                )}
              </div>
            </div>
          }
          actions={
            isModerator && (
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => console.log("Delete thread")}
              >
                <i className="bi bi-trash"></i> Delete Thread
              </button>
            )
          }
        />

        {/* New posts notification */}
        {newPostsAvailable && (
          <div
            className="position-fixed bottom-0 start-50 translate-middle-x mb-3"
            style={{ zIndex: 1000 }}
          >
            <button
              className="btn btn-primary shadow-lg"
              onClick={scrollToNewPosts}
            >
              <i className="bi bi-arrow-down-circle me-2"></i>
              New posts available
            </button>
          </div>
        )}

        {/* Posts Section */}
        <div className="card bg-mid-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h2 className="h5 mb-0 text-light">Posts</h2>
          </div>
          <div className="card-body">
            {posts.length > 0 ? (
              <div className="post-list">
                {posts.map((post, index) => (
                  <div key={post.id} id={`post-${post.id}`}>
                    <PostCard
                      post={post}
                      thread={thread}
                      boardId={boardId}
                      board={board}
                      isOP={index === 0}
                      isHidden={isPostHidden(post.id)}
                      isUserHidden={
                        post.thread_user_id && isUserHidden(post.thread_user_id)
                      }
                      onToggleHidden={() => togglePostHidden(post.id)}
                      onToggleUserHidden={() =>
                        toggleUserHidden(post.thread_user_id)
                      }
                      onPostNumberClick={handlePostNumberClick}
                      onPostLinkClick={handlePostLinkClick}
                      boardSettings={{
                        thread_ids_enabled: board?.thread_ids_enabled,
                        country_flags_enabled: board?.country_flags_enabled,
                      }}
                      adminUser={adminUser}
                      className={post.isNew ? "new-post" : ""}
                      posts={posts}
                      isThreadPage={true}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3">
                <p className="text-muted">No posts available.</p>
              </div>
            )}
          </div>
        </div>

        {/* Reply Form */}
        {!showReplyForm && (
          <div className="text-center mb-4">
            <button
              className="btn btn-primary"
              onClick={() => setShowReplyForm(true)}
              disabled={banned}
            >
              Reply to Thread
            </button>
          </div>
        )}

        {showReplyForm && (
          <ReplyForm
            ref={contentTextareaRef}
            content={content}
            setContent={setContent}
            image={image}
            setImage={setImage}
            imagePreview={imagePreview}
            setImagePreview={setImagePreview}
            onSubmit={handleSubmitPost}
            loading={postLoading}
            error={postError}
          />
        )}
      </div>
    </div>
  );
}

export default ThreadPage;
