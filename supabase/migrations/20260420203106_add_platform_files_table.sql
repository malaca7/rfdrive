-- Create platform_files table for CEO file management
CREATE TABLE IF NOT EXISTS public.platform_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  downloads INT NOT NULL DEFAULT 0
);

ALTER TABLE public.platform_files ENABLE ROW LEVEL SECURITY;

-- Admins/CEOs can do everything
CREATE POLICY "admins_manage_files" ON public.platform_files
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.tipo IN ('admin', 'ceo') OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[])) OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[])))
    )
  );

-- Storage bucket for platform files (public = false, authenticated access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-files',
  'platform-files',
  false,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/zip', 'text/plain', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage: only admins/CEOs
CREATE POLICY "admins_can_upload_files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'platform-files'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.tipo IN ('admin', 'ceo') OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[])) OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[])))
    )
  );

CREATE POLICY "admins_can_read_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'platform-files'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.tipo IN ('admin', 'ceo') OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[])) OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[])))
    )
  );

CREATE POLICY "admins_can_delete_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'platform-files'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.tipo IN ('admin', 'ceo') OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[])) OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[])))
    )
  );
