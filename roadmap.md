# Roadmap

## Várias clínicas no mesmo sistema
- [x] Apagar dados de teste
- [x] Clínicas separadas no banco (cada dado pertence a uma clínica; regras de acesso por clínica)
- [x] Endereço por clínica: dominio/nome-da-clinica/...
- [x] Acesso desenvolvedor: Google + código do Google Authenticator, escolhe a clínica, permissão total
- [x] Painel do desenvolvedor: criar clínica + master inicial, ativar/suspender clínica
- [x] Equipe/auditoria/financeiro/documentos separados por clínica
- [x] Autorizar o e-mail Google do desenvolvedor

## Cobranças dos pacientes (Asaas por trás, cara do CliniHelp)
- [x] Banco: contas de recebimento por clínica (chave protegida), cobranças e sessões cobradas
- [x] Cada clínica conecta a própria chave do Asaas em Cobranças (painel /dev só consulta)
- [x] Página Cobranças: por sessão, mensal (soma do mês) e avulsa; Pix, boleto, cartão ou à escolha
- [x] Página pública de pagamento CliniHelp (Pix QR, boleto, cartão)
- [x] Aviso automático de pagamento (webhook) marca a sessão como paga
- [x] Chave de teste do desenvolvedor (não é mais usada pelo sistema)

## Indicadores e lista de espera
- [x] Página Indicadores: ocupação das salas, faltas, faturamento do mês e valores a receber
- [x] Lista de espera: pacientes aguardando vaga por especialidade, dias e horário

## Prontuário mais completo
- [x] Plano terapêutico com metas por especialidade e gráfico de progresso a partir das evoluções
- [x] Modelos de evolução por especialidade (preenchimento rápido no celular)
- [x] Evolução por voz: grava no celular, IA escreve, profissional revisa antes de salvar
- [x] Relatório do paciente em PDF por período (escola, médico, convênio)
