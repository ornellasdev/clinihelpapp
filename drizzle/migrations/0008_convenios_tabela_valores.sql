CREATE TABLE public.convenios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'convenio' CHECK (tipo IN ('convenio','particular','liminar')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX convenios_nome_unico ON public.convenios (lower(nome));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convenios TO authenticated;
GRANT ALL ON public.convenios TO service_role;
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff le convenios" ON public.convenios FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "financeiro cria convenios" ON public.convenios FOR INSERT TO authenticated WITH CHECK (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'));
CREATE POLICY "financeiro edita convenios" ON public.convenios FOR UPDATE TO authenticated USING (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'));
CREATE POLICY "financeiro remove convenios" ON public.convenios FOR DELETE TO authenticated USING (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'));

-- Valores ficam separados para a recepção escolher o convênio sem ver o valor.
CREATE TABLE public.convenio_valores (
  convenio_id uuid PRIMARY KEY REFERENCES public.convenios(id) ON DELETE CASCADE,
  valor_sessao numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_sessao >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.convenio_valores TO authenticated;
GRANT ALL ON public.convenio_valores TO service_role;
ALTER TABLE public.convenio_valores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financeiro le valores convenio" ON public.convenio_valores FOR SELECT TO authenticated USING (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'));
CREATE POLICY "financeiro cria valores convenio" ON public.convenio_valores FOR INSERT TO authenticated WITH CHECK (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'));
CREATE POLICY "financeiro edita valores convenio" ON public.convenio_valores FOR UPDATE TO authenticated USING (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'));

ALTER TABLE public.pacientes ADD COLUMN convenio_id uuid REFERENCES public.convenios(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.criar_financeiro_agendamento()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v numeric(10,2); vc numeric(10,2); p numeric(5,2);
begin
  select valor_sessao_padrao, percentual_repasse_padrao into v, p
  from public.profissional_config where user_id = new.profissional_id;
  select cv.valor_sessao into vc
  from public.pacientes pa join public.convenio_valores cv on cv.convenio_id = pa.convenio_id
  where pa.id = new.paciente_id;
  insert into public.atendimento_financeiro (agendamento_id, valor, percentual_repasse)
  values (new.id, coalesce(vc, v, 0), coalesce(p, 50))
  on conflict do nothing;
  return new;
end; $function$;