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

## Para os pais
- [x] Área da família (/familia): entrada por código no e-mail; agenda, cobranças, recibos e relatórios liberados
- [x] Termos com assinatura no dedo (consentimento de tratamento e uso de imagem); comprovante em PDF
- [ ] E-mails com a marca da clínica e aviso de termo novo (depende de um domínio de e-mail próprio)

## Guias de convênio e glosas (controle interno)
- [x] Guias com os 3 códigos (TUSS, guia, faturamento), sessões solicitadas/autorizadas, datas e anexo
- [x] Liberações do dia para a recepção (pendente / aguardando / liberado + token) e baixa automática do saldo
- [x] Alertas na agenda e avisos de renovação (vencimento e poucas sessões)
- [x] Conferência mensal do faturamento (planilha) e controle de glosas
- [x] Glosas no painel de Indicadores (KPI)

## Liminar (sem guia)
- [x] Fechamento mensal por paciente com lista de presença em PDF
- [x] Nota fiscal (número + emissão) com vencimento automático em 30 dias
- [x] Registro do pagamento marca as sessões do mês como pagas
- [x] Liminares a receber / vencidas nos Indicadores (KPI)

## Status da agenda ligados ao prontuário, guias e financeiro
- [x] Novos status: Agendado, Aguardando atendimento, Em atendimento, Finalizado + 3 faltas (Cancelado mantido)
- [x] Chegada pela recepção (agenda e liberações do dia) coloca a criança na fila do profissional
- [x] "Meus atendimentos de hoje" no painel com Iniciar / Evoluir; abrir a evolução inicia o atendimento
- [x] Salvar a evolução finaliza a sessão: cobra, desconta a guia e gera repasse
- [x] Falta justificada com motivo e atestado (sessão + documentos do paciente), clipe na agenda
- [x] Falta do terapeuta (sem cobrança/repasse, reposição pendente) e falta cobrada (repasse opcional)
- [x] Cores por status na agenda, financeiro, indicadores e cobranças ajustados

## Segurança e conformidade (LGPD / ISO 27001 / HIPAA / SOC 2)
- [x] Etapa 1: banco — vínculos que preservam histórico, exclusão lógica, índices, dados clínicos separados, consentimento LGPD, adendos, auditoria imutável, acesso por papel, views de indicadores
- [x] Etapa 2: ficha padronizada com validação, dados clínicos só para a equipe terapêutica, prontuário assinado + adendo, links temporários para anexos, saída automática em 15 min
- [x] Etapa 2b: levar a mesma validação aos formulários de valores (convênios, cobranças, repasses) e às demais telas que ainda gravam direto
- [x] Etapa 3: painel de Segurança, Banco e Auditoria (filtros, pacientes sem termo LGPD, integridade)
- [x] Publicar

## Treinamento (CliniHelp LMS)
- [x] Tópicos por cargo com aula e questionário (70% para concluir), progresso da equipe para a gestão e indicador no painel de conformidade
