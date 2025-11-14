# Quick Start Guide

Fast setup for experienced developers who want to get the project running quickly.

## TL;DR

```bash
# 1. Clone the repo
git clone <repo-url>
cd "Parking Hub - QR Parking Management System"

# 2. Set up Supabase
# - Create project at https://supabase.com
# - Run database.sql in SQL Editor
# - Run seed_data.sql for sample data
# - Copy API keys

# 3. Configure environment
cp Parking/Parking_Hub/.env.example Parking/Parking_Hub/.env
cp Parking/.env.example Parking/.env
# Edit both .env files with your Supabase keys

# 4. Install dependencies
cd Parking/Parking_Hub && npm install
cd ../../Parking && npm install

# 5. Run the apps
# Terminal 1 - Mobile App
cd Parking/Parking_Hub && npx expo start

# Terminal 2 - Admin Web App
cd Parking && npm run dev
```

## Essential Steps

### 1. Database Setup (Supabase)

1. Create project: https://supabase.com/dashboard
2. Copy from Settings → API:
   - Project URL
   - anon/public key
   - service_role key

3. Run SQL scripts:
   - `database.sql` - Creates schema
   - `seed_data.sql` - Adds sample parking spaces

### 2. Environment Variables

**Mobile App** (`Parking/Parking_Hub/.env`):
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_DEV_API_HOST=192.168.1.x
```

**Admin Web** (`Parking/.env`):
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
VITE_API_BASE=http://localhost:3001
PAYMONGO_SECRET=sk_test_...
SUPABASE_URL=https://xxxxx.supabase.co
```

### 3. Fix Expo Config

Remove deprecated property from `Parking/Parking_Hub/app.json`:
```json
// Remove this line:
"usesCleartextTraffic": true,
```

### 4. Create Admin Account

1. Sign up through mobile app
2. In Supabase SQL Editor:
```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## Project Structure

```
Parking Hub/
├── Parking/                    # Admin Web App (Vite + React)
│   ├── src/
│   ├── server/
│   ├── .env                   # Web app environment
│   └── package.json
│
├── Parking/Parking_Hub/       # Mobile App (Expo + React Native)
│   ├── src/
│   ├── assets/
│   ├── .env                   # Mobile app environment
│   ├── app.json
│   ├── database.sql           # Main schema
│   └── seed_data.sql          # Sample data
│
├── SETUP.md                   # Detailed setup guide
└── QUICKSTART.md             # This file
```

## Key Commands

### Mobile App
```bash
cd Parking/Parking_Hub
npm start              # Start Expo
npm run android        # Run on Android
npm run ios            # Run on iOS
npx expo-doctor        # Check project health
```

### Admin Web App
```bash
cd Parking
npm run dev            # Start dev server (http://localhost:5173)
npm run build          # Build for production
npm run server         # Start backend API
```

## Common Issues

### "Network request failed"
- Check Supabase URL in `.env`
- Verify API keys are correct
- Ensure phone and computer on same WiFi

### Can't login
- Check if user exists in Supabase Auth
- Verify RLS policies are enabled
- Make sure `database.sql` was executed

### Payments not working
- Get PayMongo test keys from https://dashboard.paymongo.com
- Add to `Parking/.env`
- Use test credit card: `4343434343434345`

### Expo errors
```bash
cd Parking/Parking_Hub
rm -rf node_modules
npm install
npx expo start --clear
```

## Test Credentials

After seeding database:
- Create account through mobile app
- Update role to admin (see step 4 above)

## Sample Parking Spaces

The seed file creates:
- **Section A**: 5 car spaces, 3 truck spaces
- **Section B**: 5 motorcycle, 4 bike, 3 scooter spaces
- **Section C**: 3 van, 4 pickup spaces
- **Section D**: 4 premium car spaces

**Total**: 31 parking spaces

## Next Steps

1. Test mobile app booking flow
2. Test admin QR scanner
3. Customize parking categories
4. Set up PayMongo payment gateway
5. Deploy to production

## Need More Help?

See [SETUP.md](./SETUP.md) for detailed instructions.

## Tech Stack

- **Mobile**: React Native, Expo
- **Web**: React, Vite, TailwindCSS
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Payments**: PayMongo
- **QR Codes**: react-native-qrcode-svg

---

**Ready in ~10 minutes** ⚡
