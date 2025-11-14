-- SEED DATA FOR PARKING HUB
-- Run this SQL after running database.sql to populate your database with sample data

-- ============================================
-- STEP 1: Create Sample Parking Spaces
-- ============================================

-- Section A - Car Parking
INSERT INTO parking_spaces (space_number, section, category, daily_rate, address, is_occupied) VALUES
('A-001', 'Section A - Ground Floor', 'car', 50.00, '123 Main Street, Downtown', false),
('A-002', 'Section A - Ground Floor', 'car', 50.00, '123 Main Street, Downtown', false),
('A-003', 'Section A - Ground Floor', 'car', 50.00, '123 Main Street, Downtown', false),
('A-004', 'Section A - Ground Floor', 'car', 50.00, '123 Main Street, Downtown', false),
('A-005', 'Section A - Ground Floor', 'car', 50.00, '123 Main Street, Downtown', false);

-- Section A - Truck Parking
INSERT INTO parking_spaces (space_number, section, category, daily_rate, address, is_occupied) VALUES
('A-T01', 'Section A - Truck Area', 'truck', 100.00, '123 Main Street, Downtown', false),
('A-T02', 'Section A - Truck Area', 'truck', 100.00, '123 Main Street, Downtown', false),
('A-T03', 'Section A - Truck Area', 'truck', 100.00, '123 Main Street, Downtown', false);

-- Section B - Motorcycle & Bike Parking
INSERT INTO parking_spaces (space_number, section, category, daily_rate, address, is_occupied) VALUES
('B-M01', 'Section B - Two-Wheeler Zone', 'motorcycle', 30.00, '456 Park Avenue, City Center', false),
('B-M02', 'Section B - Two-Wheeler Zone', 'motorcycle', 30.00, '456 Park Avenue, City Center', false),
('B-M03', 'Section B - Two-Wheeler Zone', 'motorcycle', 30.00, '456 Park Avenue, City Center', false),
('B-M04', 'Section B - Two-Wheeler Zone', 'motorcycle', 30.00, '456 Park Avenue, City Center', false),
('B-M05', 'Section B - Two-Wheeler Zone', 'motorcycle', 30.00, '456 Park Avenue, City Center', false);

INSERT INTO parking_spaces (space_number, section, category, daily_rate, address, is_occupied) VALUES
('B-B01', 'Section B - Bicycle Parking', 'bike', 20.00, '456 Park Avenue, City Center', false),
('B-B02', 'Section B - Bicycle Parking', 'bike', 20.00, '456 Park Avenue, City Center', false),
('B-B03', 'Section B - Bicycle Parking', 'bike', 20.00, '456 Park Avenue, City Center', false),
('B-B04', 'Section B - Bicycle Parking', 'bike', 20.00, '456 Park Avenue, City Center', false);

INSERT INTO parking_spaces (space_number, section, category, daily_rate, address, is_occupied) VALUES
('B-S01', 'Section B - Scooter Zone', 'scooter', 25.00, '456 Park Avenue, City Center', false),
('B-S02', 'Section B - Scooter Zone', 'scooter', 25.00, '456 Park Avenue, City Center', false),
('B-S03', 'Section B - Scooter Zone', 'scooter', 25.00, '456 Park Avenue, City Center', false);

-- Section C - Van & Pickup Parking
INSERT INTO parking_spaces (space_number, section, category, daily_rate, address, is_occupied) VALUES
('C-V01', 'Section C - Large Vehicles', 'van', 75.00, '789 Commerce Boulevard, Business District', false),
('C-V02', 'Section C - Large Vehicles', 'van', 75.00, '789 Commerce Boulevard, Business District', false),
('C-V03', 'Section C - Large Vehicles', 'van', 75.00, '789 Commerce Boulevard, Business District', false);

INSERT INTO parking_spaces (space_number, section, category, daily_rate, address, is_occupied) VALUES
('C-P01', 'Section C - Pickup Trucks', 'pickup', 60.00, '789 Commerce Boulevard, Business District', false),
('C-P02', 'Section C - Pickup Trucks', 'pickup', 60.00, '789 Commerce Boulevard, Business District', false),
('C-P03', 'Section C - Pickup Trucks', 'pickup', 60.00, '789 Commerce Boulevard, Business District', false),
('C-P04', 'Section C - Pickup Trucks', 'pickup', 60.00, '789 Commerce Boulevard, Business District', false);

-- Section D - Premium Parking
INSERT INTO parking_spaces (space_number, section, category, daily_rate, address, is_occupied) VALUES
('D-P01', 'Section D - Premium Covered', 'car', 100.00, '321 Executive Plaza, Premium Zone', false),
('D-P02', 'Section D - Premium Covered', 'car', 100.00, '321 Executive Plaza, Premium Zone', false),
('D-P03', 'Section D - Premium Covered', 'car', 100.00, '321 Executive Plaza, Premium Zone', false),
('D-P04', 'Section D - Premium Covered', 'car', 100.00, '321 Executive Plaza, Premium Zone', false);

-- ============================================
-- STEP 2: Create Sample Test Users
-- ============================================

-- NOTE: Users must sign up through the app first!
-- After they sign up, you can update their profiles here

-- Example: After user signs up with email 'admin@parkinghub.com'
-- Run this to make them an admin:
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@parkinghub.com';

-- Example: After user signs up with email 'user@test.com'
-- Run this to update their profile:
-- UPDATE profiles SET name = 'Test User' WHERE email = 'user@test.com';

-- ============================================
-- STEP 3: Verify the Data
-- ============================================

-- Check all parking spaces
SELECT
    space_number,
    section,
    category,
    daily_rate,
    is_occupied
FROM parking_spaces
ORDER BY section, space_number;

-- Count by category
SELECT
    category,
    COUNT(*) as total_spaces,
    SUM(CASE WHEN is_occupied THEN 1 ELSE 0 END) as occupied,
    AVG(daily_rate) as avg_rate
FROM parking_spaces
GROUP BY category
ORDER BY category;

-- Count by section
SELECT
    section,
    COUNT(*) as total_spaces
FROM parking_spaces
GROUP BY section
ORDER BY section;

-- ============================================
-- STEP 4: Create Your First Admin Account
-- ============================================

-- IMPORTANT: First sign up through the mobile app with your email
-- Then run this query to make yourself an admin:

-- UPDATE profiles
-- SET role = 'admin'
-- WHERE email = 'YOUR-EMAIL@example.com';

-- Verify admin status:
-- SELECT id, name, email, role FROM profiles WHERE role = 'admin';

-- ============================================
-- STEP 5: Sample Data for Testing (Optional)
-- ============================================

-- If you want to create test bookings, you need:
-- 1. At least one user signed up (get their user_id from auth.users)
-- 2. At least one vehicle registered

-- Example: Add a test vehicle (replace USER_ID_HERE with actual user ID)
-- INSERT INTO vehicles (user_id, vehicle_type, vehicle_model, vehicle_plate_number)
-- VALUES ('USER_ID_HERE', 'car', 'Toyota Camry', 'ABC-1234');

-- Example: Create a test booking (replace IDs with actual values)
-- INSERT INTO parking_sessions (user_id, space_id, vehicle_id, start_time, end_time, total_amount, status)
-- VALUES (
--   'USER_ID_HERE',
--   (SELECT id FROM parking_spaces WHERE space_number = 'A-001'),
--   'VEHICLE_ID_HERE',
--   NOW(),
--   NOW() + INTERVAL '1 day',
--   50.00,
--   'booked'
-- );

-- ============================================
-- CLEANUP QUERIES (if needed)
-- ============================================

-- Remove all parking spaces (CAUTION!)
-- DELETE FROM parking_spaces;

-- Remove all bookings (CAUTION!)
-- DELETE FROM parking_sessions;

-- Remove all payments (CAUTION!)
-- DELETE FROM payments;

-- Reset auto-increment (PostgreSQL doesn't use this, but IDs are UUIDs anyway)

-- ============================================
-- STATISTICS QUERIES
-- ============================================

-- Total parking capacity
SELECT
    COUNT(*) as total_spaces,
    SUM(CASE WHEN is_occupied THEN 1 ELSE 0 END) as occupied_spaces,
    COUNT(*) - SUM(CASE WHEN is_occupied THEN 1 ELSE 0 END) as available_spaces,
    ROUND(100.0 * SUM(CASE WHEN is_occupied THEN 1 ELSE 0 END) / COUNT(*), 2) as occupancy_rate
FROM parking_spaces;

-- Revenue potential per day
SELECT
    category,
    COUNT(*) as spaces,
    SUM(daily_rate) as max_daily_revenue
FROM parking_spaces
GROUP BY category
ORDER BY max_daily_revenue DESC;

-- Total potential revenue
SELECT
    SUM(daily_rate) as total_daily_potential,
    SUM(daily_rate) * 30 as monthly_potential,
    SUM(daily_rate) * 365 as yearly_potential
FROM parking_spaces;
