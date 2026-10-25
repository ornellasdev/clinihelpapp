ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS responsavel2_email text,
  ADD COLUMN IF NOT EXISTS responsavel_financeiro_telefone text,
  ADD COLUMN IF NOT EXISTS responsavel_financeiro_email text;