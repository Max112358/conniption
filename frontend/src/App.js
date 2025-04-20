import { useState, useEffect } from "react";
import { io } from "socket.io-client";

export default function CounterApp() {
  const [counter, setCounter] = useState(0);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to the backend server
    //const newSocket = io("http://localhost:5000"); // Use this for local development
    // For Render deployment, use the following line:
    const newSocket = io("https://conniption.onrender.com");

    setSocket(newSocket);

    // Listen for connection events
    newSocket.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to server");
    });

    // Listen for counter updates
    newSocket.on("counterUpdate", (data) => {
      setCounter(data.counter);
    });

    // Clean up socket connection on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Function to increment counter
  const incrementCounter = () => {
    if (socket) {
      socket.emit("increment");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold mb-6">Shared Counter</h1>

        <div className="mb-6">
          <div className="text-6xl font-bold mb-2">{counter}</div>
          <div className="text-gray-500">
            {isConnected
              ? "Connected to server - all users see this number"
              : "Connecting to server..."}
          </div>
        </div>

        <button
          onClick={incrementCounter}
          disabled={!isConnected}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Increment Counter
        </button>
      </div>
    </div>
  );
}
