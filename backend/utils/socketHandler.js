// backend/utils/socketHandler.js

// Store io instance for access from other modules
let ioInstance;

/**
 * Setup Socket.io event handlers
 * @param {Object} io - Socket.io server instance
 */
const setupSocketHandlers = (io) => {
  // Store io instance for later use
  ioInstance = io;

  // Socket.io connection handling
  io.on("connection", async (socket) => {
    console.log(`Socket: New client connected: ${socket.id}`);

    // Join board rooms for real-time updates
    socket.on("join_board", (boardId) => {
      socket.join(boardId);
      console.log(`Socket: Client ${socket.id} joined board: ${boardId}`);
    });

    // Leave board room
    socket.on("leave_board", (boardId) => {
      socket.leave(boardId);
      console.log(`Socket: Client ${socket.id} left board: ${boardId}`);
    });

    // Join thread room for real-time updates
    socket.on("join_thread", ({ boardId, threadId }) => {
      const roomId = `${boardId}-${threadId}`;
      socket.join(roomId);
      console.log(`Socket: Client ${socket.id} joined thread: ${roomId}`);
    });

    // Leave thread room
    socket.on("leave_thread", ({ boardId, threadId }) => {
      const roomId = `${boardId}-${threadId}`;
      socket.leave(roomId);
      console.log(`Socket: Client ${socket.id} left thread: ${roomId}`);
    });

    // Log other events for debugging
    socket.onAny((event, ...args) => {
      console.log(`Socket: Received event "${event}" from client ${socket.id}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket: Client ${socket.id} disconnected`);
    });
  });

  // Log socket server events
  io.engine.on("connection_error", (err) => {
    console.error("Socket: Connection error:", err);
  });
};

/**
 * Get the Socket.io instance
 * @returns {Object|null} Socket.io instance or null if not initialized
 */
const getIo = () => {
  return ioInstance || null;
};

module.exports = setupSocketHandlers;
module.exports.getIo = getIo;
