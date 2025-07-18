// backend/config/surveys.js
const surveysConfig = {
  // Maximum number of characters allowed in survey question
  questionCharacterLimit: 280,

  // Maximum number of characters allowed in each survey option
  optionCharacterLimit: 280,

  // Minimum number of options required
  minOptions: 2,

  // Maximum number of options allowed
  maxOptions: 16,
};

module.exports = surveysConfig;
