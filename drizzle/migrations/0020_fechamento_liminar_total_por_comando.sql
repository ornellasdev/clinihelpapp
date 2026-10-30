-- Recalcula o total uma vez por comando (e não por sessão), para a auditoria registrar uma alteração só.
drop trigger if exists fatura_liminar_itens_total on public.fatura_liminar_itens;

create or replace function public.recalcular_faturas_liminar(_ids uuid[])
 returns void language sql security definer set search_path to 'public'
as $function$
  update faturas_liminar f set
    quantidade_sessoes = coalesce(s.n, 0),
    valor = coalesce(s.total, 0)
  from (select unnest(_ids) as id) alvo
  left join (
    select i.fatura_id, count(*)::int as n, sum(coalesce(af.valor, 0)) as total
    from fatura_liminar_itens i left join atendimento_financeiro af on af.agendamento_id = i.agendamento_id
    where i.fatura_id = any(_ids)
    group by i.fatura_id
  ) s on s.fatura_id = alvo.id
  where f.id = alvo.id
    and (f.quantidade_sessoes, f.valor) is distinct from (coalesce(s.n, 0), coalesce(s.total, 0));
$function$;
revoke execute on function public.recalcular_faturas_liminar(uuid[]) from public, anon, authenticated;

create or replace function public.recalcular_fatura_liminar_ins()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  perform public.recalcular_faturas_liminar(array(select distinct fatura_id from novos));
  return null;
end $function$;

create or replace function public.recalcular_fatura_liminar_del()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  perform public.recalcular_faturas_liminar(array(select distinct fatura_id from antigos));
  return null;
end $function$;

drop function if exists public.recalcular_fatura_liminar();

create trigger fatura_liminar_itens_total_ins after insert on public.fatura_liminar_itens
  referencing new table as novos for each statement execute function public.recalcular_fatura_liminar_ins();
create trigger fatura_liminar_itens_total_del after delete on public.fatura_liminar_itens
  referencing old table as antigos for each statement execute function public.recalcular_fatura_liminar_del();
