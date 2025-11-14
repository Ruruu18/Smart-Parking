# Deployment Guide

Guide for deploying Parking Hub to production.

## Overview

This project has two deployment components:
1. **Mobile App** - Deploy to App Store (iOS) and Google Play (Android)
2. **Admin Web App** - Deploy to web hosting (Vercel, Netlify, etc.)

---

## Prerequisites

- [ ] Supabase project set up and tested
- [ ] PayMongo account with live API keys
- [ ] Domain name (for admin web app)
- [ ] Apple Developer Account ($99/year - for iOS)
- [ ] Google Play Developer Account ($25 one-time - for Android)

---

## Part 1: Mobile App Deployment

### A. Update Configuration for Production

#### 1. Update app.json

```json
{
  "expo": {
    "name": "Parking Hub",
    "slug": "parking-hub",
    "version": "1.0.0",
    "icon": "./assets/images/icons/wheel.png",
    "splash": {
      "image": "./assets/icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.parkinghub.app",
      "buildNumber": "1"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/icons/wheel.png",
        "backgroundColor": "#000000"
      },
      "package": "com.parkinghub.app",
      "versionCode": 1
    },
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    }
  }
}
```

#### 2. Update Environment Variables

Create `.env.production`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
EXPO_PUBLIC_DEV_API_HOST=api.yourdomain.com
```

### B. Build with Expo Application Services (EAS)

#### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

#### 2. Login to Expo
```bash
eas login
```

#### 3. Configure EAS Build

Create `eas.json`:
```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-id",
        "appleTeamId": "your-team-id"
      }
    }
  }
}
```

#### 4. Build for Android
```bash
cd Parking/Parking_Hub
eas build --platform android --profile production
```

#### 5. Build for iOS
```bash
eas build --platform ios --profile production
```

### C. Submit to App Stores

#### Google Play Store
```bash
eas submit --platform android --profile production
```

Manual steps:
1. Create app in Google Play Console
2. Upload build (or use EAS submit)
3. Fill app details, screenshots, description
4. Set up pricing (free/paid)
5. Submit for review

#### Apple App Store
```bash
eas submit --platform ios --profile production
```

Manual steps:
1. Create app in App Store Connect
2. Upload build (or use EAS submit)
3. Fill app information
4. Add screenshots (required sizes)
5. Submit for review

---

## Part 2: Admin Web App Deployment

### A. Choose Hosting Platform

**Recommended: Vercel** (easiest for Vite/React)

Alternatives:
- Netlify
- AWS Amplify
- Render
- Railway

### B. Prepare for Production

#### 1. Update Environment Variables

Production `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_API_BASE=https://api.yourdomain.com
PAYMONGO_SECRET=sk_live_your-live-key
SUPABASE_URL=https://your-project.supabase.co
```

#### 2. Build for Production
```bash
cd Parking
npm run build
```

### C. Deploy to Vercel

#### Option 1: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd Parking
vercel

# Deploy to production
vercel --prod
```

#### Option 2: GitHub Integration

1. Push code to GitHub
2. Go to https://vercel.com
3. Click "Import Project"
4. Select your repository
5. Configure:
   - Framework: Vite
   - Root Directory: `Parking`
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Add environment variables
7. Deploy

### D. Deploy Backend Server (Optional)

If using the Express server:

**Deploy to Railway:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

**Or Deploy to Render:**
1. Go to https://render.com
2. Create new Web Service
3. Connect repository
4. Configure:
   - Build Command: `npm install`
   - Start Command: `npm run server`
   - Environment: Node
5. Add environment variables
6. Deploy

---

## Part 3: Database (Supabase)

### Production Database Setup

1. **Use existing Supabase project** OR create new production project
2. **Run migrations**:
   ```sql
   -- Run database.sql in production Supabase
   -- Run seed_data.sql for initial parking spaces
   ```

3. **Configure Row Level Security**:
   - Review all RLS policies
   - Test with production credentials
   - Ensure admin functions are secure

4. **Set up database backups**:
   - Supabase Pro plan includes automatic backups
   - Or use `pg_dump` for manual backups

5. **Enable database monitoring**:
   - Set up alerts in Supabase dashboard
   - Monitor query performance

---

## Part 4: Payment Gateway (PayMongo)

### Switch to Live Mode

1. Go to https://dashboard.paymongo.com
2. Submit business verification
3. Get live API keys
4. Update environment variables:
   ```env
   PAYMONGO_SECRET=sk_live_...
   ```

5. Test live payments with real cards
6. Set up webhooks for payment notifications

---

## Part 5: Security Checklist

### Before Going Live

- [ ] All `.env` files use production keys
- [ ] Service role keys never exposed to client
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] HTTPS enabled everywhere
- [ ] Database RLS policies tested
- [ ] API authentication working
- [ ] Payment webhooks secured
- [ ] Error logging set up
- [ ] Monitoring configured

### Additional Security

1. **Enable 2FA** on:
   - Supabase account
   - Expo account
   - App store accounts
   - Hosting accounts

2. **Set up secrets management**:
   ```bash
   # Use environment-specific secrets
   # Never commit .env files
   # Rotate keys regularly
   ```

3. **Configure CORS** (in server):
   ```javascript
   app.use(cors({
     origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
     credentials: true
   }));
   ```

---

## Part 6: Monitoring & Analytics

### Set Up Error Tracking

**Sentry** (recommended):
```bash
npm install @sentry/react @sentry/react-native
```

Configure in both apps:
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production",
});
```

### Analytics

**Mobile App:**
- Expo Analytics
- Firebase Analytics
- Mixpanel

**Web App:**
- Google Analytics
- Plausible
- PostHog

---

## Part 7: CI/CD Pipeline (Optional)

### GitHub Actions for Auto-Deploy

`.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd Parking && npm install
      - run: cd Parking && npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID}}
          vercel-project-id: ${{ secrets.PROJECT_ID}}
          working-directory: ./Parking

  build-mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g eas-cli
      - run: cd Parking/Parking_Hub && eas build --platform all --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

## Part 8: Post-Deployment

### Testing Checklist

- [ ] User registration works
- [ ] Login/logout works
- [ ] Admin can create parking spaces
- [ ] Users can book parking
- [ ] QR code generation works
- [ ] QR code scanning works
- [ ] Check-in flow works
- [ ] Check-out flow works
- [ ] Payments process correctly
- [ ] History shows correctly
- [ ] Push notifications work (if enabled)

### Go-Live Checklist

- [ ] Domain configured
- [ ] SSL certificates active
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Seed data loaded
- [ ] Admin accounts created
- [ ] Payment gateway tested
- [ ] Error tracking enabled
- [ ] Analytics enabled
- [ ] Backups configured
- [ ] Documentation updated

---

## Support & Maintenance

### Regular Tasks

- **Daily**: Monitor error logs
- **Weekly**: Check analytics, review payments
- **Monthly**: Database backups, security updates
- **Quarterly**: Dependency updates, performance review

### Scaling Considerations

- Monitor Supabase usage limits
- Upgrade plans as needed
- Optimize database queries
- Implement caching if needed
- Consider CDN for assets

---

## Rollback Procedure

If issues occur after deployment:

1. **Web App**: Revert to previous deployment in Vercel
2. **Mobile App**: Cannot rollback immediately (users need to update)
   - Fix and push new version ASAP
   - Communicate with users

---

## Cost Estimates

### Monthly Costs (estimated)

- **Supabase**: $0 (free tier) - $25 (pro)
- **Vercel**: $0 (hobby) - $20 (pro)
- **Expo**: $0 (free tier)
- **PayMongo**: Transaction fees only
- **Domain**: $10-15/year
- **App Store (iOS)**: $99/year
- **Google Play (Android)**: $25 one-time

**Total**: ~$35-60/month + transaction fees

---

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [PayMongo Documentation](https://developers.paymongo.com)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policies](https://play.google.com/about/developer-content-policy/)

---

**Last Updated**: 2025
**Version**: 1.0.0
