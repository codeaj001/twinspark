-- Debug script to check trigger and RLS status
-- Run this in your Supabase SQL Editor to diagnose the issue

-- 1. Check if the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check if the trigger function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user_registration';

-- 3. Check RLS policies on users table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users';

-- 4. Check if RLS is enabled on users table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users';

-- 5. Check current auth.users structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- 6. Check users table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 7. Test if we can manually insert a user (this will help identify the exact issue)
-- DON'T RUN THIS - Just check if the structure looks correct

-- Display helpful info
SELECT 'Debug information collected. Check the results above for any missing components.' as status;
