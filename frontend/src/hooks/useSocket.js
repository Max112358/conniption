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
  const currentRoom = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  // Store event handlers in a ref
  const eventHandlersRef = useRef(events);

  // Update event handlers ref when they change
  useEffect(() => {
    eventHandlersRef.current = events;
  }, [events]);

  // Create stable event handler wrappers that always call the latest version
  const stableEventHandlers = useRef({});

  // Memoize the event handler to prevent unnecessary re-renders
  const handleConnect = useCallback(() => {
    console.log(`Socket connected to room: ${room}`);
    setIsConnected(true);
    isConnecting.current = false;
    reconnectAttempts.current = 0;

    // Join room after connection
    if (room && socketRef.current) {
      socketRef.current.emit("join_board", room);
    }
  }, [room]);

  const handleDisconnect = useCallback(
    (reason) => {
      console.log(`Socket disconnected from room ${room}:`, reason);
      setIsConnected(false);
      isConnecting.current = false;
    },
    [room]
  );

  const handleConnectError = useCallback((error) => {
    console.error("Socket connection error:", error.message || error);
    setIsConnected(false);
    isConnecting.current = false;

    // Increment reconnect attempts
    reconnectAttempts.current++;

    // If we've exceeded max attempts, stop trying
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log(
        `Max reconnection attempts (${maxReconnectAttempts}) reached. Stopping reconnection.`
      );
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    }
  }, []);

  // Main effect - only depends on room and enabled
  useEffect(() => {
    // Skip if not enabled
    if (!enabled) {
      // If we have a socket and it's disabled, disconnect it
      if (socketRef.current?.connected) {
        console.log(`Disconnecting socket for room: ${room} (disabled)`);
        if (room) {
          socketRef.current.emit("leave_board", room);
        }
        socketRef.current.disconnect();
        socketRef.current = null;
        currentRoom.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Skip if already connecting
    if (isConnecting.current) {
      return;
    }

    // If we already have a connected socket for this room, don't recreate
    if (socketRef.current?.connected && currentRoom.current === room) {
      return;
    }

    // If we have a socket for a different room, clean it up first
    if (socketRef.current && currentRoom.current !== room) {
      console.log(
        `Cleaning up previous socket for room: ${currentRoom.current}`
      );

      // Leave the old room
      if (currentRoom.current) {
        socketRef.current.emit("leave_board", currentRoom.current);
      }

      // Disconnect the old socket
      socketRef.current.disconnect();
      socketRef.current = null;
      currentRoom.current = null;
    }

    // Don't create a new connection if we're at max attempts
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      return;
    }

    isConnecting.current = true;
    console.log(`Creating new socket connection for room: ${room}`);

    // Create new socket connection with optimized settings
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    socketRef.current = socket;
    currentRoom.current = room;

    // Connection event handlers
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    // Create stable wrappers for custom events that always call the latest handler
    Object.keys(eventHandlersRef.current).forEach((eventName) => {
      const stableHandler = (...args) => {
        const currentHandler = eventHandlersRef.current[eventName];
        if (currentHandler && typeof currentHandler === "function") {
          currentHandler(...args);
        }
      };
      stableEventHandlers.current[eventName] = stableHandler;
      socket.on(eventName, stableHandler);
    });

    // Cleanup function
    return () => {
      console.log(`Cleaning up socket for room: ${room}`);

      // Leave room before disconnecting
      if (room && socket.connected) {
        socket.emit("leave_board", room);
      }

      // Remove all event listeners
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      // Remove custom event handlers
      Object.entries(stableEventHandlers.current).forEach(
        ([eventName, handler]) => {
          socket.off(eventName, handler);
        }
      );

      // Disconnect socket
      socket.disconnect();

      // Clear refs only if this is the current socket
      if (socketRef.current === socket) {
        socketRef.current = null;
        currentRoom.current = null;
        isConnecting.current = false;
        reconnectAttempts.current = 0;
        stableEventHandlers.current = {};
      }
    };
  }, [room, enabled, handleConnect, handleDisconnect, handleConnectError]);

  return { isConnected, socket: socketRef.current };
}

export default useSocket;
