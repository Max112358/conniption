// backend/config/cors.js
const cors = require("cors");

// Define the frontend domain in one place
const FRONTEND_DOMAIN =
  process.env.FRONTEND_DOMAIN || "https://conniption.pages.dev";

console.log(`CORS config: Frontend domain set to ${FRONTEND_DOMAIN}`);

// CORS options object that can be reused for Express and Socket.io
const corsOptions = {
  origin: FRONTEND_DOMAIN,
  methods: ["GET", "POST"],
  credentials: true,
};

// Create middleware function
const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware;
module.exports.corsOptions = corsOptions;
module.exports.FRONTEND_DOMAIN = FRONTEND_DOMAIN;
