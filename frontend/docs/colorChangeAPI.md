# Post Color Change API Guide

## Overview

The post color change feature allows administrators and moderators (but NOT janitors) to change the color of posts for moderation purposes. This can be used to highlight important posts, warn users, or categorize content.

## Available Colors

The following colors are available:

- `black` (default)
- `red`
- `orange`
- `yellow`
- `green`
- `blue`
- `purple`
- `brown`

## API Endpoint

### Change Post Color

**Endpoint:** `PUT /api/admin/posts/:postId/color`

**Access:** Requires moderator or admin role (janitors cannot use this feature)

**Authentication:** Requires active admin session

### Request Format

```http
PUT /api/admin/posts/123/color
Content-Type: application/json

{
  "boardId": "tech",
  "threadId": 456,
  "color": "red",
  "reason": "Rule violation warning"
}
```

### Parameters

#### URL Parameters

- `postId` (required): The ID of the post to change color

#### Body Parameters

- `boardId` (required): The board ID where the post is located
- `threadId` (required): The thread ID where the post is located
- `color` (required): The new color for the post
- `reason` (optional): Reason for the color change (will be logged)

### Response Format

#### Success Response (200 OK)

```json
{
  "message": "Post color changed successfully",
  "post": {
    "id": 123,
    "content": "This is the post content",
    "image_url": "https://cdn.example.com/image.jpg",
    "created_at": "2024-01-20T10:30:00Z",
    "color": "red",
    "thread_user_id": "abc123",
    "country_code": "US"
  }
}
```

#### Error Responses

**400 Bad Request** - Missing required fields

```json
{
  "error": "Missing required fields",
  "required": ["boardId", "threadId", "color"]
}
```

**400 Bad Request** - Invalid color

```json
{
  "error": "Invalid color",
  "allowed": [
    "black",
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "brown"
  ]
}
```

**403 Forbidden** - Not authorized

```json
{
  "error": "Not authorized to moderate this board"
}
```

**404 Not Found** - Post not found

```json
{
  "error": "Post not found"
}
```

## Usage Examples

### Using cURL

```bash
# Change a post to red
curl -X PUT https://api.example.com/api/admin/posts/123/color \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your-session-cookie" \
  -d '{
    "boardId": "tech",
    "threadId": 456,
    "color": "red",
    "reason": "Violation of rule #3"
  }'
```

### Using JavaScript (Frontend)

```javascript
async function changePostColor(postId, boardId, threadId, color, reason) {
  try {
    const response = await fetch(`/api/admin/posts/${postId}/color`, {
      method: "PUT",
      credentials: "include", // Include session cookie
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        boardId,
        threadId,
        color,
        reason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const data = await response.json();
    console.log("Post color changed:", data);
    return data;
  } catch (error) {
    console.error("Failed to change post color:", error);
    throw error;
  }
}

// Example usage
changePostColor(123, "tech", 456, "yellow", "Important announcement")
  .then((result) => {
    console.log("Color changed successfully");
  })
  .catch((error) => {
    console.error("Error:", error.message);
  });
```

## WebSocket Events

When a post color is changed, the following WebSocket event is emitted to all clients in the thread and board rooms:

### Event: `post_color_changed`

```javascript
{
  "postId": 123,
  "threadId": 456,
  "boardId": "tech",
  "color": "red"
}
```

Frontend clients should listen for this event to update the post color in real-time without requiring a page refresh.

## Moderation Logging

Every color change is logged in the moderation_actions table with:

- Action type: `change_post_color`
- Admin user who made the change
- Original and new color in the reason field
- Timestamp of the change
- IP address of the post author

## Database Changes

### Posts Table

- Added `color` column with VARCHAR(20) type
- Default value: `'black'`
- CHECK constraint ensures only valid colors are stored

### Moderation Actions

- Added `'change_post_color'` to the allowed action types

## Security Considerations

1. **Role-based Access**: Only moderators and admins can change post colors. Janitors are explicitly excluded.
2. **Board Permissions**: Moderators can only change colors in boards they have permission to moderate.
3. **Audit Trail**: All color changes are logged with the admin user, timestamp, and reason.
4. **Input Validation**: The API validates that only allowed colors can be set.

## Best Practices

1. **Use Colors Consistently**: Establish guidelines for when to use each color

   - Red: Serious violations or warnings
   - Yellow: Cautions or important notices
   - Green: Approved or verified content
   - Blue: Informational posts
   - Orange: Temporary warnings
   - Purple: Special announcements
   - Brown: Archived or outdated content

2. **Always Provide a Reason**: While optional, providing a reason helps maintain transparency in moderation actions.

3. **Monitor Color Changes**: Regularly review the moderation logs to ensure colors are being used appropriately.

4. **Communicate with Users**: Consider having a legend or guide visible to users explaining what different colors mean.

## Frontend Implementation Notes

When implementing the frontend:

1. **CSS Classes**: Create CSS classes for each color (e.g., `.post-color-red`, `.post-color-yellow`)
2. **Real-time Updates**: Listen for the `post_color_changed` WebSocket event
3. **Visual Feedback**: Show a brief animation when a color changes
4. **Accessibility**: Ensure color changes don't rely solely on color (add icons or borders for colorblind users)

## Error Handling

Always handle potential errors gracefully:

```javascript
try {
  await changePostColor(postId, boardId, threadId, color, reason);
} catch (error) {
  if (error.message.includes("Not authorized")) {
    showError("You do not have permission to change post colors in this board");
  } else if (error.message.includes("Invalid color")) {
    showError("Please select a valid color");
  } else {
    showError("Failed to change post color. Please try again.");
  }
}
```
