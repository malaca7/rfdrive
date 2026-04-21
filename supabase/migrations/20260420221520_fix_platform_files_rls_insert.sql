-- Fix RLS on public.platform_files: add WITH CHECK for INSERT/UPDATE
-- The original "admins_manage_files" policy only had USING (SELECT filter),
-- which blocks INSERT because Postgres RLS requires WITH CHECK for INSERT.

DROP POLICY IF EXISTS "admins_manage_files" ON public.platform_files;
DROP POLICY IF EXISTS "admins_select_files" ON public.platform_files;
DROP POLICY IF EXISTS "admins_insert_files" ON public.platform_files;
DROP POLICY IF EXISTS "admins_update_files" ON public.platform_files;
DROP POLICY IF EXISTS "admins_delete_files" ON public.platform_files;

CREATE POLICY "admins_select_files" ON public.platform_files
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

CREATE POLICY "admins_insert_files" ON public.platform_files
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

CREATE POLICY "admins_update_files" ON public.platform_files
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

CREATE POLICY "admins_delete_files" ON public.platform_files
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
