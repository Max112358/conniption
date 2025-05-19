// frontend/src/components/LandingPage.test.js
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import LandingPage from "./LandingPage";

// Mock fetch API
global.fetch = jest.fn();

describe("LandingPage Component", () => {
  beforeEach(() => {
    // Reset mock before each test
    fetch.mockReset();
  });

  test("renders loading state initially", () => {
    // Mock the fetch response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ boards: [] }),
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Loading boards...")).toBeInTheDocument();
  });

  test("renders boards after successful fetch", async () => {
    // Mock the fetch response with sample data
    const mockBoards = [
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
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ boards: mockBoards }),
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    // Wait for async operations to complete
    await waitFor(() => {
      expect(screen.getByText("/tech/")).toBeInTheDocument();
      expect(screen.getByText("/random/")).toBeInTheDocument();
    });
  });

  test("displays error when fetch fails", async () => {
    // Mock a failed fetch
    fetch.mockRejectedValueOnce(new Error("Failed to fetch"));

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    // Wait for async operations to complete
    await waitFor(() => {
      expect(screen.getByText(/failed to load boards/i)).toBeInTheDocument();
    });
  });
});
