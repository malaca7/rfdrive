-- Create storage bucket for uploads (logos, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Uploads public read" ON storage.objects;
DROP POLICY IF EXISTS "Uploads insert" ON storage.objects;
DROP POLICY IF EXISTS "Uploads update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update uploads" ON storage.objects;

-- RLS: anyone can read uploaded files
CREATE POLICY "Uploads public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'uploads');

-- RLS: anyone can upload files (app uses custom auth, not Supabase Auth)
CREATE POLICY "Uploads insert" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'uploads');

-- RLS: anyone can update uploaded files
CREATE POLICY "Uploads update" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'uploads');
