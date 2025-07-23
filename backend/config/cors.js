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
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (FRONTEND_DOMAINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-CSRF-Token", // Added this to allow CSRF token headers
  ],
};

// Create middleware function
const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware;
module.exports.corsOptions = corsOptions;
module.exports.FRONTEND_DOMAINS = FRONTEND_DOMAINS;
