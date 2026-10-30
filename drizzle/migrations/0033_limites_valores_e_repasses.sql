-- Mesmas faixas da validação das telas, garantidas no banco.
alter table public.convenios add constraint convenios_nome_tamanho_check
  check (char_length(btrim(nome)) between 2 and 80);
alter table public.convenio_valores add constraint convenio_valores_faixa_check
  check (valor_sessao <= 1000000 and valor_sessao = round(valor_sessao, 2));
alter table public.atendimento_financeiro add constraint atendimento_financeiro_faixa_check
  check (valor <= 1000000 and valor = round(valor, 2) and percentual_repasse = round(percentual_repasse, 2));
alter table public.profissional_config add constraint profissional_config_faixa_check
  check (valor_sessao_padrao between 0 and 1000000 and valor_sessao_padrao = round(valor_sessao_padrao, 2)
         and percentual_repasse_padrao = round(percentual_repasse_padrao, 2));
alter table public.cobrancas add constraint cobrancas_valor_faixa_check
  check (valor <= 1000000 and valor = round(valor, 2));
alter table public.glosas add constraint glosas_valor_faixa_check
  check (valor <= 1000000 and valor = round(valor, 2));
