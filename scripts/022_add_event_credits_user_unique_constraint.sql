-- Remove duplicate credits rows, keeping the most recent per user
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id
           ORDER BY coalesce(updated_at, created_at) DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.event_credits
)
DELETE FROM public.event_credits ec
USING ranked r
WHERE ec.id = r.id AND r.rn > 1;

-- Ensure event_credits has a unique row per user for default grants
ALTER TABLE public.event_credits
  ADD CONSTRAINT event_credits_user_id_key UNIQUE (user_id);
