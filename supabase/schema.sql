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
    is_discoverable BOOLEAN DEFAULT TRUE,
    avatar TEXT DEFAULT '1',
    bio TEXT,
    age INTEGER CHECK (age >= 18 AND age <= 100),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_location_update TIMESTAMP WITH TIME ZONE,
    notification_preferences JSONB DEFAULT '{"match_found": true, "chat_message": true, "reveal_request": true}',
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
    type TEXT NOT NULL CHECK (type IN ('match_found', 'chat_message', 'reveal_request', 'reveal_accepted', 'profile_view', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Location tracking table for real-time updates
CREATE TABLE location_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    accuracy FLOAT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User settings table
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    match_radius INTEGER DEFAULT 500 CHECK (match_radius >= 100 AND match_radius <= 50000),
    age_range_min INTEGER DEFAULT 18 CHECK (age_range_min >= 18),
    age_range_max INTEGER DEFAULT 100 CHECK (age_range_max <= 100),
    push_notifications BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    show_distance BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_users_location ON users USING GIST (location);
CREATE INDEX idx_users_interests ON users USING GIN (interests);
CREATE INDEX idx_users_discoverable ON users(is_discoverable, is_online);
CREATE INDEX idx_users_online_discoverable ON users(is_online, is_discoverable, last_active);
CREATE INDEX idx_matches_users ON matches(user_id_1, user_id_2);
CREATE INDEX idx_chats_match_id ON chats(match_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read, created_at);
CREATE INDEX idx_location_updates_user_timestamp ON location_updates(user_id, timestamp);
CREATE INDEX idx_location_updates_location ON location_updates USING GIST (location);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

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

-- Location updates policies
CREATE POLICY "Users can view their location updates" ON location_updates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their location updates" ON location_updates FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User settings policies
CREATE POLICY "Users can view their settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

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
        AND u.is_discoverable = true
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

-- Function to update user location with tracking
CREATE OR REPLACE FUNCTION update_user_location(lat FLOAT, lng FLOAT, accuracy FLOAT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    new_location GEOMETRY;
BEGIN
    new_location := ST_GeomFromText('POINT(' || lng || ' ' || lat || ')', 4326);
    
    -- Update user's current location
    UPDATE users 
    SET 
        location = new_location,
        last_location_update = NOW(),
        updated_at = NOW()
    WHERE id = auth.uid();
    
    -- Insert location tracking record
    INSERT INTO location_updates (user_id, location, accuracy)
    VALUES (auth.uid(), new_location, accuracy);
    
    -- Clean up old location updates (keep last 100 per user)
    DELETE FROM location_updates 
    WHERE user_id = auth.uid() 
    AND id NOT IN (
        SELECT id FROM location_updates 
        WHERE user_id = auth.uid() 
        ORDER BY timestamp DESC 
        LIMIT 100
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle user discoverability
CREATE OR REPLACE FUNCTION toggle_discoverability(discoverable BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users 
    SET 
        is_discoverable = discoverable,
        updated_at = NOW()
    WHERE id = auth.uid();
    
    RETURN discoverable;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
    target_user_id UUID,
    notification_type TEXT,
    notification_title TEXT,
    notification_message TEXT,
    notification_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    user_preferences JSONB;
BEGIN
    -- Check if user wants this type of notification
    SELECT notification_preferences INTO user_preferences
    FROM users WHERE id = target_user_id;
    
    -- Only create notification if user has enabled this type
    IF user_preferences IS NULL OR (user_preferences ->> notification_type)::BOOLEAN = true THEN
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (target_user_id, notification_type, notification_title, notification_message, notification_data)
        RETURNING id INTO notification_id;
        
        RETURN notification_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(notification_ids UUID[] DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF notification_ids IS NULL THEN
        -- Mark all notifications as read
        UPDATE notifications 
        SET is_read = true 
        WHERE user_id = auth.uid() AND is_read = false;
    ELSE
        -- Mark specific notifications as read
        UPDATE notifications 
        SET is_read = true 
        WHERE user_id = auth.uid() AND id = ANY(notification_ids) AND is_read = false;
    END IF;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user settings or create defaults
CREATE OR REPLACE FUNCTION get_or_create_user_settings()
RETURNS TABLE (
    user_id UUID,
    match_radius INTEGER,
    age_range_min INTEGER,
    age_range_max INTEGER,
    push_notifications BOOLEAN,
    email_notifications BOOLEAN,
    show_distance BOOLEAN
) AS $$
BEGIN
    -- Insert default settings if they don't exist
    INSERT INTO user_settings (user_id)
    VALUES (auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Return current settings
    RETURN QUERY
    SELECT 
        s.user_id,
        s.match_radius,
        s.age_range_min,
        s.age_range_max,
        s.push_notifications,
        s.email_notifications,
        s.show_distance
    FROM user_settings s
    WHERE s.user_id = auth.uid();
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
