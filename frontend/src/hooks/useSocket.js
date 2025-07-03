// frontend/src/hooks/useSocket.js

import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/api";

export default function useSocket(roomType, roomId, options = {}) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;

    console.log(`Setting up Socket.io connection for ${roomType}:`, roomId);

    const socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      path: "/socket.io/",
      forceNew: true,
      rejectUnauthorized: false,
      ...options,
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on("connect", () => {
      console.log("Socket.io connected successfully");
      setConnected(true);

      // Join the appropriate room
      if (roomType === "board") {
        socket.emit("join_board", roomId);
      } else if (roomType === "thread") {
        const { boardId, threadId } = roomId;
        socket.emit("join_thread", { boardId, threadId });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.io disconnected:", reason);
      setConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.io connection error:", error.message);
      setConnected(false);
    });

    // Cleanup
    return () => {
      console.log(`Cleaning up Socket.io connection for ${roomType}:`, roomId);
      if (socket.connected) {
        if (roomType === "board") {
          socket.emit("leave_board", roomId);
        } else if (roomType === "thread") {
          const { boardId, threadId } = roomId;
          socket.emit("leave_thread", { boardId, threadId });
        }
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomType, roomId, options]);

  return {
    socket: socketRef.current,
    connected,
    emit: (event, data) => socketRef.current?.emit(event, data),
    on: (event, handler) => {
      socketRef.current?.on(event, handler);
      return () => socketRef.current?.off(event, handler);
    },
    off: (event, handler) => socketRef.current?.off(event, handler),
  };
}
