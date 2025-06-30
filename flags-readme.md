# Thread IDs and Country Flags Features

## Overview

This update adds two new features to the Conniption image board:

1. **Thread IDs**: Unique identifiers for users within a thread
2. **Country Flags**: Display of poster's country based on IP geolocation

## Thread IDs

### How it works:

- Each user gets a unique 8-character ID within a thread
- The same user will have the same ID for all their posts in that thread
- IDs are different across different threads
- IDs are color-coded for easy visual distinction
- IDs cannot be reverse-engineered to obtain IP addresses

### Security:

- Uses SHA256 hashing with:
  - User's IP address
  - Thread-specific salt (randomly generated)
  - Server secret key
  - Thread ID
- Only the first 8 characters of the hash are used
- Thread salts are stored in the database
- IP addresses are never stored with posts

### Configuration:

Boards can enable thread IDs by setting `thread_ids_enabled: true` in `backend/config/boards.js`

## Country Flags

### How it works:

- Uses GeoIP lookup to determine country from IP address
- Displays country flag emoji next to post timestamp
- Shows country name on hover
- Local/private IPs show a house emoji 🏠
- Unknown IPs show a question mark ❓

### Privacy:

- Only the 2-letter country code is stored
- IP addresses are not stored
- No other location data is collected

### Configuration:

Boards can enable country flags by setting `country_flags_enabled: true` in `backend/config/boards.js`

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install geoip-lite
```

### 2. Update Database

Run the migration script:

```bash
cd backend
node migrations/add-thread-ids-and-country-flags.js
```

Or manually run these SQL commands:

```sql
-- Add columns to boards table
ALTER TABLE boards
ADD COLUMN thread_ids_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN country_flags_enabled BOOLEAN DEFAULT FALSE;

-- Add column to threads table
ALTER TABLE threads
ADD COLUMN thread_salt TEXT;

-- Add columns to posts table
ALTER TABLE posts
ADD COLUMN thread_user_id TEXT,
ADD COLUMN country_code VARCHAR(2);

-- Create indexes
CREATE INDEX idx_posts_thread_user_id ON posts(thread_user_id);
CREATE INDEX idx_posts_country_code ON posts(country_code);
```

### 3. Environment Variables

Add to your `.env` file:

```
THREAD_ID_SECRET=your_random_secret_key_here
```

Generate a secure random key for production use.

### 4. Configure Boards

Edit `backend/config/boards.js` to enable features per board:

```javascript
{
  id: "random",
  name: "Random",
  description: "Discussion about anything and everything",
  nsfw: true,
  thread_ids_enabled: true,    // Enable thread IDs
  country_flags_enabled: true,  // Enable country flags
}
```

## Testing

### Thread IDs:

1. Enable thread IDs for a board
2. Create a thread and make multiple posts
3. Verify same user has same colored ID
4. Create another thread and verify IDs are different

### Country Flags:

1. Enable country flags for a board
2. Make posts from different IPs/locations
3. Verify flags appear and show correct countries on hover
4. Test with VPN to verify different countries

## Performance Considerations

- Thread ID generation uses in-memory caching
- Cache is cleared hourly to prevent memory bloat
- Country lookup is fast (uses local database)
- Both features add minimal overhead

## Troubleshooting

### GeoIP Database Issues:

If country lookups aren't working:

```bash
cd backend
npm rebuild geoip-lite
```

This will download/update the GeoIP database.

### Thread IDs Not Appearing:

1. Check board configuration has `thread_ids_enabled: true`
2. Verify thread has a salt in database
3. Check posts have IP addresses (not stored, but needed at creation time)

### Country Flags Not Appearing:

1. Check board configuration has `country_flags_enabled: true`
2. Verify geoip-lite is installed
3. Check IP address is being passed correctly

## Future Enhancements

Possible improvements:

- Custom flag images instead of emoji
- Thread ID history/statistics for moderators
- Option to hide thread ID temporarily
- Regional flags (state/province level)
- Custom thread ID colors per board
