-- Recreate missing event credit rows for existing events
INSERT INTO public.event_credits (
  user_id,
  credits_minutes,
  max_attendees,
  notes,
  allocated_to_event_id,
  allocated_at,
  created_at,
  updated_at
)
SELECT
  e.user_id,
  COALESCE(e.credits_minutes, 0),
  COALESCE(e.max_attendees, 0),
  'Backfilled from existing event',
  e.id,
  COALESCE(e.created_at, now()),
  now(),
  now()
FROM public.events e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.event_credits ec
  WHERE ec.allocated_to_event_id = e.id
);
