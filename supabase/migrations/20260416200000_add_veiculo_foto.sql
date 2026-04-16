-- Add veiculo_foto column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS veiculo_foto TEXT DEFAULT NULL;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
