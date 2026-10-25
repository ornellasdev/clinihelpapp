ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS responsavel2_parentesco text,
  ADD COLUMN IF NOT EXISTS responsavel_financeiro_parentesco text;