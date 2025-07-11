# Updated API Documentation for Conniption Imageboard

## 1. Boards API Guide

### Overview

The Boards API manages the main boards/categories where threads are organized. Each board has its own settings for features like thread IDs and country flags.

### Endpoints

#### Get All Boards

**GET** `/api/boards`

Returns a list of all available boards.

**Response:**

```json
{
  "boards": [
    {
      "id": "random",
      "name": "Random",
      "description": "Anything and Everything",
      "nsfw": true,
      "thread_ids_enabled": true,
      "country_flags_enabled": true
    },
    {
      "id": "tech",
      "name": "Technology",
      "description": "Technology, Computers, and Programming",
      "nsfw": false,
      "thread_ids_enabled": false,
      "country_flags_enabled": false
    }
  ]
}
```

#### Get Single Board

**GET** `/api/boards/:boardId`

Returns details for a specific board.

**Parameters:**

- `boardId` (string): The board identifier (e.g., "tech", "random")

**Response:**

```json
{
  "board": {
    "id": "tech",
    "name": "Technology",
    "description": "Technology, Computers, and Programming",
    "nsfw": false,
    "thread_ids_enabled": false,
    "country_flags_enabled": false
  }
}
```

**Error Responses:**

- `404`: Board not found

---

## 2. Threads API Guide

### Overview

Threads are the main discussion topics within boards. Each board maintains exactly 100 threads, with the oldest being automatically deleted when new ones are created.

### Endpoints

#### Get Board Threads

**GET** `/api/boards/:boardId/threads`

Returns all threads for a board, ordered by most recently updated.

**Parameters:**

- `boardId` (string): The board identifier

**Response:**

```json
{
  "threads": [
    {
      "id": 123,
      "topic": "What's your favorite programming language?",
      "created_at": "2024-01-20T10:00:00Z",
      "updated_at": "2024-01-20T15:30:00Z",
      "content": "I'm curious what languages everyone prefers and why.",
      "image_url": "https://cdn.example.com/image.jpg",
      "file_type": "image",
      "color": "black",
      "post_count": 25
    }
  ]
}
```

#### Create New Thread

**POST** `/api/boards/:boardId/threads`

Creates a new thread with an initial post. **Requires image/video upload.**

**Parameters:**

- `boardId` (string): The board identifier

**Request Format:**

```
Content-Type: multipart/form-data

topic: "Thread title here"
content: "Initial post content"
image: [FILE] (required - image or video file)
```

**File Requirements:**

- **Required**: Must include an image or video file
- **Supported formats**: PNG, JPG, JPEG, WebP, GIF, MP4, WebM
- **Max size**: 4MB
- **Field name**: `image`

**Response:**

```json
{
  "message": "Thread created successfully",
  "threadId": 124,
  "boardId": "tech"
}
```

**Error Responses:**

- `400`: Missing required fields (topic, content, or image)
- `400`: File size exceeds 4MB limit
- `400`: Invalid file type
- `403`: User is banned from this board
- `404`: Board not found

#### Get Single Thread

**GET** `/api/boards/:boardId/threads/:threadId`

Returns details for a specific thread (metadata only, not posts).

**Parameters:**

- `boardId` (string): The board identifier
- `threadId` (number): The thread ID

**Response:**

```json
{
  "thread": {
    "id": 123,
    "board_id": "tech",
    "topic": "What's your favorite programming language?",
    "created_at": "2024-01-20T10:00:00Z",
    "updated_at": "2024-01-20T15:30:00Z",
    "thread_salt": "abc123def456" // Used for thread IDs if enabled
  }
}
```

#### Delete Thread

**DELETE** `/api/boards/:boardId/threads/:threadId`

Deletes a thread. Can be done by the original creator (IP match) or admin users.

**Authorization:**

- **Thread creator**: Automatically authorized by IP address match
- **Admin users**: Must be logged in with appropriate permissions

**Request Body (optional for admin moderation):**

```json
{
  "reason": "Violation of board rules" // Creates moderation log entry
}
```

**Response:**

```json
{
  "message": "Thread deleted successfully",
  "deletedBy": "owner" // or "admin-direct" or "admin-moderation"
}
```

**Error Responses:**

- `403`: Not authorized to delete this thread
- `404`: Thread not found

---

## 3. Posts API Guide

### Overview

Posts are individual messages within threads. Posts can include text content and/or media attachments. When a post is created, it bumps the thread to the top of the board.

### Endpoints

#### Get Thread Posts

**GET** `/api/boards/:boardId/threads/:threadId/posts`

Returns all posts in a thread, ordered chronologically.

**Parameters:**

- `boardId` (string): The board identifier
- `threadId` (number): The thread ID
- `includeSurveys` (query, optional): Include survey data (default: "true")

**Response:**

```json
{
  "posts": [
    {
      "id": 456,
      "content": "This is a great question!",
      "image_url": "https://cdn.example.com/image.jpg",
      "file_type": "image",
      "created_at": "2024-01-20T10:05:00Z",
      "thread_user_id": "abc12345", // If thread IDs enabled
      "country_code": "US", // If country flags enabled
      "color": "black",
      "isBanned": false,
      "banInfo": null,
      "survey": {
        // If post has attached survey
        "survey_id": 789,
        "survey_type": "single",
        "question": "Which framework do you prefer?",
        "response_count": 15
      }
    }
  ]
}
```

#### Create New Post

**POST** `/api/boards/:boardId/threads/:threadId/posts`

Creates a new post in a thread. Either content or media is required.

**Parameters:**

- `boardId` (string): The board identifier
- `threadId` (number): The thread ID

**Request Format:**

```
Content-Type: multipart/form-data

content: "Post content here" (optional if image provided)
image: [FILE] (optional - image or video file)
```

**File Requirements (if provided):**

- **Supported formats**: PNG, JPG, JPEG, WebP, GIF, MP4, WebM
- **Max size**: 4MB
- **Field name**: `image`

**Response:**

```json
{
  "message": "Post created successfully",
  "postId": 457,
  "threadId": 123,
  "boardId": "tech"
}
```

**Error Responses:**

- `400`: Missing both content and image
- `400`: File size exceeds 4MB limit
- `400`: Invalid file type
- `403`: User is banned from this board
- `404`: Thread or board not found

#### Delete Post

**DELETE** `/api/boards/:boardId/threads/:threadId/posts/:postId`

Deletes a post. Can be done by the original creator (IP match) or admin users.

**Parameters:**

- `boardId` (string): The board identifier
- `threadId` (number): The thread ID
- `postId` (number): The post ID

**Authorization:**

- **Post creator**: Automatically authorized by IP address match
- **Admin users**: Must be logged in with appropriate permissions

**Request Body (optional for admin moderation):**

```json
{
  "reason": "Inappropriate content" // Creates moderation log entry
}
```

**Response:**

```json
{
  "message": "Post deleted successfully",
  "deletedBy": "owner" // or "admin-direct" or "admin-moderation"
}
```

**Error Responses:**

- `403`: Not authorized to delete this post
- `404`: Post not found

---

## 4. Surveys API Guide (Updated)

### Overview

Surveys allow users to attach polls to their posts. Only the post creator can attach a survey, and each post can have only one survey.

### Key Features

- **Survey Types**: Single choice or multiple choice
- **Options**: 2-16 options per survey
- **Vote Tracking**: By IP address (one vote per IP)
- **Vote Updates**: Users can change their vote
- **Real-time Updates**: Socket.io events for live results
- **Expiration**: Optional expiration dates

### Endpoints

#### Create Survey

**POST** `/api/boards/:boardId/threads/:threadId/posts/:postId/survey`

Attaches a survey to a post. Only the post owner can do this.

**Request Body:**

```json
{
  "survey_type": "single", // or "multiple"
  "question": "What is your favorite programming language?",
  "options": ["JavaScript", "Python", "Java", "C++"],
  "expires_at": "2024-12-31T23:59:59Z" // Optional
}
```

**Response:**

```json
{
  "message": "Survey created successfully",
  "survey": {
    "id": 789,
    "post_id": 456,
    "thread_id": 123,
    "board_id": "tech",
    "survey_type": "single",
    "question": "What is your favorite programming language?",
    "created_at": "2024-01-20T10:30:00Z",
    "expires_at": null,
    "is_active": true,
    "options": [
      { "id": 1, "option_text": "JavaScript", "option_order": 1 },
      { "id": 2, "option_text": "Python", "option_order": 2 },
      { "id": 3, "option_text": "Java", "option_order": 3 },
      { "id": 4, "option_text": "C++", "option_order": 4 }
    ]
  }
}
```

#### Get Survey

**GET** `/api/boards/:boardId/threads/:threadId/posts/:postId/survey`

Gets the survey attached to a post, including user's current vote if any.

**Response:**

```json
{
  "survey": {
    "id": 789,
    "post_id": 456,
    "survey_type": "single",
    "question": "What is your favorite programming language?",
    "is_expired": false,
    "options": [
      { "id": 1, "option_text": "JavaScript", "option_order": 1 },
      { "id": 2, "option_text": "Python", "option_order": 2 }
    ],
    "user_response": {
      // If user has voted
      "response_id": 123,
      "selected_options": [1],
      "created_at": "2024-01-20T11:00:00Z"
    }
  }
}
```

#### Submit Vote

**POST** `/api/boards/:boardId/surveys/:surveyId/vote`

Submit or update a vote on a survey.

**Request Body:**

```json
{
  "option_ids": [1] // Single choice
}
// OR for multiple choice:
{
  "option_ids": [1, 3, 4] // Multiple options
}
```

**Response:**

```json
{
  "message": "Vote submitted successfully",
  "response": {
    "response_id": 456,
    "survey_id": 789,
    "option_ids": [1],
    "is_update": false
  }
}
```

#### Get Survey Results

**GET** `/api/boards/:boardId/surveys/:surveyId/results`

Get current results for a survey.

**Response:**

```json
{
  "results": {
    "id": 789,
    "question": "What is your favorite programming language?",
    "total_responses": 42,
    "results": [
      {
        "option_id": 1,
        "option_text": "JavaScript",
        "vote_count": 15,
        "percentage": 35.71
      },
      {
        "option_id": 2,
        "option_text": "Python",
        "vote_count": 20,
        "percentage": 47.62
      }
    ]
  }
}
```

#### Get Survey Correlations (Multiple Choice Only)

**GET** `/api/boards/:boardId/surveys/:surveyId/correlations`

Shows how often different options are selected together in multiple choice surveys.

**Response:**

```json
{
  "survey_id": 789,
  "survey_type": "multiple",
  "correlations": [
    {
      "option1": { "id": 1, "text": "JavaScript" },
      "option2": { "id": 3, "text": "React" },
      "co_occurrence_count": 25,
      "correlation_percentage": 59.52
    }
  ]
}
```

#### Get All Board Surveys

**GET** `/api/boards/:boardId/surveys`

Get all active surveys for a board.

**Response:**

```json
{
  "board_id": "tech",
  "surveys": [
    {
      "id": 789,
      "post_id": 456,
      "thread_id": 123,
      "survey_type": "single",
      "question": "What is your favorite programming language?",
      "response_count": 42
    }
  ]
}
```

---

## 5. WebSocket Events

### Overview

The application uses Socket.io for real-time updates. Clients should join rooms for boards and threads they're viewing.

### Room Management

#### Join Board Room

```javascript
socket.emit("join_board", "tech");
```

#### Join Thread Room

```javascript
socket.emit("join_thread", { boardId: "tech", threadId: 123 });
```

#### Leave Rooms

```javascript
socket.emit("leave_board", "tech");
socket.emit("leave_thread", { boardId: "tech", threadId: 123 });
```

### Events

#### Thread Created

**Event:** `thread_created`

```javascript
{
  "threadId": 124,
  "boardId": "tech",
  "topic": "New thread title"
}
```

#### Thread Deleted

**Event:** `thread_deleted`

```javascript
{
  "threadId": 123,
  "boardId": "tech"
}
```

#### Post Created

**Event:** `post_created`

```javascript
{
  "postId": 457,
  "threadId": 123,
  "boardId": "tech"
}
```

#### Post Deleted

**Event:** `post_deleted`

```javascript
{
  "postId": 456,
  "threadId": 123,
  "boardId": "tech"
}
```

#### Post Color Changed

**Event:** `post_color_changed`

```javascript
{
  "postId": 456,
  "threadId": 123,
  "boardId": "tech",
  "color": "red"
}
```

#### Survey Vote

**Event:** `survey_vote`

```javascript
{
  "surveyId": 789,
  "boardId": "tech",
  "threadId": 123
}
```

---

## 6. Error Handling

### Standard Error Response Format

```json
{
  "error": "Error message here",
  "details": "Additional error details (development only)"
}
```

### Common HTTP Status Codes

- `200`: Success
- `201`: Resource created successfully
- `400`: Bad request (invalid input)
- `401`: Unauthorized (admin login required)
- `403`: Forbidden (banned or insufficient permissions)
- `404`: Resource not found
- `409`: Conflict (duplicate resource)
- `500`: Internal server error

### Ban Response Format

When a user is banned, they receive a 403 with additional ban information:

```json
{
  "error": "You are banned from this board",
  "message": "You are banned from this board permanently. Reason: Spam",
  "ban": {
    "id": 123,
    "reason": "Spam",
    "expires_at": null,
    "appeal_status": "none",
    "canAppeal": true
  }
}
```

### Range Ban Response Format

When a user's country is range banned:

```json
{
  "error": "Country Rangebanned",
  "message": "United States is range banned permanently. Sorry, but your country is not allowed to post on this site.",
  "rangeban": {
    "type": "country",
    "value": "US",
    "country_name": "United States",
    "reason": "Spam prevention",
    "expires_at": null
  }
}
```

---

## 7. File Upload Guidelines

### Supported File Types

- **Images**: PNG, JPG, JPEG, WebP, GIF
- **Videos**: MP4, WebM

### File Size Limits

- **Maximum size**: 4MB per file
- **Encoding**: Files are stored on Cloudflare R2 with public URLs

### Upload Process

1. Files are uploaded via `multipart/form-data`
2. Server validates file type and size
3. Files are stored on R2 with unique names
4. Public URLs are returned in responses
5. Files are automatically deleted when posts/threads are removed

### File URL Format

All file URLs follow this pattern:

```
https://conniption.xyz/[unique-filename].[extension]
```

---

## 8. Security & Rate Limiting

### Authentication

- **Public endpoints**: No authentication required for posting/viewing
- **Admin endpoints**: Session-based authentication required
- **IP-based ownership**: Users can delete their own content based on IP matching

### IP Address Detection

The server uses multiple headers to detect real IP addresses:

1. `CF-Connecting-IP` (Cloudflare)
2. `True-Client-IP` (Cloudflare Enterprise)
3. `X-Real-IP` (Reverse proxy)
4. `X-Forwarded-For` (Standard proxy header)

### Ban Enforcement

- **IP bans**: Prevent specific IP addresses from posting
- **Range bans**: Block entire countries or IP ranges
- **Board-specific**: Bans can be global or limited to specific boards
- **Appeals**: Users can appeal bans through the appeals system

---

## 9. Board Features

### Thread IDs

When enabled on a board:

- Each user gets a unique 8-character ID per thread
- IDs are consistent for the same user within a thread
- Generated using IP address + thread salt + secret key
- Helps identify users without exposing IP addresses

### Country Flags

When enabled on a board:

- User's country is detected via IP geolocation
- Two-letter country codes are stored (e.g., "US", "GB")
- Special codes: "LO" (local/private IP), "CF" (Cloudflare IP)
- Can be used for analytics or moderation

### NSFW Boards

- Some boards are marked as NSFW (Not Safe For Work)
- This is informational only - no special restrictions applied
- Frontend should display appropriate warnings

---

## 10. Development Notes

### API Base URL

- **Production**: `https://conniption.onrender.com/api`
- **Local development**: `http://localhost:5000/api`

### CORS Configuration

The API allows requests from:

- `https://conniption.pages.dev` (Cloudflare Pages)
- `https://conniption.xyz` (Custom domain)

### Session Configuration

- **Session duration**: 24 hours
- **Cookie settings**: HttpOnly, Secure (production), SameSite
- **Storage**: PostgreSQL via connect-pg-simple

### Database Cleanup

- **Thread limit**: 100 threads per board (oldest deleted automatically)
- **File cleanup**: Orphaned files are removed via scheduled housekeeping
- **Image deletion**: Images are automatically deleted when posts/threads are removed

This completes the updated API documentation. The guides now include all the survey functionality and provide comprehensive information for frontend development.
