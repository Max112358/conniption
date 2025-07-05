// frontend/src/hooks/useBanCheck.js
import { useState, useCallback } from "react";
import { handleApiError } from "../utils/apiErrorHandler";

const useBanCheck = () => {
  const [banned, setBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);

  const checkBanStatus = useCallback(async (response) => {
    if (response.status === 403) {
      try {
        const errorData = await response.json();

        if (errorData.error === "Banned") {
          setBanned(true);

          // Use the API error handler for consistent messaging
          const banData = {
            ...errorData.ban,
            displayMessage: handleApiError(errorData),
          };

          setBanInfo(banData);
          return true; // Indicates user is banned
        } else if (errorData.error === "Rangebanned") {
          setBanned(true);

          // Use the API error handler for consistent messaging
          const rangebanData = {
            rangeban: {
              ...errorData.rangeban,
              displayMessage: handleApiError(errorData),
            },
            isRangeban: true,
          };

          setBanInfo(rangebanData);
          return true; // Indicates user is rangebanned
        }
      } catch (error) {
        console.error("Error parsing ban response:", error);
      }
    }
    return false; // Not banned
  }, []);

  const resetBanStatus = useCallback(() => {
    setBanned(false);
    setBanInfo(null);
  }, []);

  return {
    banned,
    banInfo,
    checkBanStatus,
    resetBanStatus,
  };
};

export default useBanCheck;
