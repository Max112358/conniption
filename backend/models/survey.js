// backend/models/survey.js
const { pool } = require("../config/database");

/**
 * Survey model functions - NO EXPIRATION FUNCTIONALITY
 */
const surveyModel = {
  /**
   * Get surveys for multiple posts
   * @param {Array<number>} postIds - Array of post IDs
   * @param {string} boardId - Board ID
   * @returns {Promise<Array>} Array of survey objects with basic info
   */
  getSurveysByPostIds: async (postIds, boardId) => {
    console.log(
      `Model: Getting surveys for ${postIds.length} posts in board ${boardId}`
    );

    if (!postIds || postIds.length === 0) {
      return [];
    }

    try {
      const result = await pool.query(
        `SELECT s.id as survey_id, s.post_id, s.survey_type, s.question, 
                COUNT(DISTINCT sr.id) as response_count
         FROM surveys s
         LEFT JOIN survey_responses sr ON s.id = sr.survey_id
         WHERE s.post_id = ANY($1) AND s.board_id = $2 AND s.is_active = TRUE
         GROUP BY s.id`,
        [postIds, boardId]
      );

      console.log(`Model: Found ${result.rows.length} surveys for posts`);

      return result.rows.map((survey) => ({
        survey_id: survey.survey_id,
        post_id: survey.post_id,
        survey_type: survey.survey_type,
        question: survey.question,
        response_count: parseInt(survey.response_count),
      }));
    } catch (error) {
      console.error(`Model Error - getSurveysByPostIds:`, error);
      throw error;
    }
  },

  /**
   * Create a new survey attached to a post
   * @param {Object} surveyData - Survey data
   * @returns {Promise<Object>} Created survey object with options
   */
  createSurvey: async (surveyData) => {
    console.log(`Model: Creating survey for post ${surveyData.post_id}`);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Validate that options array has 2-16 entries
      if (
        !surveyData.options ||
        surveyData.options.length < 2 ||
        surveyData.options.length > 16
      ) {
        throw new Error("Survey must have between 2 and 16 options");
      }

      // Insert survey WITHOUT expires_at
      const surveyResult = await client.query(
        `INSERT INTO surveys (post_id, thread_id, board_id, survey_type, question, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, post_id, thread_id, board_id, survey_type, question, created_at, is_active`,
        [
          surveyData.post_id,
          surveyData.thread_id,
          surveyData.board_id,
          surveyData.survey_type,
          surveyData.question,
          true,
        ]
      );

      const survey = surveyResult.rows[0];

      // Insert options
      const options = [];
      for (let i = 0; i < surveyData.options.length; i++) {
        const optionResult = await client.query(
          `INSERT INTO survey_options (survey_id, option_text, option_order)
           VALUES ($1, $2, $3)
           RETURNING id, option_text, option_order`,
          [survey.id, surveyData.options[i], i + 1]
        );
        options.push(optionResult.rows[0]);
      }

      await client.query("COMMIT");
      console.log(`Model: Created survey with ID: ${survey.id}`);

      return {
        ...survey,
        options,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - createSurvey:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get survey by post ID
   * @param {number} postId - Post ID
   * @param {string} boardId - Board ID
   * @returns {Promise<Object|null>} Survey object with options or null
   */
  getSurveyByPostId: async (postId, boardId) => {
    console.log(`Model: Getting survey for post ${postId} in board ${boardId}`);

    try {
      // Get survey WITHOUT expires_at
      const surveyResult = await pool.query(
        `SELECT id, post_id, thread_id, board_id, survey_type, question, 
                created_at, is_active
         FROM surveys
         WHERE post_id = $1 AND board_id = $2`,
        [postId, boardId]
      );

      if (surveyResult.rows.length === 0) {
        console.log(`Model: No survey found for post ${postId}`);
        return null;
      }

      const survey = surveyResult.rows[0];

      // Get options
      const optionsResult = await pool.query(
        `SELECT id, option_text, option_order
         FROM survey_options
         WHERE survey_id = $1
         ORDER BY option_order`,
        [survey.id]
      );

      survey.options = optionsResult.rows;

      console.log(`Model: Found survey with ${survey.options.length} options`);
      return survey;
    } catch (error) {
      console.error(
        `Model Error - getSurveyByPostId(${postId}, ${boardId}):`,
        error
      );
      throw error;
    }
  },

  /**
   * Get survey by ID
   * @param {number} surveyId - Survey ID
   * @returns {Promise<Object|null>} Survey object with options or null
   */
  getSurveyById: async (surveyId) => {
    console.log(`Model: Getting survey with ID: ${surveyId}`);

    try {
      const surveyResult = await pool.query(
        `SELECT id, post_id, thread_id, board_id, survey_type, question, 
                created_at, is_active
         FROM surveys
         WHERE id = $1`,
        [surveyId]
      );

      if (surveyResult.rows.length === 0) {
        console.log(`Model: Survey not found with ID: ${surveyId}`);
        return null;
      }

      const survey = surveyResult.rows[0];

      // Get options
      const optionsResult = await pool.query(
        `SELECT id, option_text, option_order
         FROM survey_options
         WHERE survey_id = $1
         ORDER BY option_order`,
        [survey.id]
      );

      survey.options = optionsResult.rows;

      return survey;
    } catch (error) {
      console.error(`Model Error - getSurveyById(${surveyId}):`, error);
      throw error;
    }
  },

  /**
   * Submit or update a survey response
   * @param {Object} responseData - Response data
   * @returns {Promise<Object>} Response object
   */
  submitResponse: async (responseData) => {
    console.log(
      `Model: Submitting response for survey ${responseData.survey_id}`
    );
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Validate survey type and selected options
      const surveyResult = await client.query(
        `SELECT survey_type FROM surveys WHERE id = $1 AND is_active = TRUE`,
        [responseData.survey_id]
      );

      if (surveyResult.rows.length === 0) {
        throw new Error("Survey not found or not active");
      }

      const surveyType = surveyResult.rows[0].survey_type;

      // Validate options count
      if (surveyType === "single" && responseData.option_ids.length !== 1) {
        throw new Error("Single choice survey requires exactly one option");
      }

      if (responseData.option_ids.length === 0) {
        throw new Error("At least one option must be selected");
      }

      if (responseData.option_ids.length > 16) {
        throw new Error("Maximum 16 options can be selected");
      }

      // Check if response already exists
      const existingResponse = await client.query(
        `SELECT id FROM survey_responses 
         WHERE survey_id = $1 AND ip_address = $2`,
        [responseData.survey_id, responseData.ip_address]
      );

      let responseId;

      if (existingResponse.rows.length > 0) {
        // Update existing response
        responseId = existingResponse.rows[0].id;

        // Delete old option selections
        await client.query(
          `DELETE FROM survey_response_options WHERE response_id = $1`,
          [responseId]
        );

        // Update timestamp
        await client.query(
          `UPDATE survey_responses SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [responseId]
        );

        console.log(`Model: Updating existing response ${responseId}`);
      } else {
        // Create new response
        const responseResult = await client.query(
          `INSERT INTO survey_responses (survey_id, ip_address)
           VALUES ($1, $2)
           RETURNING id`,
          [responseData.survey_id, responseData.ip_address]
        );
        responseId = responseResult.rows[0].id;
        console.log(`Model: Created new response ${responseId}`);
      }

      // Insert selected options
      for (const optionId of responseData.option_ids) {
        await client.query(
          `INSERT INTO survey_response_options (response_id, option_id)
           VALUES ($1, $2)
           ON CONFLICT (response_id, option_id) DO NOTHING`,
          [responseId, optionId]
        );
      }

      await client.query("COMMIT");

      return {
        response_id: responseId,
        survey_id: responseData.survey_id,
        option_ids: responseData.option_ids,
        is_update: existingResponse.rows.length > 0,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - submitResponse:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get survey results
   * @param {number} surveyId - Survey ID
   * @returns {Promise<Object>} Survey results with vote counts and percentages
   */
  getSurveyResults: async (surveyId) => {
    console.log(`Model: Getting results for survey ${surveyId}`);

    try {
      // Get survey info WITHOUT expiration fields
      const surveyResult = await pool.query(
        `SELECT id, post_id, thread_id, board_id, survey_type, question, 
                created_at, is_active
         FROM surveys
         WHERE id = $1`,
        [surveyId]
      );

      if (surveyResult.rows.length === 0) {
        console.log(`Model: Survey not found with ID: ${surveyId}`);
        return null;
      }

      const survey = surveyResult.rows[0];

      // Get total responses
      const totalResult = await pool.query(
        `SELECT COUNT(DISTINCT id) as total_responses
         FROM survey_responses
         WHERE survey_id = $1`,
        [surveyId]
      );

      survey.total_responses = parseInt(totalResult.rows[0].total_responses);

      // Get results from view
      const resultsResult = await pool.query(
        `SELECT option_id, option_text, option_order, vote_count, percentage
         FROM survey_results
         WHERE survey_id = $1
         ORDER BY option_order`,
        [surveyId]
      );

      survey.results = resultsResult.rows.map((row) => ({
        option_id: row.option_id,
        option_text: row.option_text,
        option_order: row.option_order,
        vote_count: parseInt(row.vote_count),
        percentage: parseFloat(row.percentage) || 0,
      }));

      console.log(
        `Model: Retrieved results with ${survey.total_responses} total responses`
      );
      return survey;
    } catch (error) {
      console.error(`Model Error - getSurveyResults(${surveyId}):`, error);
      throw error;
    }
  },

  /**
   * Get correlations for multiple choice surveys
   * @param {number} surveyId - Survey ID
   * @returns {Promise<Array>} Correlation data
   */
  getSurveyCorrelations: async (surveyId) => {
    console.log(`Model: Getting correlations for survey ${surveyId}`);

    try {
      // First check if it's a multiple choice survey
      const surveyResult = await pool.query(
        `SELECT survey_type FROM surveys WHERE id = $1`,
        [surveyId]
      );

      if (surveyResult.rows.length === 0) {
        return null;
      }

      if (surveyResult.rows[0].survey_type !== "multiple") {
        return []; // No correlations for single choice
      }

      // Get all option pairs and their co-occurrence counts
      const correlationResult = await pool.query(
        `WITH option_pairs AS (
          SELECT 
            sro1.option_id as option1_id,
            sro2.option_id as option2_id,
            COUNT(DISTINCT sro1.response_id) as co_occurrence_count
          FROM survey_response_options sro1
          JOIN survey_response_options sro2 
            ON sro1.response_id = sro2.response_id 
            AND sro1.option_id < sro2.option_id
          JOIN survey_responses sr ON sro1.response_id = sr.id
          WHERE sr.survey_id = $1
          GROUP BY sro1.option_id, sro2.option_id
        ),
        total_responses AS (
          SELECT COUNT(DISTINCT id) as total FROM survey_responses WHERE survey_id = $1
        )
        SELECT 
          op.option1_id,
          so1.option_text as option1_text,
          op.option2_id,
          so2.option_text as option2_text,
          op.co_occurrence_count,
          ROUND((op.co_occurrence_count::NUMERIC / tr.total * 100), 2) as correlation_percentage
        FROM option_pairs op
        JOIN survey_options so1 ON op.option1_id = so1.id
        JOIN survey_options so2 ON op.option2_id = so2.id
        CROSS JOIN total_responses tr
        WHERE op.co_occurrence_count > 0
        ORDER BY op.co_occurrence_count DESC, op.option1_id, op.option2_id`,
        [surveyId]
      );

      console.log(
        `Model: Found ${correlationResult.rows.length} option correlations`
      );
      return correlationResult.rows.map((row) => ({
        option1: {
          id: row.option1_id,
          text: row.option1_text,
        },
        option2: {
          id: row.option2_id,
          text: row.option2_text,
        },
        co_occurrence_count: parseInt(row.co_occurrence_count),
        correlation_percentage: parseFloat(row.correlation_percentage),
      }));
    } catch (error) {
      console.error(`Model Error - getSurveyCorrelations(${surveyId}):`, error);
      throw error;
    }
  },

  /**
   * Get user's existing response for a survey
   * @param {number} surveyId - Survey ID
   * @param {string} ipAddress - User's IP address
   * @returns {Promise<Object|null>} User's response or null
   */
  getUserResponse: async (surveyId, ipAddress) => {
    console.log(`Model: Getting user response for survey ${surveyId}`);

    try {
      const responseResult = await pool.query(
        `SELECT sr.id, sr.created_at, sr.updated_at,
                array_agg(sro.option_id ORDER BY sro.option_id) as selected_options
         FROM survey_responses sr
         LEFT JOIN survey_response_options sro ON sr.id = sro.response_id
         WHERE sr.survey_id = $1 AND sr.ip_address = $2
         GROUP BY sr.id`,
        [surveyId, ipAddress]
      );

      if (responseResult.rows.length === 0) {
        return null;
      }

      const response = responseResult.rows[0];
      return {
        response_id: response.id,
        selected_options: response.selected_options || [],
        created_at: response.created_at,
        updated_at: response.updated_at,
      };
    } catch (error) {
      console.error(`Model Error - getUserResponse:`, error);
      throw error;
    }
  },

  /**
   * Delete a user's survey response
   * @param {Object} responseData - Response data
   * @param {number} responseData.survey_id - Survey ID
   * @param {string} responseData.ip_address - User's IP address
   * @returns {Promise<boolean>} True if deleted, false if no response found
   */
  deleteResponse: async (responseData) => {
    console.log(
      `Model: Deleting response for survey ${responseData.survey_id} from IP ${responseData.ip_address}`
    );

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check if response exists
      const existingResponse = await client.query(
        `SELECT id FROM survey_responses 
       WHERE survey_id = $1 AND ip_address = $2`,
        [responseData.survey_id, responseData.ip_address]
      );

      if (existingResponse.rows.length === 0) {
        await client.query("ROLLBACK");
        console.log(`Model: No response found to delete`);
        return false;
      }

      const responseId = existingResponse.rows[0].id;

      // Delete response options first (due to foreign key constraint)
      await client.query(
        `DELETE FROM survey_response_options WHERE response_id = $1`,
        [responseId]
      );

      // Delete the response itself
      await client.query(`DELETE FROM survey_responses WHERE id = $1`, [
        responseId,
      ]);

      await client.query("COMMIT");
      console.log(`Model: Successfully deleted response ${responseId}`);
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Model Error - deleteResponse:`, error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Get all surveys for a board
   * @param {string} boardId - Board ID
   * @returns {Promise<Array>} Array of surveys
   */
  getSurveysByBoard: async (boardId) => {
    console.log(`Model: Getting surveys for board ${boardId}`);

    try {
      const result = await pool.query(
        `SELECT s.id, s.post_id, s.thread_id, s.survey_type, s.question, 
                s.created_at, s.is_active,
                COUNT(DISTINCT sr.id) as response_count
         FROM surveys s
         LEFT JOIN survey_responses sr ON s.id = sr.survey_id
         WHERE s.board_id = $1 AND s.is_active = TRUE
         GROUP BY s.id
         ORDER BY s.created_at DESC`,
        [boardId]
      );

      console.log(
        `Model: Found ${result.rows.length} surveys for board ${boardId}`
      );
      return result.rows.map((row) => ({
        ...row,
        response_count: parseInt(row.response_count),
      }));
    } catch (error) {
      console.error(`Model Error - getSurveysByBoard(${boardId}):`, error);
      throw error;
    }
  },
};

module.exports = surveyModel;
