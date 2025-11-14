# Parking Hub - Setup Guide

Complete guide to clone and set up the Parking Hub project on a new device.

## Project Structure

This project consists of two main applications:
- **Parking/Parking_Hub** - React Native mobile app (Expo) for users
- **Parking** - React web app (Vite) for admin dashboard

## Prerequisites

1. **Node.js** (v18 or higher)
   ```bash
   node --version
   ```

2. **npm** or **yarn**
   ```bash
   npm --version
   ```

3. **Git**
   ```bash
   git --version
   ```

4. **Expo CLI** (for mobile app)
   ```bash
   npm install -g expo-cli
   ```

5. **Expo Go app** on your phone (for testing mobile app)
   - iOS: Download from App Store
   - Android: Download from Google Play

6. **Supabase Account** (for database)
   - Create account at https://supabase.com

## Step 1: Clone the Repository

```bash
git clone <your-repository-url>
cd "Parking Hub - QR Parking Management System"
```

## Step 2: Set Up Supabase Database

### 2.1 Create a New Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in project details:
   - Name: Parking Hub
   - Database Password: (create a strong password)
   - Region: Choose closest to you

### 2.2 Get Your API Keys

Once your project is created:
1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (looks like: https://xxxxx.supabase.co)
   - **anon/public key** (starts with eyJhbGci...)
   - **service_role key** (starts with eyJhbGci...) - Keep this secret!

### 2.3 Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Open the file `Parking/Parking_Hub/database.sql` from your cloned project
3. Copy all the SQL code
4. Paste into Supabase SQL Editor
5. Click **Run** to execute

This will create:
- All database tables (parking_spaces, parking_sessions, payments, etc.)
- Row Level Security policies
- Admin functions
- Triggers for activity logging
- Indexes for performance

### 2.4 Create Seed Data (Optional but Recommended)

After running the schema, you'll need to seed some data. In Supabase SQL Editor, run:

```sql
-- Create admin user (you'll need to sign up first through the app)
-- After signing up, update the user's role to admin:
-- Replace 'user-email@example.com' with your actual email

UPDATE profiles
SET role = 'admin'
WHERE email = 'user-email@example.com';

-- Create sample parking spaces
INSERT INTO parking_spaces (space_number, section, category, daily_rate, address) VALUES
('A-001', 'Section A', 'car', 50.00, '123 Main St, City'),
('A-002', 'Section A', 'car', 50.00, '123 Main St, City'),
('A-003', 'Section A', 'truck', 100.00, '123 Main St, City'),
('B-001', 'Section B', 'motorcycle', 30.00, '456 Park Ave, City'),
('B-002', 'Section B', 'motorcycle', 30.00, '456 Park Ave, City'),
('B-003', 'Section B', 'bike', 20.00, '456 Park Ave, City'),
('C-001', 'Section C', 'van', 75.00, '789 Center Blvd, City'),
('C-002', 'Section C', 'pickup', 60.00, '789 Center Blvd, City');

-- Verify the data
SELECT * FROM parking_spaces ORDER BY space_number;
```

## Step 3: Configure Environment Variables

### 3.1 Mobile App (Parking_Hub)

Create `.env` file in `Parking/Parking_Hub/`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_DEV_API_HOST=192.168.1.x
```

**Important:**
- Replace `your-project.supabase.co` with your Supabase project URL
- Replace `your-anon-key-here` with your Supabase anon key
- Replace `192.168.1.x` with your local machine's IP address for testing
  - To find your IP:
    - **macOS/Linux**: `ifconfig | grep inet`
    - **Windows**: `ipconfig`

### 3.2 Admin Web App (Parking)

Create `.env` file in `Parking/`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
VITE_API_BASE=http://localhost:3001
PAYMONGO_SECRET=sk_test_your-paymongo-key
SUPABASE_URL=https://your-project.supabase.co
```

**Important:**
- Use the **same** Supabase URL and anon key
- Add your service role key (keep this SECRET - never commit to git)
- For PayMongo integration (payment gateway), get test API key from https://paymongo.com

## Step 4: Install Dependencies

### 4.1 Mobile App

```bash
cd "Parking/Parking_Hub"
npm install
```

### 4.2 Admin Web App

```bash
cd ../..
cd Parking
npm install
```

## Step 5: Fix Expo Configuration Issue

The mobile app has a deprecated property in `app.json`. Remove it:

Open `Parking/Parking_Hub/app.json` and remove line 24:
```json
"usesCleartextTraffic": true,
```

Or run:
```bash
cd "Parking/Parking_Hub"
# The property will be removed in a future update
```

## Step 6: Run the Applications

### 6.1 Start Mobile App (Parking_Hub)

```bash
cd "Parking/Parking_Hub"
npx expo start
```

**Options:**
- Press `i` for iOS simulator (requires macOS and Xcode)
- Press `a` for Android emulator (requires Android Studio)
- Scan QR code with Expo Go app on your phone

**Important for Physical Devices:**
- Make sure your phone and computer are on the **same WiFi network**
- The `EXPO_PUBLIC_DEV_API_HOST` should be your computer's local IP

### 6.2 Start Admin Web App (Parking)

Open a new terminal:

```bash
cd Parking
npm run dev
```

This will start the web app at `http://localhost:5173`

### 6.3 Start Backend Server (Optional)

If using the backend server:

```bash
cd Parking
npm run server
```

## Step 7: Create Your First Admin Account

1. Open the **mobile app** on your device
2. Sign up with your email and password
3. Go to **Supabase Dashboard** → **SQL Editor**
4. Run this query (replace with your email):

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

5. Restart the app and log in again
6. You should now have admin access

## Step 8: Test the System

### Mobile App (User Side)
1. Browse available parking spaces
2. Select a space and book it
3. View booking history
4. Check QR code for check-in

### Admin Web App
1. Open `http://localhost:5173`
2. Log in with your admin account
3. View dashboard with metrics
4. Scan QR codes for check-in/check-out
5. View bookings and payments
6. Manage parking spaces

## Troubleshooting

### Issue: "Network request failed" in mobile app

**Solution:**
1. Check that `EXPO_PUBLIC_SUPABASE_URL` is correct
2. Make sure you're on the same WiFi network
3. Try updating `EXPO_PUBLIC_DEV_API_HOST` to your machine's IP

### Issue: Can't connect to Supabase

**Solution:**
1. Verify your API keys in `.env` files
2. Check Supabase project status in dashboard
3. Ensure RLS policies are enabled (run database.sql again)

### Issue: Authentication errors

**Solution:**
1. Check that Supabase Auth is enabled in your project
2. Go to **Authentication** → **Settings** in Supabase dashboard
3. Enable Email provider
4. Verify email confirmation is set correctly

### Issue: Payments not working

**Solution:**
1. Get PayMongo test API keys from https://dashboard.paymongo.com
2. Add to `.env` file in Parking directory
3. Use test card numbers from PayMongo documentation

### Issue: Expo doctor fails

**Solution:**
```bash
cd "Parking/Parking_Hub"
npx expo-doctor
```
Follow the recommendations to fix any issues.

## Project Commands Reference

### Mobile App (Parking_Hub)
```bash
npm start              # Start Expo development server
npm run android        # Run on Android
npm run ios            # Run on iOS
npx expo-doctor        # Check project health
```

### Admin Web App (Parking)
```bash
npm run dev            # Start development server
npm run build          # Build for production
npm run preview        # Preview production build
npm run server         # Start backend server
```

## Additional Configuration

### PayMongo Setup (for Payments)

1. Sign up at https://paymongo.com
2. Get your test API keys
3. Add to `Parking/.env`:
   ```
   PAYMONGO_SECRET=sk_test_...
   ```
4. For production, use live API keys

### Push Notifications (Optional)

To enable push notifications:
1. Follow Expo push notification setup: https://docs.expo.dev/push-notifications/overview/
2. Add notification tokens to user profiles
3. Configure server to send notifications

## Security Checklist

Before deploying to production:

- [ ] Change all API keys from test to production
- [ ] Never commit `.env` files to git
- [ ] Use strong database passwords
- [ ] Enable RLS (Row Level Security) on all tables
- [ ] Review and test all security policies
- [ ] Set up proper CORS policies
- [ ] Enable HTTPS for all production endpoints
- [ ] Implement rate limiting
- [ ] Set up database backups
- [ ] Review admin access controls

## Git Configuration

Add to `.gitignore`:
```
.env
.env.local
*.env
node_modules/
.expo/
dist/
build/
```

## Getting Help

If you encounter issues:
1. Check this setup guide
2. Review Supabase documentation: https://supabase.com/docs
3. Check Expo documentation: https://docs.expo.dev
4. Look at error logs in console

## Next Steps

After successful setup:
1. Customize parking space categories
2. Add more seed data
3. Configure payment methods
4. Set up production environment
5. Test all features thoroughly
6. Deploy to app stores (for mobile)
7. Deploy admin panel to hosting service

---

**Project Version:** 1.0.0
**Last Updated:** 2025

For questions or issues, contact the development team.
