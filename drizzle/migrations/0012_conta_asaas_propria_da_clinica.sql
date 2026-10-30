alter table public.pagamento_contas add column if not exists webhook_id text;
alter table public.pagamento_contas add column if not exists conectada_por uuid;
comment on column public.pagamento_contas.asaas_conta_id is 'Carteira (walletId) da conta Asaas da própria clínica';