# Rangeban API Guide for Frontend Implementation

## Overview

The rangeban system allows administrators to block users from specific countries from posting on the imageboard. This guide explains how to use the backend API to manage country-based rangebans.

## API Endpoints

### 1. Get Active Rangebans

**Endpoint:** `GET /api/admin/rangebans`  
**Authentication:** Required (Admin only)  
**Query Parameters:**

- `boardId` (optional) - Filter rangebans by board

**Response:**

```json
{
  "rangebans": [
    {
      "id": 1,
      "ban_type": "country",
      "ban_value": "RU",
      "board_id": null, // null means global ban
      "reason": "Spam prevention",
      "expires_at": null, // null means permanent
      "created_at": "2024-01-15T10:30:00Z",
      "admin_user_id": 1,
      "admin_username": "admin",
      "is_active": true,
      "country_name": "Russia" // Added for country bans
    }
  ]
}
```

### 2. Create Country Rangeban

**Endpoint:** `POST /api/admin/rangebans`  
**Authentication:** Required (Admin only)  
**Body:**

```json
{
  "ban_type": "country",
  "ban_value": "RU", // Two-letter country code (uppercase)
  "board_id": null, // null for global, or specific board ID
  "reason": "Spam from this region",
  "expires_at": null // null for permanent, or ISO date string
}
```

**Response:**

```json
{
  "message": "Rangeban created successfully",
  "rangeban": {
    "id": 2,
    "ban_type": "country",
    "ban_value": "RU",
    "board_id": null,
    "reason": "Spam from this region",
    "expires_at": null,
    "created_at": "2024-01-15T10:35:00Z",
    "admin_user_id": 1,
    "is_active": true,
    "country_name": "Russia"
  }
}
```

### 3. Update Rangeban

**Endpoint:** `PUT /api/admin/rangebans/:rangebanId`  
**Authentication:** Required (Admin only)  
**Body:**

```json
{
  "reason": "Updated reason",
  "expires_at": "2024-12-31T23:59:59Z", // Set expiration
  "is_active": true // or false to disable
}
```

### 4. Remove Rangeban (Soft Delete)

**Endpoint:** `DELETE /api/admin/rangebans/:rangebanId`  
**Authentication:** Required (Admin only)  
**Description:** Sets the rangeban to inactive (soft delete)

### 5. Get Rangeban Statistics

**Endpoint:** `GET /api/admin/rangebans/stats`  
**Authentication:** Required (Admin only)  
**Response:**

```json
{
  "stats": {
    "byType": [
      {
        "ban_type": "country",
        "count": "5",
        "active_count": "3"
      }
    ],
    "topCountries": [
      {
        "country_code": "RU",
        "ban_count": "2",
        "global_bans": "1",
        "country_name": "Russia"
      }
    ]
  }
}
```

## Country Codes

Use standard ISO 3166-1 alpha-2 country codes (2 letters, uppercase):

- US - United States
- RU - Russia
- CN - China
- DE - Germany
- FR - France
- GB - United Kingdom
- JP - Japan
- etc.

## Frontend Implementation Guide

### 1. Country Selection Component

Create a component that displays all countries with toggles:

```javascript
// Fetch active rangebans on component mount
const fetchRangebans = async () => {
  const response = await fetch("/api/admin/rangebans", {
    credentials: "include",
  });
  const data = await response.json();
  // Convert to a Set of banned country codes for easy lookup
  const bannedCountries = new Set(
    data.rangebans
      .filter((rb) => rb.ban_type === "country" && rb.is_active)
      .map((rb) => rb.ban_value)
  );
  return bannedCountries;
};
```

### 2. Toggle Country Ban

```javascript
const toggleCountryBan = async (countryCode, countryName, isBanned) => {
  if (isBanned) {
    // Find and remove the ban
    const rangebans = await fetchRangebans();
    const ban = rangebans.find(
      (rb) =>
        rb.ban_type === "country" &&
        rb.ban_value === countryCode &&
        rb.is_active
    );

    if (ban) {
      await fetch(`/api/admin/rangebans/${ban.id}`, {
        method: "DELETE",
        credentials: "include",
      });
    }
  } else {
    // Create new ban
    await fetch("/api/admin/rangebans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        ban_type: "country",
        ban_value: countryCode,
        board_id: null, // or specific board
        reason: `Country ban: ${countryName}`,
        expires_at: null, // permanent
      }),
    });
  }
};
```

### 3. Board-Specific Bans

To ban a country from specific boards only:

```javascript
const banCountryFromBoard = async (countryCode, boardId, reason) => {
  await fetch("/api/admin/rangebans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      ban_type: "country",
      ban_value: countryCode,
      board_id: boardId, // Specific board
      reason: reason,
      expires_at: null,
    }),
  });
};
```

## User Experience

When a user from a banned country tries to post, they will receive:

```json
{
  "error": "Rangebanned",
  "message": "Your country is banned from this board permanently. Reason: Spam prevention",
  "rangeban": {
    "type": "country",
    "value": "RU",
    "reason": "Spam prevention",
    "expires_at": null,
    "board_id": null
  }
}
```

Status Code: `403 Forbidden`

## Best Practices

1. **Global vs Board-Specific**: Consider whether to ban countries globally or per-board
2. **Reason Documentation**: Always provide clear reasons for bans
3. **Temporary Bans**: Use `expires_at` for temporary restrictions
4. **Monitoring**: Use the stats endpoint to track ban effectiveness
5. **Error Handling**: Always handle 403 responses gracefully in the UI

## Testing

To test if a country ban is working:

1. Create a ban for a specific country
2. Use a VPN or proxy from that country
3. Try to create a post
4. Verify you receive the 403 error with rangeban details

## Notes

- Country detection is based on IP geolocation and may not be 100% accurate
- VPNs and proxies can bypass country bans
- The system uses the `geoip-lite` library for country detection
- Local/private IPs return country code "LO" and are not affected by country bans
- Cloudflare IPs return "CF" if headers are misconfigured
