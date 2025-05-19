// loadtest/load-test.js
import http from "k6/http";
import { sleep, check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom metrics
const boardFetchErrors = new Counter("board_fetch_errors");
const threadFetchErrors = new Counter("thread_fetch_errors");
const postFetchErrors = new Counter("post_fetch_errors");
const successRate = new Rate("success_rate");
const boardFetchTrend = new Trend("board_fetch_time");
const threadFetchTrend = new Trend("thread_fetch_time");
const postFetchTrend = new Trend("post_fetch_time");

// Test configuration - override with k6 run -e API_BASE_URL=... load-test.js
const API_BASE_URL = __ENV.API_BASE_URL || "https://conniption.onrender.com";

// Test stages
export const options = {
  stages: [
    { duration: "1m", target: 20 }, // Ramp up to 20 users over 1 minute
    { duration: "3m", target: 20 }, // Stay at 20 users for 3 minutes
    { duration: "1m", target: 50 }, // Ramp up to 50 users over 1 minute
    { duration: "3m", target: 50 }, // Stay at 50 users for 3 minutes
    { duration: "1m", target: 0 }, // Ramp down to 0 users over 1 minute
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests should be below 500ms
    success_rate: ["rate>0.95"], // 95% of requests should succeed
  },
};

// List of boards to test
const boards = ["tech", "random", "gaming", "anime", "music"];

// Main test function
export default function () {
  // Get all boards
  let boardsResponse = http.get(`${API_BASE_URL}/api/boards`);

  // Record metrics for boards fetch
  boardFetchTrend.add(boardsResponse.timings.duration);

  // Check if boards request succeeded
  const boardsSuccess = check(boardsResponse, {
    "boards status is 200": (r) => r.status === 200,
    "boards has data": (r) => r.json().boards && r.json().boards.length > 0,
  });

  // Record success/failure
  successRate.add(boardsSuccess);

  if (!boardsSuccess) {
    boardFetchErrors.add(1);
    console.error(`Failed to fetch boards: ${boardsResponse.status}`);
    return;
  }

  // Randomly select a board
  const randomBoard = boards[Math.floor(Math.random() * boards.length)];

  // Get threads for the selected board
  let threadsResponse = http.get(
    `${API_BASE_URL}/api/boards/${randomBoard}/threads`
  );

  // Record metrics for threads fetch
  threadFetchTrend.add(threadsResponse.timings.duration);

  // Check if threads request succeeded
  const threadsSuccess = check(threadsResponse, {
    "threads status is 200": (r) => r.status === 200,
    "threads has data": (r) => r.json().threads !== undefined,
  });

  // Record success/failure
  successRate.add(threadsSuccess);

  if (!threadsSuccess) {
    threadFetchErrors.add(1);
    console.error(`Failed to fetch threads: ${threadsResponse.status}`);
    return;
  }

  // Get thread data
  let threadData = threadsResponse.json();

  // If there are threads, select one randomly and fetch its posts
  if (threadData.threads && threadData.threads.length > 0) {
    // Randomly select a thread
    const randomThread =
      threadData.threads[Math.floor(Math.random() * threadData.threads.length)];

    // Get posts for the selected thread
    let postsResponse = http.get(
      `${API_BASE_URL}/api/boards/${randomBoard}/threads/${randomThread.id}/posts`
    );

    // Record metrics for posts fetch
    postFetchTrend.add(postsResponse.timings.duration);

    // Check if posts request succeeded
    const postsSuccess = check(postsResponse, {
      "posts status is 200": (r) => r.status === 200,
      "posts has data": (r) => r.json().posts !== undefined,
    });

    // Record success/failure
    successRate.add(postsSuccess);

    if (!postsSuccess) {
      postFetchErrors.add(1);
      console.error(`Failed to fetch posts: ${postsResponse.status}`);
    }
  }

  // Sleep between iterations
  sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}
