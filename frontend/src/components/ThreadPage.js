// frontend/src/components/ThreadPage.js
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import BanNotification from "./BanNotification";
import LoadingSpinner from "./LoadingSpinner";
import PageHeader from "./shared/PageHeader";
import ErrorDisplay from "./shared/ErrorDisplay";
import ConnectionStatus from "./shared/ConnectionStatus";
import PostCard from "./shared/PostCard";
import ReplyForm from "./ReplyForm";
import ThreadDeleteButton from "./ThreadDeleteButton";
import StickyToggle from "./admin/StickyToggle";
import useSocket from "../hooks/useSocket";
import useHideManager from "../hooks/useHideManager";
import useBanCheck from "../hooks/useBanCheck";
import useAdminStatus from "../hooks/useAdminStatus";
import usePostOwnership from "../hooks/usePostOwnership";
import useThreadOwnership from "../hooks/useThreadOwnership";
import { API_BASE_URL } from "../config/api";
import { handleApiError } from "../utils/apiErrorHandler";
// Import the CSS file directly
import "../styles/deadThread.css";

function ThreadPage() {
  const { boardId, threadId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [threadNotFound, setThreadNotFound] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [board, setBoard] = useState(null);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const [threadDead, setThreadDead] = useState(false);
  const [threadDiedAt, setThreadDiedAt] = useState(null);
  const [bumpLimit, setBumpLimit] = useState(null);

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
  const { addOwnPost, removeOwnPost } = usePostOwnership();
  const { isOwnThread, removeOwnThread } = useThreadOwnership();

  // Update postsRef when posts change
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // Handle quote parameter from URL
  useEffect(() => {
    const quotePostId = searchParams.get("quote");
    if (quotePostId && !threadDead) {
      // Open reply form
      setShowReplyForm(true);

      // Add quote to content
      const replyLink = `>>${quotePostId}`;
      setContent((prev) => {
        if (!prev || prev.endsWith("\n")) {
          return prev + replyLink + "\n";
        } else {
          return prev + "\n" + replyLink + "\n";
        }
      });

      // Clear the quote parameter from URL using replace to avoid back button issues
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Focus textarea and scroll to bottom after a delay
      setTimeout(() => {
        if (contentTextareaRef.current) {
          contentTextareaRef.current.focus();
          // Scroll to the bottom of the page to show the reply form
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);
    }
  }, [searchParams, threadDead]);

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

      if (!response.ok) {
        if (response.status === 404) {
          setThreadNotFound(true);
          return false;
        }
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch thread");
      }

      const data = await response.json();
      setThread(data.thread);
      setThreadDead(data.thread.is_dead);
      setThreadDiedAt(data.thread.died_at);

      // Set bump limit from config
      if (data.config && data.config.bumpLimit) {
        setBumpLimit(data.config.bumpLimit);
      }

      setThreadNotFound(false);
      return true;
    } catch (err) {
      console.error("Error fetching thread:", err);
      setError(err.message);
      return false;
    }
  }, [boardId, threadId]);

  // Fetch posts with socket update support
  const fetchPosts = useCallback(
    async (isSocketUpdate = false) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts?includeSurveys=true`
        );

        if (!response.ok) {
          // Check for ban
          if (response.status === 403) {
            const isBanned = await checkBanStatus(response);
            if (isBanned) return false;
          }

          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch posts");
        }

        const data = await response.json();

        // Check thread dead status from response
        if (data.thread) {
          setThreadDead(data.thread.is_dead);
          setThreadDiedAt(data.thread.died_at);
        }

        // Ensure we have an array of posts - handle both data.posts and direct array response
        let newPosts = [];
        if (Array.isArray(data)) {
          newPosts = data;
        } else if (data && Array.isArray(data.posts)) {
          newPosts = data.posts;
        } else if (data && data.data && Array.isArray(data.data)) {
          newPosts = data.data;
        }

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
      // Fetch all data in parallel
      const results = await Promise.all([
        fetchBoard(),
        fetchThread(),
        fetchPosts(false),
      ]);

      const [, threadSuccess] = results;

      // Check if thread exists
      if (!threadSuccess) {
        return;
      }
    } catch (err) {
      console.error("Error in fetchData:", err);
      setError(err.message || "Failed to load thread data");
    } finally {
      setLoading(false);
    }
  }, [fetchBoard, fetchThread, fetchPosts, resetBanStatus]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket event handlers
  const handlePostCreated = useCallback(
    (data) => {
      if (
        data.boardId === boardId &&
        data.threadId === parseInt(threadId, 10)
      ) {
        fetchPosts(true);
      }
    },
    [boardId, threadId, fetchPosts]
  );

  const handlePostDeleted = useCallback(
    (data) => {
      if (
        data.boardId === boardId &&
        data.threadId === parseInt(threadId, 10)
      ) {
        // Remove the deleted post from the UI
        setPosts((currentPosts) =>
          currentPosts.filter((p) => p.id !== data.postId)
        );
        // Also remove from ownership tracking if it was ours
        removeOwnPost(data.postId);
      }
    },
    [boardId, threadId, removeOwnPost]
  );

  const handleThreadDeleted = useCallback(
    (data) => {
      if (
        data.boardId === boardId &&
        data.threadId === parseInt(threadId, 10)
      ) {
        // Thread has been deleted, redirect to board
        navigate(`/board/${boardId}`);
      }
    },
    [boardId, threadId, navigate]
  );

  const handlePostColorChanged = useCallback(
    (data) => {
      if (
        data.boardId === boardId &&
        data.threadId === parseInt(threadId, 10)
      ) {
        // Update the post color in the UI
        setPosts((currentPosts) =>
          currentPosts.map((p) =>
            p.id === data.postId ? { ...p, color: data.color } : p
          )
        );
      }
    },
    [boardId, threadId]
  );

  const handleThreadStickyUpdated = useCallback(
    (data) => {
      if (
        data.boardId === boardId &&
        data.threadId === parseInt(threadId, 10)
      ) {
        // Update the thread sticky status
        setThread((currentThread) =>
          currentThread
            ? { ...currentThread, is_sticky: data.isSticky }
            : currentThread
        );
      }
    },
    [boardId, threadId]
  );

  const handleThreadDied = useCallback(
    (data) => {
      if (
        data.boardId === boardId &&
        data.threadId === parseInt(threadId, 10)
      ) {
        // Mark the thread as dead
        setThreadDead(true);
        setThreadDiedAt(data.diedAt);
        setThread((currentThread) =>
          currentThread
            ? { ...currentThread, is_dead: true, died_at: data.diedAt }
            : currentThread
        );
        // Hide reply form if it's open
        setShowReplyForm(false);
      }
    },
    [boardId, threadId]
  );

  const handleStickyChanged = useCallback((threadId, isSticky) => {
    // Update the thread sticky status locally
    setThread((currentThread) =>
      currentThread ? { ...currentThread, is_sticky: isSticky } : currentThread
    );
  }, []);

  // Socket configuration
  const socketConfig = useMemo(
    () => ({
      room: `${boardId}-${threadId}`,
      enabled: !loading && !error && !threadNotFound && !banned,
      events: {
        post_created: handlePostCreated,
        post_deleted: handlePostDeleted,
        thread_deleted: handleThreadDeleted,
        post_color_changed: handlePostColorChanged,
        thread_sticky_updated: handleThreadStickyUpdated,
        thread_died: handleThreadDied,
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
      handlePostDeleted,
      handleThreadDeleted,
      handlePostColorChanged,
      handleThreadStickyUpdated,
      handleThreadDied,
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
    async (submitData) => {
      // Check if thread is dead
      if (threadDead) {
        setPostError(
          "This thread has been archived and no longer accepts new posts"
        );
        return;
      }

      // Extract data from the submit object
      const {
        content: submitContent,
        image: submitImage,
        includeSurvey,
        surveyData,
        dontBump,
      } = submitData;

      // Validation
      if (!submitContent.trim() && !submitImage) {
        setPostError("Either content or an image/video is required");
        return;
      }

      setPostLoading(true);
      setPostError(null);

      const formData = new FormData();
      formData.append("content", submitContent);
      if (submitImage) {
        formData.append("image", submitImage);
      }
      // Add don't bump flag
      formData.append("dont_bump", dontBump ? "true" : "false");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts?includeSurveys=true`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = handleApiError(errorData);
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Track the new post as owned by the user
        if (data.postId) {
          addOwnPost(data.postId);
        }

        // Create survey if requested (but not if thread is dead)
        if (includeSurvey && data.postId && surveyData && !threadDead) {
          try {
            const surveyResponse = await fetch(
              `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts/${data.postId}/survey`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  survey_type: surveyData.surveyType,
                  question: surveyData.surveyQuestion.trim(),
                  options: surveyData.surveyOptions, // Already filtered in ReplyForm
                  // NO expires_at field - surveys never expire
                }),
              }
            );

            if (!surveyResponse.ok) {
              console.error("Failed to create survey, but post was created");
            }
          } catch (surveyErr) {
            console.error("Error creating survey:", surveyErr);
            // Don't fail the post creation if survey fails
          }
        }

        // Reset form
        setContent("");
        setImage(null);
        setImagePreview(null);
        setShowReplyForm(false);

        // Fetch updated posts (with survey data)
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
    [boardId, threadId, fetchPosts, addOwnPost, threadDead]
  );

  // Handle clicking on a post number to quote it
  const handlePostNumberClick = useCallback(
    (postId) => {
      // Don't allow quoting in dead threads
      if (threadDead) {
        return;
      }

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

      // Focus textarea and scroll to bottom after a short delay
      setTimeout(() => {
        if (contentTextareaRef.current) {
          contentTextareaRef.current.focus();
          // Scroll to the bottom of the page
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);
    },
    [content, threadDead]
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

  // Handle post deletion from delete button (remove from UI)
  const handlePostDeletedByUser = useCallback((postId) => {
    setPosts((currentPosts) => currentPosts.filter((p) => p.id !== postId));
  }, []);

  // Handle post color change (from mod menu)
  const handlePostColorChangedByUser = useCallback((postId, newColor) => {
    setPosts((currentPosts) =>
      currentPosts.map((p) => (p.id === postId ? { ...p, color: newColor } : p))
    );
  }, []);

  // Scroll to new posts when notification is clicked
  const scrollToNewPosts = useCallback(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
    setNewPostsAvailable(false);
  }, []);

  // Format time remaining for dead thread
  const getTimeRemaining = useCallback(() => {
    if (!threadDiedAt) return null;

    const diedAt = new Date(threadDiedAt);
    const expiresAt = new Date(diedAt.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
    const now = new Date();
    const remaining = expiresAt - now;

    if (remaining <= 0) return "Expired";

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? "s" : ""} ${minutes} minute${
        minutes !== 1 ? "s" : ""
      }`;
    }
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }, [threadDiedAt]);

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

  // Check if thread has reached bump limit
  const hasReachedBumpLimit =
    bumpLimit && thread && thread.post_count >= bumpLimit;

  return (
    <div
      className={`container-fluid min-vh-100 bg-dark text-light py-4 ${
        threadDead ? "dead-thread" : ""
      }`}
    >
      {threadDead && <div className="dead-thread-overlay"></div>}

      <div className="container">
        {threadDead && (
          <div className="dead-thread-banner">
            <i className="bi bi-exclamation-triangle-fill"></i>
            This thread has been archived and is now read-only.
            {threadDiedAt && (
              <div className="mt-2 small">
                Time remaining before deletion: {getTimeRemaining()}
              </div>
            )}
          </div>
        )}

        <PageHeader
          backLink={`/board/${boardId}`}
          backText={`← Back to /${boardId}/`}
          badge={`/${boardId}/`}
          title={
            <span>
              {thread?.is_sticky && (
                <i
                  className="bi bi-pin-fill text-warning me-2"
                  title="Sticky thread"
                ></i>
              )}
              {threadDead && (
                <i
                  className="bi bi-archive-fill text-danger me-2"
                  title="Archived thread"
                ></i>
              )}
              {thread?.topic || "Loading..."}
            </span>
          }
          subtitle={
            <div className="d-flex justify-content-between align-items-center">
              <span>
                {thread &&
                  `Thread created: ${new Date(
                    thread.created_at
                  ).toLocaleString()}`}
                {hasReachedBumpLimit && (
                  <span className="badge bg-secondary ms-2">
                    Bump limit reached ({bumpLimit} posts)
                  </span>
                )}
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
            thread &&
            !threadDead && (
              <div className="d-flex gap-2">
                <StickyToggle
                  threadId={parseInt(threadId)}
                  boardId={boardId}
                  isSticky={thread.is_sticky}
                  adminUser={adminUser}
                  onStickyChanged={handleStickyChanged}
                />
                <ThreadDeleteButton
                  threadId={parseInt(threadId)}
                  boardId={boardId}
                  isOwnThread={isOwnThread(parseInt(threadId))}
                  isModerator={isModerator}
                  adminUser={adminUser}
                  onDeleted={() => {
                    removeOwnThread(parseInt(threadId));
                    navigate(`/board/${boardId}`);
                  }}
                />
              </div>
            )
          }
        />

        {/* New posts notification */}
        {newPostsAvailable && !threadDead && (
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
            <h2 className="h5 mb-0 text-light">Posts ({posts.length})</h2>
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
                      onPostDeleted={handlePostDeletedByUser}
                      onPostColorChanged={handlePostColorChangedByUser}
                      isThreadDead={threadDead}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5">
                <p className="text-muted">
                  No posts available in this thread yet.
                </p>
                <p className="text-muted small">
                  This could mean the thread is new or there was an error
                  loading posts.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reply Form */}
        {!threadDead && !showReplyForm && posts.length > 0 && (
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

        {!threadDead && showReplyForm && (
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
            currentPostCount={thread?.post_count || posts.length}
            bumpLimit={bumpLimit}
          />
        )}

        {threadDead && posts.length > 0 && (
          <div className="card bg-dark border-danger reply-form-disabled">
            <div className="card-body text-center py-5">
              <div className="reply-form-disabled-message">
                <i className="bi bi-lock-fill me-2"></i>
                This thread is archived. No new posts allowed.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ThreadPage;
