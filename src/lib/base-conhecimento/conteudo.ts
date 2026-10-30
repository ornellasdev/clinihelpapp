/**
 * Base de conhecimento do CliniHelp (área do desenvolvedor).
 * REGRA: toda mudança de tela, regra ou nova funcionalidade atualiza o artigo correspondente
 * (ou cria um novo), muda `atualizadoEm` e ganha uma linha em HISTORICO.
 * Não colocar aqui chaves, senhas, e-mails de clientes nem dados de pacientes.
 */

export type Bloco = { titulo?: string; texto?: string; itens?: string[] };
export type Pergunta = { p: string; r: string };
export type Artigo = {
  id: string;
  categoria: Categoria;
  titulo: string;
  resumo: string;
  quemUsa?: string;
  onde?: string;
  blocos: Bloco[];
  perguntas?: Pergunta[];
  atualizadoEm: string; // AAAA-MM-DD
};

export const CATEGORIAS = [
  "Visão geral",
  "Acesso e segurança",
  "Rotina da clínica",
  "Clínico",
  "Convênios e liminares",
  "Financeiro",
  "Responsáveis",
  "Gestão",
  "Desenvolvedor",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ARTIGOS: Artigo[] = [
  // ───────────── Visão geral
  {
    id: "o-que-e",
    categoria: "Visão geral",
    titulo: "O que é o CliniHelp",
    resumo: "Sistema para clínicas multidisciplinares de crianças com necessidades especiais, vendido para várias clínicas.",
    blocos: [
      {
        texto:
          "O CliniHelp reúne agenda, ficha do paciente, prontuário por especialidade, plano terapêutico, guias de convênio, liminares, cobranças, repasses, indicadores, área dos pais, treinamento da equipe e painel de segurança. Funciona no computador e no celular pelo navegador (sem instalar aplicativo).",
      },
      {
        titulo: "Cada clínica é separada",
        itens: [
          "Cada clínica tem o próprio endereço: clinihelpsystem.lovable.app/nome-da-clinica.",
          "Equipe, pacientes, agenda, financeiro, arquivos e auditoria de uma clínica nunca aparecem para outra.",
          "A clínica é criada pelo desenvolvedor, junto com a primeira conta Master. O Master cadastra o resto da equipe.",
        ],
      },
      {
        titulo: "Especialidades padrão",
        texto: "Psicologia, Fonoaudiologia, Terapia Ocupacional, Fisioterapia, Psicomotricidade, Musicoterapia e Psicopedagogia (a clínica pode ajustar).",
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "mapa-menu",
    categoria: "Visão geral",
    titulo: "Mapa do menu",
    resumo: "O que existe em cada item do menu e quem enxerga.",
    blocos: [
      {
        itens: [
          "Painel — atendimentos de hoje; o terapeuta vê a fila “Aguardando” e “Em atendimento” no topo.",
          "Agenda — por dia/semana, por sala e por profissional; cores por status.",
          "Pacientes — cadastro, ficha, documentos, plano terapêutico, prontuário e relatório PDF.",
          "Lista de espera — crianças aguardando vaga por especialidade e horário.",
          "Guias — liberações do dia, guias de convênio, conferência mensal e glosas.",
          "Liminares — fechamento mensal com lista de presença e nota fiscal.",
          "Financeiro — atendimentos e repasses + aba Cobranças (Asaas). Profissional vê só “Meus repasses”.",
          "Indicadores (KPI) — ocupação, faltas, faturamento, recebido, a receber e glosas.",
          "Equipe e Salas — contas, papéis, especialidades e salas.",
          "Segurança — conformidade (LGPD, ISO, HIPAA, SOC 2) e trilha de auditoria.",
          "Treinamento — cursos com questionário de acordo com o cargo.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },

  // ───────────── Acesso e segurança
  {
    id: "papeis",
    categoria: "Acesso e segurança",
    titulo: "Papéis e o que cada um pode fazer",
    resumo: "Separação de funções: cada pessoa vê só o necessário para o seu trabalho.",
    blocos: [
      {
        itens: [
          "Master — tudo, inclusive prontuários de todas as especialidades.",
          "Administrador — tudo do Master, menos prontuários e dados clínicos. Não pode dar o papel Master, mexer em contas Master nem se vincular a especialidades.",
          "Recepção — agenda, cadastro administrativo, lista de espera, guias e atestados. Não vê evoluções, diagnóstico/CID nem valores.",
          "Financeiro — valores, repasses, cobranças, liminares, glosas e indicadores.",
          "Profissional — só a própria agenda, a fila do dia e os pacientes que atende; prontuário só da própria especialidade; vê os próprios repasses.",
        ],
      },
      { texto: "Uma pessoa pode ter mais de um papel. As regras ficam no banco de dados, então esconder um botão não é a única proteção: mesmo tentando por fora, o acesso é negado." },
    ],
    perguntas: [
      { p: "A recepcionista diz que não vê o valor da sessão. É erro?", r: "Não. Recepção nunca vê preços nem repasses (separação de funções). Quem precisa ver valores deve ter o papel Financeiro." },
      { p: "O administrador não consegue abrir o prontuário.", r: "Correto: o papel Administrador nunca acessa prontuários. Só o Master e os profissionais da especialidade." },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "senha-2fa",
    categoria: "Acesso e segurança",
    titulo: "Login, senha temporária e verificação em 2 etapas",
    resumo: "Ninguém se cadastra sozinho; toda a equipe usa senha própria + Google Authenticator.",
    blocos: [
      {
        titulo: "Primeiro acesso",
        itens: [
          "O Master (ou Administrador) cria a conta em Equipe com uma senha temporária.",
          "No primeiro login a pessoa cria a própria senha.",
          "Logo depois, cadastra o Google Authenticator (ou Authy) lendo o QR code. Sem isso não entra no sistema.",
        ],
      },
      {
        titulo: "Regras da senha",
        itens: ["Mínimo 8 caracteres", "Letra maiúscula e minúscula", "Número", "Caractere especial", "Sem espaços"],
      },
      {
        titulo: "Problemas comuns",
        itens: [
          "Esqueceu a senha: o Master cria outra temporária em Equipe; a pessoa cria uma nova no próximo login.",
          "Perdeu/trocou o celular: o Master usa “Redefinir verificação em 2 etapas” em Equipe; a pessoa cadastra o app de novo.",
          "Código inválido: conferir se o relógio do celular está no automático.",
        ],
      },
      { titulo: "Logout automático", texto: "Após 15 minutos sem uso a sessão encerra sozinha, com aviso no último minuto." },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "lgpd",
    categoria: "Acesso e segurança",
    titulo: "LGPD, retenção e arquivos",
    resumo: "Dados de saúde de menores: nada clínico ou financeiro some, e arquivos são privados.",
    blocos: [
      {
        itens: [
          "Evolução salva não pode ser editada nem apagada. Correção é feita por Adendo, ligado à evolução original.",
          "Guias, glosas, documentos e relatórios liberados são “excluídos” só da tela; o registro fica guardado.",
          "Excluir paciente apenas o desativa.",
          "Agendamento só pode ser excluído enquanto está Agendado/Cancelado e sem pagamento.",
          "Arquivos (atestados, guias, documentos) são privados e abrem por um link que vale de 1 a 5 minutos.",
          "Consentimento LGPD: fica registrado na ficha quando o responsável assina o termo de tratamento.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },

  // ───────────── Rotina da clínica
  {
    id: "agenda",
    categoria: "Rotina da clínica",
    titulo: "Agenda e status do atendimento",
    resumo: "Agendado → Aguardando → Em atendimento → Finalizado, mais faltas e cancelado.",
    quemUsa: "Recepção, gestão e profissionais (cada profissional vê só a sua).",
    onde: "Menu Agenda → toque no horário.",
    blocos: [
      {
        titulo: "Fluxo normal",
        itens: [
          "Agendado (azul) — padrão ao marcar.",
          "Aguardando atendimento (laranja) — recepção marca “Chegou”; a criança entra na fila do terapeuta no Painel.",
          "Em atendimento (roxo) — o terapeuta clica “Iniciar atendimento”, que já abre o prontuário.",
          "Finalizado (verde) — automático quando o terapeuta salva a evolução daquela sessão. Gera cobrança, baixa 1 sessão da guia e conta para o repasse.",
        ],
      },
      {
        titulo: "Faltas",
        itens: [
          "Falta justificada (cinza) — não cobra, não baixa guia, sem repasse. Pode anexar atestado (PDF/JPG/PNG); aparece um clipe na agenda.",
          "Falta do terapeuta (cinza) — não cobra, não baixa guia, sem repasse; marca “reposição pendente”.",
          "Falta não justificada (vermelho) — é cobrada; na hora decide-se se o profissional recebe repasse. Não baixa guia de convênio.",
          "Cancelado — mantido para histórico, libera o horário.",
        ],
      },
      { titulo: "Conflitos", texto: "O sistema não deixa marcar a mesma sala ou o mesmo profissional em horários sobrepostos." },
    ],
    perguntas: [
      { p: "A sessão não ficou verde.", r: "Ela só finaliza quando o terapeuta salva a evolução ligada àquele atendimento (aberta pelo botão Iniciar/Evoluir). A gestão pode finalizar manualmente, mas sem evolução." },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "lembrete-whatsapp",
    categoria: "Rotina da clínica",
    titulo: "Lembrete de sessão por WhatsApp",
    resumo: "Botão que abre o WhatsApp com a mensagem de lembrete pronta para o responsável.",
    quemUsa: "Recepção e gestão.",
    onde: "Agenda → abrir uma sessão Agendada ou Aguardando → “Lembrete por WhatsApp”.",
    blocos: [
      {
        itens: [
          "Aparece um botão para cada responsável (1 e 2) com telefone válido (com DDD) na ficha.",
          "A mensagem traz nome do responsável, criança, especialidade, terapeuta, dia e horário e pede resposta 1 (confirmar) ou 2 (não pode vir).",
          "O envio é manual: abre o WhatsApp do aparelho/computador e a recepção toca em Enviar. Sem custo.",
          "A resposta do pai chega no WhatsApp da clínica; a recepção ajusta a agenda manualmente.",
        ],
      },
    ],
    perguntas: [{ p: "O botão não aparece.", r: "Falta telefone com DDD do responsável na ficha do paciente, ou a sessão não está Agendada/Aguardando." }],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "pacientes",
    categoria: "Rotina da clínica",
    titulo: "Cadastro e ficha do paciente",
    resumo: "Dados administrativos, responsáveis, endereço, convênio e documentos.",
    blocos: [
      {
        itens: [
          "Até 3 responsáveis (1, 2 e financeiro) com nome, parentesco, CPF, e-mail e telefone.",
          "Endereço: digitar o CEP preenche rua, bairro, município, Estado e UF automaticamente.",
          "Convênio/plano do paciente define o valor da sessão (recepção escolhe o plano sem ver o preço).",
          "Dados clínicos (diagnóstico, CID, alergias, medicação) ficam em área separada: só Master e terapeutas do paciente.",
          "Documentos: anexos privados; documentos clínicos seguem a mesma regra dos dados clínicos.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "lista-espera",
    categoria: "Rotina da clínica",
    titulo: "Lista de espera",
    resumo: "Fila por especialidade e horário desejado, com prioridade e posição.",
    blocos: [
      {
        itens: [
          "Toda a equipe vê; recepção e gestão incluem e editam.",
          "Ao abrir vaga, “Agendar” usa a mesma tela de agendamento (com proteção contra conflito) e marca o pedido como agendado.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },

  // ───────────── Clínico
  {
    id: "prontuario",
    categoria: "Clínico",
    titulo: "Prontuário e evoluções",
    resumo: "Evolução por especialidade, imutável, com nome e registro do profissional.",
    blocos: [
      {
        itens: [
          "Só o Master e os profissionais da especialidade veem as evoluções daquela especialidade.",
          "Nome e registro (conselho + número) do autor são gravados automaticamente.",
          "Modelos de evolução por especialidade agilizam o preenchimento no celular (há um modelo padrão quando a clínica não criou nenhum).",
          "Depois de salva, a evolução não muda: correções são Adendos.",
        ],
      },
      {
        titulo: "Evolução por voz",
        texto: "O profissional fala no celular, a inteligência artificial transcreve e organiza o texto, que volta para o formulário. Nada é salvo sem o profissional revisar e clicar em salvar. Consome créditos de IA.",
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "plano-terapeutico",
    categoria: "Clínico",
    titulo: "Plano terapêutico, metas e relatório PDF",
    resumo: "Metas por especialidade com progresso 1–5 em gráfico e relatório para escola, médico ou convênio.",
    blocos: [
      {
        itens: [
          "Cada criança tem metas por especialidade; a cada evolução o profissional marca o nível (1 a 5).",
          "O gráfico mostra a evolução das metas ao longo do tempo.",
          "Relatório PDF junta evoluções, adendos e metas de um período, com assinatura/registro do profissional.",
          "O PDF gerado pode ser liberado para os responsáveis na Área dos pais.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },

  // ───────────── Convênios e liminares
  {
    id: "convenios",
    categoria: "Convênios e liminares",
    titulo: "Tabela de convênios e tipos de plano",
    resumo: "Convênio, Particular e Liminar, com preço por sessão.",
    onde: "Financeiro → tabela de convênios.",
    blocos: [
      {
        itens: [
          "Convênio — exige guia (3 códigos) e liberação diária.",
          "Particular — sem guia.",
          "Liminar — sem guia; usa lista de presença + nota fiscal e é paga 30 dias após a emissão da NF.",
          "O preço é visível só para gestão/financeiro. Nova sessão herda o valor do plano do paciente (ou o padrão do profissional).",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "guias",
    categoria: "Convênios e liminares",
    titulo: "Guias de convênio, liberações e glosas",
    resumo: "Controle interno: o sistema não coleta assinatura dos pais (cada operadora valida no próprio app).",
    onde: "Menu Guias.",
    blocos: [
      {
        titulo: "Guia",
        itens: [
          "Obrigatório: Código TUSS, Código da Guia e Código de Faturamento.",
          "Convênio, especialidade, sessões solicitadas × autorizadas, datas de solicitação, liberação e validade, anexo.",
          "Ciclo: Solicitada → Autorizada → Em uso → Concluída/Vencida → Faturada.",
          "Saldo: cada sessão finalizada ligada à guia conta como usada (“Restam 5 de 10”).",
        ],
      },
      {
        titulo: "Primeira hora do dia (recepção)",
        itens: [
          "Lista os atendimentos de convênio do dia com status: Pendente de solicitação, Aguardando liberação, Liberado/Token validado.",
          "Marcar liberado, anotar token/senha e vincular à guia.",
          "Alertas na agenda: sem guia válida, saldo zerado, guia vencendo ou com poucas sessões.",
        ],
      },
      {
        titulo: "Conferência e glosas",
        itens: [
          "Conferência mensal por convênio/período com paciente, data, profissional e os 3 códigos; exporta para lançar no portal.",
          "Glosa: valor, motivo e status (Identificada, Em recurso, Recuperada, Perda definitiva). Entra nos Indicadores.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "liminares",
    categoria: "Convênios e liminares",
    titulo: "Liminares (lista de presença + NF)",
    resumo: "Fechamento mensal por paciente, vencimento automático 30 dias após a NF.",
    quemUsa: "Gestão e financeiro.",
    blocos: [
      {
        itens: [
          "Um fechamento por paciente/mês com as sessões finalizadas.",
          "Gera a lista de presença em PDF.",
          "Informar número e data de emissão da NF; vencimento = emissão + 30 dias.",
          "Marcar como paga baixa as sessões vinculadas; desfazer reverte.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },

  // ───────────── Financeiro
  {
    id: "financeiro",
    categoria: "Financeiro",
    titulo: "Atendimentos, repasses e exportações",
    resumo: "Valor cobrado e repasse seguem o status da sessão.",
    blocos: [
      {
        itens: [
          "Repasse = percentual por sessão; o padrão vem do “repasse de profissional” e pode ser editado em cada atendimento.",
          "Cobra: Finalizado e Falta não justificada. Não cobra: faltas justificada/do terapeuta e cancelado.",
          "Exporta PDF, CSV e Excel com os dados que a pessoa já está vendo.",
          "Valores aceitam vírgula, até 2 casas, até R$ 1.000.000; repasse de 0 a 100%.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "cobrancas",
    categoria: "Financeiro",
    titulo: "Cobranças aos pais (Pix, boleto e cartão)",
    resumo: "Cada clínica conecta a própria conta Asaas; os pais só veem a marca CliniHelp.",
    onde: "Financeiro → aba Cobranças.",
    blocos: [
      {
        titulo: "Configuração",
        itens: [
          "Master/Administrador cola a chave de API da conta Asaas da própria clínica. A chave é guardada criptografada e nunca aparece de novo.",
          "O dinheiro cai direto na conta Asaas da clínica; o CliniHelp não cobra taxa.",
          "Para Pix, a conta Asaas precisa ter uma chave Pix cadastrada.",
        ],
      },
      {
        titulo: "Uso",
        itens: [
          "Nova cobrança: mínimo R$ 5, vencimento de hoje até 1 ano.",
          "Enviar o link por WhatsApp ou copiar. O pai paga na página CliniHelp (Pix, boleto ou cartão).",
          "O status atualiza sozinho quando o Asaas avisa o pagamento; as sessões ligadas ficam pagas.",
        ],
      },
    ],
    perguntas: [{ p: "Cliente quer saber se o CliniHelp fica com parte do valor.", r: "Não. Só existem as tarifas do próprio Asaas na conta da clínica." }],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "indicadores",
    categoria: "Financeiro",
    titulo: "Indicadores (KPI)",
    resumo: "Ocupação das salas, faltas, faturamento, recebido, a receber e glosas.",
    quemUsa: "Gestão e financeiro.",
    blocos: [{ texto: "O horário de funcionamento usado no cálculo da ocupação é salvo no navegador de quem configurou." }],
    atualizadoEm: "2026-10-30",
  },

  // ───────────── Responsáveis
  {
    id: "area-pais",
    categoria: "Responsáveis",
    titulo: "Área dos responsáveis",
    resumo: "Pais entram com código no e-mail e veem agenda, cobranças, recibos, relatórios e termos.",
    onde: "clinihelpsystem.lovable.app/familia",
    blocos: [
      {
        itens: [
          "Sem senha: digita o e-mail e recebe um código. Só entra quem tem o e-mail na ficha de uma criança ativa (qualquer um dos 3 responsáveis).",
          "Vê só as próprias crianças e só informações próprias para os pais.",
          "Termos (tratamento e uso de imagem) são assinados com o dedo + nome e CPF; guarda data/hora, aparelho e cópia do texto.",
          "Relatórios aparecem quando a clínica gera o PDF e clica “Liberar para os responsáveis”.",
        ],
      },
    ],
    perguntas: [{ p: "O pai não recebe o código.", r: "Conferir se o e-mail está exatamente igual na ficha do paciente e se o paciente está ativo; verificar spam." }],
    atualizadoEm: "2026-10-30",
  },

  // ───────────── Gestão
  {
    id: "equipe",
    categoria: "Gestão",
    titulo: "Equipe e salas",
    resumo: "Criar contas, papéis, especialidades, repasse padrão e salas.",
    blocos: [
      {
        itens: [
          "Criar conta: nome, e-mail, papéis, especialidades e senha temporária.",
          "Ações: redefinir senha (nova temporária), redefinir 2 etapas, desativar conta.",
          "Profissional: conselho e número de registro, repasse de profissional (%).",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "seguranca",
    categoria: "Gestão",
    titulo: "Segurança, Banco e Auditoria",
    resumo: "Painel de conformidade e trilha de auditoria que não pode ser alterada.",
    quemUsa: "Master e Administrador (registros clínicos na auditoria só o Master).",
    blocos: [
      {
        itens: [
          "Controles LGPD, ISO 27001, HIPAA e SOC 2 com status OK / Atenção / Crítico.",
          "Pacientes sem consentimento, equipe sem 2 etapas, treinamento essencial pendente.",
          "Auditoria: toda criação/alteração/exclusão e logins. Os registros não podem ser alterados nem apagados.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "treinamento",
    categoria: "Gestão",
    titulo: "Treinamento (CliniHelp LMS)",
    resumo: "Tópicos e questionários de acordo com o cargo; 70% para concluir.",
    blocos: [
      {
        itens: [
          "Cada pessoa vê só a trilha dos seus papéis.",
          "Questionário corrigido no servidor; resultados não podem ser apagados.",
          "A gestão acompanha o progresso da equipe. Tópicos essenciais contam no controle ISO de conscientização.",
          "Quando uma regra muda, o tópico é atualizado e a pessoa refaz aquela versão.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },

  // ───────────── Desenvolvedor
  {
    id: "painel-dev",
    categoria: "Desenvolvedor",
    titulo: "Painel do desenvolvedor",
    resumo: "Criar e suspender clínicas, entrar em qualquer clínica e ver o status do Asaas.",
    onde: "/dev",
    blocos: [
      {
        itens: [
          "Entrada: conta Google autorizada + código do autenticador. Conta não autorizada vê “Acesso negado”.",
          "Nova clínica: nome, endereço (/nome-da-clinica) e conta Master com senha temporária.",
          "Suspender clínica bloqueia o acesso da equipe sem apagar dados.",
          "“Entrar nesta clínica” dá acesso total àquela clínica (inclusive prontuários) para suporte.",
          "Novos desenvolvedores são adicionados pela equipe técnica (lista protegida).",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "suporte",
    categoria: "Desenvolvedor",
    titulo: "Roteiro de suporte ao cliente",
    resumo: "Perguntas a fazer antes de investigar um problema.",
    blocos: [
      {
        itens: [
          "Qual clínica, qual pessoa e qual papel ela tem?",
          "Em qual tela e o que aparece (print)? Computador ou celular?",
          "É falta de permissão (comportamento esperado) ou erro?",
          "Consultar Segurança → Auditoria para ver quem alterou o quê e quando.",
          "Senha/2 etapas: o Master da clínica resolve em Equipe.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },
  {
    id: "migracao-dados",
    categoria: "Desenvolvedor",
    titulo: "Migração de dados de um cliente novo",
    resumo: "Como trazer convênios e pacientes do sistema antigo pela aba Migração do /dev.",
    quemUsa: "Somente desenvolvedores (Google + 2 etapas).",
    onde: "/dev → Migração",
    blocos: [
      {
        itens: [
          "Crie a clínica primeiro em Clínicas.",
          "Baixe o modelo (Convênios ou Pacientes), cole os dados do sistema antigo e salve como CSV (separador ; ou ,).",
          "Importe Convênios antes de Pacientes: a coluna convenio do paciente é ligada pelo nome.",
          "Datas em DD/MM/AAAA. CPF, telefone com DDD, e-mail, CEP e UF são conferidos linha a linha.",
          "Nada é gravado enquanto houver linha com erro; o servidor confere tudo de novo.",
          "Registros que já existem (convênio com mesmo nome; paciente com mesmo nome e nascimento) são ignorados, então reimportar é seguro.",
          "Equipe é criada em Equipe pelo Master (senha temporária + 2 etapas). Diagnóstico e prontuário antigo entram como documento na ficha, não como evolução.",
          "Cada importação fica registrada na auditoria da clínica.",
        ],
      },
    ],
    atualizadoEm: "2026-10-30",
  },
];

export const HISTORICO: { data: string; texto: string }[] = [
  { data: "2026-10-30", texto: "Agenda: legenda passa a dizer “Faltas justificadas” (cinza) e “Faltas não justificadas” (vermelho)." },
  { data: "2026-10-30", texto: "Aba Migração no /dev: importação de convênios e pacientes por planilha." },
  { data: "2026-10-30", texto: "Base de conhecimento criada no painel do desenvolvedor." },
  { data: "2026-10-30", texto: "Lembrete de sessão por WhatsApp na agenda." },
  { data: "2026-10-30", texto: "Treinamento CliniHelp (LMS) por cargo." },
  { data: "2026-10-30", texto: "Validação de valores em convênios, cobranças e repasses." },
  { data: "2026-10-30", texto: "Tela Segurança, Banco e Auditoria; logout após 15 min; adendos no prontuário." },
  { data: "2026-10-30", texto: "Senha temporária + verificação em 2 etapas obrigatória." },
  { data: "2026-10-30", texto: "Cobranças movidas para dentro do Financeiro." },
  { data: "2026-10-30", texto: "Novos status da agenda e faltas; Liminares; Guias e glosas." },
];

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function textoDoArtigo(a: Artigo) {
  return [a.titulo, a.resumo, a.categoria, a.quemUsa, a.onde, ...a.blocos.flatMap((b) => [b.titulo, b.texto, ...(b.itens ?? [])]), ...(a.perguntas ?? []).flatMap((q) => [q.p, q.r])]
    .filter(Boolean)
    .join(" ");
}

/** Busca sem acento e sem diferenciar maiúsculas; todas as palavras precisam aparecer. */
export function buscarArtigos(termo: string, artigos: Artigo[] = ARTIGOS): Artigo[] {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return artigos;
  return artigos.filter((a) => {
    const t = normalizar(textoDoArtigo(a));
    return palavras.every((p) => t.includes(p));
  });
}
