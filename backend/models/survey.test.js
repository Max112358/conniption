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

  describe("createSurvey", () => {
    it("should create a survey with options", async () => {
      const surveyData = {
        post_id: 456,
        thread_id: 123,
        board_id: "tech",
        survey_type: "single",
        question: "What is your favorite color?",
        options: ["Red", "Blue", "Green", "Yellow"],
        expires_at: null,
      };

      const mockSurvey = {
        id: 1,
        ...surveyData,
        created_at: new Date(),
        is_active: true,
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockSurvey] }) // INSERT survey
        .mockResolvedValueOnce({
          rows: [{ id: 1, option_text: "Red", option_order: 1 }],
        }) // INSERT option 1
        .mockResolvedValueOnce({
          rows: [{ id: 2, option_text: "Blue", option_order: 2 }],
        }) // INSERT option 2
        .mockResolvedValueOnce({
          rows: [{ id: 3, option_text: "Green", option_order: 3 }],
        }) // INSERT option 3
        .mockResolvedValueOnce({
          rows: [{ id: 4, option_text: "Yellow", option_order: 4 }],
        }) // INSERT option 4
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await surveyModel.createSurvey(surveyData);

      expect(result).toMatchObject({
        id: 1,
        post_id: 456,
        survey_type: "single",
        question: "What is your favorite color?",
        options: expect.arrayContaining([
          expect.objectContaining({ option_text: "Red", option_order: 1 }),
          expect.objectContaining({ option_text: "Blue", option_order: 2 }),
          expect.objectContaining({ option_text: "Green", option_order: 3 }),
          expect.objectContaining({ option_text: "Yellow", option_order: 4 }),
        ]),
      });
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should reject surveys with too few options", async () => {
      const surveyData = {
        post_id: 456,
        thread_id: 123,
        board_id: "tech",
        survey_type: "single",
        question: "Yes or no?",
        options: ["Yes"], // Only 1 option
      };

      await expect(surveyModel.createSurvey(surveyData)).rejects.toThrow(
        "Survey must have between 2 and 16 options"
      );
    });

    it("should reject surveys with too many options", async () => {
      const surveyData = {
        post_id: 456,
        thread_id: 123,
        board_id: "tech",
        survey_type: "multiple",
        question: "Too many choices?",
        options: Array(17).fill("Option"), // 17 options
      };

      await expect(surveyModel.createSurvey(surveyData)).rejects.toThrow(
        "Survey must have between 2 and 16 options"
      );
    });
  });

  describe("submitResponse", () => {
    it("should create new response for single choice survey", async () => {
      const responseData = {
        survey_id: 1,
        ip_address: "192.168.1.1",
        option_ids: [2],
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ survey_type: "single" }] }) // SELECT survey type
        .mockResolvedValueOnce({ rows: [] }) // SELECT existing response (none)
        .mockResolvedValueOnce({ rows: [{ id: 100 }] }) // INSERT response
        .mockResolvedValueOnce(undefined) // INSERT response option
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await surveyModel.submitResponse(responseData);

      expect(result).toEqual({
        response_id: 100,
        survey_id: 1,
        option_ids: [2],
        is_update: false,
      });
    });

    it("should update existing response", async () => {
      const responseData = {
        survey_id: 1,
        ip_address: "192.168.1.1",
        option_ids: [3],
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ survey_type: "single" }] }) // SELECT survey type
        .mockResolvedValueOnce({ rows: [{ id: 100 }] }) // SELECT existing response
        .mockResolvedValueOnce(undefined) // DELETE old options
        .mockResolvedValueOnce(undefined) // UPDATE timestamp
        .mockResolvedValueOnce(undefined) // INSERT new option
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await surveyModel.submitResponse(responseData);

      expect(result).toEqual({
        response_id: 100,
        survey_id: 1,
        option_ids: [3],
        is_update: true,
      });
    });

    it("should reject single choice survey with multiple options", async () => {
      const responseData = {
        survey_id: 1,
        ip_address: "192.168.1.1",
        option_ids: [1, 2, 3],
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ survey_type: "single" }] }); // SELECT survey type

      await expect(surveyModel.submitResponse(responseData)).rejects.toThrow(
        "Single choice survey requires exactly one option"
      );
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  describe("getSurveyResults", () => {
    it("should return survey results with percentages", async () => {
      const mockSurvey = {
        id: 1,
        post_id: 456,
        thread_id: 123,
        board_id: "tech",
        survey_type: "single",
        question: "Favorite color?",
        created_at: new Date(),
        expires_at: null,
        is_active: true,
      };

      const mockResults = [
        {
          option_id: 1,
          option_text: "Red",
          option_order: 1,
          vote_count: "15",
          percentage: "35.71",
        },
        {
          option_id: 2,
          option_text: "Blue",
          option_order: 2,
          vote_count: "20",
          percentage: "47.62",
        },
        {
          option_id: 3,
          option_text: "Green",
          option_order: 3,
          vote_count: "5",
          percentage: "11.90",
        },
        {
          option_id: 4,
          option_text: "Yellow",
          option_order: 4,
          vote_count: "2",
          percentage: "4.76",
        },
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [mockSurvey] }) // SELECT survey
        .mockResolvedValueOnce({ rows: [{ total_responses: "42" }] }) // SELECT total
        .mockResolvedValueOnce({ rows: mockResults }); // SELECT results

      const results = await surveyModel.getSurveyResults(1);

      expect(results).toMatchObject({
        id: 1,
        survey_type: "single",
        question: "Favorite color?",
        total_responses: 42,
        results: [
          {
            option_id: 1,
            option_text: "Red",
            vote_count: 15,
            percentage: 35.71,
          },
          {
            option_id: 2,
            option_text: "Blue",
            vote_count: 20,
            percentage: 47.62,
          },
          {
            option_id: 3,
            option_text: "Green",
            vote_count: 5,
            percentage: 11.9,
          },
          {
            option_id: 4,
            option_text: "Yellow",
            vote_count: 2,
            percentage: 4.76,
          },
        ],
      });
    });
  });

  describe("getSurveyCorrelations", () => {
    it("should return correlations for multiple choice survey", async () => {
      const mockCorrelations = [
        {
          option1_id: 1,
          option1_text: "JavaScript",
          option2_id: 3,
          option2_text: "React",
          co_occurrence_count: "25",
          correlation_percentage: "59.52",
        },
        {
          option1_id: 2,
          option1_text: "Python",
          option2_id: 5,
          option2_text: "Django",
          co_occurrence_count: "18",
          correlation_percentage: "42.86",
        },
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ survey_type: "multiple" }] }) // SELECT survey type
        .mockResolvedValueOnce({ rows: mockCorrelations }); // SELECT correlations

      const correlations = await surveyModel.getSurveyCorrelations(1);

      expect(correlations).toEqual([
        {
          option1: { id: 1, text: "JavaScript" },
          option2: { id: 3, text: "React" },
          co_occurrence_count: 25,
          correlation_percentage: 59.52,
        },
        {
          option1: { id: 2, text: "Python" },
          option2: { id: 5, text: "Django" },
          co_occurrence_count: 18,
          correlation_percentage: 42.86,
        },
      ]);
    });

    it("should return empty array for single choice survey", async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ survey_type: "single" }] });

      const correlations = await surveyModel.getSurveyCorrelations(1);

      expect(correlations).toEqual([]);
    });
  });

  describe("getUserResponse", () => {
    it("should return user response with selected options", async () => {
      const mockResponse = {
        id: 100,
        created_at: new Date(),
        updated_at: new Date(),
        selected_options: [1, 3, 5],
      };

      pool.query.mockResolvedValueOnce({ rows: [mockResponse] });

      const response = await surveyModel.getUserResponse(1, "192.168.1.1");

      expect(response).toEqual({
        response_id: 100,
        selected_options: [1, 3, 5],
        created_at: mockResponse.created_at,
        updated_at: mockResponse.updated_at,
      });
    });

    it("should return null when no response exists", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await surveyModel.getUserResponse(1, "192.168.1.1");

      expect(response).toBeNull();
    });
  });

  describe("getSurveysByBoard", () => {
    it("should return all surveys for a board", async () => {
      const mockSurveys = [
        {
          id: 1,
          post_id: 456,
          thread_id: 123,
          survey_type: "single",
          question: "Favorite color?",
          created_at: new Date(),
          expires_at: null,
          is_active: true,
          response_count: "42",
        },
        {
          id: 2,
          post_id: 457,
          thread_id: 124,
          survey_type: "multiple",
          question: "Programming languages?",
          created_at: new Date(),
          expires_at: new Date(),
          is_active: true,
          response_count: "28",
        },
      ];

      pool.query.mockResolvedValueOnce({ rows: mockSurveys });

      const surveys = await surveyModel.getSurveysByBoard("tech");

      expect(surveys).toHaveLength(2);
      expect(surveys[0]).toMatchObject({
        id: 1,
        survey_type: "single",
        question: "Favorite color?",
        response_count: 42,
      });
      expect(surveys[1]).toMatchObject({
        id: 2,
        survey_type: "multiple",
        question: "Programming languages?",
        response_count: 28,
      });
    });
  });
});
