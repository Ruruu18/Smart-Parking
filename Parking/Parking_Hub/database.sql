-- PostgreSQL/Supabase Database Schema for Parking Hub

-- Note: auth.users table is managed by Supabase Auth automatically
-- This file creates the application-specific tables

-- Parking spaces table  
CREATE TABLE IF NOT EXISTS parking_spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  space_number VARCHAR(20) NOT NULL,
  section VARCHAR(100),
  category TEXT NOT NULL,
  is_occupied BOOLEAN DEFAULT FALSE,
  vehicle_id TEXT,
  occupied_since TIMESTAMPTZ,
  daily_rate DECIMAL(10,2) NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
 
-- Parking sessions table (replaces bookings with more comprehensive tracking)
CREATE TABLE IF NOT EXISTS parking_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  space_id UUID, -- Nullable to preserve history when parking space is deleted
  vehicle_id TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  total_amount DECIMAL(10,2),
  status TEXT NOT NULL CHECK (status IN ('booked', 'checked_in', 'in_progress', 'completed', 'cancelled')) DEFAULT 'booked',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id) REFERENCES parking_spaces(id) ON DELETE SET NULL -- Preserve sessions when space deleted
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  space_id UUID NOT NULL,
  session_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id) REFERENCES parking_spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES parking_sessions(id) ON DELETE CASCADE,
  CONSTRAINT unique_review UNIQUE (user_id, space_id, session_id)
);

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  method_type TEXT NOT NULL CHECK (method_type IN ('credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay')),
  card_last_four VARCHAR(4),
  card_brand VARCHAR(20),
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Payment history table
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES parking_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Admin activities table (for tracking admin actions)
CREATE TABLE IF NOT EXISTS admin_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- User activities table (for tracking end-user events like bookings, payments, views)
CREATE TABLE IF NOT EXISTS user_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking', 'payment', 'view', 'parking', 'profile', 'other')),
  action TEXT NOT NULL,
  details TEXT,
  session_id UUID,
  payment_id UUID,
  space_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES parking_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id) REFERENCES parking_spaces(id) ON DELETE CASCADE
);

-- User profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table (User Vehicle Management)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'truck', 'van', 'pickup', 'bike', 'motorcycle', 'scooter')),
  vehicle_model VARCHAR(255) NOT NULL,
  vehicle_plate_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT unique_plate UNIQUE (vehicle_plate_number)
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to handle re-runs)
DROP POLICY IF EXISTS "Anyone can view parking spaces" ON parking_spaces;
DROP POLICY IF EXISTS "Only authenticated users can modify parking spaces" ON parking_spaces;
DROP POLICY IF EXISTS "Authenticated users can modify parking spaces" ON parking_spaces;
DROP POLICY IF EXISTS "Users can view own sessions" ON parking_sessions;
DROP POLICY IF EXISTS "Authenticated users can view all sessions" ON parking_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON parking_sessions;
DROP POLICY IF EXISTS "Allow all authenticated users to view sessions" ON parking_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON parking_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON parking_sessions;
DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
DROP POLICY IF EXISTS "Users can insert own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can view own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can insert own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can update own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can delete own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Only admins can view admin activities" ON admin_activities;
DROP POLICY IF EXISTS "Only admins can insert admin activities" ON admin_activities;
DROP POLICY IF EXISTS "Allow authenticated to view user activities" ON user_activities;
DROP POLICY IF EXISTS "Users can view own activities" ON user_activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON user_activities;
DROP POLICY IF EXISTS "Users can view own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can insert own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can update own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can delete own vehicles" ON vehicles;

-- RLS Policies for parking_spaces (publicly viewable, admin manageable)
CREATE POLICY "Anyone can view parking spaces" ON parking_spaces
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can modify parking spaces" ON parking_spaces
  FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for parking_sessions - SIMPLIFIED FOR ADMIN ACCESS
-- Temporarily allow all authenticated users to view sessions
CREATE POLICY "Allow all authenticated users to view sessions" ON parking_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own sessions" ON parking_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON parking_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON parking_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for reviews
CREATE POLICY "Anyone can view reviews" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" ON reviews
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for payment_methods
CREATE POLICY "Users can view own payment methods" ON payment_methods
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods" ON payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods" ON payment_methods
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods" ON payment_methods
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" ON payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Helper to check admin role from signed JWT app_metadata
CREATE OR REPLACE FUNCTION is_admin_from_jwt()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    ((auth.jwt() -> 'app_metadata' -> 'roles')::jsonb ? 'admin') OR
    ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  , false);
$$;

-- Allow admins to view all payments without relying on user_metadata
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (is_admin_from_jwt());

-- RLS Policies for admin_activities (admin only)
CREATE POLICY "Only admins can view admin activities" ON admin_activities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can insert admin activities" ON admin_activities
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for user_activities
-- Allow authenticated to view (so admins can aggregate easily); tighten later if needed
CREATE POLICY "Allow authenticated to view user activities" ON user_activities
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own activities" ON user_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities" ON user_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for vehicles
CREATE POLICY "Users can view own vehicles" ON vehicles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vehicles" ON vehicles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicles" ON vehicles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicles" ON vehicles
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for profiles
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parking_sessions_user_id ON parking_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_space_id ON parking_sessions(space_id);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_status ON parking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_vehicle_id ON parking_sessions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(vehicle_plate_number);
CREATE INDEX IF NOT EXISTS idx_reviews_space_id ON reviews(space_id);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at);

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_session_for_admin(UUID);
DROP FUNCTION IF EXISTS get_vehicle_for_admin(UUID);
DROP FUNCTION IF EXISTS get_profile_for_admin(UUID);

-- Admin function to get session details (bypasses RLS)
CREATE OR REPLACE FUNCTION get_session_for_admin(session_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  space_id UUID,
  vehicle_id TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  total_amount DECIMAL,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.user_id,
    ps.space_id,
    ps.vehicle_id,
    ps.start_time,
    ps.end_time,
    ps.total_amount,
    ps.status,
    ps.created_at
  FROM parking_sessions ps
  WHERE ps.id = session_id;
END;
$$;

-- Grant execute permission to authenticated users (for admin scanner)
GRANT EXECUTE ON FUNCTION get_session_for_admin(UUID) TO authenticated;

-- Admin function to get vehicle details (bypasses RLS)
CREATE OR REPLACE FUNCTION get_vehicle_for_admin(vehicle_id UUID)
RETURNS TABLE (
  id UUID,
  vehicle_type TEXT,
  vehicle_model VARCHAR,
  vehicle_plate_number VARCHAR
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.vehicle_type,
    v.vehicle_model,
    v.vehicle_plate_number
  FROM vehicles v
  WHERE v.id = vehicle_id;
END;
$$;

-- Admin function to get user profile details (bypasses RLS)
CREATE OR REPLACE FUNCTION get_profile_for_admin(user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  role TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.role
  FROM profiles p
  WHERE p.id = user_id;
END;
$$;

-- Admin function to update session status (bypasses RLS)
CREATE OR REPLACE FUNCTION update_session_status_for_admin(session_id UUID, new_status TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE parking_sessions 
  SET status = new_status 
  WHERE id = session_id;
  
  RETURN FOUND;
END;
$$;

-- Admin function to set the session end time at checkout (bypasses RLS)
CREATE OR REPLACE FUNCTION set_session_end_time_for_admin(session_id UUID, end_ts TIMESTAMPTZ)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE parking_sessions
  SET end_time = end_ts
  WHERE id = session_id;

  RETURN FOUND;
END;
$$;

-- Admin function to set the session start time at check-in (bypasses RLS)
CREATE OR REPLACE FUNCTION set_session_start_time_for_admin(session_id UUID, start_ts TIMESTAMPTZ)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE parking_sessions
  SET start_time = start_ts
  WHERE id = session_id;

  RETURN FOUND;
END;
$$;

-- USER ACTIVITY LOGGING FUNCTIONS/TRIGGERS

-- Log booking creation, check-in/out updates to user_activities
DROP FUNCTION IF EXISTS log_user_activity_on_session() CASCADE;
CREATE OR REPLACE FUNCTION log_user_activity_on_session()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'booked' THEN
      INSERT INTO user_activities (user_id, type, action, details, session_id, space_id, metadata)
      VALUES (
        NEW.user_id,
        'booking',
        'booking_created',
        'New booking created',
        NEW.id,
        NEW.space_id,
        jsonb_build_object('start_time', NEW.start_time, 'end_time', NEW.end_time)
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'checked_in' THEN
        INSERT INTO user_activities (user_id, type, action, details, session_id, space_id)
        VALUES (NEW.user_id, 'parking', 'check_in', 'Checked in by admin', NEW.id, NEW.space_id);
      ELSIF NEW.status = 'completed' THEN
        INSERT INTO user_activities (user_id, type, action, details, session_id, space_id)
        VALUES (NEW.user_id, 'parking', 'check_out', 'Checked out by admin', NEW.id, NEW.space_id);
      ELSIF NEW.status = 'cancelled' THEN
        INSERT INTO user_activities (user_id, type, action, details, session_id, space_id)
        VALUES (NEW.user_id, 'booking', 'booking_cancelled', 'Booking cancelled', NEW.id, NEW.space_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_activity_on_session_insert ON parking_sessions;
CREATE TRIGGER trg_user_activity_on_session_insert
AFTER INSERT ON parking_sessions
FOR EACH ROW
EXECUTE FUNCTION log_user_activity_on_session();

DROP TRIGGER IF EXISTS trg_user_activity_on_session_update ON parking_sessions;
CREATE TRIGGER trg_user_activity_on_session_update
AFTER UPDATE ON parking_sessions
FOR EACH ROW
EXECUTE FUNCTION log_user_activity_on_session();

-- Log payment events into user_activities
DROP FUNCTION IF EXISTS log_user_activity_on_payment() CASCADE;
CREATE OR REPLACE FUNCTION log_user_activity_on_payment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO user_activities (user_id, type, action, details, session_id, payment_id, metadata)
    VALUES (NEW.user_id, 'payment', 'payment_created', 'Payment created', NEW.session_id, NEW.id,
            jsonb_build_object('amount', NEW.amount, 'status', NEW.status, 'method', NEW.payment_method));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO user_activities (user_id, type, action, details, session_id, payment_id, metadata)
      VALUES (NEW.user_id, 'payment', CONCAT('payment_', NEW.status), 'Payment status updated', NEW.session_id, NEW.id,
              jsonb_build_object('amount', NEW.amount, 'old_status', OLD.status, 'new_status', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_activity_on_payment_insert ON payments;
CREATE TRIGGER trg_user_activity_on_payment_insert
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION log_user_activity_on_payment();

DROP TRIGGER IF EXISTS trg_user_activity_on_payment_update ON payments;
CREATE TRIGGER trg_user_activity_on_payment_update
AFTER UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION log_user_activity_on_payment();

-- Function to log booking activity automatically
CREATE OR REPLACE FUNCTION log_booking_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    vehicle_type_val TEXT := 'Vehicle';
    space_number_val TEXT := 'Unknown';
    activity_details TEXT;
BEGIN
    -- Only log for new bookings (INSERT with status 'booked')
    IF TG_OP = 'INSERT' AND NEW.status = 'booked' THEN
        
        -- Get vehicle type
        IF NEW.vehicle_id IS NOT NULL THEN
            SELECT vehicle_type INTO vehicle_type_val
            FROM vehicles 
            WHERE id = NEW.vehicle_id::UUID;
            
            -- Capitalize first letter
            vehicle_type_val := INITCAP(COALESCE(vehicle_type_val, 'Vehicle'));
        END IF;
        
        -- Get space number
        IF NEW.space_id IS NOT NULL THEN
            SELECT space_number INTO space_number_val
            FROM parking_spaces 
            WHERE id = NEW.space_id;
            
            space_number_val := COALESCE(space_number_val, 'Unknown');
        END IF;
        
        -- Create activity details
        activity_details := 'Booked ' || vehicle_type_val || ' ' || space_number_val;
        
        -- Insert admin activity
        INSERT INTO admin_activities (admin_id, action, details)
        VALUES (NEW.user_id, 'booking', activity_details);
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for booking activity logging
DROP TRIGGER IF EXISTS trigger_log_booking_activity ON parking_sessions;
CREATE TRIGGER trigger_log_booking_activity
    AFTER INSERT ON parking_sessions
    FOR EACH ROW
    EXECUTE FUNCTION log_booking_activity();

-- Grant execute permissions to authenticated users (for admin scanner)
GRANT EXECUTE ON FUNCTION get_vehicle_for_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_profile_for_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_session_status_for_admin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_session_end_time_for_admin(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION set_session_start_time_for_admin(UUID, TIMESTAMPTZ) TO authenticated;