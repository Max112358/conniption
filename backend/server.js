const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store our counter value
let counter = 0;

// API endpoint to get the current counter value
app.get("/api/counter", (req, res) => {
  res.json({ counter });
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("New client connected");

  // Send current counter value to newly connected client
  socket.emit("counterUpdate", { counter });

  // Handle increment requests
  socket.on("increment", () => {
    counter += 1;
    io.emit("counterUpdate", { counter });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
