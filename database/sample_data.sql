USE PersonalFinanceDB;

-- Fictional demo users
INSERT INTO Users
(Username, Email, PasswordHash, FullName, Phone)
VALUES
('demo_chris', 'demo_chris@example.com', 'REPLACE_WITH_ARGON2_HASH', 'Demo Chris', NULL),
('demo_chiranth', 'demo_chiranth@example.com', 'REPLACE_WITH_ARGON2_HASH', 'Demo Chiranth', NULL),
('demo_deeksha', 'demo_deeksha@example.com', 'REPLACE_WITH_ARGON2_HASH', 'Demo Deeksha', NULL),
('demo_janhavi', 'demo_janhavi@example.com', 'REPLACE_WITH_ARGON2_HASH', 'Demo Janhavi', NULL),
('demo_vivek', 'demo_vivek@example.com', 'REPLACE_WITH_ARGON2_HASH', 'Demo Vivek', NULL);
