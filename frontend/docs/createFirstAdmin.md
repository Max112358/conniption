-- Create first admin user
-- Replace 'your_username', 'your_email', and 'your_password_hash' with actual values

-- First, generate a password hash using bcrypt with 10 salt rounds
-- You can use an online bcrypt generator or Node.js to generate this
-- Example: for password "admin123", a bcrypt hash might look like:
-- $2b$10$K1wNrTrpHQrVlKLFJ9Z.9OXgE1hQ8ZGYvKKlM5N7t3Q2S1yT7U9V6

// Run this in your terminal from the backend directory:
// node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your_password_here', 10).then(hash => console.log(hash));"

--second, insert that into the database
INSERT INTO admin_users (username, password_hash, email, role, boards, is_active)
VALUES ('admin', 'your_hash_here', 'admin@localhost', 'admin', '{}', TRUE);

--third, Verify the user was created
SELECT id, username, email, role, created_at, is_active FROM admin_users WHERE username = 'admin';
