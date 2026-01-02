-- Make user_id nullable in conversions table to support guest mode
ALTER TABLE public.conversions ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to allow access to rows where user_id is NULL (for guest session flow) 
-- Note: This is a simplified "Guest" access. In a real app we might use session IDs.
-- For "default part works directly", we just allow Insert/Select if user_id is NULL? 
-- Actually, RLS blocks anonymous access by default unless policy exists.

-- Policy for inserting guest conversions (anyone can insert if no user_id)
CREATE POLICY "Allow anonymous uploads" ON public.conversions
FOR INSERT 
WITH CHECK (user_id IS NULL);

-- Policy to view guest conversions (anyone can view if no user_id)
-- Warning: This makes all guest conversions public if ID is known. Acceptable for dev/MVP default test.
CREATE POLICY "Allow anonymous view" ON public.conversions
FOR SELECT
USING (user_id IS NULL);

-- Transactions need similar access
CREATE POLICY "Allow anonymous transactions insert" ON public.transactions
FOR INSERT
WITH CHECK (
    conversion_id IN (
        SELECT id FROM public.conversions WHERE user_id IS NULL
    )
);

CREATE POLICY "Allow anonymous transactions view" ON public.transactions
FOR SELECT
USING (
    conversion_id IN (
        SELECT id FROM public.conversions WHERE user_id IS NULL
    )
);
