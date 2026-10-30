create or replace function public.termo_calcular_hash()
returns trigger language plpgsql set search_path = public as $$
begin
  new.texto_hash := encode(sha256(convert_to(new.texto, 'UTF8')), 'hex');
  return new;
end $$;
create trigger trg_termo_hash before insert on public.termos_assinaturas
  for each row execute function public.termo_calcular_hash();