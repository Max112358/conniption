API Documentation for Thread Deletion
I've implemented the thread deletion functionality in the backend. Here's how to use the API:
Delete Thread Endpoint
URL: DELETE /api/boards/:boardId/threads/:threadId
Authorization:

Thread can be deleted by the original creator (matched by IP address)
Thread can be deleted by any admin role (janitor, moderator, admin)
Non-admin moderators must have permission for the specific board

Request Examples:

1. User deleting their own thread (no authentication needed):
   javascript// Simple deletion by thread creator
   const response = await fetch(`/api/boards/tech/threads/123`, {
   method: 'DELETE',
   headers: {
   'Content-Type': 'application/json',
   }
   });
2. Admin deleting a thread (with moderation logging):
   javascript// Admin deletion with reason (creates moderation log)
   const response = await fetch(`/api/boards/tech/threads/123`, {
   method: 'DELETE',
   headers: {
   'Content-Type': 'application/json',
   },
   credentials: 'include', // Include session cookies
   body: JSON.stringify({
   reason: 'Violation of board rules' // Optional - triggers moderation logging
   })
   });
3. Admin deleting without moderation logging:
   javascript// Admin can also delete without providing a reason
   // This won't create a moderation log entry
   const response = await fetch(`/api/boards/tech/threads/123`, {
   method: 'DELETE',
   headers: {
   'Content-Type': 'application/json',
   },
   credentials: 'include' // Include session cookies
   });
   Response:
   json{
   "message": "Thread deleted successfully",
   "deletedBy": "owner" // or "admin-direct" or "admin-moderation"
   }
   Error Responses:

404: Thread not found
403: Not authorized to delete this thread
500: Failed to delete thread

Key Features:

IP-based ownership: The system determines thread ownership by comparing the request IP with the IP of the first post in the thread (the thread creator).
Admin permissions:

Admins can delete any thread
Moderators and janitors can only delete threads in boards they have permission for
If an admin provides a reason in the request body, it creates a moderation log entry

Automatic cleanup:

All posts in the thread are automatically deleted (cascade delete)
All associated images/videos are removed from R2 storage
Socket.io emits a thread_deleted event to update connected clients

Two deletion modes:

Direct deletion: When users delete their own threads or admins delete without a reason
Moderation deletion: When admins provide a reason, creating an audit trail

The system is designed to be flexible while maintaining security and proper logging for moderation actions.
