# Supabase Setup Guide

## 🚀 Quick Setup (Recommended)

Supabase is the perfect free database for your Parking Hub app! Here's how to set it up:

### 1. Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Sign up for free
3. Create a new project

### 2. Get Your Project Credentials

1. In your Supabase dashboard, go to Settings > API
2. Copy your `Project URL` and `anon public` key

### 3. Create Environment File

Create a `.env.local` file in your project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set Up Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable RLS (Row Level Security)
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create user_profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create parking_spaces table
CREATE TABLE parking_spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  space_number TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL,
  is_occupied BOOLEAN DEFAULT FALSE,
  vehicle_id TEXT,
  occupied_since TIMESTAMP WITH TIME ZONE,
  hourly_rate DECIMAL(10,2) DEFAULT 5.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create parking_sessions table
CREATE TABLE parking_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  space_id UUID REFERENCES parking_spaces(id),
  vehicle_id TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  total_amount DECIMAL(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payments table
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES parking_sessions(id),
  user_id UUID REFERENCES auth.users(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample parking spaces
INSERT INTO parking_spaces (space_number, section, hourly_rate) VALUES
('A-01', 'Section A', 5.00),
('A-02', 'Section A', 5.00),
('A-03', 'Section A', 5.00),
('A-04', 'Section A', 5.00),
('A-05', 'Section A', 5.00),
('B-01', 'Section B', 7.50),
('B-02', 'Section B', 7.50),
('B-03', 'Section B', 7.50),
('C-01', 'Section C', 10.00),
('C-02', 'Section C', 10.00);

-- Set up RLS policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Anyone can read parking spaces
CREATE POLICY "Anyone can read parking spaces" ON parking_spaces
  FOR SELECT TO authenticated USING (true);

-- Only admins can modify parking spaces
CREATE POLICY "Admins can modify parking spaces" ON parking_spaces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can read their own sessions
CREATE POLICY "Users can read own sessions" ON parking_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own sessions
CREATE POLICY "Users can create sessions" ON parking_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
```

### 5. Create Admin User

1. Register normally through your app
2. In Supabase, go to Authentication > Users
3. Find your user and note the ID
4. In SQL Editor, run:

```sql
INSERT INTO user_profiles (id, name, email, role)
VALUES ('your-user-id', 'Admin User', 'admin@parkinghub.com', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### 6. Test Your Setup

1. Start your development server: `npm run dev`
2. Try logging in with your admin credentials
3. You should see the admin dashboard!

## 🎯 Why Supabase?

✅ **Free Tier**: 500MB database, 50MB storage, 2GB bandwidth  
✅ **Authentication**: Built-in user management  
✅ **Real-time**: Perfect for live parking updates  
✅ **Mobile Ready**: Works with React Native  
✅ **PostgreSQL**: Full SQL database features  
✅ **Instant APIs**: Auto-generated REST and GraphQL APIs

## 🔄 Alternative Free Options

If you prefer other options:

1. **Firebase** (Google)

   - 1GB storage, 100K reads/day
   - Great mobile integration
   - NoSQL database

2. **PocketBase** (Self-hosted)

   - Completely free
   - Single binary deployment
   - Built-in admin UI

3. **Appwrite** (Self-hosted or cloud)
   - Open source
   - Multi-platform support
   - Built-in authentication

## 🛠 Need Help?

If you run into any issues:

1. Check the Supabase logs in your dashboard
2. Verify your environment variables
3. Make sure RLS policies are set up correctly

Your app is already configured to work with Supabase - you just need to add your project credentials!
