-- Remove legacy trigger/function referencing old credit columns
DROP TRIGGER IF EXISTS init_user_credits_trigger ON public.user_profiles;
DROP FUNCTION IF EXISTS public.init_user_credits();
