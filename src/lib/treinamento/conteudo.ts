// Conteúdo do Treinamento CliniHelp (LMS): tópicos, aulas e questionários por cargo.
// Ao mudar o conteúdo de um tópico de forma relevante, suba a `versao` — quem já fez precisa refazer.
import type { Papel } from "@/lib/permissions";

export type Questao = { pergunta: string; opcoes: string[]; correta: number; explicacao: string };
export type Secao = { titulo: string; texto?: string[]; itens?: string[]; atencao?: string };
export type Categoria = "Essencial" | "Recepção" | "Atendimento clínico" | "Financeiro" | "Gestão";
export type Modulo = {
  id: string;
  versao: number;
  titulo: string;
  resumo: string;
  categoria: Categoria;
  minutos: number;
  /** Cargos para os quais o tópico é obrigatório. */
  papeis: readonly Papel[];
  secoes: Secao[];
  questoes: Questao[];
};

const TODOS: Papel[] = ["master", "administrador", "recepcao", "profissional", "financeiro"];
const GESTAO: Papel[] = ["master", "administrador"];

export const CATEGORIAS: Categoria[] = ["Essencial", "Recepção", "Atendimento clínico", "Financeiro", "Gestão"];

export const MODULOS: Modulo[] = [
  // ======================= ESSENCIAL (todos) =======================
  {
    id: "acesso-seguranca",
    versao: 1,
    titulo: "Acesso seguro ao CliniHelp",
    resumo: "Senha própria, Google Authenticator, saída automática e boas práticas de uso.",
    categoria: "Essencial",
    minutos: 6,
    papeis: TODOS,
    secoes: [
      {
        titulo: "Primeiro acesso e senha",
        texto: [
          "Sua conta é criada pelo master ou pelo administrador da clínica com uma senha temporária. No primeiro login você cria a sua própria senha.",
          "A senha precisa ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial (ex.: ! @ # $), sem espaços. Ela não pode ser igual à temporária.",
        ],
        atencao: "Esqueceu a senha? Peça ao master ou ao administrador uma nova senha temporária. No próximo login você cria outra senha.",
      },
      {
        titulo: "Verificação em duas etapas (obrigatória)",
        texto: [
          "Depois de criar a senha, você cadastra o Google Authenticator no celular lendo o QR code. A partir daí, todo login pede o código de 6 dígitos do aplicativo.",
          "Sem a verificação em duas etapas o sistema não libera nenhum dado da clínica.",
        ],
        itens: [
          "Trocou ou perdeu o celular: peça ao master/administrador para zerar sua verificação; no próximo login você cadastra de novo.",
          "Nunca envie o código do aplicativo para ninguém.",
        ],
      },
      {
        titulo: "Saída automática por inatividade",
        texto: [
          "Depois de 15 minutos sem uso, o CliniHelp encerra a sessão. No último minuto aparece o aviso “Você ainda está aí?” para continuar conectado.",
          "Usar o sistema em qualquer aba aberta conta como atividade.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Cada pessoa usa a própria conta: tudo o que é feito fica registrado com o seu nome na auditoria.",
          "Anexos (atestados, guias, laudos) abrem por um link temporário que expira em cerca de 2 minutos — não encaminhe esses links.",
          "No celular, use pelo navegador. Saia da conta em computadores compartilhados.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "Qual destas senhas o CliniHelp aceita?",
        opcoes: ["clinica123", "Clinica 2024!", "Clinica@2024", "CLINICA@2024"],
        correta: 2,
        explicacao: "“Clinica@2024” tem maiúscula, minúscula, número e caractere especial, sem espaço. As outras falham em pelo menos uma regra.",
      },
      {
        pergunta: "Você esqueceu sua senha. O que fazer?",
        opcoes: [
          "Criar uma conta nova",
          "Pedir ao master ou administrador uma senha temporária",
          "Usar a conta de um colega até resolver",
          "Esperar 24 horas para a senha ser liberada",
        ],
        correta: 1,
        explicacao: "Só o master/administrador gera uma nova senha temporária; no login seguinte você cria a sua.",
      },
      {
        pergunta: "Depois de quanto tempo sem uso o sistema encerra a sessão?",
        opcoes: ["5 minutos", "15 minutos", "1 hora", "Nunca"],
        correta: 1,
        explicacao: "A saída automática acontece com 15 minutos sem uso, com aviso no último minuto.",
      },
      {
        pergunta: "Você trocou de celular e perdeu o Google Authenticator. E agora?",
        opcoes: [
          "Entrar só com a senha",
          "Pedir ao master ou administrador para zerar a verificação em duas etapas",
          "Desativar a verificação nas configurações",
          "Pedir o código a um colega",
        ],
        correta: 1,
        explicacao: "A verificação é obrigatória. O master/administrador zera e você cadastra o aplicativo de novo no próximo login.",
      },
      {
        pergunta: "Um colega pede para usar seu login por um dia. Pode?",
        opcoes: ["Sim, se for da mesma clínica", "Sim, se for só para consultar", "Não: cada ação fica registrada no seu nome", "Sim, desde que ele troque a senha depois"],
        correta: 2,
        explicacao: "A conta é pessoal. A auditoria registra quem fez cada ação, e compartilhar o login quebra essa rastreabilidade.",
      },
    ],
  },
  {
    id: "lgpd-sigilo",
    versao: 1,
    titulo: "LGPD, sigilo e quem vê o quê",
    resumo: "Dados de saúde de crianças, consentimento dos responsáveis e por que nada é apagado.",
    categoria: "Essencial",
    minutos: 7,
    papeis: TODOS,
    secoes: [
      {
        titulo: "Dados sensíveis",
        texto: [
          "A clínica trata dados de saúde de crianças — dados sensíveis pela LGPD (Art. 11 e 14). Cada pessoa só acessa o que precisa para o seu trabalho, e o próprio banco de dados aplica essas regras.",
        ],
      },
      {
        titulo: "Quem vê o quê",
        itens: [
          "Recepção: agenda, cadastro administrativo, guias, lista de espera e atestados. Não vê evoluções, diagnóstico, CID, laudos nem valores.",
          "Profissional: a própria agenda e os próprios pacientes; prontuário só da sua especialidade; só os próprios repasses.",
          "Financeiro: valores, cobranças, repasses, liminares e glosas.",
          "Administrador: gestão completa da clínica, exceto prontuários e dados clínicos.",
          "Master: tudo, inclusive todos os prontuários.",
        ],
      },
      {
        titulo: "Consentimento dos responsáveis",
        texto: [
          "O consentimento é registrado quando um responsável assina, na Área da família, o termo de consentimento de tratamento. A ficha do paciente mostra se está pendente, assinado ou revogado.",
        ],
      },
      {
        titulo: "Nada some e tudo fica registrado",
        itens: [
          "Prontuários, guias, glosas, documentos e dados financeiros não são apagados: ao excluir, o item sai da tela e fica guardado no histórico.",
          "Uma evolução assinada não pode ser editada; correções são feitas por adendo.",
          "A auditoria registra quem fez o quê e quando, e ninguém consegue alterá-la ou apagá-la.",
        ],
        atencao: "Não fotografe telas, não envie dados de pacientes por aplicativos pessoais e não deixe o computador desbloqueado.",
      },
    ],
    questoes: [
      {
        pergunta: "A recepção pode ver o diagnóstico e o CID do paciente?",
        opcoes: ["Sim, sempre", "Só se o paciente for particular", "Não: ficam só com a equipe terapêutica e o master", "Só na agenda"],
        correta: 2,
        explicacao: "Os dados clínicos ficam num bloco separado, que só o master e o terapeuta do paciente veem.",
      },
      {
        pergunta: "O que acontece quando alguém exclui um documento do paciente?",
        opcoes: ["Ele é apagado para sempre", "Sai da ficha, mas fica guardado no histórico da clínica", "Vai para uma lixeira por 30 dias", "Só o master consegue excluir"],
        correta: 1,
        explicacao: "Por retenção legal, documentos e registros saem da tela, mas continuam guardados.",
      },
      {
        pergunta: "Como fica registrado o consentimento LGPD da família?",
        opcoes: [
          "A recepção marca uma caixinha no cadastro",
          "Quando um responsável assina o termo de consentimento de tratamento na Área da família",
          "Automaticamente ao cadastrar o paciente",
          "Pelo e-mail de boas-vindas",
        ],
        correta: 1,
        explicacao: "O status vira “assinado” sozinho quando o termo de tratamento é assinado com “concordo”.",
      },
      {
        pergunta: "Alguém pode alterar ou apagar a trilha de auditoria?",
        opcoes: ["O master pode", "O administrador pode", "Ninguém pode", "O desenvolvedor pode pela tela"],
        correta: 2,
        explicacao: "A auditoria é somente inclusão: o banco bloqueia alteração e exclusão para todos.",
      },
      {
        pergunta: "O administrador da clínica pode ler os prontuários?",
        opcoes: ["Sim, como o master", "Não: ele gerencia tudo, menos prontuários e dados clínicos", "Só os de convênio", "Só os do mês atual"],
        correta: 1,
        explicacao: "O administrador tem as funções do master, exceto o acesso clínico.",
      },
    ],
  },

  // ======================= RECEPÇÃO =======================
  {
    id: "agenda",
    versao: 1,
    titulo: "Agenda e status do atendimento",
    resumo: "Marcar sessões, marcar a chegada da criança e entender cada status e cor.",
    categoria: "Recepção",
    minutos: 7,
    papeis: ["recepcao", "master", "administrador"],
    secoes: [
      {
        titulo: "Marcar uma sessão",
        texto: [
          "Na Agenda, crie o agendamento escolhendo paciente, profissional, sala, especialidade e horário.",
          "O sistema impede a mesma sala ou o mesmo profissional em dois atendimentos no mesmo horário e avisa o conflito.",
        ],
      },
      {
        titulo: "Status e cores",
        itens: [
          "Agendado (azul): sessão marcada.",
          "Aguardando atendimento (amarelo): a recepção marca quando a criança chega e a guia/token do dia já foi validada. O paciente entra na fila do profissional.",
          "Em atendimento (roxo): muda sozinho quando o profissional inicia o atendimento ou abre a evolução.",
          "Finalizado (verde): muda sozinho quando o profissional salva a evolução. Gera a cobrança, desconta a guia e conta para o repasse.",
          "Faltas não cobradas (cinza), falta cobrada (vermelho) e cancelado.",
        ],
      },
      {
        titulo: "Cancelar ou excluir",
        texto: [
          "Prefira sempre Cancelar. Excluir só é possível enquanto a sessão está agendada (ou cancelada) e sem pagamento. Sessão com chegada, atendimento ou falta registrada não pode ser excluída.",
        ],
      },
      {
        titulo: "Privacidade na agenda",
        texto: ["Os cartões da agenda mostram só nome, sala, profissional, especialidade e status — nada de diagnóstico."],
      },
    ],
    questoes: [
      {
        pergunta: "A criança chegou na clínica e a guia do dia já foi validada. O que você marca?",
        opcoes: ["Em atendimento", "Aguardando atendimento", "Finalizado", "Nada, o profissional marca"],
        correta: 1,
        explicacao: "“Aguardando atendimento” coloca o paciente na fila do profissional.",
      },
      {
        pergunta: "Quem muda a sessão para “Finalizado”?",
        opcoes: ["A recepção, ao final do horário", "O financeiro", "O sistema, quando o profissional salva a evolução", "O master no fim do dia"],
        correta: 2,
        explicacao: "Salvar a evolução da sessão finaliza o atendimento automaticamente.",
      },
      {
        pergunta: "Você tenta marcar uma sessão numa sala já ocupada naquele horário. O que acontece?",
        opcoes: ["Fica marcado em dobro", "O sistema bloqueia e avisa que a sala está ocupada", "A sessão anterior é cancelada", "Vai para a lista de espera"],
        correta: 1,
        explicacao: "Conflitos de sala e de profissional são impossíveis: o banco recusa.",
      },
      {
        pergunta: "Uma sessão finalizada foi lançada errada. Dá para excluir?",
        opcoes: ["Sim, pelo botão Excluir", "Não: sessão com histórico não pode ser excluída", "Sim, se ninguém pagou", "Só o profissional pode"],
        correta: 1,
        explicacao: "Atendimentos com chegada, atendimento ou falta registrada ficam no histórico. Fale com a gestão para corrigir.",
      },
    ],
  },
  {
    id: "faltas",
    versao: 1,
    titulo: "Faltas, atestados e reposições",
    resumo: "Os três tipos de falta e o que cada um faz com cobrança, guia e repasse.",
    categoria: "Recepção",
    minutos: 5,
    papeis: ["recepcao", "financeiro", "master", "administrador"],
    secoes: [
      {
        titulo: "Falta justificada (não cobrada)",
        itens: [
          "Não cobra da família nem do convênio e não desconta a guia.",
          "Não gera repasse ao profissional.",
          "Anexe o atestado ou comprovante (PDF, JPG ou PNG até 15 MB). Ele fica na sessão (ícone de clipe na agenda) e nos documentos do paciente.",
        ],
      },
      {
        titulo: "Falta do terapeuta (não cobrada)",
        itens: ["Não cobra, não desconta a guia e não gera repasse.", "Pode marcar que a sessão precisa de reposição."],
      },
      {
        titulo: "Falta não justificada (cobrada)",
        itens: [
          "Entra no faturamento da sessão, conforme a regra da clínica.",
          "Não desconta a guia do convênio.",
          "Você indica se o profissional recebe repasse pela hora reservada.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "Falta justificada com atestado: o que acontece?",
        opcoes: ["Cobra a família", "Não cobra, não desconta a guia e não gera repasse", "Desconta a guia", "Gera repasse integral"],
        correta: 1,
        explicacao: "Falta justificada não tem efeito financeiro nem na guia.",
      },
      {
        pergunta: "O terapeuta faltou. Qual tipo de falta registrar?",
        opcoes: ["Falta justificada", "Falta cobrada", "Falta do terapeuta, podendo marcar reposição", "Cancelar a sessão"],
        correta: 2,
        explicacao: "“Falta do terapeuta” não cobra, não gera repasse e permite sinalizar reposição.",
      },
      {
        pergunta: "Falta não justificada desconta uma sessão da guia do convênio?",
        opcoes: ["Sim", "Não", "Só se for particular", "Só depois de 30 dias"],
        correta: 1,
        explicacao: "A guia só é descontada quando a sessão é finalizada (atendimento realizado).",
      },
      {
        pergunta: "Onde fica o atestado anexado na falta justificada?",
        opcoes: ["Só no e-mail da clínica", "Na sessão (clipe na agenda) e nos documentos do paciente", "Some depois de 15 minutos", "Só no financeiro"],
        correta: 1,
        explicacao: "O atestado fica ligado à sessão e à ficha do paciente.",
      },
    ],
  },
  {
    id: "cadastro-paciente",
    versao: 1,
    titulo: "Cadastro do paciente e documentos",
    resumo: "Ficha administrativa, responsáveis, convênio e quem vê cada documento.",
    categoria: "Recepção",
    minutos: 6,
    papeis: ["recepcao", "master", "administrador"],
    secoes: [
      {
        titulo: "Ficha administrativa",
        itens: [
          "Dados da criança e de até três responsáveis: principal, segundo e financeiro (nome, parentesco, CPF, telefone e e-mail).",
          "O CPF é conferido pelos dígitos verificadores; o telefone precisa de DDD.",
          "Ao digitar o CEP, endereço, município, estado e UF são preenchidos sozinhos — confira e complete o número.",
          "Campos com problema ficam destacados em vermelho antes de salvar.",
        ],
      },
      {
        titulo: "Convênio e responsáveis",
        itens: [
          "O convênio escolhido define o valor da sessão automaticamente (a recepção não vê valores).",
          "Os e-mails dos três responsáveis dão acesso à Área da família.",
          "O CPF do responsável financeiro é usado nas cobranças.",
        ],
      },
      {
        titulo: "Dados clínicos e documentos",
        itens: [
          "Diagnóstico, CID, alergias e medicação ficam num bloco separado, preenchido pela equipe terapêutica.",
          "Laudos, relatórios, exames e receitas: só o master e o terapeuta do paciente veem (e quem enviou).",
          "Atestados, documentos pessoais, termos e encaminhamentos: quem vê o paciente.",
          "Paciente não é apagado: desmarque “Paciente ativo” para inativar.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "O que define o valor da sessão de um paciente?",
        opcoes: ["A recepção digita a cada sessão", "O convênio escolhido no cadastro", "O profissional", "O dia da semana"],
        correta: 1,
        explicacao: "O valor vem da tabela de convênios do financeiro, conforme o convênio do paciente.",
      },
      {
        pergunta: "Você enviou um laudo do paciente. Quem consegue vê-lo?",
        opcoes: ["Toda a equipe", "Só você, o master e o terapeuta do paciente", "Só o financeiro", "Os pais, automaticamente"],
        correta: 1,
        explicacao: "Documentos clínicos ficam com a equipe terapêutica; quem enviou também continua vendo.",
      },
      {
        pergunta: "Qual e-mail permite que um responsável entre na Área da família?",
        opcoes: ["Qualquer e-mail", "Um dos e-mails dos três responsáveis cadastrados na ficha", "Só o e-mail da clínica", "O e-mail do profissional"],
        correta: 1,
        explicacao: "O código de acesso só é enviado para e-mails cadastrados na ficha.",
      },
      {
        pergunta: "Um paciente deixou a clínica. O que fazer com a ficha?",
        opcoes: ["Excluir", "Inativar desmarcando “Paciente ativo”", "Apagar os documentos", "Trocar o nome"],
        correta: 1,
        explicacao: "Fichas não são apagadas; o paciente fica inativo e o histórico preservado.",
      },
    ],
  },
  {
    id: "guias",
    versao: 1,
    titulo: "Guias de convênio e liberações do dia",
    resumo: "Os três códigos, a liberação na primeira hora do dia e o saldo de sessões.",
    categoria: "Recepção",
    minutos: 8,
    papeis: ["recepcao", "financeiro", "master", "administrador"],
    secoes: [
      {
        titulo: "Quem usa guia",
        texto: ["Só pacientes de convênio usam guia. Particular e liminar não usam (liminar trabalha com lista de presença e nota fiscal)."],
      },
      {
        titulo: "Cadastro da guia",
        itens: [
          "Três códigos obrigatórios: TUSS (8 dígitos), número da guia e código de faturamento.",
          "Sessões solicitadas e autorizadas; datas de solicitação, liberação e validade.",
          "Anexo do pedido médico ou autorização (PDF ou foto, até 15 MB).",
          "Situação: solicitada → autorizada → faturada (ou negada/cancelada).",
        ],
      },
      {
        titulo: "Primeira hora do dia: liberações",
        itens: [
          "A aba Liberações do dia lista as sessões de convênio de hoje: Pendente de solicitação, Aguardando liberação do plano ou Liberado.",
          "Ao liberar na operadora, marque “Liberado” e anote o token/senha do dia, se houver.",
          "Quando a criança chega, a sessão é ligada sozinha à guia válida.",
        ],
        atencao: "O CliniHelp não coleta assinatura dos pais para a guia: cada operadora valida no próprio sistema (token, QR code, biometria).",
      },
      {
        titulo: "Saldo e alertas",
        itens: [
          "Cada sessão finalizada desconta 1 do saldo (ex.: “Restam 5 de 10”). Faltas não descontam.",
          "A agenda alerta criança agendada sem guia válida ou com saldo zerado.",
          "Avisos de guia perto do vencimento ou com poucas sessões: peça a renovação a tempo.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "Quais são os três códigos obrigatórios da guia?",
        opcoes: ["CPF, RG e carteirinha", "TUSS, número da guia e código de faturamento", "CID, TUSS e CRM", "Token, senha e protocolo"],
        correta: 1,
        explicacao: "TUSS (procedimento), número da guia (autorização) e código de faturamento (lote).",
      },
      {
        pergunta: "Paciente de liminar precisa de guia?",
        opcoes: ["Sim, como convênio", "Não: liminar usa lista de presença e nota fiscal", "Só na primeira sessão", "Só se for TO"],
        correta: 1,
        explicacao: "Particular e liminar não usam guia.",
      },
      {
        pergunta: "Quando o saldo da guia diminui?",
        opcoes: ["Ao agendar", "Quando a criança chega", "Quando a sessão é finalizada", "Em qualquer falta"],
        correta: 2,
        explicacao: "A baixa acontece com a sessão finalizada; faltas não descontam.",
      },
      {
        pergunta: "O TUSS “5000047” (7 dígitos) será aceito?",
        opcoes: ["Sim", "Não: o TUSS precisa ter 8 dígitos", "Sim, se tiver anexo", "Só para particular"],
        correta: 1,
        explicacao: "O sistema confere o formato do TUSS antes de salvar.",
      },
    ],
  },
  {
    id: "lista-espera",
    versao: 1,
    titulo: "Lista de espera",
    resumo: "Organizar quem aguarda vaga por especialidade, dia e período.",
    categoria: "Recepção",
    minutos: 3,
    papeis: ["recepcao", "master", "administrador"],
    secoes: [
      {
        titulo: "Como funciona",
        itens: [
          "Registre o paciente com a especialidade, os dias da semana e os períodos (manhã, tarde, noite) em que pode vir, e a prioridade (normal ou alta).",
          "A lista mostra a posição de cada um na fila.",
          "Ao agendar a partir da lista, o pedido fica como “agendado”. Se a família desistir, marque “Desistiu da vaga” para manter o histórico.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "A família desistiu da vaga. O que fazer?",
        opcoes: ["Excluir o pedido", "Marcar “Desistiu da vaga”", "Agendar mesmo assim", "Trocar a especialidade"],
        correta: 1,
        explicacao: "Marcar a desistência mantém o histórico da fila.",
      },
      {
        pergunta: "O que acontece com o pedido quando você agenda a partir da lista?",
        opcoes: ["Some", "Fica como “agendado”", "Volta para o fim da fila", "Vira prioridade alta"],
        correta: 1,
        explicacao: "O agendamento usa o fluxo normal da agenda e marca o pedido como agendado.",
      },
      {
        pergunta: "Quais preferências são registradas no pedido?",
        opcoes: ["Só a especialidade", "Especialidade, dias, períodos e prioridade", "Só o profissional", "Valor da sessão"],
        correta: 1,
        explicacao: "Essas informações ordenam e filtram a fila.",
      },
    ],
  },
  {
    id: "familia-termos",
    versao: 1,
    titulo: "Área da família e termos",
    resumo: "Como os pais acessam, assinam termos no celular e recebem relatórios.",
    categoria: "Recepção",
    minutos: 5,
    papeis: ["recepcao", "master", "administrador"],
    secoes: [
      {
        titulo: "Acesso dos pais",
        itens: [
          "Os responsáveis entram na Área da família com um código enviado por e-mail — sem senha.",
          "Só funciona para e-mails cadastrados na ficha do paciente.",
          "Eles veem a agenda da criança, as cobranças, os recibos, os relatórios liberados e os termos.",
        ],
      },
      {
        titulo: "Termos e assinatura digital",
        itens: [
          "Na aba Família do paciente, solicite o termo de consentimento de tratamento ou de uso de imagem.",
          "O responsável assina com o dedo no celular, informando nome e CPF. O texto não muda depois de enviado.",
          "Termo de tratamento assinado com “concordo” registra o consentimento LGPD na ficha.",
        ],
      },
      {
        titulo: "Relatórios liberados",
        texto: ["O master ou o profissional gera o relatório em PDF e libera na Área da família. Retirar o relatório tira da tela dos pais, mas ele fica guardado."],
      },
    ],
    questoes: [
      {
        pergunta: "Como os pais entram na Área da família?",
        opcoes: ["Com senha criada pela recepção", "Com um código enviado ao e-mail cadastrado na ficha", "Com o CPF da criança", "Pelo WhatsApp da clínica"],
        correta: 1,
        explicacao: "O acesso é por código no e-mail, só para responsáveis cadastrados.",
      },
      {
        pergunta: "O que registra o consentimento LGPD?",
        opcoes: ["Termo de uso de imagem", "Termo de consentimento de tratamento assinado com “concordo”", "A primeira sessão", "O pagamento da primeira cobrança"],
        correta: 1,
        explicacao: "O termo de tratamento assinado marca o consentimento automaticamente.",
      },
      {
        pergunta: "Depois de enviado ao responsável, o texto do termo pode ser alterado?",
        opcoes: ["Sim, pela recepção", "Não", "Sim, pelo master", "Só antes das 18h"],
        correta: 1,
        explicacao: "O texto é congelado para garantir a validade da assinatura; cancele e envie outro se precisar.",
      },
    ],
  },

  // ======================= ATENDIMENTO CLÍNICO =======================
  {
    id: "meus-atendimentos",
    versao: 1,
    titulo: "Meus atendimentos e repasses",
    resumo: "A fila do dia, iniciar o atendimento e acompanhar seus repasses.",
    categoria: "Atendimento clínico",
    minutos: 4,
    papeis: ["profissional", "master"],
    secoes: [
      {
        titulo: "Fila do dia",
        itens: [
          "No Painel, “Meus atendimentos de hoje” destaca quem está Aguardando e Em atendimento.",
          "O botão Iniciar / Evoluir abre o prontuário da especialidade e muda a sessão para Em atendimento.",
          "Você vê só a sua agenda e os seus pacientes (com sessão com você ou registros na sua especialidade).",
        ],
      },
      {
        titulo: "Meus repasses",
        itens: [
          "Em Financeiro › Meus repasses você vê só os seus atendimentos e o valor do seu repasse.",
          "Falta do terapeuta e falta justificada não geram repasse; falta cobrada pode gerar, conforme a decisão da clínica.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "O que o botão Iniciar / Evoluir faz?",
        opcoes: ["Cancela a sessão", "Abre o prontuário e muda a sessão para Em atendimento", "Gera a cobrança", "Envia mensagem aos pais"],
        correta: 1,
        explicacao: "Iniciar coloca a sessão em atendimento e já abre a evolução.",
      },
      {
        pergunta: "Você consegue ver a agenda dos outros profissionais?",
        opcoes: ["Sim, de todos", "Não: só a sua", "Só da mesma sala", "Só na sexta-feira"],
        correta: 1,
        explicacao: "Por menor privilégio, o profissional vê apenas a própria agenda.",
      },
      {
        pergunta: "Falta do terapeuta gera repasse?",
        opcoes: ["Sim", "Não", "Metade", "Só para convênio"],
        correta: 1,
        explicacao: "Falta do terapeuta não cobra o paciente e não gera repasse.",
      },
    ],
  },
  {
    id: "prontuario",
    versao: 1,
    titulo: "Prontuário: evolução assinada e adendo",
    resumo: "Registrar a evolução, o que acontece ao salvar e como corrigir com adendo.",
    categoria: "Atendimento clínico",
    minutos: 8,
    papeis: ["profissional", "master"],
    secoes: [
      {
        titulo: "Escrever a evolução",
        itens: [
          "Escolha a especialidade, a data do atendimento (não pode ser futura) e vincule à sessão do dia.",
          "Use os modelos da especialidade para preencher mais rápido no celular.",
          "Ditado por voz: você fala, a inteligência artificial escreve o texto e você revisa antes de salvar — nada é salvo sem sua revisão.",
          "Marque o progresso de cada meta ativa (1 a 5).",
        ],
      },
      {
        titulo: "Salvar é assinar",
        itens: [
          "A evolução sai com seu nome e registro profissional (mantenha conselho e número atualizados).",
          "Salvar a evolução ligada à sessão finaliza o atendimento: gera a cobrança, desconta a guia e conta para o seu repasse.",
          "Depois de salva, a evolução e o progresso das metas não podem ser editados nem apagados.",
        ],
      },
      {
        titulo: "Correção por adendo",
        texto: [
          "Errou ou faltou algo? Use o botão Adendo na evolução: escolha o motivo e escreva a correção. A evolução original continua intacta e o adendo aparece logo abaixo, com seu nome, registro, data e hora — inclusive no relatório em PDF.",
        ],
        atencao: "O adendo também é definitivo: não pode ser editado nem apagado. Para corrigir um adendo, registre outro.",
      },
      {
        titulo: "Quem lê o prontuário",
        texto: ["Só o master e os profissionais vinculados à mesma especialidade. Recepção, financeiro e administrador não têm acesso."],
      },
    ],
    questoes: [
      {
        pergunta: "Você salvou a evolução com um erro de digitação. Como corrigir?",
        opcoes: ["Editar a evolução", "Apagar e escrever de novo", "Registrar um adendo com o motivo", "Pedir ao master para apagar"],
        correta: 2,
        explicacao: "Evolução assinada não muda; a correção é um adendo ligado à original.",
      },
      {
        pergunta: "O que acontece ao salvar a evolução ligada à sessão de hoje?",
        opcoes: ["Nada", "A sessão é finalizada: cobrança, baixa da guia e repasse", "A sessão é cancelada", "Os pais recebem a evolução"],
        correta: 1,
        explicacao: "Salvar finaliza o atendimento e dispara as regras financeiras e de guia.",
      },
      {
        pergunta: "Sobre o ditado por voz, é correto dizer:",
        opcoes: [
          "A IA salva sozinha a evolução",
          "A IA escreve o texto e você revisa antes de salvar",
          "Só funciona no computador",
          "O áudio fica anexado ao prontuário",
        ],
        correta: 1,
        explicacao: "O texto da IA volta para o formulário; só vira registro depois da sua revisão.",
      },
      {
        pergunta: "Quem pode ler as evoluções de Fonoaudiologia?",
        opcoes: ["Toda a equipe", "O master e os profissionais de Fonoaudiologia", "A recepção", "O administrador"],
        correta: 1,
        explicacao: "O acesso é por especialidade, mais o master.",
      },
      {
        pergunta: "Um adendo registrado pode ser apagado?",
        opcoes: ["Sim, em até 24 horas", "Sim, pelo master", "Não; para corrigir, registra-se outro adendo", "Sim, pelo autor"],
        correta: 2,
        explicacao: "Adendos também são imutáveis.",
      },
    ],
  },
  {
    id: "plano-terapeutico",
    versao: 1,
    titulo: "Plano terapêutico, metas e relatório PDF",
    resumo: "Metas por especialidade, gráfico de progresso e relatório para escola, médico ou convênio.",
    categoria: "Atendimento clínico",
    minutos: 5,
    papeis: ["profissional", "master"],
    secoes: [
      {
        titulo: "Metas",
        itens: [
          "Cada criança tem metas por especialidade, com situação ativa, alcançada ou pausada.",
          "Em cada evolução você marca o nível da meta: 1 Não realizou · 2 Com ajuda total · 3 Com ajuda parcial · 4 Com pouca ajuda · 5 Independente.",
          "O gráfico mostra a evolução ao longo das sessões — ótimo para apresentar aos pais e ao convênio.",
        ],
      },
      {
        titulo: "Relatório em PDF",
        itens: [
          "Escolha o período, as especialidades, a finalidade (escola, médico, convênio, família) e se inclui metas e evoluções.",
          "Baixe o PDF ou libere direto na Área da família.",
          "O relatório inclui os adendos de cada evolução.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "Qual nível significa que a criança fez sozinha?",
        opcoes: ["1", "3", "5", "Não existe esse nível"],
        correta: 2,
        explicacao: "5 = Independente.",
      },
      {
        pergunta: "Onde o progresso de cada meta é registrado?",
        opcoes: ["Numa planilha à parte", "Na própria evolução da sessão", "Na agenda", "No financeiro"],
        correta: 1,
        explicacao: "O nível é marcado junto com a evolução e fica assinado com ela.",
      },
      {
        pergunta: "O relatório PDF pode ser enviado para os pais pelo sistema?",
        opcoes: ["Não", "Sim, liberando na Área da família", "Só por e-mail pessoal", "Só impresso"],
        correta: 1,
        explicacao: "Ao liberar, o relatório aparece na Área da família.",
      },
    ],
  },

  // ======================= FINANCEIRO =======================
  {
    id: "financeiro-sessoes",
    versao: 1,
    titulo: "Valores das sessões e repasses",
    resumo: "De onde vem o valor, quando a sessão entra no faturamento e como marcar pagamentos.",
    categoria: "Financeiro",
    minutos: 7,
    papeis: ["financeiro", "master", "administrador"],
    secoes: [
      {
        titulo: "Tabela de convênios",
        itens: [
          "Em Financeiro, cadastre cada convênio, particular ou liminar com o valor da sessão.",
          "O valor é aplicado às novas sessões do paciente conforme o convênio do cadastro.",
          "A recepção escolhe o convênio sem ver os valores.",
        ],
      },
      {
        titulo: "Valor e repasse de cada sessão",
        itens: [
          "O percentual de repasse vem do cadastro do profissional (Equipe) e pode ser ajustado em cada sessão.",
          "Valores aceitam vírgula (ex.: 150,00), de R$ 0 a R$ 1.000.000 com até 2 casas; repasse de 0 a 100%.",
          "Valor inválido é recusado e o campo volta ao valor anterior.",
        ],
      },
      {
        titulo: "O que entra no faturamento",
        itens: [
          "Sessão finalizada e falta cobrada entram no faturamento.",
          "Falta justificada e falta do terapeuta não são cobradas e não geram repasse.",
          "Na falta cobrada, decida se há repasse ao profissional.",
          "Marque “Pago pelo paciente” e “Repasse pago”; exporte em PDF, CSV ou Excel.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "De onde vem o valor de uma sessão nova?",
        opcoes: ["Da recepção", "Da tabela de convênios, pelo convênio do paciente", "Do último pagamento", "Do profissional, sempre"],
        correta: 1,
        explicacao: "Se o convênio não tiver valor, o sistema usa o padrão do profissional.",
      },
      {
        pergunta: "Qual valor o sistema aceita digitar?",
        opcoes: ["-50,00", "150,505", "150,50", "abc"],
        correta: 2,
        explicacao: "Valores não podem ser negativos nem ter mais de 2 casas decimais.",
      },
      {
        pergunta: "Falta justificada entra no faturamento?",
        opcoes: ["Sim", "Não", "Só de convênio", "Só se tiver atestado"],
        correta: 1,
        explicacao: "Só sessões finalizadas e faltas cobradas entram.",
      },
      {
        pergunta: "Um repasse de 120% será aceito?",
        opcoes: ["Sim", "Não: o repasse vai de 0 a 100%", "Sim, para o master", "Só em feriados"],
        correta: 1,
        explicacao: "O percentual é limitado a 0–100% na tela e no banco.",
      },
    ],
  },
  {
    id: "cobrancas",
    versao: 1,
    titulo: "Cobranças com Pix, boleto e cartão",
    resumo: "Conta Asaas da clínica, nova cobrança, link de pagamento e baixa automática.",
    categoria: "Financeiro",
    minutos: 6,
    papeis: ["financeiro", "master", "administrador"],
    secoes: [
      {
        titulo: "Conta de recebimento",
        texto: [
          "Cada clínica conecta a própria chave do Asaas em Financeiro › Cobranças. A chave fica protegida e o dinheiro vai direto para a conta da clínica, sem taxa do CliniHelp.",
        ],
      },
      {
        titulo: "Nova cobrança",
        itens: [
          "Escolha o paciente e marque as sessões do mês, ou use valor livre.",
          "Valor mínimo de R$ 5,00; vencimento de hoje até 1 ano à frente.",
          "Forma: Pix, boleto, cartão ou o responsável escolhe.",
          "O responsável financeiro precisa ter CPF válido no cadastro.",
        ],
      },
      {
        titulo: "Envio e baixa",
        itens: [
          "Envie o link de pagamento (com a marca CliniHelp) por WhatsApp ou copie.",
          "Quando o pagamento é confirmado, a cobrança e as sessões ligadas são marcadas como pagas automaticamente.",
          "Cobranças pendentes podem ser canceladas.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "Qual o valor mínimo de uma cobrança?",
        opcoes: ["R$ 1,00", "R$ 5,00", "R$ 50,00", "Não há mínimo"],
        correta: 1,
        explicacao: "R$ 5,00 é o mínimo aceito pelo meio de pagamento.",
      },
      {
        pergunta: "O que é preciso no cadastro do paciente para gerar a cobrança?",
        opcoes: ["Diagnóstico", "CPF válido do responsável financeiro", "Foto da criança", "Número da guia"],
        correta: 1,
        explicacao: "A cobrança sai no nome e CPF do responsável financeiro.",
      },
      {
        pergunta: "Depois que a família paga, o que você precisa fazer?",
        opcoes: ["Marcar à mão cada sessão como paga", "Nada: a baixa é automática", "Enviar o comprovante ao suporte", "Gerar outra cobrança"],
        correta: 1,
        explicacao: "A confirmação do pagamento atualiza a cobrança e as sessões.",
      },
      {
        pergunta: "Um vencimento para daqui a 2 anos será aceito?",
        opcoes: ["Sim", "Não: o vencimento vai de hoje até 1 ano", "Só no boleto", "Só no cartão"],
        correta: 1,
        explicacao: "O sistema limita o vencimento a até 1 ano à frente.",
      },
    ],
  },
  {
    id: "liminares-glosas",
    versao: 1,
    titulo: "Liminares e glosas",
    resumo: "Fechamento mensal de liminar com nota fiscal e o controle de glosas dos convênios.",
    categoria: "Financeiro",
    minutos: 6,
    papeis: ["financeiro", "master", "administrador"],
    secoes: [
      {
        titulo: "Liminar",
        itens: [
          "Liminar não usa guia: entra como particular, mas é paga pela operadora depois.",
          "Em Liminares, feche o mês por paciente: gere a lista de presença em PDF e registre o número e a data de emissão da nota fiscal.",
          "O vencimento é calculado: 30 dias após a emissão da NF.",
          "Ao marcar como paga, as sessões do fechamento ficam pagas.",
        ],
      },
      {
        titulo: "Glosas",
        itens: [
          "Marque uma sessão ou guia como glosada com o valor e o motivo (falha de token, guia vencida, erro de TUSS, limite excedido, sem autorização, documentação, outro).",
          "Acompanhe o recurso: Glosa identificada → Em recurso → Recuperada (paga) ou Perda definitiva.",
          "O valor retido em glosa aparece nos Indicadores por convênio.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "A NF de uma liminar foi emitida em 01/03. Qual o vencimento?",
        opcoes: ["01/03", "31/03", "01/04", "30/04"],
        correta: 1,
        explicacao: "O vencimento é a emissão + 30 dias: 31/03.",
      },
      {
        pergunta: "O que se gera no fechamento mensal da liminar?",
        opcoes: ["Uma guia", "Lista de presença em PDF e registro da nota fiscal", "Uma cobrança Pix", "Um termo de consentimento"],
        correta: 1,
        explicacao: "Liminar trabalha com lista de presença + NF.",
      },
      {
        pergunta: "A glosa foi revertida e o convênio pagou. Qual situação marcar?",
        opcoes: ["Em recurso", "Recuperada (paga)", "Perda definitiva", "Excluir a glosa"],
        correta: 1,
        explicacao: "“Recuperada” encerra a glosa como paga.",
      },
      {
        pergunta: "Onde a clínica acompanha quanto está retido em glosa?",
        opcoes: ["Na agenda", "Nos Indicadores (KPI), por convênio", "No prontuário", "Na lista de espera"],
        correta: 1,
        explicacao: "As glosas entram nos indicadores financeiros.",
      },
    ],
  },
  {
    id: "indicadores",
    versao: 1,
    titulo: "Indicadores (KPI)",
    resumo: "Ocupação das salas, faltas, faturamento, recebido, a receber e glosas.",
    categoria: "Financeiro",
    minutos: 3,
    papeis: ["financeiro", "master", "administrador"],
    secoes: [
      {
        titulo: "O que o painel mostra",
        itens: [
          "Ocupação das salas no período (o horário de funcionamento é configurado no próprio navegador).",
          "Taxa de faltas dos pacientes e faltas do terapeuta.",
          "Faturamento do mês, valor recebido e valores a receber (sessões, cobranças e liminares).",
          "Valor retido em glosa por convênio.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "Quem vê os Indicadores (KPI)?",
        opcoes: ["Toda a equipe", "Master, administrador e financeiro", "Só a recepção", "Os pais"],
        correta: 1,
        explicacao: "Os indicadores mostram valores, por isso ficam com a gestão e o financeiro.",
      },
      {
        pergunta: "O horário de funcionamento usado na ocupação das salas fica salvo onde?",
        opcoes: ["No cadastro da clínica", "No navegador de quem configurou", "Na agenda de cada profissional", "No convênio"],
        correta: 1,
        explicacao: "É uma preferência do navegador.",
      },
      {
        pergunta: "Glosas aparecem nos indicadores?",
        opcoes: ["Não", "Sim, o valor retido por convênio", "Só as perdidas", "Só no fim do ano"],
        correta: 1,
        explicacao: "O painel mostra quanto está retido em glosa.",
      },
    ],
  },

  // ======================= GESTÃO =======================
  {
    id: "gestao-equipe",
    versao: 1,
    titulo: "Equipe, papéis e acessos",
    resumo: "Criar contas, senhas temporárias, verificação em duas etapas, salas e especialidades.",
    categoria: "Gestão",
    minutos: 6,
    papeis: GESTAO,
    secoes: [
      {
        titulo: "Criar uma conta",
        itens: [
          "Em Equipe, informe nome, e-mail, papéis (master, administrador, recepção, profissional, financeiro), especialidades, conselho/registro e repasse do profissional.",
          "O sistema gera uma senha temporária segura: envie para a pessoa. No primeiro login ela cria a própria senha e cadastra o Google Authenticator.",
          "Não existe cadastro público: só a gestão cria contas.",
        ],
      },
      {
        titulo: "Manutenção dos acessos",
        itens: [
          "Esqueceu a senha: gere uma nova senha temporária.",
          "Trocou de celular: zere a verificação em duas etapas.",
          "Saiu da clínica: desative a conta (não apaga o histórico).",
        ],
      },
      {
        titulo: "Regras de segurança",
        itens: [
          "Só o master cria ou altera contas master.",
          "O administrador não vincula especialidades a si mesmo e não vê prontuários.",
          "Salas e especialidades são cadastradas pela gestão.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "Como uma pessoa nova recebe acesso?",
        opcoes: ["Ela se cadastra sozinha", "A gestão cria a conta com senha temporária", "O desenvolvedor cria por e-mail", "Pelo link da Área da família"],
        correta: 1,
        explicacao: "Não há auto-cadastro; a conta nasce com senha temporária.",
      },
      {
        pergunta: "Uma profissional saiu da clínica. O que fazer com a conta?",
        opcoes: ["Excluir", "Desativar a conta", "Trocar o e-mail", "Deixar ativa"],
        correta: 1,
        explicacao: "Desativar bloqueia o acesso e mantém o histórico e as assinaturas.",
      },
      {
        pergunta: "O administrador pode alterar a conta do master?",
        opcoes: ["Sim", "Não: só o master mexe em contas master", "Só a senha", "Só o e-mail"],
        correta: 1,
        explicacao: "Isso impede que alguém ganhe acesso ao prontuário por escalada.",
      },
      {
        pergunta: "Um profissional trocou de celular e não consegue o código. O que você faz?",
        opcoes: ["Desativa a conta", "Zera a verificação em duas etapas dele", "Cria outra conta", "Desliga a verificação da clínica"],
        correta: 1,
        explicacao: "Ao zerar, ele cadastra o aplicativo de novo no próximo login.",
      },
    ],
  },
  {
    id: "seguranca-auditoria",
    versao: 1,
    titulo: "Segurança, conformidade e auditoria",
    resumo: "Ler o painel de conformidade LGPD/ISO/HIPAA e investigar a trilha de auditoria.",
    categoria: "Gestão",
    minutos: 5,
    papeis: GESTAO,
    secoes: [
      {
        titulo: "Painel de conformidade",
        itens: [
          "Em Segurança e auditoria › Conformidade, cada controle (LGPD, ISO 27001, HIPAA, SOC 2) aparece como Em ordem, Atenção ou Crítico, verificado direto no banco.",
          "Veja os pacientes sem termo LGPD, quem ainda não ativou a verificação em duas etapas ou usa senha temporária, e o andamento do treinamento da equipe.",
          "Use “Verificar de novo” depois de resolver uma pendência.",
        ],
      },
      {
        titulo: "Trilha de auditoria",
        itens: [
          "Filtre por período, usuário, área e ação. Abra um registro para ver o antes e o depois de cada campo.",
          "Registros do prontuário aparecem só para o master.",
          "A trilha não pode ser alterada nem apagada.",
        ],
      },
    ],
    questoes: [
      {
        pergunta: "Um controle aparece como “Crítico”. O que significa?",
        opcoes: ["Está tudo certo", "Uma proteção importante está faltando e deve ser resolvida primeiro", "É só informativo", "O sistema está fora do ar"],
        correta: 1,
        explicacao: "Crítico = resolver antes de tudo; Atenção = pendência a acompanhar.",
      },
      {
        pergunta: "Onde você descobre quem alterou o cadastro de um paciente?",
        opcoes: ["No financeiro", "Na trilha de auditoria, filtrando por área e período", "Perguntando à equipe", "Na agenda"],
        correta: 1,
        explicacao: "A auditoria mostra quem, quando e o que mudou.",
      },
      {
        pergunta: "O administrador vê os registros de prontuário na auditoria?",
        opcoes: ["Sim", "Não, só o master", "Só os do mês", "Só os excluídos"],
        correta: 1,
        explicacao: "Mesmo na auditoria, dados clínicos ficam com o master.",
      },
    ],
  },
];

export const moduloPorId = (id: string) => MODULOS.find((m) => m.id === id);

/** Tópicos básicos de segurança e privacidade exigidos de toda a equipe (ISO 27001 A.7.2.2). */
export const MODULOS_ESSENCIAIS = MODULOS.filter((m) => m.categoria === "Essencial").map((m) => m.id);
