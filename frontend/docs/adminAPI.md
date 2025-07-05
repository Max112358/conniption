# Admin API Guide

## Overview

This guide documents all administrative API endpoints for the imageboard. All endpoints require authentication and appropriate role permissions. The API uses session-based authentication with cookies.

## Authentication

### Login

**Endpoint:** `POST /api/admin/login`  
**Authentication:** None required  
**Body:**

```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**

```json
{
  "message": "Authentication successful",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "boards": [] // Empty array means access to all boards
  }
}
```

**Error Response (401):**

```json
{
  "error": "Invalid credentials"
}
```

### Logout

**Endpoint:** `GET /api/admin/logout`  
**Authentication:** Required  
**Response:**

```json
{
  "message": "Logout successful"
}
```

### Get Profile

**Endpoint:** `GET /api/admin/profile`  
**Authentication:** Required  
**Response:**

```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "boards": [],
    "created_at": "2024-01-01T00:00:00Z",
    "last_login": "2024-01-15T10:30:00Z",
    "is_active": true
  }
}
```

### Update Profile

**Endpoint:** `PUT /api/admin/profile`  
**Authentication:** Required  
**Body:**

```json
{
  "email": "newemail@example.com",
  "password": "newpassword123" // Optional
}
```

**Response:**

```json
{
  "message": "Profile updated successfully",
  "user": {
    // Updated user object
  }
}
```

## User Management (Admin Only)

### List All Admin Users

**Endpoint:** `GET /api/admin/users`  
**Authentication:** Admin only  
**Response:**

```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "boards": [],
      "created_at": "2024-01-01T00:00:00Z",
      "last_login": "2024-01-15T10:30:00Z",
      "is_active": true
    },
    {
      "id": 2,
      "username": "moderator1",
      "email": "mod1@example.com",
      "role": "moderator",
      "boards": ["tech", "gaming"], // Specific board access
      "created_at": "2024-01-05T00:00:00Z",
      "last_login": "2024-01-14T15:20:00Z",
      "is_active": true
    }
  ]
}
```

### Create Admin User

**Endpoint:** `POST /api/admin/users`  
**Authentication:** Admin only  
**Body:**

```json
{
  "username": "newmod",
  "password": "securepassword",
  "email": "newmod@example.com",
  "role": "moderator", // "janitor", "moderator", or "admin"
  "boards": ["tech", "gaming"] // Optional, empty means all boards
}
```

**Response (201):**

```json
{
  "message": "Admin user created successfully",
  "user": {
    "id": 3,
    "username": "newmod",
    "email": "newmod@example.com",
    "role": "moderator",
    "boards": ["tech", "gaming"],
    "created_at": "2024-01-15T11:00:00Z",
    "is_active": true
  }
}
```

### Get Admin User

**Endpoint:** `GET /api/admin/users/:userId`  
**Authentication:** Admin only  
**Response:**

```json
{
  "user": {
    "id": 2,
    "username": "moderator1",
    "email": "mod1@example.com",
    "role": "moderator",
    "boards": ["tech", "gaming"],
    "created_at": "2024-01-05T00:00:00Z",
    "last_login": "2024-01-14T15:20:00Z",
    "is_active": true
  }
}
```

### Update Admin User

**Endpoint:** `PUT /api/admin/users/:userId`  
**Authentication:** Admin only  
**Body:**

```json
{
  "username": "updatedmod", // Optional
  "password": "newpassword", // Optional
  "email": "updated@example.com", // Optional
  "role": "admin", // Optional
  "boards": ["tech"], // Optional
  "is_active": false // Optional
}
```

**Response:**

```json
{
  "message": "User updated successfully",
  "user": {
    // Updated user object
  }
}
```

### Delete Admin User

**Endpoint:** `DELETE /api/admin/users/:userId`  
**Authentication:** Admin only  
**Response:**

```json
{
  "message": "User deleted successfully"
}
```

**Note:** You cannot delete your own account.

## Ban Management

### List Bans

**Endpoint:** `GET /api/admin/bans`  
**Authentication:** Required  
**Query Parameters:**

- `boardId` (optional) - Filter bans by board

**Response:**

```json
{
  "bans": [
    {
      "id": 1,
      "ip_address": "192.168.1.100",
      "board_id": "tech", // null for global ban
      "reason": "Spam",
      "expires_at": "2024-12-31T23:59:59Z", // null for permanent
      "created_at": "2024-01-15T10:00:00Z",
      "admin_user_id": 1,
      "admin_username": "admin",
      "is_active": true,
      "appeal_text": "I promise to behave",
      "appeal_status": "pending" // "none", "pending", "approved", "denied"
    }
  ]
}
```

### Create Ban

**Endpoint:** `POST /api/admin/bans`  
**Authentication:** Required  
**Body:**

```json
{
  "ip_address": "192.168.1.100",
  "board_id": "tech", // null for global ban
  "reason": "Spam",
  "expires_at": "2024-12-31T23:59:59Z" // null for permanent
}
```

**Response (201):**

```json
{
  "message": "Ban created successfully",
  "ban": {
    "id": 2,
    "ip_address": "192.168.1.100",
    "board_id": "tech",
    "reason": "Spam",
    "expires_at": "2024-12-31T23:59:59Z",
    "created_at": "2024-01-15T11:00:00Z",
    "admin_user_id": 1,
    "is_active": true
  }
}
```

### Get Ban Details

**Endpoint:** `GET /api/admin/bans/:banId`  
**Authentication:** Required  
**Response:**

```json
{
  "ban": {
    "id": 1,
    "ip_address": "192.168.1.100",
    "board_id": "tech",
    "reason": "Spam",
    "expires_at": null,
    "created_at": "2024-01-15T10:00:00Z",
    "admin_user_id": 1,
    "admin_username": "admin",
    "is_active": true,
    "appeal_text": "I promise to behave",
    "appeal_status": "pending"
  }
}
```

### Update Ban

**Endpoint:** `PUT /api/admin/bans/:banId`  
**Authentication:** Required  
**Body:**

```json
{
  "reason": "Updated reason", // Optional
  "expires_at": "2024-06-30T23:59:59Z", // Optional
  "is_active": false, // Optional - effectively unbans
  "appeal_status": "approved" // Optional - handle appeal
}
```

**Response:**

```json
{
  "message": "Ban updated successfully",
  "ban": {
    // Updated ban object
  }
}
```

## Content Moderation

### Get Post IP Address

**Endpoint:** `GET /api/admin/posts/:postId/ip`  
**Authentication:** Required (Moderator or Admin)  
**Query Parameters:**

- `boardId` (required) - Board ID
- `threadId` (required) - Thread ID

**Response:**

```json
{
  "ip_address": "192.168.1.100",
  "post_content": "This is the post content",
  "image_url": "https://cdn.example.com/image.jpg"
}
```

**Note:** This action is logged for audit purposes.

### Delete Thread

**Endpoint:** `DELETE /api/admin/threads/:threadId`  
**Authentication:** Required  
**Body:**

```json
{
  "boardId": "tech",
  "reason": "Off-topic",
  "ip_address": "192.168.1.100" // Optional
}
```

**Response:**

```json
{
  "message": "Thread deleted successfully"
}
```

### Delete Post

**Endpoint:** `DELETE /api/admin/posts/:postId`  
**Authentication:** Required  
**Body:**

```json
{
  "boardId": "tech",
  "threadId": 123,
  "reason": "Inappropriate content"
}
```

**Response:**

```json
{
  "message": "Post deleted successfully",
  "ipAddress": "192.168.1.100",
  "postContent": "Deleted post content",
  "imageUrl": "https://cdn.example.com/deleted-image.jpg"
}
```

### Edit Post

**Endpoint:** `PUT /api/admin/posts/:postId`  
**Authentication:** Required  
**Body:**

```json
{
  "boardId": "tech",
  "threadId": 123,
  "content": "Edited content",
  "reason": "Removed personal information",
  "ip_address": "192.168.1.100" // Optional
}
```

**Response:**

```json
{
  "message": "Post edited successfully",
  "post": {
    "id": 456,
    "content": "Edited content",
    "image_url": "https://cdn.example.com/image.jpg",
    "created_at": "2024-01-15T09:00:00Z"
  }
}
```

## Moderation Actions History

### List Moderation Actions

**Endpoint:** `GET /api/admin/actions`  
**Authentication:** Required  
**Query Parameters:**

- `admin_user_id` - Filter by admin user
- `action_type` - Filter by action type
- `board_id` - Filter by board
- `thread_id` - Filter by thread
- `post_id` - Filter by post
- `ban_id` - Filter by ban
- `ip_address` - Filter by IP address
- `start_date` - Filter by start date (ISO format)
- `end_date` - Filter by end date (ISO format)
- `limit` - Number of results (default: no limit)
- `offset` - Offset for pagination

**Response:**

```json
{
  "actions": [
    {
      "id": 1,
      "admin_user_id": 1,
      "admin_username": "admin",
      "action_type": "delete_post",
      "board_id": "tech",
      "thread_id": 123,
      "post_id": 456,
      "ban_id": null,
      "reason": "Spam",
      "created_at": "2024-01-15T10:30:00Z",
      "ip_address": "192.168.1.100"
    }
  ]
}
```

### Get Moderation Statistics

**Endpoint:** `GET /api/admin/actions/stats`  
**Authentication:** Required (Admin or Moderator)  
**Query Parameters:**

- `admin_user_id` - Filter by admin user
- `board_id` - Filter by board
- `start_date` - Start date for stats
- `end_date` - End date for stats

**Response:**

```json
{
  "stats": {
    "total": 150,
    "byActionType": [
      {
        "action_type": "delete_post",
        "count": "45"
      },
      {
        "action_type": "ban",
        "count": "30"
      }
    ],
    "byAdmin": [
      {
        "admin_user_id": 1,
        "username": "admin",
        "count": "80"
      }
    ],
    "byBoard": [
      {
        "board_id": "tech",
        "count": "50"
      }
    ]
  }
}
```

## Housekeeping

### Get Housekeeping Status

**Endpoint:** `GET /api/admin/housekeeping/status`  
**Authentication:** Admin only  
**Response:**

```json
{
  "status": {
    "initialized": true,
    "jobs": {
      "housekeeping": {
        "running": true,
        "lastRun": "2024-01-15T10:00:00Z"
      }
    }
  }
}
```

### Run Housekeeping Manually

**Endpoint:** `POST /api/admin/housekeeping/run`  
**Authentication:** Admin only  
**Response:**

```json
{
  "message": "Housekeeping completed successfully",
  "results": {
    "timestamp": "2024-01-15T11:00:00Z",
    "tasks": {
      "threadCleanup": {
        "boardsChecked": 2,
        "threadsDeleted": 5
      },
      "fileCleanup": {
        "totalFiles": 1000,
        "databaseImages": 950,
        "orphanedFiles": 50,
        "deletedFiles": 48,
        "errors": 2,
        "duration": 1523
      }
    }
  }
}
```

## Role Permissions

### Roles

1. **Admin**: Full access to all features
2. **Moderator**: Can moderate boards, view/create bans, delete content
3. **Janitor**: Can only delete posts and threads (limited access)

### Permission Matrix

| Action            | Admin | Moderator | Janitor |
| ----------------- | ----- | --------- | ------- |
| Manage Users      | ✓     | ✗         | ✗       |
| Create/Edit Bans  | ✓     | ✓         | ✗       |
| Delete Content    | ✓     | ✓         | ✓       |
| View IP Addresses | ✓     | ✓         | ✗       |
| View All Stats    | ✓     | ✓         | ✗       |
| Run Housekeeping  | ✓     | ✗         | ✗       |
| Manage Rangebans  | ✓     | ✗         | ✗       |

## Error Responses

### 400 Bad Request

```json
{
  "error": "Missing required fields",
  "required": ["field1", "field2"]
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized - Login required"
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden - Admin privileges required"
}
```

### 404 Not Found

```json
{
  "error": "Resource not found"
}
```

### 409 Conflict

```json
{
  "error": "Username or email already exists"
}
```

### 500 Internal Server Error

```json
{
  "error": "An unexpected error occurred"
}
```

## Best Practices

1. **Session Management**: Sessions expire after 24 hours. Re-authenticate if you receive a 401 error.

2. **Board Permissions**: Moderators can only manage boards they're assigned to. An empty boards array means access to all boards.

3. **IP Address Privacy**: IP addresses are only visible to moderators and admins, and all IP lookups are logged.

4. **Audit Trail**: All moderation actions are logged with timestamp, admin user, and reason.

5. **Soft Deletes**: Bans and rangebans use soft deletes (is_active flag) to maintain history.

6. **Rate Limiting**: While not currently implemented, be mindful of request frequency.

7. **Error Handling**: Always check response status codes and handle errors appropriately.

## Testing with cURL

### Login

```bash
curl -X POST https://conniption.onrender.com/api/admin/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"admin","password":"password"}'
```

### Get IP Address

```bash
curl -X GET "https://conniption.onrender.com/api/admin/posts/123/ip?boardId=tech&threadId=456" \
  -b cookies.txt
```

### Create Ban

```bash
curl -X POST https://conniption.onrender.com/api/admin/bans \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "ip_address":"192.168.1.100",
    "board_id":"tech",
    "reason":"Spam"
  }'
```
