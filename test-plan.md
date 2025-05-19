Conniption Test Plan

1. Introduction
   This document outlines the automated testing strategy for the Conniption image board application. The purpose of this test plan is to ensure that all critical components of the application are thoroughly tested, that the application meets its functional requirements, and that regressions are detected early in the development process.

2. Test Environment
   2.1 Development Environment
   Frontend: React 19.1.0
   Backend: Express 5.1.0
   Database: PostgreSQL 15
   CDN: Cloudflare R2
   Hosting: Cloudflare Pages (Frontend), Render (Backend)
   2.2 Testing Tools
   Unit Testing: Jest
   Frontend Testing: React Testing Library, Jest
   API Testing: Supertest
   E2E Testing: Cypress
   Load Testing: k6
   Coverage Reporting: Jest Coverage, Codecov
   CI/CD: GitHub Actions
3. Testing Strategy
   3.1 Unit Testing
   Frontend Unit Tests
   Unit tests for React components focus on testing individual components in isolation, mocking dependencies where necessary.

Test Coverage Targets:

Components: 80%
Utility Functions: 90%
Hooks: 85%
Key Areas to Test:

Component rendering
State changes
User interactions
Error states
Loading states
Backend Unit Tests
Unit tests for backend focus on models, utilities, and middleware, using mocks to isolate the components being tested.

Test Coverage Targets:

Models: 90%
Middleware: 90%
Utilities: 90%
Key Areas to Test:

Data access functions
Data transformation
Authentication/authorization
Error handling
File handling
Validation
3.2 Integration Testing
Frontend Integration Tests
Integration tests for the frontend focus on testing user flows across multiple components.

Key Flows to Test:

Navigating through the application
Creating a thread with image upload
Posting a reply to a thread
Pagination and thread loading
Ban notification and appeal
Backend Integration Tests
Integration tests for the backend focus on testing the routes and their interaction with models.

Key Endpoints to Test:

/api/boards - Get all boards
/api/boards/:boardId - Get a specific board
/api/boards/:boardId/threads - Get and create threads
/api/boards/:boardId/threads/:threadId - Get a specific thread
/api/boards/:boardId/threads/:threadId/posts - Get and create posts
/api/admin/\* - Admin functionality
3.3 End-to-End Testing
E2E tests use Cypress to test the full application stack, focusing on user flows from UI interaction to database changes.

Key Flows to Test:

Landing page loads with boards
Navigating to a board shows threads
Creating a new thread
Posting a reply to a thread
Admin login and moderation functions
Ban notifications and appeals
3.4 Load Testing
Load testing uses k6 to simulate multiple users accessing the application simultaneously.

Test Scenarios:

Normal load (20 concurrent users)
High load (50 concurrent users)
Spike load (rapid increase to 100 concurrent users)
Key Metrics:

Response time
Error rate
Throughput
Resource utilization
3.5 Security Testing
Key Areas to Test:

Input validation
Authentication/authorization
XSS prevention
CSRF protection
Rate limiting
File upload validation 4. Continuous Integration/Continuous Deployment
4.1 CI Pipeline
The CI pipeline uses GitHub Actions to run tests on every push and pull request:

Run backend unit tests
Run frontend unit tests
Run E2E tests for pull requests
Generate and upload coverage reports
Deploy to production for pushes to main
4.2 Test Automation
All tests are automated and run in the CI pipeline. Tests should be fast enough to complete within 10 minutes to provide quick feedback to developers.

5. Test Maintenance
   5.1 Adding New Tests
   New tests should be added:

When new features are developed
When bugs are fixed
When refactoring existing code
5.2 Test Reporting
Test results are reported:

In the CI pipeline
Via code coverage reports in Codecov
In PR comments 6. Specific Test Cases
6.1 Frontend Component Tests
Component Test Category Description
LandingPage Rendering Displays list of boards
BoardPage Rendering Displays list of threads
ThreadPage Rendering Displays thread and posts
CreateThreadPage Form Submission Validates input and uploads image
PostModMenu Admin Functions Moderation controls work properly
BanNotification User Feedback Shows ban details and appeal form
6.2 Backend API Tests
Endpoint Method Test Description
/api/boards GET Returns list of boards
/api/boards/:boardId GET Returns specific board
/api/boards/:boardId/threads GET Returns threads for board
/api/boards/:boardId/threads POST Creates new thread with image
/api/boards/:boardId/threads/:threadId GET Returns specific thread
/api/boards/:boardId/threads/:threadId/posts GET Returns posts for thread
/api/boards/:boardId/threads/:threadId/posts POST Creates new post
/api/admin/login POST Authenticates admin user
/api/admin/bans GET Returns list of bans
/api/admin/bans POST Creates new ban
6.3 Load Test Scenarios
Scenario Description Acceptance Criteria
Normal Load 20 concurrent users for 3 minutes Response time < 500ms (95th percentile), Error rate < 1%
High Load 50 concurrent users for 3 minutes Response time < 1000ms (95th percentile), Error rate < 5%
Endurance 30 concurrent users for 30 minutes No memory leaks, Response time remains stable 7. Testing Schedule
Unit Tests: Run on every commit
Integration Tests: Run on every PR
E2E Tests: Run on every PR to main
Load Tests: Run weekly and before major releases
Security Tests: Run monthly and before major releases 8. Appendix
8.1 Test File Structure
frontend/
├── src/
│ ├── **tests**/ # Component tests
│ ├── **mocks**/ # Mock files
│ └── components/
│ └── \*.test.js # Component-specific tests
└── cypress/
├── e2e/ # E2E test specs
├── fixtures/ # Test data
└── support/ # Test helpers

backend/
├── **tests**/ # Unit and integration tests
├── models/
│ └── _.test.js # Model-specific tests
├── routes/
│ └── _.test.js # Route-specific tests
├── middleware/
│ └── \*.test.js # Middleware-specific tests
└── test/
├── setup.js # Test setup
└── api.test.js # API tests

loadtest/
└── load-test.js # k6 load test script
8.2 Running Tests Locally
bash

# Frontend tests

cd frontend
npm test # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run cy:open # Open Cypress for E2E testing
npm run test:e2e # Run all E2E tests

# Backend tests

cd backend
npm test # Run all tests
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Load tests

cd loadtest
k6 run load-test.js # Run load tests
