create extension if not exists btree_gist;

create type public.app_role as enum ('master','recepcao','profissional','financeiro');
create type public.agendamento_status as enum ('agendado','confirmado','realizado','falta','cancelado');

-- generic updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text,
  telefone text,
  conselho text,
  registro_profissional text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- USER ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = _user_id and p.ativo
  )
$$;

create or replace function public.master_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'master')
$$;
grant execute on function public.master_exists() to anon, authenticated;

-- ESPECIALIDADES
create table public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text not null default 'chart-1',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.especialidades to authenticated;
grant all on public.especialidades to service_role;
alter table public.especialidades enable row level security;

create table public.profissional_especialidades (
  user_id uuid not null references public.profiles(id) on delete cascade,
  especialidade_id uuid not null references public.especialidades(id) on delete cascade,
  primary key (user_id, especialidade_id)
);
grant select, insert, delete on public.profissional_especialidades to authenticated;
grant all on public.profissional_especialidades to service_role;
alter table public.profissional_especialidades enable row level security;

create or replace function public.has_especialidade(_user_id uuid, _esp uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profissional_especialidades where user_id = _user_id and especialidade_id = _esp)
    and public.is_staff(_user_id)
$$;

create or replace function public.can_view_especialidade(_user_id uuid, _esp uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'master') or public.has_especialidade(_user_id, _esp)
$$;

create table public.profissional_config (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  valor_sessao_padrao numeric(10,2) not null default 0,
  percentual_repasse_padrao numeric(5,2) not null default 50 check (percentual_repasse_padrao between 0 and 100),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profissional_config to authenticated;
grant all on public.profissional_config to service_role;
alter table public.profissional_config enable row level security;
create trigger trg_pconf_updated before update on public.profissional_config for each row execute function public.set_updated_at();

-- SALAS
create table public.salas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.salas to authenticated;
grant all on public.salas to service_role;
alter table public.salas enable row level security;

-- PACIENTES
create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_nascimento date,
  sexo text,
  cpf text,
  diagnostico text,
  cid text,
  responsavel_nome text,
  responsavel_parentesco text,
  responsavel_telefone text,
  responsavel_email text,
  responsavel2_nome text,
  responsavel2_telefone text,
  endereco text,
  cidade text,
  escola text,
  convenio text,
  carteirinha text,
  alergias text,
  medicamentos text,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pacientes to authenticated;
grant all on public.pacientes to service_role;
alter table public.pacientes enable row level security;
create trigger trg_pacientes_updated before update on public.pacientes for each row execute function public.set_updated_at();

create table public.paciente_documentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  nome text not null,
  categoria text not null default 'Outros',
  storage_path text not null,
  tamanho bigint,
  mime_type text,
  enviado_por uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.paciente_documentos to authenticated;
grant all on public.paciente_documentos to service_role;
alter table public.paciente_documentos enable row level security;

-- AGENDAMENTOS
create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  profissional_id uuid not null references public.profiles(id),
  sala_id uuid not null references public.salas(id),
  especialidade_id uuid not null references public.especialidades(id),
  inicio timestamptz not null,
  fim timestamptz not null,
  status public.agendamento_status not null default 'agendado',
  observacoes text,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agendamento_fim_maior check (fim > inicio),
  constraint sala_sem_conflito exclude using gist (sala_id with =, tstzrange(inicio, fim) with &&) where (status <> 'cancelado'),
  constraint profissional_sem_conflito exclude using gist (profissional_id with =, tstzrange(inicio, fim) with &&) where (status <> 'cancelado')
);
create index on public.agendamentos (inicio);
grant select, insert, update, delete on public.agendamentos to authenticated;
grant all on public.agendamentos to service_role;
alter table public.agendamentos enable row level security;
create trigger trg_agend_updated before update on public.agendamentos for each row execute function public.set_updated_at();

-- FINANCEIRO por atendimento
create table public.atendimento_financeiro (
  agendamento_id uuid primary key references public.agendamentos(id) on delete cascade,
  valor numeric(10,2) not null default 0 check (valor >= 0),
  percentual_repasse numeric(5,2) not null default 50 check (percentual_repasse between 0 and 100),
  valor_repasse numeric(10,2) generated always as (round(valor * percentual_repasse / 100, 2)) stored,
  pagamento_status text not null default 'pendente' check (pagamento_status in ('pendente','pago')),
  repasse_pago boolean not null default false,
  observacoes text,
  updated_at timestamptz not null default now()
);
grant select, update on public.atendimento_financeiro to authenticated;
grant all on public.atendimento_financeiro to service_role;
alter table public.atendimento_financeiro enable row level security;
create trigger trg_fin_updated before update on public.atendimento_financeiro for each row execute function public.set_updated_at();

create or replace function public.criar_financeiro_agendamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v numeric(10,2); p numeric(5,2);
begin
  select valor_sessao_padrao, percentual_repasse_padrao into v, p
  from public.profissional_config where user_id = new.profissional_id;
  insert into public.atendimento_financeiro (agendamento_id, valor, percentual_repasse)
  values (new.id, coalesce(v, 0), coalesce(p, 50))
  on conflict do nothing;
  return new;
end; $$;
create trigger trg_agend_financeiro after insert on public.agendamentos for each row execute function public.criar_financeiro_agendamento();

-- EVOLUCOES (prontuario)
create table public.evolucoes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  especialidade_id uuid not null references public.especialidades(id),
  profissional_id uuid not null default auth.uid(),
  profissional_nome text,
  profissional_registro text,
  data_atendimento date not null default current_date,
  conteudo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.evolucoes (paciente_id, data_atendimento desc);
grant select, insert, update, delete on public.evolucoes to authenticated;
grant all on public.evolucoes to service_role;
alter table public.evolucoes enable row level security;

create or replace function public.evolucao_assinatura()
returns trigger language plpgsql security definer set search_path = public as $$
declare pr record;
begin
  if tg_op = 'INSERT' then
    new.profissional_id := auth.uid();
    select nome, conselho, registro_profissional into pr from public.profiles where id = new.profissional_id;
    new.profissional_nome := pr.nome;
    new.profissional_registro := nullif(trim(coalesce(pr.conselho,'') || ' ' || coalesce(pr.registro_profissional,'')), '');
  else
    new.profissional_id := old.profissional_id;
    new.profissional_nome := old.profissional_nome;
    new.profissional_registro := old.profissional_registro;
    new.paciente_id := old.paciente_id;
    new.especialidade_id := old.especialidade_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end; $$;
create trigger trg_evolucao_assinatura before insert or update on public.evolucoes for each row execute function public.evolucao_assinatura();

-- PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- POLICIES
create policy "staff le perfis" on public.profiles for select to authenticated using (public.is_staff(auth.uid()) or id = auth.uid());
create policy "master edita perfis" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'master')) with check (public.has_role(auth.uid(),'master'));

create policy "staff le papeis" on public.user_roles for select to authenticated using (public.is_staff(auth.uid()) or user_id = auth.uid());
create policy "master cria papeis" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'master'));
create policy "master remove papeis" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'master'));

create policy "staff le especialidades" on public.especialidades for select to authenticated using (public.is_staff(auth.uid()));
create policy "master gerencia especialidades ins" on public.especialidades for insert to authenticated with check (public.has_role(auth.uid(),'master'));
create policy "master gerencia especialidades upd" on public.especialidades for update to authenticated using (public.has_role(auth.uid(),'master'));
create policy "master gerencia especialidades del" on public.especialidades for delete to authenticated using (public.has_role(auth.uid(),'master'));

create policy "staff le vinculos" on public.profissional_especialidades for select to authenticated using (public.is_staff(auth.uid()) or user_id = auth.uid());
create policy "master cria vinculos" on public.profissional_especialidades for insert to authenticated with check (public.has_role(auth.uid(),'master'));
create policy "master remove vinculos" on public.profissional_especialidades for delete to authenticated using (public.has_role(auth.uid(),'master'));

create policy "le config financeira" on public.profissional_config for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'financeiro'));
create policy "cria config financeira" on public.profissional_config for insert to authenticated with check (public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'financeiro'));
create policy "edita config financeira" on public.profissional_config for update to authenticated using (public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'financeiro'));

create policy "staff le salas" on public.salas for select to authenticated using (public.is_staff(auth.uid()));
create policy "master cria salas" on public.salas for insert to authenticated with check (public.has_role(auth.uid(),'master'));
create policy "master edita salas" on public.salas for update to authenticated using (public.has_role(auth.uid(),'master'));
create policy "master remove salas" on public.salas for delete to authenticated using (public.has_role(auth.uid(),'master'));

create policy "staff le pacientes" on public.pacientes for select to authenticated using (public.is_staff(auth.uid()));
create policy "recepcao cria pacientes" on public.pacientes for insert to authenticated with check (public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'recepcao'));
create policy "recepcao edita pacientes" on public.pacientes for update to authenticated using (public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'recepcao'));
create policy "master remove pacientes" on public.pacientes for delete to authenticated using (public.has_role(auth.uid(),'master'));

create policy "staff le documentos" on public.paciente_documentos for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff envia documentos" on public.paciente_documentos for insert to authenticated with check (public.is_staff(auth.uid()) and enviado_por = auth.uid());
create policy "remove documentos" on public.paciente_documentos for delete to authenticated using (public.has_role(auth.uid(),'master') or enviado_por = auth.uid());

create policy "staff le agenda" on public.agendamentos for select to authenticated using (public.is_staff(auth.uid()));
create policy "recepcao agenda" on public.agendamentos for insert to authenticated with check (public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'recepcao'));
create policy "edita agenda" on public.agendamentos for update to authenticated using (public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'recepcao') or (profissional_id = auth.uid() and public.is_staff(auth.uid())));
create policy "remove agenda" on public.agendamentos for delete to authenticated using (public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'recepcao'));

create policy "le financeiro" on public.atendimento_financeiro for select to authenticated using (
  public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'financeiro')
  or exists (select 1 from public.agendamentos a where a.id = agendamento_id and a.profissional_id = auth.uid())
);
create policy "edita financeiro" on public.atendimento_financeiro for update to authenticated using (public.has_role(auth.uid(),'master') or public.has_role(auth.uid(),'financeiro'));

create policy "le prontuario da especialidade" on public.evolucoes for select to authenticated using (public.can_view_especialidade(auth.uid(), especialidade_id));
create policy "profissional registra evolucao" on public.evolucoes for insert to authenticated with check (public.has_especialidade(auth.uid(), especialidade_id));
create policy "autor edita evolucao" on public.evolucoes for update to authenticated using (profissional_id = auth.uid() and public.has_especialidade(auth.uid(), especialidade_id));
create policy "master remove evolucao" on public.evolucoes for delete to authenticated using (public.has_role(auth.uid(),'master'));

-- STORAGE policies (bucket created separately)
create policy "staff le arquivos pacientes" on storage.objects for select to authenticated using (bucket_id = 'documentos-pacientes' and public.is_staff(auth.uid()));
create policy "staff envia arquivos pacientes" on storage.objects for insert to authenticated with check (bucket_id = 'documentos-pacientes' and public.is_staff(auth.uid()));
create policy "remove arquivos pacientes" on storage.objects for delete to authenticated using (bucket_id = 'documentos-pacientes' and (public.has_role(auth.uid(),'master') or owner = auth.uid()));

-- SEED
insert into public.especialidades (nome, cor) values
 ('Psicologia','chart-1'),('Fonoaudiologia','chart-2'),('Terapia Ocupacional','chart-3'),('Fisioterapia','chart-4'),
 ('Psicomotricidade','chart-5'),('Musicoterapia','chart-1'),('Psicopedagogia','chart-2');
insert into public.salas (nome, descricao) values
 ('Sala 1','Atendimento individual'),('Sala 2','Atendimento individual'),('Sala de Integração Sensorial','Equipamentos sensoriais'),('Sala de Música','Musicoterapia');