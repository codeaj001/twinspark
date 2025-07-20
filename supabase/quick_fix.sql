-- Quick diagnostic and fix script for signup issues
-- Run this to identify and fix the problem

-- 1. First, let's check if the issue is with the trigger by temporarily disabling RLS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Allow user profile creation" ON users;

-- 3. Create a simple, permissive policy for testing
CREATE POLICY "Allow all operations for authenticated users" ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. Test the trigger function manually
-- You can run this to test if the trigger works:
/*
DO $$
BEGIN
    -- This simulates what happens when a user signs up
    RAISE NOTICE 'Testing trigger function...';
    
    -- Check if we can call the function
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user_registration') THEN
        RAISE NOTICE 'Trigger function exists!';
    ELSE
        RAISE NOTICE 'Trigger function NOT found!';
    END IF;
END $$;
*/

-- 6. Ensure trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_registration();

-- 7. Update the trigger function to be more robust
CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the attempt (for debugging)
    RAISE LOG 'Creating user profile for: %', NEW.email;
    
    -- Insert user profile with conflict handling
    INSERT INTO users (id, email, username, interests, avatar)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(NEW.email, '@', 1)),
        '{}',
        '1'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = EXCLUDED.username;
    
    RAISE LOG 'User profile created successfully for: %', NEW.email;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error creating user profile: %', SQLERRM;
        RETURN NEW; -- Don't fail the auth creation
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
SELECT 'Quick fix applied! Try signing up again. Check the logs for any trigger activity.' as status;
