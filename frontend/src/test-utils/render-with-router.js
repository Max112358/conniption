// frontend/src/test-utils/render-with-router.js
import React from "react";
import { render } from "@testing-library/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

/**
 * Custom render function that wraps the component with BrowserRouter
 * @param {React.ReactElement} ui - The component to render
 * @param {Object} options - Render options
 * @returns {Object} Rendered component with router utilities
 */
export function renderWithRouter(ui, { route = "/", ...options } = {}) {
  // Set the initial route
  window.history.pushState({}, "Test page", route);

  // Wrap component with BrowserRouter
  const Wrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>;

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Custom render function that wraps the component with Routes
 * @param {React.ReactElement} ui - The component to render
 * @param {Object} options - Render options including route path
 * @returns {Object} Rendered component with router utilities
 */
export function renderWithRoutes(
  ui,
  { path = "/", initialPath = "/", ...options } = {}
) {
  // Set the initial route
  window.history.pushState({}, "Test page", initialPath);

  // Wrap component with BrowserRouter and Routes
  const Wrapper = ({ children }) => (
    <BrowserRouter>
      <Routes>
        <Route path={path} element={children} />
      </Routes>
    </BrowserRouter>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}
