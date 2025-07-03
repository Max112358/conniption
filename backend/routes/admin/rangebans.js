// backend/routes/admin/rangebans.js
const express = require("express");
const router = express.Router();
const rangebanModel = require("../../models/rangeban");
const adminAuth = require("../../middleware/adminAuth");
const { getCountryName } = require("../../utils/countryLookup");

/**
 * @route   GET /api/admin/rangebans
 * @desc    Get active rangebans
 * @access  Admin only
 */
router.get("/", adminAuth.requireAdmin, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/rangebans - by ${req.session.adminUser.username}`
  );

  try {
    const { boardId } = req.query;
    const rangebans = await rangebanModel.getActiveRangebans(boardId);

    // Add country names for country bans
    const rangebansWithNames = rangebans.map((rb) => {
      if (rb.ban_type === "country") {
        return {
          ...rb,
          country_name: getCountryName(rb.ban_value),
        };
      }
      return rb;
    });

    res.json({ rangebans: rangebansWithNames });
  } catch (error) {
    console.error("Route Error - GET /api/admin/rangebans:", error);
    next(error);
  }
});

/**
 * @route   POST /api/admin/rangebans
 * @desc    Create a new rangeban
 * @access  Admin only
 */
router.post("/", adminAuth.requireAdmin, async (req, res, next) => {
  console.log(
    `Route: POST /api/admin/rangebans - by ${req.session.adminUser.username}`
  );

  try {
    const { ban_type, ban_value, board_id, reason, expires_at } = req.body;

    // Validate input
    if (!ban_type || !ban_value || !reason) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["ban_type", "ban_value", "reason"],
      });
    }

    // Validate ban_type
    if (!["country", "ip_range", "asn"].includes(ban_type)) {
      return res.status(400).json({
        error: "Invalid ban type",
        allowed: ["country", "ip_range", "asn"],
      });
    }

    // For country bans, validate country code
    if (ban_type === "country") {
      if (ban_value.length !== 2) {
        return res.status(400).json({
          error: "Country code must be 2 letters",
        });
      }
      // Check if it's a valid country code
      const countryName = getCountryName(ban_value.toUpperCase());
      if (countryName === "Unknown") {
        return res.status(400).json({
          error: "Invalid country code",
        });
      }
    }

    const rangeban = await rangebanModel.createRangeban({
      ban_type,
      ban_value: ban_value.toUpperCase(), // Uppercase for country codes
      board_id: board_id || null,
      reason,
      expires_at: expires_at || null,
      admin_user_id: req.session.adminUser.id,
    });

    res.status(201).json({
      message: "Rangeban created successfully",
      rangeban: {
        ...rangeban,
        country_name:
          ban_type === "country"
            ? getCountryName(rangeban.ban_value)
            : undefined,
      },
    });
  } catch (error) {
    console.error("Route Error - POST /api/admin/rangebans:", error);

    // Check for duplicate rangeban
    if (error.message && error.message.includes("already exists")) {
      return res.status(409).json({ error: error.message });
    }

    next(error);
  }
});

/**
 * @route   GET /api/admin/rangebans/stats
 * @desc    Get rangeban statistics
 * @access  Admin only
 */
router.get("/stats", adminAuth.requireAdmin, async (req, res, next) => {
  console.log(
    `Route: GET /api/admin/rangebans/stats - by ${req.session.adminUser.username}`
  );

  try {
    const stats = await rangebanModel.getRangebanStats();

    // Add country names to top countries
    if (stats.topCountries) {
      stats.topCountries = stats.topCountries.map((country) => ({
        ...country,
        country_name: getCountryName(country.country_code),
      }));
    }

    res.json({ stats });
  } catch (error) {
    console.error("Route Error - GET /api/admin/rangebans/stats:", error);
    next(error);
  }
});

/**
 * @route   GET /api/admin/rangebans/:rangebanId
 * @desc    Get rangeban by ID
 * @access  Admin only
 */
router.get("/:rangebanId", adminAuth.requireAdmin, async (req, res, next) => {
  const { rangebanId } = req.params;
  console.log(
    `Route: GET /api/admin/rangebans/${rangebanId} - by ${req.session.adminUser.username}`
  );

  try {
    const rangeban = await rangebanModel.getRangebanById(rangebanId);

    if (!rangeban) {
      return res.status(404).json({ error: "Rangeban not found" });
    }

    // Add country name if it's a country ban
    if (rangeban.ban_type === "country") {
      rangeban.country_name = getCountryName(rangeban.ban_value);
    }

    res.json({ rangeban });
  } catch (error) {
    console.error(
      `Route Error - GET /api/admin/rangebans/${rangebanId}:`,
      error
    );
    next(error);
  }
});

/**
 * @route   PUT /api/admin/rangebans/:rangebanId
 * @desc    Update rangeban
 * @access  Admin only
 */
router.put("/:rangebanId", adminAuth.requireAdmin, async (req, res, next) => {
  const { rangebanId } = req.params;
  console.log(
    `Route: PUT /api/admin/rangebans/${rangebanId} - by ${req.session.adminUser.username}`
  );

  try {
    const { reason, expires_at, is_active } = req.body;

    const updates = {
      admin_user_id: req.session.adminUser.id,
    };

    if (reason !== undefined) updates.reason = reason;
    if (expires_at !== undefined) updates.expires_at = expires_at;
    if (is_active !== undefined) updates.is_active = is_active;

    const updatedRangeban = await rangebanModel.updateRangeban(
      rangebanId,
      updates
    );

    if (!updatedRangeban) {
      return res.status(404).json({ error: "Rangeban not found" });
    }

    // Add country name if it's a country ban
    if (updatedRangeban.ban_type === "country") {
      updatedRangeban.country_name = getCountryName(updatedRangeban.ban_value);
    }

    res.json({
      message: "Rangeban updated successfully",
      rangeban: updatedRangeban,
    });
  } catch (error) {
    console.error(
      `Route Error - PUT /api/admin/rangebans/${rangebanId}:`,
      error
    );
    next(error);
  }
});

/**
 * @route   DELETE /api/admin/rangebans/:rangebanId
 * @desc    Remove rangeban (set inactive)
 * @access  Admin only
 */
router.delete(
  "/:rangebanId",
  adminAuth.requireAdmin,
  async (req, res, next) => {
    const { rangebanId } = req.params;
    console.log(
      `Route: DELETE /api/admin/rangebans/${rangebanId} - by ${req.session.adminUser.username}`
    );

    try {
      const updatedRangeban = await rangebanModel.updateRangeban(rangebanId, {
        is_active: false,
        admin_user_id: req.session.adminUser.id,
        reason: `Removed by ${req.session.adminUser.username}`,
      });

      if (!updatedRangeban) {
        return res.status(404).json({ error: "Rangeban not found" });
      }

      res.json({ message: "Rangeban removed successfully" });
    } catch (error) {
      console.error(
        `Route Error - DELETE /api/admin/rangebans/${rangebanId}:`,
        error
      );
      next(error);
    }
  }
);

module.exports = router;
