// frontend/src/hooks/useSocket.js
import { useEffect, useState, useRef, useCallback } from "react";
import io from "socket.io-client";
import { SOCKET_URL } from "../config/api";

/**
 * Custom hook for managing Socket.io connections
 * @param {Object} config - Configuration object
 * @param {string} config.room - Room to join
 * @param {boolean} config.enabled - Whether to enable the connection
 * @param {Object} config.events - Event handlers { eventName: handler }
 * @returns {Object} { isConnected, socket }
 */
function useSocket({ room, enabled = true, events = {} }) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const isConnecting = useRef(false);

  // Clean up function to remove all event listeners
  const cleanupEvents = useCallback(() => {
    if (socketRef.current) {
      // Remove all event listeners
      Object.keys(events).forEach((event) => {
        socketRef.current.off(event);
      });

      // Remove connection event listeners
      socketRef.current.off("connect");
      socketRef.current.off("disconnect");
      socketRef.current.off("connect_error");
    }
  }, [events]);

  useEffect(() => {
    // Skip if not enabled or already connecting
    if (!enabled || isConnecting.current) {
      return;
    }

    // If we already have a connected socket for this room, reuse it
    if (socketRef.current?.connected && socketRef.current?.room === room) {
      // Just update event handlers
      cleanupEvents();

      // Re-attach event handlers
      Object.entries(events).forEach(([event, handler]) => {
        if (handler && typeof handler === "function") {
          socketRef.current.on(event, handler);
        }
      });

      return;
    }

    isConnecting.current = true;

    // Create new socket connection
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    socketRef.current.room = room;

    // Connection event handlers
    socket.on("connect", () => {
      console.log(`Socket connected to room: ${room}`);
      setIsConnected(true);
      isConnecting.current = false;

      // Join room after connection
      if (room) {
        socket.emit("join_board", room);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected from room ${room}:`, reason);
      setIsConnected(false);
      isConnecting.current = false;
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setIsConnected(false);
      isConnecting.current = false;
    });

    // Attach custom event handlers
    Object.entries(events).forEach(([event, handler]) => {
      if (handler && typeof handler === "function") {
        socket.on(event, handler);
      }
    });

    // Cleanup function
    return () => {
      console.log(`Cleaning up socket for room: ${room}`);

      // Leave room before disconnecting
      if (room && socket.connected) {
        socket.emit("leave_board", room);
      }

      // Clean up all event listeners
      cleanupEvents();

      // Disconnect socket
      if (socket.connected) {
        socket.disconnect();
      }

      // Clear refs
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      isConnecting.current = false;
    };
  }, [room, enabled]); // Remove 'events' from dependencies to prevent reconnection

  // Update event handlers when they change (without reconnecting)
  useEffect(() => {
    if (socketRef.current?.connected) {
      // Clean up old handlers
      cleanupEvents();

      // Attach new handlers
      Object.entries(events).forEach(([event, handler]) => {
        if (handler && typeof handler === "function") {
          socketRef.current.on(event, handler);
        }
      });
    }
  }, [events, cleanupEvents]);

  return { isConnected, socket: socketRef.current };
}

export default useSocket;
