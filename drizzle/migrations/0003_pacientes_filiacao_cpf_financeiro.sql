ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS responsavel_cpf text,
  ADD COLUMN IF NOT EXISTS responsavel2_cpf text,
  ADD COLUMN IF NOT EXISTS responsavel_financeiro_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_financeiro_cpf text;