-- Ensure the storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow anonymous uploads to 'documents' bucket
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
);

-- Policy to allow public read access to files in 'documents' bucket
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
);
