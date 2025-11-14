# 🚀 Deploy Backend to Railway

Follow these steps to deploy your PayMongo backend to Railway (FREE).

## Step 1: Sign Up for Railway

1. Go to [railway.app](https://railway.app)
2. Click "Login" → Sign up with GitHub
3. Authorize Railway to access your GitHub account

## Step 2: Create New Project

1. Click "New Project" button
2. Select "Deploy from GitHub repo"
3. Choose your repository: `Smart-Parking`
4. Railway will detect your project

## Step 3: Configure Project Settings

1. In Railway dashboard, click on your project
2. Click "Settings" tab
3. **Root Directory**: Set to `Parking`
4. **Start Command**: Should auto-detect `npm start` (or set it manually)

## Step 4: Set Environment Variables

Click on "Variables" tab and add these:

```bash
# PayMongo (REQUIRED)
PAYMONGO_SECRET=sk_test_your_actual_secret_key_here

# Supabase (REQUIRED)
SUPABASE_URL=https://nyqwdgkbqtlruoinecjo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional webhook verification
PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret_if_you_have_one
```

**Where to find these:**
- **PAYMONGO_SECRET**: [PayMongo Dashboard](https://dashboard.paymongo.com/developers/api-keys) → API Keys → Secret Key (sk_test_...)
- **SUPABASE_SERVICE_ROLE_KEY**: [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api) → Project Settings → API → service_role key (⚠️ Keep this secret!)

## Step 5: Deploy!

1. Click "Deploy" button
2. Wait for build to complete (2-3 minutes)
3. Railway will show your backend URL: `https://your-project.up.railway.app`
4. Copy this URL - you'll need it for Step 6!

## Step 6: Update Mobile App Config

Open `Parking/Parking_Hub/src/config/api.ts` and update line 35:

```typescript
} else {
  // Production: YOUR DEPLOYED RAILWAY URL
  BASE_URL = 'https://your-project.up.railway.app';
}
```

**Important:** Remove the port (`:3001`) when using Railway URL!

## Step 7: Update EAS Build Config

Open `Parking/Parking_Hub/eas.json` and remove the local IP variables:

```json
"preview": {
  "distribution": "internal",
  "env": {
    "EXPO_PUBLIC_SUPABASE_URL": "https://nyqwdgkbqtlruoinecjo.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
    // Remove EXPO_PUBLIC_DEV_API_HOST and EXPO_PUBLIC_PRODUCTION_API_HOST
  }
}
```

## Step 8: Test Your Deployment

1. Open your Railway URL in browser: `https://your-project.up.railway.app`
2. You should see: `{"message": "Supabase connection successful", "paymongoConfigured": true}`
3. Build your app: `eas build --platform android --profile preview`
4. Install on phone and test GCash payment!

## ✅ Done!

**Benefits:**
- ✅ No need to run `npm run server` locally
- ✅ Backend runs 24/7 in the cloud
- ✅ GCash payments work on any device, anywhere
- ✅ Free tier includes 500 hours/month (plenty for testing)
- ✅ Auto-deploys when you push to GitHub

## 🔧 Troubleshooting

**Build fails?**
- Check that Root Directory is set to `Parking`
- Verify Start Command is `npm start`

**Backend shows offline?**
- Check environment variables are set correctly
- View logs in Railway dashboard

**GCash still not working?**
- Verify you updated `api.ts` with Railway URL
- Make sure PAYMONGO_SECRET is set in Railway
- Check Railway logs for errors

## 📝 Next Steps

After Railway deployment works:
1. Get your LIVE PayMongo keys (not test keys)
2. Update `PAYMONGO_SECRET` in Railway with live key
3. Build production version: `eas build --platform android --profile production`
4. Submit to Google Play Store!
