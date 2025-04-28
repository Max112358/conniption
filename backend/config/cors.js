// backend/config/cors.js
const cors = require("cors");

// Define the frontend domains in one place
const FRONTEND_DOMAINS = process.env.FRONTEND_DOMAINS
  ? process.env.FRONTEND_DOMAINS.split(",")
  : ["https://conniption.pages.dev", "https://conniption.xyz"];

console.log(
  `CORS config: Frontend domains set to ${FRONTEND_DOMAINS.join(", ")}`
);

// CORS options object that can be reused for Express and Socket.io
const corsOptions = {
  origin: FRONTEND_DOMAINS,
  methods: ["GET", "POST"],
  credentials: true,
};

// Create middleware function
const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware;
module.exports.corsOptions = corsOptions;
module.exports.FRONTEND_DOMAINS = FRONTEND_DOMAINS;
