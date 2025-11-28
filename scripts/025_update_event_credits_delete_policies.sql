-- Allow deleting event credits via RLS
DROP POLICY IF EXISTS "Users can delete their own event credits" ON public.event_credits;
DROP POLICY IF EXISTS "Admins can delete event credits" ON public.event_credits;

CREATE POLICY "Users can delete their own event credits"
  ON public.event_credits FOR DELETE
  USING (auth.uid() = user_id AND allocated_to_event_id IS NULL);

CREATE POLICY "Admins can delete event credits"
  ON public.event_credits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  );
