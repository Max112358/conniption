// frontend/src/hooks/useBanCheck.js
import { useState, useCallback } from "react";

const useBanCheck = () => {
  const [banned, setBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);

  const checkBanStatus = useCallback(async (response) => {
    if (response.status === 403) {
      try {
        const errorData = await response.json();

        if (errorData.error === "Banned") {
          setBanned(true);
          setBanInfo(errorData.ban);
          return true; // Indicates user is banned
        } else if (errorData.error === "Rangebanned") {
          setBanned(true);
          setBanInfo({
            rangeban: errorData.rangeban,
            isRangeban: true,
          });
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
