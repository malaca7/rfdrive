-- Define avatar padrao no banco para novos usuarios
CREATE OR REPLACE FUNCTION public.set_default_avatar_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.avatar_url IS NULL OR btrim(NEW.avatar_url) = '' THEN
		NEW.avatar_url := 'https://api.dicebear.com/9.x/thumbs/svg?seed=' || NEW.id::text;
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_set_default_avatar_url ON public.users;

CREATE TRIGGER trg_users_set_default_avatar_url
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_default_avatar_url();

-- Backfill dos usuarios ja existentes sem avatar
UPDATE public.users
SET avatar_url = 'https://api.dicebear.com/9.x/thumbs/svg?seed=' || id::text
WHERE avatar_url IS NULL OR btrim(avatar_url) = '';

NOTIFY pgrst, 'reload schema';
