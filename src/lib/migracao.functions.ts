import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lerCsv, validarPlanilha } from "./migracao";

const entrada = z.object({
  clinicaId: z.string().uuid(),
  tipo: z.enum(["pacientes", "convenios"]),
  conteudo: z.string().max(5_000_000),
});

const chave = (nome: string, extra?: string | null) =>
  nome.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "|" + (extra ?? "");

/** Importação em lote feita só pelo desenvolvedor (Google + 2 etapas). Revalida tudo no servidor e ignora registros já existentes. */
export const importarDados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof entrada>) => entrada.parse(input))
  .handler(async ({ data, context }) => {
    const { data: dev } = await context.supabase.rpc("eh_dev");
    if (!dev) throw new Error("Acesso de desenvolvedor com verificação em duas etapas necessário.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registrarAuditoria } = await import("./auditoria.server");

    const { data: clinica } = await supabaseAdmin.from("clinicas").select("id, nome").eq("id", data.clinicaId).maybeSingle();
    if (!clinica) throw new Error("Clínica não encontrada.");

    const { linhas, erroGeral } = validarPlanilha(data.tipo, lerCsv(data.conteudo));
    if (erroGeral) throw new Error(erroGeral);
    const comErro = linhas.filter((l) => l.erros.length);
    if (comErro.length) throw new Error(`${comErro.length} linha(s) com erro. Corrija antes de importar.`);

    let inseridos = 0;
    let ignorados = 0;
    const lote = <T,>(arr: T[], n = 200) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

    if (data.tipo === "convenios") {
      const { data: existentes } = await supabaseAdmin.from("convenios").select("nome").eq("clinica_id", clinica.id);
      const vistos = new Set((existentes ?? []).map((c) => chave(c.nome)));
      const novos = linhas
        .filter((l) => !vistos.has(chave(l.dados["nome"]!)))
        .map((l) => ({ clinica_id: clinica.id, nome: l.dados["nome"]!, tipo: l.dados["tipo"] ?? "convenio", criado_por: context.userId }));
      ignorados = linhas.length - novos.length;
      for (const parte of lote(novos)) {
        const { error } = await supabaseAdmin.from("convenios").insert(parte);
        if (error) throw new Error(`Falha ao gravar convênios (${inseridos} já gravados): ${error.message}`);
        inseridos += parte.length;
      }
    } else {
      const [{ data: existentes }, { data: convenios }] = await Promise.all([
        supabaseAdmin.from("pacientes").select("nome, data_nascimento").eq("clinica_id", clinica.id),
        supabaseAdmin.from("convenios").select("id, nome").eq("clinica_id", clinica.id),
      ]);
      const vistos = new Set((existentes ?? []).map((p) => chave(p.nome, p.data_nascimento)));
      const porNome = new Map((convenios ?? []).map((c) => [chave(c.nome), c.id]));
      const novos = linhas
        .filter((l) => !vistos.has(chave(l.dados["nome"]!, l.dados["data_nascimento"])))
        .map((l) => {
          const d = l.dados;
          const convenioId = d["convenio"] ? (porNome.get(chave(d["convenio"])) ?? null) : null;
          return { ...d, nome: d["nome"]!, convenio_id: convenioId, clinica_id: clinica.id, criado_por: context.userId };
        });
      ignorados = linhas.length - novos.length;
      for (const parte of lote(novos)) {
        const { error } = await supabaseAdmin.from("pacientes").insert(parte as any);
        if (error) throw new Error(`Falha ao gravar pacientes (${inseridos} já gravados): ${error.message}`);
        inseridos += parte.length;
      }
    }

    await registrarAuditoria(supabaseAdmin, {
      clinicaId: clinica.id,
      usuarioId: context.userId,
      acao: "importou",
      tabela: data.tipo,
      registroId: clinica.id,
      descricao: `Migração de dados: ${inseridos} ${data.tipo} importados, ${ignorados} já existiam.`,
      depois: { inseridos, ignorados },
    });
    return { inseridos, ignorados, clinica: clinica.nome };
  });
