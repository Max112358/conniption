// backend/routes/admin/sticky.js
const express = require("express");
const router = express.Router();
const { pool } = require("../../config/database");
const threadModel = require("../../models/thread");
const { requireAdmin } = require("../../middleware/adminAuth");

/**
 * @route   PUT /api/admin/boards/:boardId/threads/:threadId/sticky
 * @desc    Make a thread sticky
 * @access  Admin only
 */
router.put(
  "/:boardId/threads/:threadId/sticky",
  requireAdmin,
  async (req, res, next) => {
    const { boardId, threadId } = req.params;
    const adminUserId = req.session.adminUser.id;

    console.log(
      `Admin Route: Making thread ${threadId} sticky in board ${boardId}`
    );

    try {
      // Check if thread exists
      const thread = await threadModel.getThreadById(threadId, boardId);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }

      // Check if already sticky
      if (thread.is_sticky) {
        return res.status(400).json({ error: "Thread is already sticky" });
      }

      // Update sticky status
      const updatedThread = await threadModel.updateStickyStatus(
        threadId,
        boardId,
        true
      );

      if (!updatedThread) {
        return res
          .status(500)
          .json({ error: "Failed to update thread sticky status" });
      }

      // Log the moderation action directly to the database
      await pool.query(
        `INSERT INTO moderation_actions 
         (admin_user_id, action_type, board_id, thread_id, reason, ip_address)
         VALUES ($1, 'sticky_thread', $2, $3, $4, $5)`,
        [adminUserId, boardId, parseInt(threadId), "Thread made sticky", "N/A"]
      );

      // Emit socket event to update connected clients
      const io = require("../../utils/socketHandler").getIo;
      const socketIo = io();
      if (socketIo) {
        socketIo.to(boardId).emit("thread_sticky_updated", {
          threadId: parseInt(threadId),
          boardId,
          isSticky: true,
        });
      }

      res.json({
        message: "Thread made sticky successfully",
        thread: updatedThread,
      });
    } catch (error) {
      console.error(`Admin Route Error - Make sticky:`, error);
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/admin/boards/:boardId/threads/:threadId/sticky
 * @desc    Remove sticky status from a thread
 * @access  Admin only
 */
router.delete(
  "/:boardId/threads/:threadId/sticky",
  requireAdmin,
  async (req, res, next) => {
    const { boardId, threadId } = req.params;
    const adminUserId = req.session.adminUser.id;

    console.log(
      `Admin Route: Removing sticky from thread ${threadId} in board ${boardId}`
    );

    try {
      // Check if thread exists
      const thread = await threadModel.getThreadById(threadId, boardId);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }

      // Check if not sticky
      if (!thread.is_sticky) {
        return res.status(400).json({ error: "Thread is not sticky" });
      }

      // Update sticky status
      const updatedThread = await threadModel.updateStickyStatus(
        threadId,
        boardId,
        false
      );

      if (!updatedThread) {
        return res
          .status(500)
          .json({ error: "Failed to update thread sticky status" });
      }

      // Log the moderation action directly to the database
      await pool.query(
        `INSERT INTO moderation_actions 
         (admin_user_id, action_type, board_id, thread_id, reason, ip_address)
         VALUES ($1, 'unsticky_thread', $2, $3, $4, $5)`,
        [
          adminUserId,
          boardId,
          parseInt(threadId),
          "Thread sticky status removed",
          "N/A",
        ]
      );

      // Emit socket event to update connected clients
      const io = require("../../utils/socketHandler").getIo;
      const socketIo = io();
      if (socketIo) {
        socketIo.to(boardId).emit("thread_sticky_updated", {
          threadId: parseInt(threadId),
          boardId,
          isSticky: false,
        });
      }

      res.json({
        message: "Thread sticky status removed successfully",
        thread: updatedThread,
      });
    } catch (error) {
      console.error(`Admin Route Error - Remove sticky:`, error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/boards/:boardId/threads/sticky
 * @desc    Get all sticky threads for a board
 * @access  Admin only
 */
router.get("/:boardId/threads/sticky", requireAdmin, async (req, res, next) => {
  const { boardId } = req.params;

  console.log(`Admin Route: Getting sticky threads for board ${boardId}`);

  try {
    const stickyThreads = await threadModel.getStickyThreads(boardId);

    res.json({
      threads: stickyThreads,
      count: stickyThreads.length,
    });
  } catch (error) {
    console.error(`Admin Route Error - Get sticky threads:`, error);
    next(error);
  }
});

module.exports = router;
