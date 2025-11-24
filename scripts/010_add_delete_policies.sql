-- Add DELETE policies for events, transcriptions, and viewer_sessions

-- Allow users to delete their own events
CREATE POLICY "Users can delete own events"
ON public.events
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow deletion of transcriptions for events owned by the user
CREATE POLICY "Users can delete transcriptions for own events"
ON public.transcriptions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = transcriptions.event_id
    AND events.user_id = auth.uid()
  )
);

-- Allow deletion of viewer sessions for events owned by the user
CREATE POLICY "Users can delete viewer sessions for own events"
ON public.viewer_sessions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = viewer_sessions.event_id
    AND events.user_id = auth.uid()
  )
);
