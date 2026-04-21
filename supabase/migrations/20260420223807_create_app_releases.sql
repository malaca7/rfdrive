CREATE TABLE IF NOT EXISTS public.app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  version_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  is_current BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS app_releases_published_at_idx
  ON public.app_releases (published_at DESC);

CREATE INDEX IF NOT EXISTS app_releases_current_idx
  ON public.app_releases (is_current, published_at DESC);

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_app_releases" ON public.app_releases;
DROP POLICY IF EXISTS "public_select_current_app_release" ON public.app_releases;
DROP POLICY IF EXISTS "admins_insert_app_releases" ON public.app_releases;
DROP POLICY IF EXISTS "admins_update_app_releases" ON public.app_releases;
DROP POLICY IF EXISTS "admins_delete_app_releases" ON public.app_releases;

CREATE POLICY "admins_select_app_releases" ON public.app_releases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.tipo IN ('admin', 'ceo')
          OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
          OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
        )
    )
  );

CREATE POLICY "public_select_current_app_release" ON public.app_releases
  FOR SELECT USING (is_current = true);

CREATE POLICY "admins_insert_app_releases" ON public.app_releases
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.tipo IN ('admin', 'ceo')
          OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
          OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
        )
    )
  );

CREATE POLICY "admins_update_app_releases" ON public.app_releases
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.tipo IN ('admin', 'ceo')
          OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
          OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.tipo IN ('admin', 'ceo')
          OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
          OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
        )
    )
  );

CREATE POLICY "admins_delete_app_releases" ON public.app_releases
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.tipo IN ('admin', 'ceo')
          OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
          OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
        )
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-releases',
  'app-releases',
  true,
  262144000,
  ARRAY[
    'application/vnd.android.package-archive',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admins_upload_app_releases" ON storage.objects;
DROP POLICY IF EXISTS "admins_update_app_release_objects" ON storage.objects;
DROP POLICY IF EXISTS "admins_delete_app_release_objects" ON storage.objects;

CREATE POLICY "admins_upload_app_releases" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'app-releases'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.tipo IN ('admin', 'ceo')
          OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
          OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
        )
    )
  );

CREATE POLICY "admins_update_app_release_objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'app-releases'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.tipo IN ('admin', 'ceo')
          OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
          OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
        )
    )
  )
  WITH CHECK (
    bucket_id = 'app-releases'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.tipo IN ('admin', 'ceo')
          OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
          OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
        )
    )
  );

CREATE POLICY "admins_delete_app_release_objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'app-releases'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.tipo IN ('admin', 'ceo')
          OR 'admin' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
          OR 'ceo' = ANY(COALESCE(u.roles, ARRAY[]::TEXT[]))
        )
    )
  );
