// frontend/src/components/ThreadPage.js

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import BanNotification from "./BanNotification";
import LoadingSpinner from "./LoadingSpinner";
import PageHeader from "./shared/PageHeader";
import ErrorDisplay from "./shared/ErrorDisplay";
import ConnectionStatus from "./shared/ConnectionStatus";
import PostCard from "./shared/PostCard";
import ReplyForm from "./shared/ReplyForm";
import useSocket from "../hooks/useSocket";
import useHideManager from "../hooks/useHideManager";
import useAdminStatus from "../hooks/useAdminStatus";
import { API_BASE_URL } from "../config/api";

export default function ThreadPage() {
  const { boardId, threadId } = useParams();
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState(null);
  const [banned, setBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  const [board, setBoard] = useState(null);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);

  const contentTextareaRef = useRef(null);
  const postsRef = useRef(posts);

  // Custom hooks
  const { socket, connected } = useSocket("thread", { boardId, threadId });
  const { adminUser, isModerator } = useAdminStatus();
  const {
    hiddenPosts,
    hiddenUsers,
    togglePostHidden,
    toggleUserHidden,
    isPostHidden,
    isUserHidden,
  } = useHideManager();

  // Update postsRef when posts change
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // Add animation styles
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
    return () => document.head.removeChild(style);
  }, []);

  // Fetch posts
  const fetchPosts = useCallback(
    async (isSocketUpdate = false) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}/posts`
        );

        if (response.status === 403) {
          const errorData = await response.json();
          if (errorData.error === "Banned") {
            setBanned(true);
            setBanInfo(errorData.ban);
            return false;
          }
        }

        if (!response.ok) {
          throw new Error("Failed to load posts");
        }

        const data = await response.json();
        const newPosts = data.posts || [];

        // Handle new post animations
        if (isSocketUpdate && postsRef.current.length > 0) {
          const existingPostIds = new Set(postsRef.current.map((p) => p.id));
          const actualNewPosts = newPosts.filter(
            (p) => !existingPostIds.has(p.id)
          );

          if (actualNewPosts.length > 0) {
            const markedPosts = newPosts.map((post) => ({
              ...post,
              isNew: !existingPostIds.has(post.id),
            }));
            setPosts(markedPosts);

            setTimeout(() => {
              setPosts((current) =>
                current.map((post) => ({ ...post, isNew: false }))
              );
            }, 500);

            // Show notification if scrolled up
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
        return false;
      }
    },
    [boardId, threadId]
  );

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handlePostCreated = (data) => {
      console.log("New post created event received:", data);
      if (data.threadId === parseInt(threadId) && data.boardId === boardId) {
        fetchPosts(true);
      }
    };

    socket.on("post_created", handlePostCreated);
    return () => socket.off("post_created", handlePostCreated);
  }, [socket, boardId, threadId, fetchPosts]);

  // Initial data fetch
  useEffect(() => {
    const fetchThreadData = async () => {
      try {
        const boardResponse = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}`
        );
        if (!boardResponse.ok) throw new Error("Board not found");
        const boardData = await boardResponse.json();
        setBoard(boardData.board);

        const threadResponse = await fetch(
          `${API_BASE_URL}/api/boards/${boardId}/threads/${threadId}`
        );
        if (!threadResponse.ok) throw new Error("Thread not found");
        const threadData = await threadResponse.json();
        setThread(threadData.thread);

        await fetchPosts(false);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching thread data:", err);
        setError(
          err.message || "Failed to load thread data. Please try again later."
        );
        setLoading(false);
      }
    };

    fetchThreadData();
  }, [boardId, threadId, fetchPosts]);

  // Handle post submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || postLoading) return;

    setPostLoading(true);
    setPostError(null);

    try {
      const formData = new FormData();
      formData.append("content", content);
      if (image) formData.append("image", image);

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

      // Clear file input
      const fileInput = document.getElementById("image");
      if (fileInput) fileInput.value = "";

      await fetchPosts(false);

      // Scroll to bottom
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      }, 100);

      setPostLoading(false);
    } catch (err) {
      console.error("Error creating post:", err);
      setPostError(
        err.message || "Failed to create post. Please try again later."
      );
      setPostLoading(false);
    }
  };

  // Handle post number clicks
  const handlePostNumberClick = (postId) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const replyLink = `>>${postId}`;
    const currentContent = content;

    if (!currentContent || currentContent.endsWith("\n")) {
      setContent(currentContent + replyLink + "\n");
    } else {
      setContent(currentContent + "\n" + replyLink + "\n");
    }

    textarea.focus();
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Handle post link clicks
  const handlePostLinkClick = (postId) => {
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

      postElement.classList.add("post-highlight");
      setTimeout(() => {
        postElement.classList.remove("post-highlight");
      }, 2000);
    }
  };

  // Scroll to new posts
  const scrollToNewPosts = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
    setNewPostsAvailable(false);
  };

  if (banned && banInfo) {
    return <BanNotification ban={banInfo} boardId={boardId} />;
  }

  if (loading) {
    return <LoadingSpinner message="Loading thread..." />;
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        backLink={`/board/${boardId}`}
        backText="← Back to Board"
      />
    );
  }

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-4">
      <div className="container">
        <PageHeader
          backLink={`/board/${boardId}`}
          backText="← Back to Board"
          title={thread.topic}
          badge={`/${boardId}/`}
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

        <div className="mb-3 text-secondary d-flex justify-content-between align-items-center">
          <small>
            Thread created: {new Date(thread.created_at).toLocaleString()}
          </small>
          <div className="d-flex align-items-center gap-2">
            <ConnectionStatus connected={connected} />
            {adminUser && (
              <span
                className={`badge bg-${
                  adminUser.role === "admin" ? "danger" : "warning"
                }`}
              >
                {adminUser.role}
              </span>
            )}
          </div>
        </div>

        {/* Posts */}
        <div className="mb-4">
          {posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              thread={thread}
              boardId={boardId}
              isOP={index === 0}
              isHidden={isPostHidden(post.id)}
              isUserHidden={isUserHidden(post.thread_user_id)}
              onToggleHidden={() => togglePostHidden(post.id)}
              onToggleUserHidden={() => toggleUserHidden(post.thread_user_id)}
              onPostNumberClick={() => handlePostNumberClick(post.id)}
              onPostLinkClick={handlePostLinkClick}
              boardSettings={board}
              adminUser={adminUser}
            />
          ))}
        </div>

        {/* New posts notification */}
        {newPostsAvailable && (
          <div
            className="position-fixed bottom-0 start-50 translate-middle-x mb-3"
            style={{ zIndex: 1000 }}
          >
            <button className="btn btn-warning" onClick={scrollToNewPosts}>
              New posts available ↓
            </button>
          </div>
        )}

        {/* Reply form */}
        <ReplyForm
          ref={contentTextareaRef}
          content={content}
          setContent={setContent}
          image={image}
          setImage={setImage}
          imagePreview={imagePreview}
          setImagePreview={setImagePreview}
          onSubmit={handleSubmit}
          loading={postLoading}
          error={postError}
        />
      </div>
    </div>
  );
}
