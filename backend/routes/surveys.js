// backend/routes/surveys.js
const express = require("express");
const router = express.Router({ mergeParams: true });
const surveyModel = require("../models/survey");
const postModel = require("../models/post");
const getClientIp = require("../utils/getClientIp");
const checkBannedIP = require("../middleware/banCheck");

/**
 * @route   POST /api/boards/:boardId/threads/:threadId/posts/:postId/survey
 * @desc    Create a survey attached to a post
 * @access  Public (must be post owner)
 */
router.post("/:postId/survey", checkBannedIP, async (req, res, next) => {
  const { boardId, threadId, postId } = req.params;
  const { survey_type, question, options, expires_at } = req.body;
  const ipAddress = getClientIp(req);

  console.log(
    `Route: POST /api/boards/${boardId}/threads/${threadId}/posts/${postId}/survey`
  );

  try {
    // Validate input
    if (!survey_type || !question || !options) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["survey_type", "question", "options"],
      });
    }

    if (!["single", "multiple"].includes(survey_type)) {
      return res.status(400).json({
        error: "Invalid survey type",
        allowed: ["single", "multiple"],
      });
    }

    if (!Array.isArray(options) || options.length < 2 || options.length > 16) {
      return res.status(400).json({
        error: "Options must be an array with 2-16 items",
      });
    }

    // Check if user is the post owner
    const post = await postModel.getPostById(postId, boardId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.ip_address !== ipAddress) {
      return res.status(403).json({
        error: "Only the post owner can attach a survey",
      });
    }

    // Check if post already has a survey
    const existingSurvey = await surveyModel.getSurveyByPostId(postId, boardId);
    if (existingSurvey) {
      return res.status(409).json({
        error: "Post already has a survey attached",
      });
    }

    // Create survey
    const survey = await surveyModel.createSurvey({
      post_id: parseInt(postId),
      thread_id: parseInt(threadId),
      board_id: boardId,
      survey_type,
      question,
      options,
      expires_at,
    });

    console.log(`Route: Created survey ${survey.id} for post ${postId}`);
    res.status(201).json({
      message: "Survey created successfully",
      survey,
    });
  } catch (error) {
    console.error(`Route Error - POST survey:`, error);
    next(error);
  }
});

/**
 * @route   GET /api/boards/:boardId/threads/:threadId/posts/:postId/survey
 * @desc    Get survey attached to a post
 * @access  Public
 */
router.get("/:postId/survey", async (req, res, next) => {
  const { boardId, postId } = req.params;
  const ipAddress = getClientIp(req);

  console.log(
    `Route: GET /api/boards/${boardId}/threads/.../posts/${postId}/survey`
  );

  try {
    const survey = await surveyModel.getSurveyByPostId(postId, boardId);

    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }

    // Check if survey is expired
    if (survey.expires_at && new Date(survey.expires_at) < new Date()) {
      survey.is_expired = true;
    } else {
      survey.is_expired = false;
    }

    // Get user's existing response if any
    const userResponse = await surveyModel.getUserResponse(
      survey.id,
      ipAddress
    );
    if (userResponse) {
      survey.user_response = userResponse;
    }

    res.json({ survey });
  } catch (error) {
    console.error(`Route Error - GET survey:`, error);
    next(error);
  }
});

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
