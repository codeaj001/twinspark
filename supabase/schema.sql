-- TwinSpark Database Schema
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Users table - stores user profiles and authentication data
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    interests TEXT[] DEFAULT '{}',
    looking_for TEXT,
    location GEOMETRY(Point, 4326),
    is_online BOOLEAN DEFAULT FALSE,
    avatar TEXT DEFAULT '1',
    bio TEXT,
    age INTEGER CHECK (age >= 18 AND age <= 100),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'chatting', 'revealed', 'ended')),
    location_matched GEOMETRY(Point, 4326),
    UNIQUE(user_id_1, user_id_2)
);

-- Chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_system_message BOOLEAN DEFAULT FALSE
);

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_summary TEXT NOT NULL,
    ai_generated_post TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('match_found', 'chat_message', 'reveal_request', 'reveal_accepted')),
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_users_location ON users USING GIST (location);
CREATE INDEX idx_users_interests ON users USING GIN (interests);
CREATE INDEX idx_matches_users ON matches(user_id_1, user_id_2);
CREATE INDEX idx_chats_match_id ON chats(match_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile and profiles of matched users
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow user profile creation" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Matches policies
CREATE POLICY "Users can view their matches" ON matches FOR SELECT USING (
    auth.uid() = user_id_1 OR auth.uid() = user_id_2
);

CREATE POLICY "System can insert matches" ON matches FOR INSERT WITH CHECK (true);

-- Chats policies
CREATE POLICY "Users can view chats from their matches" ON chats FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM matches 
        WHERE matches.id = chats.match_id 
        AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
    )
);

CREATE POLICY "Users can insert chats to their matches" ON chats FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM matches 
        WHERE matches.id = match_id 
        AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
    )
    AND auth.uid() = sender_id
);

-- Posts policies
CREATE POLICY "Users can view posts from their matches" ON posts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM matches 
        WHERE matches.id = posts.match_id 
        AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
    )
);

CREATE POLICY "Users can create posts for their matches" ON posts FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM matches 
        WHERE matches.id = match_id 
        AND (matches.user_id_1 = auth.uid() OR matches.user_id_2 = auth.uid())
    )
);

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Functions for location-based matching
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

-- Function to update user location
CREATE OR REPLACE FUNCTION update_user_location(lat FLOAT, lng FLOAT)
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET 
        location = ST_GeomFromText('POINT(' || lng || ' ' || lat || ')', 4326),
        updated_at = NOW()
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a match
CREATE OR REPLACE FUNCTION create_match(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
    match_id UUID;
    user1_id UUID;
    user2_id UUID;
BEGIN
    -- Ensure consistent ordering for user IDs
    SELECT LEAST(auth.uid(), other_user_id), GREATEST(auth.uid(), other_user_id)
    INTO user1_id, user2_id;
    
    -- Insert or get existing match
    INSERT INTO matches (user_id_1, user_id_2, location_matched)
    VALUES (
        user1_id, 
        user2_id,
        (SELECT location FROM users WHERE id = auth.uid())
    )
    ON CONFLICT (user_id_1, user_id_2) DO UPDATE SET
        status = 'chatting',
        timestamp = NOW()
    RETURNING id INTO match_id;
    
    -- Create notifications for both users
    INSERT INTO notifications (user_id, type, data)
    VALUES 
        (user1_id, 'match_found', jsonb_build_object('match_id', match_id, 'other_user_id', user2_id)),
        (user2_id, 'match_found', jsonb_build_object('match_id', match_id, 'other_user_id', user1_id));
    
    RETURN match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Function to handle new user registration
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

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_registration();

-- Function to update user online status
CREATE OR REPLACE FUNCTION update_user_online_status(is_online BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET 
        is_online = update_user_online_status.is_online,
        last_active = NOW(),
        updated_at = NOW()
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user profile by ID
CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    username TEXT,
    interests TEXT[],
    looking_for TEXT,
    bio TEXT,
    avatar TEXT,
    age INTEGER,
    is_online BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Only allow users to see profiles of their matches or their own profile
    IF user_id = auth.uid() THEN
        RETURN QUERY
        SELECT u.id, u.email, u.username, u.interests, u.looking_for, u.bio, u.avatar, u.age, u.is_online, u.created_at
        FROM users u
        WHERE u.id = user_id;
    ELSE
        -- Check if users are matched
        IF EXISTS (
            SELECT 1 FROM matches m
            WHERE (m.user_id_1 = auth.uid() AND m.user_id_2 = user_id)
               OR (m.user_id_1 = user_id AND m.user_id_2 = auth.uid())
        ) THEN
            RETURN QUERY
            SELECT u.id, u.email, u.username, u.interests, u.looking_for, u.bio, u.avatar, u.age, u.is_online, u.created_at
            FROM users u
            WHERE u.id = user_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get match statistics
CREATE OR REPLACE FUNCTION get_match_stats()
RETURNS TABLE (
    total_matches INTEGER,
    active_chats INTEGER,
    revealed_matches INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_matches,
        COUNT(CASE WHEN status = 'chatting' THEN 1 END)::INTEGER as active_chats,
        COUNT(CASE WHEN status = 'revealed' THEN 1 END)::INTEGER as revealed_matches
    FROM matches
    WHERE user_id_1 = auth.uid() OR user_id_2 = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old inactive users (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_inactive_users(days_inactive INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM users
    WHERE last_active < NOW() - INTERVAL '1 day' * days_inactive
    AND is_online = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add some helpful views
CREATE VIEW user_match_summary AS
SELECT 
    u.id,
    u.username,
    u.interests,
    u.bio,
    u.avatar,
    u.is_online,
    u.last_active,
    COUNT(m.id) as total_matches
FROM users u
LEFT JOIN matches m ON (m.user_id_1 = u.id OR m.user_id_2 = u.id)
GROUP BY u.id, u.username, u.interests, u.bio, u.avatar, u.is_online, u.last_active;

-- Create view for active matches with user details
CREATE VIEW active_matches_with_users AS
SELECT 
    m.id as match_id,
    m.status,
    m.timestamp,
    u1.id as user1_id,
    u1.username as user1_username,
    u1.avatar as user1_avatar,
    u1.interests as user1_interests,
    u2.id as user2_id,
    u2.username as user2_username,
    u2.avatar as user2_avatar,
    u2.interests as user2_interests,
    ST_Distance(
        m.location_matched::geography,
        ST_GeomFromText('POINT(0 0)', 4326)::geography
    ) as distance_at_match
FROM matches m
JOIN users u1 ON m.user_id_1 = u1.id
JOIN users u2 ON m.user_id_2 = u2.id
WHERE m.status IN ('chatting', 'revealed');

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON user_match_summary TO authenticated;
GRANT SELECT ON active_matches_with_users TO authenticated;

-- Add RLS policies for views
ALTER VIEW user_match_summary OWNER TO postgres;
ALTER VIEW active_matches_with_users OWNER TO postgres;

-- Sample data for testing (optional - remove in production)
-- INSERT INTO users (id, email, username, interests, bio, avatar, age, is_online) VALUES
-- (gen_random_uuid(), 'test1@example.com', 'test_user1', ARRAY['technology', 'music'], 'Love coding and music!', '1', 25, true),
-- (gen_random_uuid(), 'test2@example.com', 'test_user2', ARRAY['sports', 'travel'], 'Adventure seeker!', '2', 28, true);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'TwinSpark database schema created successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test the schema with sample data';
    RAISE NOTICE '2. Deploy Edge Functions';
    RAISE NOTICE '3. Configure authentication settings';
END $$;
