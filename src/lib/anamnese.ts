// Formulário de avaliação inicial — "Entrevista inicial com pais e responsáveis" (anamnese).
// As respostas ficam gravadas com a VERSAO; ao mudar perguntas de lugar ou de sentido, suba a versão.
import { cpfValido, somenteDigitos } from "./cobrancas";

export const VERSAO_ANAMNESE = 1;

/** Rascunho do formulário guardado no aparelho dos pais (apagado ao enviar ou sair). */
export const PREFIXO_RASCUNHO = "clinihelp:anamnese:";

export type TipoCampo = "texto" | "longo" | "simnao" | "escolha" | "multipla" | "data";
export type Formato = "email" | "telefone" | "cpf";
export type Campo = {
  id: string;
  rotulo: string;
  tipo: TipoCampo;
  opcoes?: string[];
  opcional?: boolean;
  formato?: Formato;
  ajuda?: string;
  /** Mostra (e exige) o campo só quando outro campo tem este valor. */
  dependeDe?: { campo: string; valor: string };
  /** Título de grupo exibido antes do campo (ex.: "Responsável 1"). */
  grupo?: string;
};
export type SecaoAnamnese = { id: string; titulo: string; descricao?: string; campos: Campo[] };
export type Respostas = Record<string, string | string[]>;

/** Dados da ficha usados para pré-preencher (vêm do RPC familia_avaliacao). */
export type FichaAnamnese = Partial<Record<
  | "nome" | "data_nascimento" | "cpf" | "endereco" | "numero" | "complemento" | "cep" | "cidade" | "uf" | "escola" | "convenio"
  | "responsavel_nome" | "responsavel_parentesco" | "responsavel_telefone" | "responsavel_email"
  | "responsavel2_nome" | "responsavel2_parentesco" | "responsavel2_telefone" | "responsavel2_email" | "responsavel_financeiro_nome",
  string | null
>>;

const SIM_NAO = ["Sim", "Não"];
type Extra = Partial<Omit<Campo, "rotulo" | "tipo">>;
// Construtores curtos; o id definitivo é dado em montar() quando não for informado.
const T = (rotulo: string, e: Extra = {}) => ({ rotulo, tipo: "texto" as const, ...e });
const L = (rotulo: string, e: Extra = {}) => ({ rotulo, tipo: "longo" as const, ...e });
const SN = (rotulo: string, e: Extra = {}) => ({ rotulo, tipo: "simnao" as const, opcoes: SIM_NAO, ...e });
const E = (rotulo: string, opcoes: string[], e: Extra = {}) => ({ rotulo, tipo: "escolha" as const, opcoes, ...e });
const M = (rotulo: string, opcoes: string[], e: Extra = {}) => ({ rotulo, tipo: "multipla" as const, opcoes, ...e });
const D = (rotulo: string, e: Extra = {}) => ({ rotulo, tipo: "data" as const, ...e });
type CampoBruto = Omit<Campo, "id"> & { id?: string };

const R2 = { campo: "resp2_existe", valor: "Sim" };

const BRUTO: { id: string; titulo: string; descricao?: string; campos: CampoBruto[] }[] = [
  {
    id: "identificacao",
    titulo: "1. Identificação da criança",
    descricao: "Alguns dados já vieram da ficha da clínica. Confira e corrija se for preciso.",
    campos: [
      T("Nome completo", { id: "crianca_nome" }),
      D("Data de nascimento", { id: "crianca_nascimento" }),
      T("CPF (se tiver)", { id: "crianca_cpf", opcional: true, formato: "cpf" }),
      T("Endereço completo (rua, número e complemento)", { id: "crianca_endereco" }),
      T("Bairro", { id: "crianca_bairro" }),
      T("Cidade/UF", { id: "crianca_cidade" }),
      T("Telefone de contato", { id: "crianca_telefone", formato: "telefone" }),
      T("E-mail", { id: "crianca_email", formato: "email" }),
      T("Nome da escola", { id: "crianca_escola" }),
      T("Escolaridade/turma"),
      E("Turno escolar", ["Manhã", "Tarde", "Integral", "Não frequenta escola"]),
      SN("A criança frequenta a escola regularmente?"),
      T("Possui acompanhante escolar ou profissional de apoio? Qual?"),
    ],
  },
  {
    id: "responsaveis",
    titulo: "2. Identificação dos responsáveis",
    campos: [
      T("Nome completo", { id: "resp1_nome", grupo: "Responsável 1" }),
      T("Grau de parentesco", { id: "resp1_parentesco" }),
      D("Data de nascimento", { id: "resp1_nascimento" }),
      T("Telefone", { id: "resp1_telefone", formato: "telefone" }),
      T("E-mail", { id: "resp1_email", formato: "email" }),
      T("Profissão", { id: "resp1_profissao" }),
      SN("É o responsável financeiro?", { id: "resp1_financeiro" }),
      SN("Há um segundo responsável?", { id: "resp2_existe", grupo: "Responsável 2" }),
      T("Nome completo", { id: "resp2_nome", dependeDe: R2 }),
      T("Grau de parentesco", { id: "resp2_parentesco", dependeDe: R2 }),
      D("Data de nascimento", { id: "resp2_nascimento", dependeDe: R2 }),
      T("Telefone", { id: "resp2_telefone", formato: "telefone", dependeDe: R2 }),
      T("E-mail", { id: "resp2_email", formato: "email", dependeDe: R2 }),
      T("Profissão", { id: "resp2_profissao", dependeDe: R2 }),
      SN("É o responsável financeiro?", { id: "resp2_financeiro", dependeDe: R2 }),
      T("Com quem a criança reside?", { grupo: "Convivência e cuidados" }),
      T("Quem participa mais ativamente dos cuidados diários?"),
      T("Quem costuma acompanhar a criança nas terapias?"),
      T("Quem está autorizado a receber informações sobre o tratamento?"),
    ],
  },
  {
    id: "motivo",
    titulo: "3. Motivo da procura e expectativas familiares",
    campos: [
      L("Qual é a principal preocupação da família neste momento?"),
      L("O que motivou a procura por atendimento?"),
      L("Quais são as principais dificuldades observadas no dia a dia?"),
      T("Quando essas dificuldades começaram a ser percebidas?"),
      T("Quem identificou as primeiras dificuldades?"),
      T("A criança já possui diagnóstico? Qual?"),
      T("O diagnóstico foi realizado por qual profissional e em que período?"),
      T("Há investigações diagnósticas em andamento?"),
      L("Como a família tem vivenciado essa situação?"),
      L("Quais mudanças ou ganhos vocês esperam observar nos próximos seis meses?"),
      L("Existe alguma prioridade que a família considera mais urgente?"),
    ],
  },
  {
    id: "gestacao",
    titulo: "4. Histórico gestacional e perinatal",
    campos: [
      SN("A gestação foi planejada?"),
      T("Qual era a idade materna na concepção?"),
      SN("Houve tratamento para fertilidade?"),
      L("Houve intercorrências durante a gestação? Quais?"),
      SN("A mãe fez acompanhamento pré-natal?"),
      T("Qual foi a idade gestacional no nascimento? (semanas)"),
      E("Tipo de parto", ["Vaginal", "Cesárea", "Outro"]),
      T("Local do parto"),
      T("Peso ao nascer"),
      T("Comprimento ao nascer"),
      T("Perímetro cefálico ao nascer"),
      SN("Houve necessidade de internação após o nascimento?"),
      T("A criança precisou de UTI neonatal, incubadora ou suporte ventilatório?"),
      T("Apresentou icterícia, hipoglicemia ou outras intercorrências?"),
      T("Quanto tempo permaneceu no hospital?"),
      L("Houve alguma complicação no período neonatal?"),
    ],
  },
  {
    id: "alimentacao",
    titulo: "5. Amamentação e alimentação inicial",
    campos: [
      T("Foi amamentada? Por quanto tempo?"),
      T("O aleitamento foi exclusivo? Até qual idade?"),
      T("Houve dificuldades para amamentar? Quais?"),
      T("Utilizou mamadeira? Até que idade?"),
      T("Utilizou chupeta? Até que idade?"),
      SN("Utilizou bico intermediário?"),
      T("Quando ocorreu a introdução alimentar?"),
      T("Como foi a aceitação dos primeiros alimentos?"),
      T("Houve engasgos, tosse, vômitos ou outras dificuldades durante a alimentação?"),
      L("Como a criança se alimenta atualmente?"),
      M("Quais consistências aceita?", ["Líquidos", "Pastosos", "Sólidos", "Outras"]),
      SN("Existe seletividade alimentar?"),
      L("Quais alimentos aceita e quais recusa?"),
      T("Como reage diante de alimentos novos?"),
      SN("Consegue comer sozinha?"),
      M("Quais utensílios utiliza?", ["Colher", "Garfo", "Faca", "Talheres adaptados", "Nenhum"]),
      T("Necessita de ajuda ou adaptações durante as refeições?"),
      T("Quanto tempo costuma durar uma refeição?"),
      E("A alimentação é realizada em ambiente tranquilo ou com telas?", ["Ambiente tranquilo", "Com telas", "Varia"]),
      L("O que a família considera mais difícil na alimentação atualmente?"),
    ],
  },
  {
    id: "desenvolvimento",
    titulo: "6. Desenvolvimento neuropsicomotor",
    campos: [
      T("Com que idade sustentou a cabeça?"),
      T("Com que idade sentou sem apoio?"),
      T("Engatinhou? Com que idade?"),
      T("Com que idade começou a andar?"),
      T("Como está o equilíbrio e a coordenação motora?"),
      T("Apresenta dificuldades para correr, pular, subir escadas ou brincar no parque?"),
      L("Como utiliza as mãos para alcançar, segurar, soltar e manipular objetos?"),
      T("Apresenta dificuldades com lápis, encaixes, blocos ou outros brinquedos?"),
      T("Há diferenças entre os lados do corpo ou preferência manual definida?"),
      T("Apresenta alterações de tônus, postura ou movimentos?"),
      T("Houve perda de habilidades que já havia adquirido?"),
      L("Como a família percebe o desenvolvimento atual em comparação com crianças da mesma idade?"),
    ],
  },
  {
    id: "comunicacao",
    titulo: "7. Comunicação, fala e linguagem",
    campos: [
      L("Como a criança costuma comunicar o que deseja?"),
      T("Utiliza fala, gestos, apontar, expressões faciais ou outros recursos?"),
      T("Com que idade falou as primeiras palavras?"),
      SN("Combina palavras em frases?"),
      T("Consegue relatar acontecimentos e expressar sentimentos?"),
      SN("Compreende instruções simples?"),
      SN("Compreende orientações com duas ou mais etapas?"),
      SN("Responde quando é chamada pelo nome?"),
      SN("Aponta para objetos ou pessoas para compartilhar interesses?"),
      T("Utiliza gestos para pedir, recusar, mostrar ou chamar alguém?"),
      T("Como demonstra que não quer algo?"),
      T("Como pede ajuda?"),
      T("A fala é compreendida por familiares? E por pessoas que não convivem com ela?"),
      T("Apresenta trocas de sons, omissões, gagueira ou dificuldades para organizar a fala?"),
      T("Apresenta repetição de palavras ou frases?"),
      L("Como participa de conversas e brincadeiras compartilhadas?"),
      T("Utiliza ou já utilizou Comunicação Aumentativa e Alternativa (CAA)?"),
      T("Utiliza figuras, pranchas, comunicador, tablet ou aplicativos de comunicação?"),
      L("Quais são as principais necessidades da família em relação à comunicação?"),
    ],
  },
  {
    id: "social",
    titulo: "8. Interação social, brincar e comportamento",
    campos: [
      L("Como você descreveria a personalidade da criança?"),
      L("Como costuma demonstrar alegria, irritação, tristeza, medo ou frustração?"),
      T("Como interage com os familiares?"),
      T("Como interage com outras crianças?"),
      T("Busca compartilhar brincadeiras e interesses?"),
      T("Como reage quando precisa esperar ou interromper uma atividade?"),
      L("Apresenta crises de choro, irritabilidade, agressividade ou agitação? Em quais situações?"),
      T("O que costuma desencadear essas reações?"),
      T("O que ajuda a criança a se reorganizar?"),
      L("Como brinca atualmente?"),
      T("Quais brinquedos e atividades prefere?"),
      M("Como brinca?", ["Funcional", "Simbólica / faz de conta", "Ainda não brinca dessas formas"]),
      T("Consegue compartilhar brinquedos e alternar turnos?"),
      T("Apresenta interesses muito específicos ou repetitivos?"),
      T("Como reage a mudanças na rotina?"),
      T("Já recebeu orientações sobre como estimular o brincar em casa? Quais?"),
      T("Em quais momentos do dia a família costuma brincar com a criança?"),
    ],
  },
  {
    id: "sensorial",
    titulo: "9. Processamento sensorial",
    campos: [
      L("A criança apresenta incômodo com sons, luzes, cheiros, texturas ou ambientes movimentados?"),
      L("Como reage ao toque, ao abraço, ao corte de cabelo e ao corte das unhas?"),
      T("Aceita diferentes texturas de roupas e materiais?"),
      T("Evita tocar em determinadas superfícies ou substâncias?"),
      T("Procura constantemente movimentos, balanços, giros ou impactos?"),
      T("Apresenta desconforto com escovação dentária, banho ou lavagem do rosto?"),
      T("Demonstra seletividade relacionada à textura, temperatura, cheiro ou aparência dos alimentos?"),
      T("Como reage a ambientes novos?"),
      L("Existem estratégias sensoriais que ajudam na organização e participação da criança?"),
    ],
  },
  {
    id: "autonomia",
    titulo: "10. Autonomia e atividades de vida diária",
    campos: [
      SN("Alimenta-se de forma independente?", { grupo: "Alimentação" }),
      T("Necessita de supervisão, auxílio físico ou utensílios adaptados?"),
      T("Como participa do banho, da escovação dentária e da lavagem das mãos?", { grupo: "Higiene" }),
      SN("Aceita os cuidados de higiene?"),
      T("Consegue vestir e retirar roupas e calçados?", { grupo: "Vestir-se" }),
      T("Necessita de ajuda para escolher ou organizar as peças?"),
      SN("Utiliza fraldas?", { grupo: "Controle esfincteriano" }),
      T("Demonstra sinais de prontidão para o desfralde?"),
      SN("Comunica quando precisa usar o banheiro?"),
      T("Apresenta dificuldades relacionadas ao uso do vaso sanitário?"),
      T("Qual é o horário habitual de dormir e acordar?", { grupo: "Sono" }),
      SN("Dorme durante a noite?"),
      T("Apresenta despertares frequentes ou dificuldade para iniciar o sono?"),
      E("Dorme sozinho ou acompanhado?", ["Sozinho", "Acompanhado", "Varia"]),
      T("Há ronco ou outras alterações observadas durante o sono?"),
    ],
  },
  {
    id: "rotina",
    titulo: "11. Rotina familiar e escolar",
    campos: [
      L("Como é a rotina da criança durante a semana?"),
      T("Como costuma ser o fim de semana?"),
      T("Quem permanece com a criança durante o dia?"),
      T("Frequenta a escola ou outro ambiente educativo?"),
      T("Como é a adaptação escolar?"),
      T("Como participa das atividades propostas?"),
      L("A escola relata dificuldades de comunicação, aprendizagem, interação ou comportamento?"),
      T("Como se relaciona com professores e colegas?"),
      T("Utiliza adaptações ou recursos de acessibilidade na escola?"),
      T("Quanto tempo utiliza telas por dia e quais conteúdos costuma assistir?"),
      T("Quais atividades realiza fora da escola?"),
      L("Quais são os momentos mais tranquilos e os mais difíceis da rotina?"),
    ],
  },
  {
    id: "clinico",
    titulo: "12. Histórico clínico e familiar",
    campos: [
      T("Apresenta alguma condição clínica ou diagnóstico confirmado?"),
      T("Já teve convulsões? Quantas, em que idade e quando ocorreu o episódio mais recente?"),
      L("Faz uso de medicamentos? Informe nome, dose e horários, se souber."),
      T("Possui alergias? Quais?"),
      T("Apresenta alterações auditivas ou visuais?"),
      M("Realizou exames?", ["Audiológicos", "Oftalmológicos", "Tomografia", "Ressonância", "Eletroencefalograma", "Outros", "Nenhum"]),
      T("Existem resultados ou laudos disponíveis?"),
      T("Já realizou cirurgias? Quais?"),
      T("Possui histórico de internações ou acidentes relevantes?"),
      L("Há histórico familiar de alterações de linguagem, aprendizagem, desenvolvimento neurológico ou outras condições relevantes?"),
      L("Quais profissionais de saúde acompanham a criança atualmente?"),
    ],
  },
  {
    id: "terapias",
    titulo: "13. Histórico terapêutico",
    campos: [
      T("A criança já realizou terapias anteriormente? Quais?"),
      T("Em quais clínicas ou serviços?"),
      T("Por quanto tempo realizou cada acompanhamento?"),
      T("Qual era a frequência semanal?"),
      L("Quais aspectos apresentaram evolução?"),
      L("Quais dificuldades permaneceram?"),
      T("O que a família considera que funcionou melhor?"),
      T("Houve interrupção do tratamento? Por qual motivo?"),
      T("Como foi a relação da criança com os terapeutas anteriores?"),
      T("Recebeu orientações ou atividades para realizar em casa?"),
      T("Possui relatórios, avaliações ou planos terapêuticos anteriores?"),
      T("Quais terapias pretende iniciar ou manter neste momento?"),
    ],
  },
  {
    id: "equipamentos",
    titulo: "14. Equipamentos, órteses e tecnologia assistiva",
    campos: [
      T("Utiliza órteses para membros superiores ou inferiores? Quais?"),
      T("Utiliza andador, cadeira de rodas ou outro dispositivo de mobilidade?"),
      T("Utiliza recursos para posicionamento ou alinhamento biomecânico?"),
      T("Utiliza equipamentos de apoio para alimentação, higiene ou vestuário?"),
      T("Utiliza recursos de Comunicação Aumentativa e Alternativa?"),
      T("Utiliza tablet, computador, comunicador ou acionadores?"),
      L("Quais adaptações são necessárias em casa, na escola ou durante as terapias?"),
      T("Há algum equipamento indicado, mas ainda não disponível?"),
    ],
  },
  {
    id: "rede",
    titulo: "15. Rede de apoio e acompanhamento multidisciplinar",
    descricao: "Informe o nome do profissional ou escreva “Não tem”.",
    campos: [
      T("Pediatra"),
      T("Neurologista"),
      T("Ortopedista"),
      T("Outros médicos", { opcional: true }),
      T("Fonoaudiólogo"),
      T("Terapeuta Ocupacional"),
      T("Psicólogo"),
      T("Psicopedagogo"),
      T("Fisioterapeuta"),
      T("Outros profissionais", { opcional: true }),
      L("Frequência atual de cada acompanhamento"),
      SN("Existe comunicação entre os profissionais?"),
      SN("A família autoriza o contato entre os profissionais envolvidos, quando necessário e mediante os consentimentos aplicáveis?"),
    ],
  },
  {
    id: "administrativo",
    titulo: "16. Informações administrativas",
    campos: [
      T("Como conheceu a clínica?"),
      T("Qual atendimento procura inicialmente?"),
      T("Possui plano de saúde? Qual?", { id: "adm_plano" }),
      E("O atendimento será particular ou por convênio?", ["Particular", "Convênio", "Liminar judicial"]),
      T("Quem será o responsável financeiro?", { id: "adm_resp_financeiro" }),
      T("Necessita de nota fiscal ou documentação específica para reembolso?"),
      T("Quais dias e horários são mais adequados para a família?"),
      T("Há alguma necessidade de acessibilidade ou adaptação para a chegada e permanência na clínica?"),
    ],
  },
  {
    id: "prioridades",
    titulo: "17. Observações e prioridades para a avaliação",
    campos: [
      L("Principais preocupações relatadas pela família"),
      L("Habilidades e potencialidades que vocês percebem na criança"),
      L("Prioridades terapêuticas da família"),
      L("Informações adicionais relevantes", { opcional: true }),
      L("Documentos ou exames que serão apresentados", { opcional: true }),
    ],
  },
];

export const SECOES_ANAMNESE: SecaoAnamnese[] = BRUTO.map((s) => ({
  ...s,
  campos: s.campos.map((c, i) => ({ ...c, id: c.id ?? `${s.id}_${i + 1}` })),
}));

export const TODOS_CAMPOS: Campo[] = SECOES_ANAMNESE.flatMap((s) => s.campos);
const POR_ID = new Map(TODOS_CAMPOS.map((c) => [c.id, c]));

export const LIMITE_TEXTO = 400;
export const LIMITE_LONGO = 4000;

export const TEXTO_LGPD_ANAMNESE = [
  "Declaro que as informações deste formulário são verdadeiras e completas, até onde sei, e que sou responsável pela criança (ou estou autorizado pelo responsável legal).",
  "Estou ciente de que a clínica tratará estes dados — inclusive dados de saúde da criança — somente para avaliação, planejamento e acompanhamento terapêutico, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), em especial os artigos 11 e 14 (dados sensíveis e dados de crianças).",
  "Os dados ficam em ambiente protegido, com acesso extremamente restrito aos profissionais responsáveis pelo cuidado da criança, e não serão compartilhados com terceiros sem autorização, exceto quando a lei exigir.",
  "Posso pedir à clínica acesso, correção ou informações sobre o uso destes dados a qualquer momento.",
].join("\n\n");

export function campoVisivel(c: Campo, r: Respostas) {
  return !c.dependeDe || r[c.dependeDe.campo] === c.dependeDe.valor;
}

const vazio = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length === 0 : !v || !v.trim());
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Erro de um campo (ou null). Campos escondidos nunca dão erro. */
export function erroDoCampo(c: Campo, r: Respostas, hoje = new Date().toISOString().slice(0, 10)): string | null {
  if (!campoVisivel(c, r)) return null;
  const v = r[c.id];
  if (vazio(v)) return c.opcional ? null : "Responda esta pergunta.";
  if (c.tipo === "multipla") {
    if (!Array.isArray(v) || v.some((x) => !c.opcoes!.includes(x))) return "Escolha entre as opções.";
    return null;
  }
  if (typeof v !== "string") return "Resposta inválida.";
  const t = v.trim();
  if ((c.tipo === "escolha" || c.tipo === "simnao") && !c.opcoes!.includes(t)) return "Escolha uma das opções.";
  if (c.tipo === "data") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(t))) return "Data inválida.";
    if (t > hoje) return "A data não pode ser no futuro.";
  }
  if (c.tipo === "texto" && t.length > LIMITE_TEXTO) return `Use no máximo ${LIMITE_TEXTO} caracteres.`;
  if (c.tipo === "longo" && t.length > LIMITE_LONGO) return `Use no máximo ${LIMITE_LONGO} caracteres.`;
  if (c.formato === "email" && !EMAIL.test(t)) return "E-mail inválido.";
  if (c.formato === "telefone" && ![10, 11].includes(somenteDigitos(t).length)) return "Telefone com DDD (10 ou 11 números).";
  if (c.formato === "cpf" && !cpfValido(t)) return "CPF inválido.";
  return null;
}

export function errosDaSecao(s: SecaoAnamnese, r: Respostas): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const c of s.campos) {
    const e = erroDoCampo(c, r);
    if (e) erros[c.id] = e;
  }
  return erros;
}

export type Validacao =
  | { ok: true; respostas: Respostas }
  | { ok: false; erros: Record<string, string>; secao: number; mensagem: string };

/** Confere o formulário inteiro e devolve só as respostas conhecidas e visíveis (sem espaços sobrando). */
export function validarAnamnese(r: Respostas): Validacao {
  const erros: Record<string, string> = {};
  let secao = -1;
  SECOES_ANAMNESE.forEach((s, i) => {
    const e = errosDaSecao(s, r);
    if (Object.keys(e).length && secao < 0) secao = i;
    Object.assign(erros, e);
  });
  if (secao >= 0) {
    const primeiro = Object.keys(erros)[0]!;
    return { ok: false, erros, secao, mensagem: `${SECOES_ANAMNESE[secao]!.titulo}: ${POR_ID.get(primeiro)!.rotulo} — ${erros[primeiro]}` };
  }
  const limpas: Respostas = {};
  for (const c of TODOS_CAMPOS) {
    if (!campoVisivel(c, r)) continue;
    const v = r[c.id];
    if (vazio(v)) continue;
    limpas[c.id] = Array.isArray(v) ? v : v!.trim();
  }
  return { ok: true, respostas: limpas };
}

/** Respostas iniciais a partir da ficha da clínica (a família confere e corrige). */
export function preencherDaFicha(f: FichaAnamnese): Respostas {
  const r: Respostas = {};
  const set = (id: string, v: string | null | undefined) => {
    if (v && v.trim()) r[id] = v.trim();
  };
  set("crianca_nome", f.nome);
  set("crianca_nascimento", f.data_nascimento);
  set("crianca_cpf", f.cpf);
  set("crianca_endereco", [f.endereco, f.numero, f.complemento].filter((x) => x && x.trim()).join(", "));
  set("crianca_cidade", [f.cidade, f.uf].filter((x) => x && x.trim()).join("/"));
  set("crianca_telefone", f.responsavel_telefone);
  set("crianca_email", f.responsavel_email);
  set("crianca_escola", f.escola);
  set("resp1_nome", f.responsavel_nome);
  set("resp1_parentesco", f.responsavel_parentesco);
  set("resp1_telefone", f.responsavel_telefone);
  set("resp1_email", f.responsavel_email);
  if (f.responsavel2_nome?.trim()) {
    r["resp2_existe"] = "Sim";
    set("resp2_nome", f.responsavel2_nome);
    set("resp2_parentesco", f.responsavel2_parentesco);
    set("resp2_telefone", f.responsavel2_telefone);
    set("resp2_email", f.responsavel2_email);
  }
  set("adm_resp_financeiro", f.responsavel_financeiro_nome);
  set("adm_plano", f.convenio);
  return r;
}

/** Texto de uma resposta para exibir/imprimir. */
export function textoDaResposta(c: Campo, v: string | string[] | undefined): string {
  if (v === undefined || (Array.isArray(v) && !v.length) || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (c.tipo === "data" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  return v;
}

/** Quantas perguntas visíveis já foram respondidas (para a barra de progresso). */
export function progresso(r: Respostas) {
  const visiveis = TODOS_CAMPOS.filter((c) => campoVisivel(c, r) && !c.opcional);
  const feitas = visiveis.filter((c) => !vazio(r[c.id])).length;
  return { feitas, total: visiveis.length };
}
