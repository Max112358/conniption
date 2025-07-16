// frontend/src/hooks/useAdminStatus.js

import { useState, useEffect } from "react";

export default function useAdminStatus() {
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    const checkAdminStatus = () => {
      const storedUser = localStorage.getItem("adminUser");
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          setAdminUser(userData);
        } catch (err) {
          console.error("Error parsing admin user data:", err);
          setAdminUser(null);
        }
      } else {
        setAdminUser(null);
      }
    };

    // Initial check
    checkAdminStatus();

    // Listen for storage changes (in case admin logs in/out in another tab)
    const handleStorageChange = (e) => {
      if (e.key === "adminUser") {
        checkAdminStatus();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const isAdmin = adminUser?.role === "admin";
  const isModerator = adminUser?.role === "moderator" || isAdmin;
  const isJanitor = adminUser?.role === "janitor";
  const hasAnyAdminRole = isAdmin || isModerator || isJanitor;

  return {
    adminUser,
    isAdmin,
    isModerator,
    isJanitor,
    hasAnyAdminRole,
  };
}
