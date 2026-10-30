-- Recebimentos por clínica (subconta Asaas). Chave criptografada; só o servidor lê.
alter table public.clinicas add column if not exists pagamentos_ativos boolean not null default false;

create table public.pagamento_contas (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  asaas_conta_id text not null,
  asaas_wallet_id text,
  api_key_cripto text not null,
  webhook_token_hash text not null,
  ambiente text not null check (ambiente in ('sandbox', 'producao')),
  titular_nome text,
  titular_documento text,
  created_at timestamptz not null default now()
);
grant all on public.pagamento_contas to service_role;
alter table public.pagamento_contas enable row level security;
-- sem políticas: nenhum usuário do app lê esta tabela diretamente

create table public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  tipo text not null check (tipo in ('sessao', 'mensal', 'avulsa')),
  descricao text not null check (char_length(descricao) between 1 and 500),
  valor numeric(12,2) not null check (valor >= 5),
  vencimento date not null,
  forma text not null check (forma in ('pix', 'boleto', 'cartao', 'todas')),
  status text not null default 'pendente' check (status in ('pendente', 'em_analise', 'pago', 'vencido', 'estornado', 'contestado', 'cancelada')),
  pagador_nome text not null,
  pagador_cpf text not null,
  pagador_email text,
  pagador_telefone text,
  asaas_cobranca_id text not null unique,
  asaas_cliente_id text not null,
  token_publico text not null unique,
  pago_em timestamptz,
  valor_pago numeric(12,2),
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cobrancas_clinica_venc_idx on public.cobrancas (clinica_id, vencimento desc);
create index cobrancas_paciente_idx on public.cobrancas (paciente_id);
grant select, insert, update on public.cobrancas to authenticated;
grant all on public.cobrancas to service_role;
alter table public.cobrancas enable row level security;

create policy "financeiro le cobrancas" on public.cobrancas for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));
create policy "financeiro cria cobrancas" on public.cobrancas for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));
create policy "financeiro edita cobrancas" on public.cobrancas for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')))
  with check (clinica_id = (select public.minha_clinica()));

create table public.cobranca_itens (
  cobranca_id uuid not null references public.cobrancas(id) on delete cascade,
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  primary key (cobranca_id, agendamento_id)
);
create index cobranca_itens_agendamento_idx on public.cobranca_itens (agendamento_id);
grant select, insert on public.cobranca_itens to authenticated;
grant all on public.cobranca_itens to service_role;
alter table public.cobranca_itens enable row level security;

create policy "financeiro le itens cobranca" on public.cobranca_itens for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));
create policy "financeiro cria itens cobranca" on public.cobranca_itens for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));

create trigger trg_cobrancas_updated before update on public.cobrancas
  for each row execute function public.set_updated_at();

-- Mesma clínica para paciente/cobrança/sessão
create or replace function public.garantir_mesma_clinica()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare ok boolean := true;
begin
  if TG_TABLE_NAME = 'agendamentos' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from salas where id = new.sala_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id)
      and exists (select 1 from profiles where id = new.profissional_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'evolucoes' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id)
      and (new.agendamento_id is null or exists (select 1 from agendamentos where id = new.agendamento_id and clinica_id = new.clinica_id));
  elsif TG_TABLE_NAME = 'paciente_documentos' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'pacientes' then
    ok := new.convenio_id is null or exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'convenio_valores' then
    ok := exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME in ('user_roles', 'profissional_config') then
    ok := exists (select 1 from profiles where id = new.user_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'profissional_especialidades' then
    ok := exists (select 1 from profiles where id = new.user_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'cobrancas' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'cobranca_itens' then
    ok := exists (select 1 from cobrancas where id = new.cobranca_id and clinica_id = new.clinica_id)
      and exists (select 1 from agendamentos a join cobrancas c on c.id = new.cobranca_id
                  where a.id = new.agendamento_id and a.clinica_id = new.clinica_id and a.paciente_id = c.paciente_id);
  end if;
  if not ok then raise exception 'Registro de outra clínica não permitido' using errcode = '42501'; end if;
  return new;
end $function$;

create trigger cobrancas_mesma_clinica before insert or update on public.cobrancas
  for each row execute function public.garantir_mesma_clinica();
create trigger cobranca_itens_mesma_clinica before insert or update on public.cobranca_itens
  for each row execute function public.garantir_mesma_clinica();

create trigger auditoria_cobrancas after insert or update or delete on public.cobrancas
  for each row execute function public.auditar_alteracao();
