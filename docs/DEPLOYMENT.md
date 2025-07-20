# TwinSpark Deployment Guide

## Overview
TwinSpark is a full-stack web application that connects like-minded individuals based on proximity and shared interests. This guide covers the complete deployment process.

## Architecture
- **Frontend**: HTML, CSS, Vanilla JavaScript (deployed on Vercel)
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **AI Integration**: OpenAI API for social media post generation
- **Real-time**: Supabase Realtime for chat functionality

## Prerequisites

### Required Accounts
1. **Supabase** - Database, Auth, and Edge Functions
2. **OpenAI** - AI post generation
3. **Vercel** - Frontend deployment
4. **GitHub** - Code repository

### Required Tools
- Git
- Node.js (for Supabase CLI)
- Supabase CLI
- Vercel CLI (optional)

## Setup Instructions

### 1. Supabase Setup

#### A. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note down your project URL and anon key

#### B. Database Setup
1. In Supabase Dashboard, go to SQL Editor
2. Run the schema from `supabase/schema.sql`
3. Enable Row Level Security for all tables
4. Verify all tables and functions are created

#### C. Enable PostGIS Extension
1. In SQL Editor, run: `CREATE EXTENSION IF NOT EXISTS "postgis";`
2. This enables location-based queries

#### D. Deploy Edge Functions
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Deploy functions
supabase functions deploy generate_post
supabase functions deploy find_matches
```

#### E. Set Environment Variables
In Supabase Dashboard → Settings → Edge Functions:
- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key

### 2. OpenAI Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Add the key to Supabase Edge Functions environment

### 3. Frontend Configuration

#### A. Update Supabase Configuration
Edit `js/supabase.js`:
```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'
```

#### B. Test Locally
```bash
# Serve locally
python3 -m http.server 3000
# or
npm run dev
```

### 4. Vercel Deployment

#### A. Connect Repository
1. Push code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your GitHub repository

#### B. Configure Build Settings
- Build Command: `npm run build`
- Output Directory: `./` (root directory)
- Install Command: `npm install`

#### C. Deploy
Vercel will automatically deploy on each push to main branch.

## Configuration Details

### Database Schema
The application uses these main tables:
- `users`: User profiles and location data
- `matches`: User match relationships
- `chats`: Chat messages
- `posts`: AI-generated social media posts
- `notifications`: User notifications

### Security Features
- Row Level Security (RLS) enabled on all tables
- User authentication via Supabase Auth
- Location data encrypted in transit
- CORS headers configured

### Location Services
- Uses browser geolocation API
- PostGIS for proximity calculations
- 200m default radius for matching
- Real-time location updates

## Environment Variables

### Supabase Edge Functions
```bash
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

### Frontend (js/supabase.js)
```javascript
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'eyJ...'
```

## Testing

### Local Testing
1. Start local server: `python3 -m http.server 3000`
2. Test user registration and login
3. Test location permissions
4. Test matching functionality
5. Test chat system
6. Test AI post generation

### Production Testing
1. Deploy to Vercel
2. Test all functionality in production
3. Monitor Edge Function logs
4. Test on mobile devices

## Monitoring

### Supabase Dashboard
- Database performance
- Edge Function logs
- User analytics
- API usage

### Vercel Dashboard
- Deployment status
- Performance metrics
- Error logs

## Troubleshooting

### Common Issues

1. **Location not working**
   - Check HTTPS is enabled
   - Verify geolocation permissions
   - Test PostGIS extension

2. **Authentication errors**
   - Verify Supabase keys
   - Check RLS policies
   - Confirm user table structure

3. **AI posts not generating**
   - Check OpenAI API key
   - Verify Edge Function deployment
   - Monitor function logs

4. **Chat not working**
   - Check Realtime enabled
   - Verify WebSocket connection
   - Test message insertion

### Debug Steps
1. Check browser console for errors
2. Monitor Supabase logs
3. Test Edge Functions directly
4. Verify database connections

## Performance Optimization

### Frontend
- Minify CSS/JS for production
- Enable gzip compression
- Use CDN for static assets
- Implement service worker for offline support

### Backend
- Index database queries
- Monitor query performance
- Optimize location queries
- Cache frequently accessed data

## Security Considerations

### Best Practices
- Regular security audits
- Monitor for suspicious activity
- Rate limiting on API endpoints
- Regular dependency updates

### Privacy
- Anonymous matching by default
- Location data minimization
- GDPR compliance considerations
- User data deletion options

## Scaling

### Database Scaling
- Monitor connection limits
- Consider read replicas
- Implement connection pooling
- Monitor query performance

### Edge Functions
- Monitor execution time
- Implement error handling
- Consider function splitting
- Monitor memory usage

## Support

### Documentation
- Supabase docs: [supabase.com/docs](https://supabase.com/docs)
- OpenAI docs: [platform.openai.com/docs](https://platform.openai.com/docs)
- Vercel docs: [vercel.com/docs](https://vercel.com/docs)

### Community
- Supabase Discord
- GitHub issues
- Stack Overflow

## License
MIT License - see LICENSE file for details
