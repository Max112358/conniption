// backend/models/survey.test.js
const surveyModel = require("./survey");
const { pool } = require("../config/database");

// Mock dependencies
jest.mock("../config/database", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

describe("Survey Model", () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe("getSurveysByPostIds", () => {
    it("should return surveys for multiple posts", async () => {
      const mockSurveys = [
        {
          survey_id: 1,
          post_id: 101,
          survey_type: "single",
          question: "Which option?",
          response_count: "5",
        },
        {
          survey_id: 2,
          post_id: 102,
          survey_type: "multiple",
          question: "Select all that apply",
          response_count: "3",
        },
      ];

      pool.query.mockResolvedValue({ rows: mockSurveys });

      const surveys = await surveyModel.getSurveysByPostIds([101, 102], "tech");

      expect(surveys).toEqual([
        {
          survey_id: 1,
          post_id: 101,
          survey_type: "single",
          question: "Which option?",
          response_count: 5,
        },
        {
          survey_id: 2,
          post_id: 102,
          survey_type: "multiple",
          question: "Select all that apply",
          response_count: 3,
        },
      ]);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT s.id as survey_id"),
        [[101, 102], "tech"]
      );
    });

    it("should return empty array for empty post IDs", async () => {
      const surveys = await surveyModel.getSurveysByPostIds([], "tech");

      expect(surveys).toEqual([]);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it("should return empty array for null post IDs", async () => {
      const surveys = await surveyModel.getSurveysByPostIds(null, "tech");

      expect(surveys).toEqual([]);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      pool.query.mockRejectedValue(new Error("Database error"));

      await expect(
        surveyModel.getSurveysByPostIds([101, 102], "tech")
      ).rejects.toThrow("Database error");
    });

    it("should handle posts with no surveys", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const surveys = await surveyModel.getSurveysByPostIds([101, 102], "tech");

      expect(surveys).toEqual([]);
    });
  });

  describe("createSurvey", () => {
    it("should create a survey with options", async () => {
      const surveyData = {
        post_id: 101,
        thread_id: 10,
        board_id: "tech",
        survey_type: "single",
        question: "Which is better?",
        options: ["Option A", "Option B", "Option C"],
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              post_id: 101,
              thread_id: 10,
              board_id: "tech",
              survey_type: "single",
              question: "Which is better?",
              created_at: new Date(),
              expires_at: null,
              is_active: true,
            },
          ],
        }) // INSERT survey
        .mockResolvedValueOnce({
          rows: [{ id: 1, option_text: "Option A", option_order: 1 }],
        }) // INSERT option 1
        .mockResolvedValueOnce({
          rows: [{ id: 2, option_text: "Option B", option_order: 2 }],
        }) // INSERT option 2
        .mockResolvedValueOnce({
          rows: [{ id: 3, option_text: "Option C", option_order: 3 }],
        }) // INSERT option 3
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await surveyModel.createSurvey(surveyData);

      expect(result).toMatchObject({
        id: 1,
        post_id: 101,
        survey_type: "single",
        question: "Which is better?",
        options: [
          { id: 1, option_text: "Option A", option_order: 1 },
          { id: 2, option_text: "Option B", option_order: 2 },
          { id: 3, option_text: "Option C", option_order: 3 },
        ],
      });

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should reject surveys with too few options", async () => {
      const surveyData = {
        post_id: 101,
        thread_id: 10,
        board_id: "tech",
        survey_type: "single",
        question: "Which is better?",
        options: ["Only one option"],
      };

      await expect(surveyModel.createSurvey(surveyData)).rejects.toThrow(
        "Survey must have between 2 and 16 options"
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should reject surveys with too many options", async () => {
      const surveyData = {
        post_id: 101,
        thread_id: 10,
        board_id: "tech",
        survey_type: "single",
        question: "Which is better?",
        options: Array(17).fill("Option"),
      };

      await expect(surveyModel.createSurvey(surveyData)).rejects.toThrow(
        "Survey must have between 2 and 16 options"
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("getSurveyByPostId", () => {
    it("should return survey with options", async () => {
      const mockSurvey = {
        id: 1,
        post_id: 101,
        thread_id: 10,
        board_id: "tech",
        survey_type: "single",
        question: "Test question?",
        created_at: new Date(),
        expires_at: null,
        is_active: true,
      };

      const mockOptions = [
        { id: 1, option_text: "Option A", option_order: 1 },
        { id: 2, option_text: "Option B", option_order: 2 },
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [mockSurvey] }) // Get survey
        .mockResolvedValueOnce({ rows: mockOptions }); // Get options

      const survey = await surveyModel.getSurveyByPostId(101, "tech");

      expect(survey).toEqual({
        ...mockSurvey,
        options: mockOptions,
      });

      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it("should return null when survey not found", async () => {
      pool.query.mockResolvedValue({ rows: [] });

      const survey = await surveyModel.getSurveyByPostId(999, "tech");

      expect(survey).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });
});
