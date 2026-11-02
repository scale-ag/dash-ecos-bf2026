# -*- coding: utf-8 -*-
"""
Configuração do cliente — Ecosmetics / Black Friday 2026 (E-commerce Nuvemshop).

Este é o ÚNICO arquivo que precisa ser editado para colocar o funil de um
cliente novo no ar (o build se recusa a rodar enquanto algum marcador de
preenchimento continuar aqui).
Ordem completa: "CHECKLIST DE NOVO CLIENTE" no topo do CLAUDE.md.

Depois de editar, teste localmente:

    python build/build.py --meta-file meta.csv --sales-file sales.csv --out dist/index.html

`build/config.example.py` é a cópia intacta deste modelo — mantenha-o
sem preencher, para restaurar o config.py se precisar começar do zero.
"""
from __future__ import annotations

# ==========================================================================
# 1) PLANILHA(S) DO CLIENTE (Google Sheets)
# ==========================================================================
# SPREADSHEET_ID: o trecho entre /d/ e /edit na URL da planilha
#   (https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit#gid=...)
# GID_META / GID_SALES: o número depois de "gid=" na URL de cada aba.
# A planilha precisa estar com o link público em modo "Qualquer pessoa com
# o link pode visualizar" (o build lê via export CSV, SOMENTE LEITURA).
SPREADSHEET_ID = "1j62VMK7led4OIdt2_qKdd_ExE-VRjH_ya0r2HCmvvFw"   # "Extração Dashboard Black Friday"
# Opcional: se a lista de Compradores estiver em OUTRA planilha, coloque o ID
# dela aqui. Vazio = Compradores na mesma planilha do Meta Ads (padrão).
# Ecosmetics: vendas em planilha separada ("Vendas Nuvemshop - Ecosmetics").
SPREADSHEET_ID_SALES = "1B65YpgnjsvB0EaH0xWKnru_OAJKlwujQrK6dj1s4nFk"
GID_META = "0"            # aba "Página1"
GID_SALES = "1257918218"  # aba "vendas" (NÃO usar a aba "Metas BF 2026")

# ==========================================================================
# 2) REGRAS DE NEGÓCIO
# ==========================================================================
# Fator de imposto aplicado sobre o gasto do Meta Ads quando o toggle
# "Imposto Meta" estiver ligado. Use 1.0 se o cliente não tiver imposto.
TAX_FACTOR = 1.1215

# Produto principal do funil (base de Vendas/CAC/ConvCHK/Ticket). Casamento
# por PREFIXO sobre o nome NORMALIZADO (sem acento, minúsculas) da coluna
# Produto da planilha de Compradores — escreva sem acento e em minúsculas.
# "*" = e-commerce: todo pedido pago conta como 1 venda (sem produto principal).
MAIN_PRODUCT_PREFIX = "*"

# Qual coluna UTM da planilha de Compradores carrega o Ad Name do Meta:
# "utm_content", "utm_term" ou "utm_medium". Depende do parametrizador de URL
# dos anúncios do cliente — CONFIRA nos dados antes de assumir: a coluna que
# não carrega o anúncio costuma trazer o posicionamento (Instagram_Feed/Stories),
# e casar pela coluna errada zera as atribuições.
# Ecosmetics (verificado em 02/11/2026): utm_content = Ad Name (53 valores batem);
# utm_term traz o ID do anúncio/posicionamento (0 batem).
AD_UTM_COLUMN = "utm_content"

# A planilha de Compradores tem uma coluna de status de pagamento confiável?
# SIM -> False (o build filtra por is_paid()). NÃO (toda linha já é uma compra
# concretizada) -> True (conta todas as linhas como venda paga).
# Ecosmetics: status_pagamento (paid/pending/voided/refunded) -> só "paid" conta.
COUNT_ALL_AS_PAID = False

# Colunas da aba de Compradores (sobrescreve os aliases do build.py; lista
# vazia = a planilha não tem essa coluna). Planilha Nuvemshop da Ecosmetics:
# data do pedido = "data", receita = "total" (com frete/desconto), status de
# pagamento = "status_pagamento", itens = "produtos"; não há nome/e-mail.
SALES_COLUMNS = {
    "created": ["data"],
    "val": ["total"],
    "status": ["status_pagamento"],
    "prod": ["produtos"],
    "name": [],
    "email": [],
}

# Ignora linhas (Meta e vendas) anteriores a esta data — a aba de vendas traz
# o histórico desde 2024; o funil Black Friday 2026 começa em 01/11/2026.
DATE_MIN = "2026-11-01"

# Link do cliente: <URL do Pages>/cliente/ — só Visão Geral + tabela de criativos
# (Gasto, CPM, CTR, Hook Rate, Hold Rate, Retenção 75%, Vendas, ROAS), sem senha.
CLIENT_PAGE_DIR = "cliente"

# Aba do Meta com gasto por hora (Adveronix, detalhamento "Hour of day":
# Day · Hour · Amount Spent), na mesma planilha do Meta. Preencha o gid quando
# a aba existir para ligar o ROAS por hora. Vazio = só vendas/faturamento por hora.
GID_META_HOURLY = ""

# Base CIFRADA de clientes que compraram até 31/10/2026 (export Nuvemshop,
# gerada por build/gerar_clientes_hist.py). Decifrada no Actions com o Secret
# CLIENTES_KEY -> gráfico Clientes novos × recorrentes. Sem a chave, o gráfico some.
CUSTOMER_HIST_FILE = "clientes_hist.enc"

# ==========================================================================
# 3) RÓTULOS EXIBIDOS NA INTERFACE
# ==========================================================================
CLIENT_NAME = "Ecosmetics"
CLIENT_SUB = "E-commerce Nuvemshop"
TAX_LABEL = "Imposto Meta ×1,1215"
MAIN_PRODUCT = "Pedidos da loja"

# ==========================================================================
# 4) METAS (aba Relatórios) — código de cor de CAC/ROAS
# ==========================================================================
#   • ROAS: quanto MAIOR, melhor  -> desempenho = roas / ROAS_TARGET
#   • CAC : quanto MENOR, melhor  -> desempenho = CAC_TARGET / cac
# Faixas (sobre o desempenho): <REPORT_BAND_LOW vermelho · até 0,99 amarelo ·
#   até REPORT_BAND_HIGH verde · acima disso azul-ciano.
# CAC alvo derivado do ROAS alvo: ticket médio dos pedidos pagos atribuídos
# ao Meta (01–02/11/2026) ÷ 3. Ajuste se o gestor definir um CAC próprio.
CAC_TARGET = 99.0
ROAS_TARGET = 3.0
REPORT_BAND_LOW = 0.70
REPORT_BAND_HIGH = 1.30

# ==========================================================================
# 5) IA INSIGHTS (Cloudflare Worker) — ver SETUP-IA.md
# ==========================================================================
# URL pública do Worker (não é secreta). Vazio = aba IA Insights indisponível.
# Preencher depois de publicar o Worker (checklist do CLAUDE.md).
# Vazio até o Worker "ecosmetics-bf2026-ia-insights" ser publicado (SETUP-IA.md).
IA_WORKER_URL = ""
