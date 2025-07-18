// backend/config/threads.js
const threadConfig = {
  // Maximum number of posts before a thread stops bumping
  // Set to null or 0 to disable bump limit
  bumpLimit: 300,

  // Number of days to keep dead threads before deletion
  deadThreadRetentionDays: 2,

  // Maximum number of active threads per board
  maxThreadsPerBoard: 100,
};

module.exports = threadConfig;
