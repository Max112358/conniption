// frontend/src/hooks/useSocket.js
import { useEffect, useState, useRef } from "react";
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
  const currentRoom = useRef(null);

  useEffect(() => {
    // Skip if not enabled or already connecting
    if (!enabled || isConnecting.current) {
      return;
    }

    // If we already have a connected socket for this room, just update handlers
    if (socketRef.current?.connected && currentRoom.current === room) {
      // Remove old event handlers
      Object.keys(events).forEach((event) => {
        socketRef.current.off(event);
      });

      // Add new event handlers
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
    currentRoom.current = room;

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

      // Remove all event listeners
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");

      // Remove custom event handlers
      Object.keys(events).forEach((event) => {
        socket.off(event);
      });

      // Disconnect socket
      if (socket.connected) {
        socket.disconnect();
      }

      // Clear refs
      if (socketRef.current === socket) {
        socketRef.current = null;
        currentRoom.current = null;
      }
      isConnecting.current = false;
    };
  }, [room, enabled, events]);

  return { isConnected, socket: socketRef.current };
}

export default useSocket;
