# Survey API Documentation

## Overview

The Survey API allows users to attach polls/surveys to their posts. Surveys can be either single-choice or multiple-choice, with 2-16 options. Responses are tracked by IP address to prevent duplicate voting and allow vote changes.

## Key Features

- **Survey Types**: Single choice or multiple choice
- **Options**: 2-16 options per survey
- **Vote Tracking**: By IP address (one vote per IP)
- **Vote Updates**: Users can change their vote
- **Real-time Updates**: Socket.io events for live results
- **Correlations**: View option correlations for multiple choice surveys
- **Expiration**: Optional expiration dates for surveys

## API Endpoints

### 1. Create Survey

**POST** `/api/boards/:boardId/threads/:threadId/posts/:postId/survey`

Creates a survey attached to a post. Only the post owner can attach a survey.

**Request Body:**

```json
{
  "survey_type": "single" | "multiple",
  "question": "What is your favorite color?",
  "options": [
    "Red",
    "Blue",
    "Green",
    "Yellow"
  ],
  "expires_at": "2024-12-31T23:59:59Z" // Optional
}
```

**Response:**

```json
{
  "message": "Survey created successfully",
  "survey": {
    "id": 123,
    "post_id": 456,
    "thread_id": 789,
    "board_id": "tech",
    "survey_type": "single",
    "question": "What is your favorite color?",
    "created_at": "2024-01-15T10:00:00Z",
    "expires_at": null,
    "is_active": true,
    "options": [
      { "id": 1, "option_text": "Red", "option_order": 1 },
      { "id": 2, "option_text": "Blue", "option_order": 2 },
      { "id": 3, "option_text": "Green", "option_order": 3 },
      { "id": 4, "option_text": "Yellow", "option_order": 4 }
    ]
  }
}
```

### 2. Get Survey

**GET** `/api/boards/:boardId/threads/:threadId/posts/:postId/survey`

Retrieves the survey attached to a post, including the user's current response if they've voted.

**Response:**

```json
{
  "survey": {
    "id": 123,
    "post_id": 456,
    "thread_id": 789,
    "board_id": "tech",
    "survey_type": "single",
    "question": "What is your favorite color?",
    "created_at": "2024-01-15T10:00:00Z",
    "expires_at": null,
    "is_active": true,
    "is_expired": false,
    "options": [
      { "id": 1, "option_text": "Red", "option_order": 1 },
      { "id": 2, "option_text": "Blue", "option_order": 2 },
      { "id": 3, "option_text": "Green", "option_order": 3 },
      { "id": 4, "option_text": "Yellow", "option_order": 4 }
    ],
    "user_response": {
      "response_id": 789,
      "selected_options": [2],
      "created_at": "2024-01-15T11:00:00Z",
      "updated_at": "2024-01-15T11:00:00Z"
    }
  }
}
```

### 3. Submit/Update Vote

**POST** `/api/boards/:boardId/surveys/:surveyId/vote`

Submit or update a vote. For single-choice surveys, provide exactly one option ID. For multiple-choice, provide 1-16 option IDs.

**Request Body:**

```json
{
  "option_ids": [1]  // Single choice
}
// OR
{
  "option_ids": [1, 3, 4]  // Multiple choice
}
```

**Response:**

```json
{
  "message": "Vote submitted successfully",
  "response": {
    "response_id": 789,
    "survey_id": 123,
    "option_ids": [1],
    "is_update": false
  }
}
```

### 4. Get Survey Results

**GET** `/api/boards/:boardId/surveys/:surveyId/results`

Retrieves current survey results with vote counts and percentages.

**Response:**

```json
{
  "results": {
    "id": 123,
    "post_id": 456,
    "thread_id": 789,
    "board_id": "tech",
    "survey_type": "single",
    "question": "What is your favorite color?",
    "created_at": "2024-01-15T10:00:00Z",
    "expires_at": null,
    "is_active": true,
    "total_responses": 42,
    "results": [
      {
        "option_id": 1,
        "option_text": "Red",
        "option_order": 1,
        "vote_count": 15,
        "percentage": 35.71
      },
      {
        "option_id": 2,
        "option_text": "Blue",
        "option_order": 2,
        "vote_count": 20,
        "percentage": 47.62
      },
      {
        "option_id": 3,
        "option_text": "Green",
        "option_order": 3,
        "vote_count": 5,
        "percentage": 11.9
      },
      {
        "option_id": 4,
        "option_text": "Yellow",
        "option_order": 4,
        "vote_count": 2,
        "percentage": 4.76
      }
    ]
  }
}
```

### 5. Get Survey Correlations (Multiple Choice Only)

**GET** `/api/boards/:boardId/surveys/:surveyId/correlations`

For multiple choice surveys, shows how often different options are selected together.

**Response:**

```json
{
  "survey_id": 123,
  "survey_type": "multiple",
  "correlations": [
    {
      "option1": { "id": 1, "text": "JavaScript" },
      "option2": { "id": 3, "text": "React" },
      "co_occurrence_count": 25,
      "correlation_percentage": 59.52
    },
    {
      "option1": { "id": 2, "text": "Python" },
      "option2": { "id": 5, "text": "Django" },
      "co_occurrence_count": 18,
      "correlation_percentage": 42.86
    }
  ]
}
```

### 6. Get All Board Surveys

**GET** `/api/boards/:boardId/surveys`

Retrieves all active surveys for a board.

**Response:**

```json
{
  "board_id": "tech",
  "surveys": [
    {
      "id": 123,
      "post_id": 456,
      "thread_id": 789,
      "survey_type": "single",
      "question": "What is your favorite color?",
      "created_at": "2024-01-15T10:00:00Z",
      "expires_at": null,
      "is_active": true,
      "response_count": 42
    },
    {
      "id": 124,
      "post_id": 457,
      "thread_id": 790,
      "survey_type": "multiple",
      "question": "Which programming languages do you use?",
      "created_at": "2024-01-14T15:30:00Z",
      "expires_at": "2024-02-14T15:30:00Z",
      "is_active": true,
      "response_count": 28
    }
  ]
}
```

## Socket.io Events

When a vote is submitted or updated, the following events are emitted:

**Event:** `survey_vote`

**Rooms:** Board room and Thread room

**Payload:**

```json
{
  "surveyId": 123,
  "boardId": "tech",
  "threadId": 789 // Only in thread room
}
```

## Integration with Posts

When fetching posts via `/api/boards/:boardId/threads/:threadId/posts`, posts with surveys will include basic survey info:

```json
{
  "posts": [
    {
      "id": 456,
      "content": "What's your favorite color?",
      "image_url": null,
      "created_at": "2024-01-15T10:00:00Z",
      "survey": {
        "survey_id": 123,
        "survey_type": "single",
        "question": "What is your favorite color?",
        "response_count": 42
      }
    }
  ]
}
```

## Error Codes

- **400**: Invalid input (wrong survey type, invalid options count, expired survey)
- **403**: Not authorized (not post owner, wrong board)
- **404**: Survey or post not found
- **409**: Post already has a survey

## Frontend Implementation Tips

1. **Creating Surveys:**

   - Show survey creation UI only to post owners when creating a new post
   - Validate 2-16 options on frontend before submission
   - Allow setting optional expiration date/time

2. **Displaying Surveys:**

   - Check `user_response` to show user's current selection
   - Disable voting UI if `is_expired` is true
   - Use Socket.io to update results in real-time

3. **Voting:**

   - For single choice, use radio buttons
   - For multiple choice, use checkboxes with validation
   - Show loading state during vote submission
   - Update UI immediately on successful vote

4. **Results Display:**

   - Show percentage bars for visual representation
   - Display total vote count
   - For multiple choice, consider showing correlations in a separate view
   - Update results when receiving `survey_vote` socket event

5. **Real-time Updates:**
   ```javascript
   socket.on("survey_vote", (data) => {
     if (data.surveyId === currentSurveyId) {
       // Refetch survey results
       fetchSurveyResults(data.surveyId);
     }
   });
   ```

## Example Frontend Flow

```javascript
// 1. Create survey with post
const createPostWithSurvey = async (postData, surveyData) => {
  // First create the post
  const postResponse = await fetch(
    `/api/boards/${boardId}/threads/${threadId}/posts`,
    {
      method: "POST",
      body: postData,
    }
  );
  const { postId } = await postResponse.json();

  // Then attach the survey
  const surveyResponse = await fetch(
    `/api/boards/${boardId}/threads/${threadId}/posts/${postId}/survey`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(surveyData),
    }
  );
  return await surveyResponse.json();
};

// 2. Vote on survey
const vote = async (surveyId, selectedOptions) => {
  const response = await fetch(
    `/api/boards/${boardId}/surveys/${surveyId}/vote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_ids: selectedOptions }),
    }
  );
  return await response.json();
};

// 3. Get live results
const getResults = async (surveyId) => {
  const response = await fetch(
    `/api/boards/${boardId}/surveys/${surveyId}/results`
  );
  return await response.json();
};
```
