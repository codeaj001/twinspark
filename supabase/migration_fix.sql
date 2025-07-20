-- TwinSpark Database Migration Script
-- This script updates the existing database schema without recreating tables

-- First, let's update the trigger function to handle conflicts
CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if user doesn't already exist
    INSERT INTO users (id, email, username, interests, avatar)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(NEW.email, '@', 1)),
        '{}',
        '1'
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add the missing INSERT policy for users table
DO $$
BEGIN
    -- Check if policy exists and drop it if it does
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND policyname = 'Allow user profile creation'
    ) THEN
        DROP POLICY "Allow user profile creation" ON users;
    END IF;
    
    -- Create the policy
    CREATE POLICY "Allow user profile creation" ON users FOR INSERT WITH CHECK (auth.uid() = id);
END $$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_registration();

-- Update the find_nearby_users function to fix ANY syntax issues
CREATE OR REPLACE FUNCTION find_nearby_users(
    user_lat FLOAT,
    user_lng FLOAT,
    radius_meters INT DEFAULT 100
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    interests TEXT[],
    looking_for TEXT,
    bio TEXT,
    avatar TEXT,
    distance_meters FLOAT,
    common_interests INT,
    match_score FLOAT
) AS $$
DECLARE
    current_user_interests TEXT[];
    current_user_looking_for TEXT;
BEGIN
    -- Get current user's interests and looking_for
    SELECT interests, looking_for INTO current_user_interests, current_user_looking_for
    FROM users WHERE id = auth.uid();
    
    RETURN QUERY
    SELECT 
        u.id,
        u.username,
        u.interests,
        u.looking_for,
        u.bio,
        u.avatar,
        ST_Distance(
            ST_GeomFromText('POINT(' || user_lng || ' ' || user_lat || ')', 4326)::geography,
            u.location::geography
        ) as distance_meters,
        -- Count common interests
        (SELECT COUNT(*) FROM unnest(current_user_interests) AS interest 
         WHERE interest = ANY(u.interests))::INT as common_interests,
        -- Calculate match score based on interests similarity and looking_for match
        (
            -- Base score from common interests (0-50%)
            (SELECT COUNT(*) FROM unnest(current_user_interests) AS interest 
             WHERE interest = ANY(u.interests)) * 10.0 +
            -- Bonus for looking_for match (0-50%)
            CASE 
                WHEN current_user_looking_for IS NOT NULL AND 
                     u.looking_for IS NOT NULL AND 
                     (current_user_looking_for ILIKE '%' || u.looking_for || '%' OR 
                      u.looking_for ILIKE '%' || current_user_looking_for || '%') THEN 50.0
                WHEN current_user_looking_for IS NOT NULL AND 
                     EXISTS(SELECT 1 FROM unnest(u.interests) AS interest WHERE interest ILIKE '%' || current_user_looking_for || '%') THEN 30.0
                WHEN u.looking_for IS NOT NULL AND 
                     EXISTS(SELECT 1 FROM unnest(current_user_interests) AS interest WHERE interest ILIKE '%' || u.looking_for || '%') THEN 30.0
                ELSE 0.0
            END
        ) as match_score
    FROM users u
    WHERE 
        u.id != auth.uid()
        AND u.is_online = true
        AND ST_DWithin(
            ST_GeomFromText('POINT(' || user_lng || ' ' || user_lat || ')', 4326)::geography,
            u.location::geography,
            radius_meters
        )
        -- Only show users with at least 1 common interest or looking_for match
        AND (
            (SELECT COUNT(*) FROM unnest(current_user_interests) AS interest 
             WHERE interest = ANY(u.interests)) > 0
            OR
            (current_user_looking_for IS NOT NULL AND 
             u.looking_for IS NOT NULL AND 
             (current_user_looking_for ILIKE '%' || u.looking_for || '%' OR 
              u.looking_for ILIKE '%' || current_user_looking_for || '%'))
            OR
            (current_user_looking_for IS NOT NULL AND 
             EXISTS(SELECT 1 FROM unnest(u.interests) AS interest WHERE interest ILIKE '%' || current_user_looking_for || '%'))
            OR
            (u.looking_for IS NOT NULL AND 
             EXISTS(SELECT 1 FROM unnest(current_user_interests) AS interest WHERE interest ILIKE '%' || u.looking_for || '%'))
        )
    ORDER BY match_score DESC, distance_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add any missing columns to existing tables
DO $$
BEGIN
    -- Add age column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'age') THEN
        ALTER TABLE users ADD COLUMN age INTEGER CHECK (age >= 18 AND age <= 100);
    END IF;
    
    -- Add last_active column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'last_active') THEN
        ALTER TABLE users ADD COLUMN last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database migration completed successfully!';
    RAISE NOTICE 'Key fixes applied:';
    RAISE NOTICE '1. Updated trigger to handle conflicts';
    RAISE NOTICE '2. Added missing INSERT policy for users';
    RAISE NOTICE '3. Fixed SQL syntax in find_nearby_users function';
    RAISE NOTICE '4. Added missing columns if needed';
    RAISE NOTICE '';
    RAISE NOTICE 'You can now test user registration - it should work without errors!';
END $$;
