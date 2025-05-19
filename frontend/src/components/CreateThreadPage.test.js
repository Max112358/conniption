// frontend/src/components/CreateThreadPage.test.js
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CreateThreadPage from "./CreateThreadPage";
import userEvent from "@testing-library/user-event";

// Mock router params
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useParams: () => ({ boardId: "tech" }),
  useNavigate: () => jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe("CreateThreadPage Integration", () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  test("submits thread creation form with correct data", async () => {
    // Mock successful response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "Thread created successfully",
        threadId: 123,
        boardId: "tech",
      }),
    });

    // Mock FileReader for image preview
    const mockFileReader = {
      readAsDataURL: jest.fn(),
      result: "data:image/jpeg;base64,mockdata",
      onloadend: null,
    };
    global.FileReader = jest.fn(() => mockFileReader);

    render(<CreateThreadPage />);

    // Fill in the form
    const topicInput = screen.getByLabelText(/thread topic/i);
    const contentInput = screen.getByLabelText(/content/i);
    const fileInput = screen.getByLabelText(/image \(required\)/i);

    userEvent.type(topicInput, "Test Thread Topic");
    userEvent.type(contentInput, "This is the content of the test thread");

    // Mock file upload
    const file = new File(["(⌐□_□)"], "test.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Trigger the FileReader's onloadend event
    mockFileReader.onloadend();

    // Submit the form
    const submitButton = screen.getByText("Create Thread");
    fireEvent.click(submitButton);

    // Verify form submission
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/boards/tech/threads"),
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );
    });

    // Verify success message appears
    await waitFor(() => {
      expect(
        screen.getByText(/thread created successfully/i)
      ).toBeInTheDocument();
    });
  });

  test("displays validation errors", async () => {
    render(<CreateThreadPage />);

    // Submit without filling form
    const submitButton = screen.getByText("Create Thread");
    fireEvent.click(submitButton);

    // Verify error message appears
    await waitFor(() => {
      expect(screen.getByText(/topic is required/i)).toBeInTheDocument();
    });
  });
});
