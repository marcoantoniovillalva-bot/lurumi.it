-- Abilita Supabase Realtime per projects e tutorials
-- Necessario per la sincronizzazione dei contatori tra dispositivi/tab

ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tutorials;
