-- Add avatar_url to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create storage bucket for avatars (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read avatar files
CREATE POLICY "Avatars public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- RLS: authenticated users can upload their own avatar
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'avatars'
  );

-- RLS: users can update their own avatar
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO public
  USING (bucket_id = 'avatars');
