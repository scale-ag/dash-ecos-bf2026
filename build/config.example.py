# -*- coding: utf-8 -*-
"""
Configuração do cliente — TEMPLATE.

Este é o ÚNICO arquivo que precisa ser editado para colocar o funil de um
cliente novo no ar. Troque TODOS os marcadores <<PREENCHER: ...>> (o build
se recusa a rodar enquanto algum marcador de texto continuar aqui).
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
SPREADSHEET_ID = "<<PREENCHER: ID da planilha do Meta Ads (trecho entre /d/ e /edit)>>"
# Opcional: se a lista de Compradores estiver em OUTRA planilha, coloque o ID
# dela aqui. Vazio = Compradores na mesma planilha do Meta Ads (padrão).
# <<PREENCHER: ID da planilha de Compradores, só se for separada — senão deixe "">>
SPREADSHEET_ID_SALES = ""
GID_META = "<<PREENCHER: gid da aba Meta Ads>>"
GID_SALES = "<<PREENCHER: gid da aba Compradores/Vendas>>"

# ==========================================================================
# 2) REGRAS DE NEGÓCIO
# ==========================================================================
# Fator de imposto aplicado sobre o gasto do Meta Ads quando o toggle
# "Imposto Meta" estiver ligado. Use 1.0 se o cliente não tiver imposto.
# <<PREENCHER: fator de imposto do Meta (ex.: 1.13806 = +13,806%; 1.0 = sem imposto)>>
TAX_FACTOR = 1.0

# Produto principal do funil (base de Vendas/CAC/ConvCHK/Ticket). Casamento
# por PREFIXO sobre o nome NORMALIZADO (sem acento, minúsculas) da coluna
# Produto da planilha de Compradores — escreva sem acento e em minúsculas.
MAIN_PRODUCT_PREFIX = "<<PREENCHER: prefixo do produto principal, sem acento e em minúsculas>>"

# Qual coluna UTM da planilha de Compradores carrega o Ad Name do Meta:
# "utm_content", "utm_term" ou "utm_medium". Depende do parametrizador de URL
# dos anúncios do cliente — CONFIRA nos dados antes de assumir: a coluna que
# não carrega o anúncio costuma trazer o posicionamento (Instagram_Feed/Stories),
# e casar pela coluna errada zera as atribuições.
AD_UTM_COLUMN = "<<PREENCHER: utm_content | utm_term | utm_medium — a coluna que bate com o Ad Name>>"

# A planilha de Compradores tem uma coluna de status de pagamento confiável?
# SIM -> False (o build filtra por is_paid()). NÃO (toda linha já é uma compra
# concretizada) -> True (conta todas as linhas como venda paga).
# <<PREENCHER: True se toda linha é venda paga; False se há coluna Status confiável>>
COUNT_ALL_AS_PAID = True

# ==========================================================================
# 3) RÓTULOS EXIBIDOS NA INTERFACE
# ==========================================================================
CLIENT_NAME = "<<PREENCHER: nome do cliente (topo do menu lateral)>>"
CLIENT_SUB = "<<PREENCHER: nome do funil/lançamento (subtítulo abaixo do nome)>>"
TAX_LABEL = "<<PREENCHER: rótulo do toggle de imposto (ex.: Imposto Meta ×1,13806)>>"
MAIN_PRODUCT = "<<PREENCHER: nome de exibição do produto principal>>"

# ==========================================================================
# 4) METAS (aba Relatórios) — código de cor de CAC/ROAS
# ==========================================================================
#   • ROAS: quanto MAIOR, melhor  -> desempenho = roas / ROAS_TARGET
#   • CAC : quanto MENOR, melhor  -> desempenho = CAC_TARGET / cac
# Faixas (sobre o desempenho): <REPORT_BAND_LOW vermelho · até 0,99 amarelo ·
#   até REPORT_BAND_HIGH verde · acima disso azul-ciano.
# <<PREENCHER: CAC alvo em R$ por venda do produto principal>>
CAC_TARGET = 0.0
# <<PREENCHER: ROAS alvo (Faturamento / Gasto)>>
ROAS_TARGET = 0.0
REPORT_BAND_LOW = 0.70
REPORT_BAND_HIGH = 1.30

# ==========================================================================
# 5) IA INSIGHTS (Cloudflare Worker) — ver SETUP-IA.md
# ==========================================================================
# URL pública do Worker (não é secreta). Vazio = aba IA Insights indisponível.
# Preencher depois de publicar o Worker (checklist do CLAUDE.md).
# <<PREENCHER: URL do Worker, ex.: https://<nome-do-worker>.<subdominio>.workers.dev>>
IA_WORKER_URL = ""
