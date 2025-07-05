// frontend/src/utils/apiErrorHandler.js

/**
 * Handles API error responses and returns user-friendly error messages
 * @param {Object} errorData - The error response data from the API
 * @returns {string} - User-friendly error message
 */
export const handleApiError = (errorData) => {
  // Default to the generic error message
  let errorMessage = errorData.error || "An error occurred";

  // If there's a more detailed message, use that instead
  if (errorData.message) {
    errorMessage = errorData.message;
  }

  // Handle specific error types with enhanced messages
  switch (errorData.error) {
    case "Rangebanned":
      if (errorData.rangeban) {
        const rangeban = errorData.rangeban;
        let banMessage = "";

        if (rangeban.type === "country") {
          banMessage = `Your country (${rangeban.value}) is banned from this board`;
        } else if (rangeban.type === "asn") {
          banMessage = `Your network (ASN ${rangeban.value}) is banned from this board`;
        } else if (rangeban.type === "ip_range") {
          banMessage = `Your IP range (${rangeban.value}) is banned from this board`;
        } else {
          banMessage = `Your ${rangeban.type} is banned from this board`;
        }

        // Add duration info
        if (rangeban.expires_at) {
          banMessage += ` until ${new Date(
            rangeban.expires_at
          ).toLocaleString()}`;
        } else {
          banMessage += ` permanently`;
        }

        // Add reason if available
        if (rangeban.reason) {
          banMessage += `. Reason: ${rangeban.reason}`;
        }

        errorMessage = banMessage;
      }
      break;

    case "Banned":
      if (errorData.ban) {
        const ban = errorData.ban;
        let banMessage = "You are banned from this board";

        // Add duration info
        if (ban.expires_at) {
          banMessage += ` until ${new Date(ban.expires_at).toLocaleString()}`;
        } else {
          banMessage += ` permanently`;
        }

        // Add reason if available
        if (ban.reason) {
          banMessage += `. Reason: ${ban.reason}`;
        }

        errorMessage = banMessage;
      }
      break;

    case "File too large":
      errorMessage =
        "The uploaded file is too large. Please choose a file smaller than 4MB.";
      break;

    case "Invalid file type":
      errorMessage =
        "Invalid file type. Only PNG, JPG, WebP, GIF, MP4, and WebM files are allowed.";
      break;

    case "Rate limited":
      errorMessage =
        "You are posting too quickly. Please wait a moment before posting again.";
      break;

    case "Thread not found":
      errorMessage = "This thread no longer exists or has been deleted.";
      break;

    case "Board not found":
      errorMessage = "This board does not exist.";
      break;

    case "Content too long":
      errorMessage =
        "Your post content is too long. Please shorten it and try again.";
      break;

    case "No content":
      errorMessage = "Please provide either text content or an image/video.";
      break;

    default:
      // For other errors, use the message if available, otherwise use the error
      break;
  }

  return errorMessage;
};

/**
 * Handles fetch response errors and extracts error data
 * @param {Response} response - The fetch response object
 * @returns {Promise<string>} - Promise that resolves to error message
 */
export const handleFetchError = async (response) => {
  try {
    const errorData = await response.json();
    return handleApiError(errorData);
  } catch (parseError) {
    // If we can't parse the response, return a generic error
    console.error("Error parsing error response:", parseError);
    return `Server error (${response.status}). Please try again later.`;
  }
};

/**
 * Makes an API request and handles errors consistently
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Promise that resolves to response data or throws formatted error
 */
export const apiRequest = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: options.credentials || "include",
    });

    if (!response.ok) {
      const errorMessage = await handleFetchError(response);
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    // If it's already a formatted error message, throw it as is
    if (error.message) {
      throw error;
    }

    // Otherwise, format it
    throw new Error(
      "Network error. Please check your connection and try again."
    );
  }
};
