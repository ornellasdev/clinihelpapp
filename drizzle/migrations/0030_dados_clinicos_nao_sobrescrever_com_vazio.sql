create or replace function public.mover_dados_clinicos_paciente()
returns trigger language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if coalesce(new.diagnostico, new.cid, new.alergias, new.medicamentos) is null then return new; end if;
  v := jsonb_build_object('diagnostico', new.diagnostico, 'cid', new.cid, 'alergias', new.alergias, 'medicamentos', new.medicamentos);
  new.diagnostico := null; new.cid := null; new.alergias := null; new.medicamentos := null;
  if tg_op = 'UPDATE' then
    -- só os campos enviados preenchidos substituem; os demais continuam como estavam
    insert into public.paciente_dados_clinicos (paciente_id, clinica_id, diagnostico, cid, alergias, medicamentos)
    values (new.id, new.clinica_id, v ->> 'diagnostico', v ->> 'cid', v ->> 'alergias', v ->> 'medicamentos')
    on conflict (paciente_id) do update set
      diagnostico = coalesce(excluded.diagnostico, paciente_dados_clinicos.diagnostico),
      cid = coalesce(excluded.cid, paciente_dados_clinicos.cid),
      alergias = coalesce(excluded.alergias, paciente_dados_clinicos.alergias),
      medicamentos = coalesce(excluded.medicamentos, paciente_dados_clinicos.medicamentos);
  else
    perform set_config('clinihelp.dc_' || replace(new.id::text, '-', '_'), v::text, true);
  end if;
  return new;
end $$;
