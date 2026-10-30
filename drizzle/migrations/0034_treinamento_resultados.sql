-- CliniHelp LMS: resultado de cada questionário (corrigido e gravado só pelo servidor; nunca alterado).
create table public.treinamento_resultados (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  user_id uuid not null,
  modulo_id text not null check (modulo_id ~ '^[a-z0-9-]{2,60}$'),
  versao integer not null check (versao >= 1),
  acertos integer not null check (acertos >= 0),
  total integer not null check (total > 0 and acertos <= total),
  aprovado boolean not null,
  created_at timestamptz not null default now()
);
grant select on public.treinamento_resultados to authenticated;
grant all on public.treinamento_resultados to service_role;
alter table public.treinamento_resultados enable row level security;

-- Cada pessoa vê os próprios resultados; gestão (master/administrador) vê os da clínica.
create policy "le resultados de treinamento" on public.treinamento_resultados for select to authenticated
  using (clinica_id = (select public.minha_clinica())
         and (user_id = auth.uid() or public.is_gestor(auth.uid())));

create index treinamento_resultados_idx on public.treinamento_resultados (clinica_id, user_id, modulo_id, created_at desc);

create or replace function public.treinamento_somente_inclusao()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Resultados de treinamento não podem ser alterados nem apagados.' using errcode = '42501';
end $$;
create trigger trg_treinamento_imutavel before update or delete on public.treinamento_resultados
  for each row execute function public.treinamento_somente_inclusao();
revoke execute on function public.treinamento_somente_inclusao() from public, anon;
grant execute on function public.treinamento_somente_inclusao() to authenticated, service_role;
