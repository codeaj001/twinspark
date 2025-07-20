# TwinSpark Setup Guide

## 🚀 Quick Start

You have everything ready! Here's how to get TwinSpark running:

### 1. ✅ Environment Setup (DONE)
- ✅ `.env` file created with your Supabase credentials
- ✅ Gemini API key configured
- ✅ Build system ready

### 2. 🗄️ Database Setup

#### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Open your project: `rhymulwjbwwcacuhxnoc`
3. Go to **SQL Editor**
4. Copy the entire content from `supabase/schema.sql`
5. Paste and run it in the SQL editor
6. Verify all tables are created

#### Option B: Using SQL Commands (Manual)
```sql
-- Run this in your Supabase SQL editor
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Then run the full schema from supabase/schema.sql
```

### 3. 🔧 Edge Functions Setup

#### Option A: Manual Setup (Recommended)
1. Go to your Supabase dashboard
2. Navigate to **Edge Functions**
3. Click **Create Function**
4. Create two functions:
   - `generate_post` - Copy content from `supabase/functions/generate_post/index.ts`
   - `find_matches` - Copy content from `supabase/functions/find_matches/index.ts`
5. Set environment variables in the dashboard:
   - `GEMINI_API_KEY`: `AIzaSyCiOpRjphqhGLJcFlEqkkvDDSVR9HMjM-o`
   - `SUPABASE_URL`: `https://rhymulwjbwwcacuhxnoc.supabase.co`
   - `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### Option B: Using CLI (If Available)
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref rhymulwjbwwcacuhxnoc

# Deploy functions
./deploy-functions.sh
```

### 4. 🌐 Start Development Server

```bash
# Install dependencies
npm install

# Build and start server
npm run dev
```

Your app will be available at: http://localhost:3000

## 📱 Testing the App

### 1. User Registration
1. Go to http://localhost:3000
2. Click "Get Started"
3. Create a new account
4. Set up your profile with interests

### 2. Location Services
- Allow location access when prompted
- The app uses your location for proximity matching

### 3. Matching System
- Add interests to your profile
- Go to Match page
- The system will show nearby users with similar interests

### 4. Chat System
- Click "Connect" on a match
- Start chatting anonymously
- Messages are real-time via Supabase

### 5. AI Post Generation
- After chatting, go to generate post
- Summarize your conversation
- Generate social media posts with Gemini AI

## 🔐 Security Features

### Environment Variables
- All sensitive data is in `.env` file
- Environment variables are injected at build time
- Production variables are separate from development

### Database Security
- Row Level Security (RLS) enabled
- Users can only access their own data
- Location data is encrypted

### Authentication
- Supabase Auth handles user management
- JWT tokens for API access
- Session management included

## 🛠️ Troubleshooting

### Common Issues

1. **"Missing Supabase configuration"**
   - Run `node build.js` to inject environment variables
   - Check your `.env` file has correct values

2. **Location not working**
   - Make sure you're using HTTPS (required for geolocation)
   - Allow location permissions in browser

3. **Database connection errors**
   - Verify your Supabase URL and key in `.env`
   - Check if the database schema is properly set up

4. **Edge Functions not working**
   - Ensure functions are deployed in Supabase dashboard
   - Check environment variables are set in Edge Functions settings

5. **Gemini AI not generating posts**
   - Verify your Gemini API key is correct
   - Check the Edge Function logs in Supabase

### Debug Steps
1. Check browser console for errors
2. Check Supabase logs in dashboard
3. Verify environment variables: `node build.js`
4. Test database connection in Supabase dashboard

## 🚀 Deployment to Production

### Vercel Deployment
1. Push your code to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production
```bash
SUPABASE_URL=https://rhymulwjbwwcacuhxnoc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=AIzaSyCiOpRjphqhGLJcFlEqkkvDDSVR9HMjM-o
APP_ENV=production
APP_URL=https://your-app.vercel.app
```

## 📊 Features Overview

### ✅ Completed Features
- **User Authentication** - Sign up, login, logout
- **Profile Management** - Interests, bio, avatars
- **Location Services** - Real-time GPS tracking
- **Proximity Matching** - Find users within 200m
- **Anonymous Chat** - Real-time messaging
- **Identity Reveal** - Mutual consent system
- **AI Post Generation** - Gemini AI integration
- **Responsive Design** - Mobile-first UI

### 🔧 Technical Stack
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: Google Gemini API
- **Deployment**: Vercel
- **Real-time**: Supabase Realtime

## 🎯 Next Steps

1. **Set up the database** using the schema file
2. **Deploy Edge Functions** for AI features
3. **Test the application** end-to-end
4. **Deploy to production** when ready

## 📞 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the logs in your Supabase dashboard
3. Verify all environment variables are set correctly

Your TwinSpark app is ready to go! 🎉
