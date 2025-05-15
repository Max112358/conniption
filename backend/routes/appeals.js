// backend/routes/appeals.js
const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access boardId
const banModel = require("../models/ban");

/**
 * @route   POST /api/boards/:boardId/appeal/:banId
 * @desc    Submit an appeal for a ban
 * @access  Public
 */
router.post("/:banId", async (req, res, next) => {
  const { boardId, banId } = req.params;
  const { appealText } = req.body;

  console.log(`Route: POST /api/boards/${boardId}/appeal/${banId}`);

  try {
    // Validate request
    if (!appealText || !appealText.trim()) {
      console.log(`Route: Invalid request - missing appeal text`);
      return res.status(400).json({ error: "Appeal text is required" });
    }

    // Check if ban exists and is for this board
    const ban = await banModel.getBanById(banId);

    if (!ban) {
      console.log(`Route: Ban not found - ${banId}`);
      return res.status(404).json({ error: "Ban not found" });
    }

    // Check if ban is for this board or is global
    if (ban.board_id && ban.board_id !== boardId) {
      console.log(`Route: Ban ${banId} is not for board ${boardId}`);
      return res.status(403).json({ error: "Ban is not for this board" });
    }

    // Check if ban is active
    if (!ban.is_active) {
      console.log(`Route: Ban ${banId} is not active`);
      return res.status(400).json({ error: "Ban is not active" });
    }

    // Check if appeal already exists and has a status other than 'none'
    if (ban.appeal_status && ban.appeal_status !== "none") {
      console.log(
        `Route: Ban ${banId} already has appeal status: ${ban.appeal_status}`
      );
      return res
        .status(400)
        .json({ error: `Appeal already ${ban.appeal_status}` });
    }

    // Submit the appeal
    const updatedBan = await banModel.submitAppeal(banId, appealText);

    if (!updatedBan) {
      console.log(`Route: Failed to submit appeal for ban ${banId}`);
      return res.status(500).json({ error: "Failed to submit appeal" });
    }

    console.log(`Route: Appeal submitted for ban ${banId}`);
    res.status(200).json({
      message: "Appeal submitted successfully",
      status: updatedBan.appeal_status,
    });
  } catch (error) {
    console.error(
      `Route Error - POST /api/boards/${boardId}/appeal/${banId}:`,
      error
    );
    next(error);
  }
});

/**
 * @route   GET /api/boards/:boardId/appeal/:banId
 * @desc    Get appeal status for a ban
 * @access  Public
 */
router.get("/:banId", async (req, res, next) => {
  const { boardId, banId } = req.params;

  console.log(`Route: GET /api/boards/${boardId}/appeal/${banId}`);

  try {
    // Check if ban exists and is for this board
    const ban = await banModel.getBanById(banId);

    if (!ban) {
      console.log(`Route: Ban not found - ${banId}`);
      return res.status(404).json({ error: "Ban not found" });
    }

    // Check if ban is for this board or is global
    if (ban.board_id && ban.board_id !== boardId) {
      console.log(`Route: Ban ${banId} is not for board ${boardId}`);
      return res.status(403).json({ error: "Ban is not for this board" });
    }

    console.log(
      `Route: Returning appeal status for ban ${banId}: ${ban.appeal_status}`
    );
    res.status(200).json({
      appeal_status: ban.appeal_status || "none",
      appeal_text: ban.appeal_text || "",
      is_active: ban.is_active,
    });
  } catch (error) {
    console.error(
      `Route Error - GET /api/boards/${boardId}/appeal/${banId}:`,
      error
    );
    next(error);
  }
});

module.exports = router;
