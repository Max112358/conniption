// backend/routes/surveys.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const surveyModel = require("../models/survey");
const getClientIp = require("../utils/getClientIp");
const checkBannedIP = require("../middleware/banCheck");

/**
 * This file handles survey-specific routes that don't fit under the posts hierarchy:
 * - Voting on surveys
 * - Getting survey results
 * - Getting correlations
 * - Listing all surveys for a board
 *
 * Survey creation/retrieval for specific posts is handled in posts.js
 */

/**
 * @route   POST /api/boards/:boardId/surveys/:surveyId/vote
 * @desc    Submit or update a survey response
 * @access  Public
 */
router.post("/:surveyId/vote", checkBannedIP, async (req, res, next) => {
  const { boardId, surveyId } = req.params;
  const { option_ids } = req.body;
  const ipAddress = getClientIp(req);

  console.log(`Route: POST /api/boards/${boardId}/surveys/${surveyId}/vote`);

  try {
    // Validate input
    if (!option_ids || !Array.isArray(option_ids)) {
      return res.status(400).json({
        error: "option_ids must be an array",
      });
    }

    // Get survey to validate it exists and belongs to this board
    const survey = await surveyModel.getSurveyById(surveyId);
    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }

    if (survey.board_id !== boardId) {
      return res.status(403).json({ error: "Survey not found in this board" });
    }

    // Check if survey is expired
    if (survey.expires_at && new Date(survey.expires_at) < new Date()) {
      return res.status(400).json({ error: "Survey has expired" });
    }

    if (!survey.is_active) {
      return res.status(400).json({ error: "Survey is not active" });
    }

    // Validate option IDs exist
    const validOptionIds = survey.options.map((opt) => opt.id);
    const invalidOptions = option_ids.filter(
      (id) => !validOptionIds.includes(id)
    );
    if (invalidOptions.length > 0) {
      return res.status(400).json({
        error: "Invalid option IDs",
        invalid: invalidOptions,
      });
    }

    // Submit response
    const response = await surveyModel.submitResponse({
      survey_id: parseInt(surveyId),
      ip_address: ipAddress,
      option_ids,
    });

    console.log(
      `Route: ${response.is_update ? "Updated" : "Created"} survey response ${
        response.response_id
      }`
    );

    // Notify connected clients about the vote
    const io = require("../utils/socketHandler").getIo;
    const socketIo = io();
    if (socketIo) {
      socketIo.to(boardId).emit("survey_vote", {
        surveyId: parseInt(surveyId),
        boardId,
      });

      // Also emit to thread room
      const roomId = `${boardId}-${survey.thread_id}`;
      socketIo.to(roomId).emit("survey_vote", {
        surveyId: parseInt(surveyId),
        threadId: survey.thread_id,
        boardId,
      });
    }

    res.json({
      message: response.is_update
        ? "Vote updated successfully"
        : "Vote submitted successfully",
      response,
    });
  } catch (error) {
    console.error(`Route Error - POST vote:`, error);
    next(error);
  }
});

/**
 * @route   GET /api/boards/:boardId/surveys/:surveyId/results
 * @desc    Get survey results
 * @access  Public
 */
router.get("/:surveyId/results", async (req, res, next) => {
  const { boardId, surveyId } = req.params;

  console.log(`Route: GET /api/boards/${boardId}/surveys/${surveyId}/results`);

  try {
    const results = await surveyModel.getSurveyResults(surveyId);

    if (!results) {
      return res.status(404).json({ error: "Survey not found" });
    }

    if (results.board_id !== boardId) {
      return res.status(403).json({ error: "Survey not found in this board" });
    }

    res.json({ results });
  } catch (error) {
    console.error(`Route Error - GET results:`, error);
    next(error);
  }
});

/**
 * @route   GET /api/boards/:boardId/surveys/:surveyId/correlations
 * @desc    Get survey correlations (for multiple choice surveys)
 * @access  Public
 */
router.get("/:surveyId/correlations", async (req, res, next) => {
  const { boardId, surveyId } = req.params;

  console.log(
    `Route: GET /api/boards/${boardId}/surveys/${surveyId}/correlations`
  );

  try {
    // Verify survey exists and belongs to board
    const survey = await surveyModel.getSurveyById(surveyId);

    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }

    if (survey.board_id !== boardId) {
      return res.status(403).json({ error: "Survey not found in this board" });
    }

    if (survey.survey_type !== "multiple") {
      return res.status(400).json({
        error: "Correlations are only available for multiple choice surveys",
      });
    }

    const correlations = await surveyModel.getSurveyCorrelations(surveyId);

    res.json({
      survey_id: parseInt(surveyId),
      survey_type: survey.survey_type,
      correlations,
    });
  } catch (error) {
    console.error(`Route Error - GET correlations:`, error);
    next(error);
  }
});

/**
 * @route   GET /api/boards/:boardId/surveys
 * @desc    Get all surveys for a board
 * @access  Public
 */
router.get("/", async (req, res, next) => {
  const { boardId } = req.params;

  console.log(`Route: GET /api/boards/${boardId}/surveys`);

  try {
    const surveys = await surveyModel.getSurveysByBoard(boardId);

    res.json({
      board_id: boardId,
      surveys,
    });
  } catch (error) {
    console.error(`Route Error - GET surveys by board:`, error);
    next(error);
  }
});

module.exports = router;
