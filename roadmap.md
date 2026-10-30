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
- [x] Painel /dev: ativar recebimentos da clínica (cria a conta da clínica no Asaas)
- [x] Página Cobranças: por sessão, mensal (soma do mês) e avulsa; Pix, boleto, cartão ou à escolha
- [x] Página pública de pagamento CliniHelp (Pix QR, boleto, cartão)
- [x] Aviso automático de pagamento (webhook) marca a sessão como paga
- [x] Chave da conta-mãe Asaas do desenvolvedor
