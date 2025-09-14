-- Simple fix: Disable the problematic trigger completely
-- Run this in your Supabase SQL Editor

-- Remove the trigger that's causing the registration failure
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remove the function as well to clean up
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Verify the trigger is removed
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_schema = 'auth' 
AND event_object_table = 'users' 
AND trigger_name = 'on_auth_user_created';

-- This should return no rows, confirming the trigger is removed
SELECT 'Trigger removed successfully! Registration should work now.' as status;