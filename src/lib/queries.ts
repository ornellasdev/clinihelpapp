import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Papel } from "./permissions";

function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export type Me = {
  id: string;
  nome: string;
  email: string | null;
  conselho: string | null;
  registro: string | null;
  papeis: Papel[];
  especialidades: string[];
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  staleTime: 60_000,
  queryFn: async (): Promise<Me> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Sessão expirada");
    const id = u.user.id;
    const [p, r, e] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", id),
      supabase.from("profissional_especialidades").select("especialidade_id").eq("user_id", id),
    ]);
    const profile = p.data;
    return {
      id,
      nome: profile?.nome || u.user.email || "",
      email: u.user.email ?? null,
      conselho: profile?.conselho ?? null,
      registro: profile?.registro_profissional ?? null,
      papeis: profile?.ativo === false ? [] : ((r.data ?? []).map((x) => x.role) as Papel[]),
      especialidades: (e.data ?? []).map((x) => x.especialidade_id),
    };
  },
});

export const especialidadesQuery = queryOptions({
  queryKey: ["especialidades"],
  staleTime: 5 * 60_000,
  queryFn: async () => ok(await supabase.from("especialidades").select("*").order("nome")),
});

export const salasQuery = queryOptions({
  queryKey: ["salas"],
  staleTime: 60_000,
  queryFn: async () => ok(await supabase.from("salas").select("*").order("nome")),
});

export type Membro = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  conselho: string | null;
  registro_profissional: string | null;
  ativo: boolean;
  papeis: Papel[];
  especialidades: string[];
};

export const equipeQuery = queryOptions({
  queryKey: ["equipe"],
  staleTime: 30_000,
  queryFn: async (): Promise<Membro[]> => {
    const [p, r, e] = await Promise.all([
      supabase.from("profiles").select("*").order("nome"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("profissional_especialidades").select("user_id, especialidade_id"),
    ]);
    const perfis = ok(p);
    const papeis = ok(r);
    const esp = ok(e);
    return perfis.map((x) => ({
      ...x,
      papeis: papeis.filter((y) => y.user_id === x.id).map((y) => y.role as Papel),
      especialidades: esp.filter((y) => y.user_id === x.id).map((y) => y.especialidade_id),
    }));
  },
});

export const configFinanceiraQuery = queryOptions({
  queryKey: ["profissional_config"],
  queryFn: async () => ok(await supabase.from("profissional_config").select("*")),
});

export const pacientesQuery = (busca: string) =>
  queryOptions({
    queryKey: ["pacientes", busca],
    queryFn: async () => {
      let q = supabase
        .from("pacientes")
        .select("id, nome, data_nascimento, diagnostico, responsavel_nome, responsavel_telefone, ativo, convenio")
        .order("nome")
        .limit(500);
      if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
      return ok(await q);
    },
  });

export const pacientesOpcoesQuery = queryOptions({
  queryKey: ["pacientes", "opcoes"],
  queryFn: async () =>
    ok(await supabase.from("pacientes").select("id, nome, data_nascimento").eq("ativo", true).order("nome").limit(1000)),
});

export const pacienteQuery = (id: string) =>
  queryOptions({
    queryKey: ["paciente", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacientes").select("*").eq("id", id).single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const documentosQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["documentos", pacienteId],
    queryFn: async () =>
      ok(
        await supabase
          .from("paciente_documentos")
          .select("*")
          .eq("paciente_id", pacienteId)
          .order("created_at", { ascending: false }),
      ),
  });

export const evolucoesQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["evolucoes", pacienteId],
    queryFn: async () =>
      ok(
        await supabase
          .from("evolucoes")
          .select("*")
          .eq("paciente_id", pacienteId)
          .order("data_atendimento", { ascending: false })
          .order("created_at", { ascending: false }),
      ),
  });

const AGENDA_SELECT =
  "*, paciente:pacientes(id, nome), profissional:profiles(id, nome), sala:salas(id, nome), especialidade:especialidades(id, nome, cor)";

async function fetchAgenda(inicioISO: string, fimISO: string) {
  return ok(
    await supabase
      .from("agendamentos")
      .select(AGENDA_SELECT)
      .gte("inicio", inicioISO)
      .lt("inicio", fimISO)
      .order("inicio"),
  );
}
export type AgendaItem = Awaited<ReturnType<typeof fetchAgenda>>[number];

export const agendaQuery = (inicioISO: string, fimISO: string) =>
  queryOptions({
    queryKey: ["agenda", inicioISO, fimISO],
    queryFn: () => fetchAgenda(inicioISO, fimISO),
  });

export const agendaPacienteQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["agenda", "paciente", pacienteId],
    queryFn: async (): Promise<AgendaItem[]> =>
      ok(
        await supabase
          .from("agendamentos")
          .select(AGENDA_SELECT)
          .eq("paciente_id", pacienteId)
          .order("inicio", { ascending: false })
          .limit(300),
      ),
  });

export const financeiroQuery = (inicioISO: string, fimISO: string) =>
  queryOptions({
    queryKey: ["financeiro", inicioISO, fimISO],
    queryFn: async () =>
      ok(
        await supabase
          .from("agendamentos")
          .select(
            "id, inicio, status, profissional_id, paciente:pacientes(nome), profissional:profiles(nome), especialidade:especialidades(nome), fin:atendimento_financeiro!inner(*)",
          )
          .gte("inicio", inicioISO)
          .lt("inicio", fimISO)
          .order("inicio"),
      ),
  });
