// frontend/src/components/CreateThreadPage.test.js
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import CreateThreadPage from "./CreateThreadPage";

// Mock the react-router-dom hooks
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useParams: () => ({ boardId: "tech" }),
  useNavigate: () => jest.fn(),
}));

// Mock fetch API
global.fetch = jest.fn();

describe("CreateThreadPage Component", () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  test("renders create thread form", async () => {
    // Mock board data fetch
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        board: {
          id: "tech",
          name: "Technology",
          description: "Tech discussion",
          nsfw: false,
        },
      }),
    });

    render(
      <BrowserRouter>
        <CreateThreadPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Create New Thread")).toBeInTheDocument();
    expect(screen.getByLabelText("Thread Topic")).toBeInTheDocument();
    expect(screen.getByLabelText("Content")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Image or Video (Required)")
    ).toBeInTheDocument();
  });

  test("displays error when form is submitted without required fields", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        board: {
          id: "tech",
          name: "Technology",
          description: "Tech discussion",
          nsfw: false,
        },
      }),
    });

    render(
      <BrowserRouter>
        <CreateThreadPage />
      </BrowserRouter>
    );

    const submitButton = screen.getByText("Create Thread");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Topic is required")).toBeInTheDocument();
    });
  });

  test("displays file size error for large files", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        board: {
          id: "tech",
          name: "Technology",
          description: "Tech discussion",
          nsfw: false,
        },
      }),
    });

    render(
      <BrowserRouter>
        <CreateThreadPage />
      </BrowserRouter>
    );

    const fileInput = screen.getByLabelText("Image or Video (Required)");
    const largeFile = new File(["x".repeat(5 * 1024 * 1024)], "large.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(
        screen.getByText("File size must be less than 4MB")
      ).toBeInTheDocument();
    });
  });
});
