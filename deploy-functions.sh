#!/bin/bash

# Deploy Supabase Edge Functions
echo "Deploying TwinSpark Edge Functions..."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Validate environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$GEMINI_API_KEY" ]; then
    echo "Missing required environment variables. Please check your .env file."
    exit 1
fi

# Deploy generate_post function
echo "Deploying generate_post function..."
supabase functions deploy generate_post

# Deploy find_matches function
echo "Deploying find_matches function..."
supabase functions deploy find_matches

# Set environment variables for Edge Functions
echo "🔧 Setting environment variables for Edge Functions..."
supabase secrets set GEMINI_API_KEY="$GEMINI_API_KEY"
supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

echo "Edge Functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Go to your Supabase dashboard"
echo "2. Run the SQL schema in the SQL editor"
echo "3. Test the functions"
echo "4. Start your development server: npm run dev"
