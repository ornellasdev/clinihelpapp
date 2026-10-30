# CliniHelp — Sistema de Gestão de Clínicas

> "Cada evolução registrada é um passo da criança."

## 📋 Sobre o Projeto

O **CliniHelp** é uma plataforma web moderna e responsiva voltada para a gestão integrada de clínicas multidisciplinares e de desenvolvimento infantil (como Fonoaudiologia, Terapia Ocupacional, Psicologia, Fisioterapia, Psicopedagogia, entre outras).

Nosso objetivo é descomplicar a rotina administrativa e clínica, oferecendo um ambiente seguro e intuitivo para que os terapeutas foquem no que realmente importa: a evolução de cada paciente.

🔗 **Acesse a aplicação:** [clinihelpsystem.lovable.app](https://clinihelpsystem.lovable.app)

## ✨ Principais Funcionalidades

### 📅 Agenda Inteligente
- Visualização clara e filtragem por sala de atendimento e por profissional.
- Controle de horários, confirmações, faltas e reposições sem conflito de espaço físico.

### 📁 Prontuário Eletrônico por Especialidade
- Registro detalhado de evoluções diárias, anamneses e planos terapêuticos adaptados para cada área de atuação.
- Histórico centralizado do desenvolvimento da criança com controle de acesso.

### 💰 Gestão Financeira e Repasses
- Organização transparente e automatizada de comissões e repasses para os profissionais da equipe.
- Controle de atendimentos realizados vs. faturamento.

### 📱 Experiência Multiplataforma (Responsivo)
- Interface otimizada para uso rápido tanto no computador (recepção/administração) quanto no celular ou tablet (terapeutas em sala de atendimento).

### 🔒 Controle de Acesso e Segurança
- Ambiente restrito à equipe da clínica, com permissões personalizadas por perfil (Administrador, Recepção, Profissional de Saúde).

## 🚀 Tecnologias Utilizadas

Este projeto foi construído utilizando o que há de mais moderno no ecossistema de desenvolvimento web para garantir performance, escalabilidade e uma excelente experiência de usuário (UX/UI):

- **Frontend:** React + TypeScript (TanStack Start / TanStack Router)
- **Build Tool:** Vite
- **Estilização:** Tailwind CSS + shadcn/ui
- **Ícones:** Lucide React
- **Backend / Banco de Dados / Autenticação:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Plataforma de Desenvolvimento:** Lovable

## 💻 Como Executar o Projeto Localmente

### Pré-requisitos
- Node.js (versão 18 ou superior)
- Gerenciador de pacotes (npm, yarn ou bun)

### Passo a passo

1. **Clone o repositório:**
   ```sh
   git clone https://github.com/ornellasdev/clinihelpapp.git
   cd clinihelpapp
   ```

2. **Instale as dependências:**
   ```sh
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   Crie um arquivo `.env` na raiz do projeto e adicione as credenciais do seu backend:
   ```env
   VITE_SUPABASE_URL=sua_url_do_supabase
   VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_do_supabase
   VITE_SUPABASE_PROJECT_ID=id_do_projeto
   ```

4. **Inicie o servidor de desenvolvimento:**
   ```sh
   npm run dev
   ```

5. **Acesse no navegador:**
   Abra [http://localhost:8080](http://localhost:8080) (ou a porta indicada no seu terminal).

## 🗂️ Estrutura Básica do Projeto

```text
├── public/              # Arquivos estáticos e ícones
├── src/
│   ├── assets/          # Imagens e logotipos
│   ├── components/      # Componentes reutilizáveis e UI (shadcn)
│   ├── hooks/           # Custom hooks do React
│   ├── integrations/    # Configuração do cliente do backend (Supabase)
│   ├── lib/             # Regras de negócio, consultas, permissões e funções de servidor
│   ├── routes/          # Telas do sistema (Auth, Agenda, Pacientes, Financeiro, Auditoria...)
│   └── styles.css       # Tema e cores do CliniHelp (Tailwind CSS v4)
├── supabase/            # Migrações do banco de dados
├── package.json         # Dependências e scripts
└── vite.config.ts       # Configuração do Vite
```

## 🛡️ Segurança e Privacidade (LGPD)

Por lidar com dados sensíveis de saúde e de menores de idade, o CliniHelp adota práticas rigorosas de segurança:

- Autenticação segura e criptografada.
- Acesso restrito exclusivamente a profissionais autorizados pela administração da clínica.
- Isolamento de dados por clínica e por nível de permissão.

## 📞 Suporte e Contato

Para dúvidas, suporte técnico ou solicitação de acesso à plataforma:

- **Sistema Web:** [clinihelpsystem.lovable.app](https://clinihelpsystem.lovable.app)
- **Desenvolvedor / Responsável:** Yurivillar Ornelas Faria (Ornellas)
- **LinkedIn:** [linkedin.com/in/yurivillarornelas](https://www.linkedin.com/in/yurivillarornelas/)
