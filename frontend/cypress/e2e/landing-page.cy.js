// frontend/cypress/e2e/landing-page.cy.js
describe("Landing Page", () => {
  beforeEach(() => {
    // Intercept API calls
    cy.intercept("GET", "**/api/boards", {
      statusCode: 200,
      body: {
        boards: [
          {
            id: "tech",
            name: "Technology",
            description: "Tech discussion",
            nsfw: false,
          },
          {
            id: "random",
            name: "Random",
            description: "Random discussion",
            nsfw: true,
          },
        ],
      },
    }).as("getBoards");

    // Visit landing page
    cy.visit("/");
  });

  it("should display the landing page with boards", () => {
    // Wait for API call to complete
    cy.wait("@getBoards");

    // Check if logo is visible
    cy.get('img[alt="Conniption Logo"]').should("be.visible");

    // Check if boards are displayed
    cy.contains("/tech/").should("be.visible");
    cy.contains("/random/").should("be.visible");

    // Check NSFW badge
    cy.contains("NSFW Boards").should("be.visible");
  });

  it("should navigate to a board when clicked", () => {
    // Wait for API call to complete
    cy.wait("@getBoards");

    // Intercept threads API call
    cy.intercept("GET", "**/api/boards/tech/threads", {
      statusCode: 200,
      body: {
        threads: [],
      },
    }).as("getThreads");

    // Click on a board
    cy.contains("/tech/").click();

    // Check URL
    cy.url().should("include", "/board/tech");

    // Wait for threads API call
    cy.wait("@getThreads");

    // Check board page content
    cy.contains("Technology").should("be.visible");
  });
});
