-- Create storage bucket for uploads (logos, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read uploaded files
CREATE POLICY "Uploads public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'uploads');

-- RLS: authenticated users can upload files
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads');

-- RLS: authenticated users can update their own uploads
CREATE POLICY "Authenticated update uploads" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads');
