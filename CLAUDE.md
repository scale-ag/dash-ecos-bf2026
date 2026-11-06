# CLAUDE.md — Dashboard de Controle de Tráfego Pago (TEMPLATE)

> Este arquivo é lido automaticamente pelo Claude Code ao abrir o repositório.
> Configurado para o cliente **Ecosmetics** (funil "Black Friday 2026", sigla
> `zenith_ecom_vendas` — prefixo de todas as campanhas do Meta).
> A engine (`build/template.html`, `build/build.py`, `build/app.js`, CSS,
> `ia-worker/worker.js`, workflows) é genérica e não deve ser editada por
> cliente; os valores do cliente ficam em **`build/config.py`** (config do funil)
> e **`config.js`** (metadados de publicação no GitHub). Veja também `README.md`.

---

## ✅ CHECKLIST DE NOVO CLIENTE

Ordem para colocar um cliente novo no ar. Todo valor específico do cliente está
marcado como `<<PREENCHER: descrição>>` — ao final, este comando **não pode
retornar nada** (exceto este checklist e o guard em `build/build.py`):

```bash
grep -rn "<<PREENCHER" --exclude-dir=.git . | grep -v -E "^\./(CLAUDE|AGENTS)\.md:|build/build\.py:|build/config\.example\.py:"
```

1. [ ] **Criar o repositório do cliente** a partir deste template ("Use this
   template" no GitHub) e habilitar o Actions nele.
2. [ ] **`build/config.py` — planilha(s)** (o build se recusa a rodar enquanto
   houver marcador de texto aqui):
   - `SPREADSHEET_ID` — ID da planilha do Meta Ads
   - `SPREADSHEET_ID_SALES` — só se Compradores estiver em outra planilha (senão `""`)
   - `GID_META`, `GID_SALES` — gid de cada aba
   - Planilha(s) com "Qualquer pessoa com o link pode visualizar".
3. [ ] **`build/config.py` — regras de negócio:**
   - `TAX_FACTOR` (imposto do Meta; `1.0` se não houver)
   - `MAIN_PRODUCT_PREFIX` (prefixo do produto principal, sem acento/minúsculas)
   - `AD_UTM_COLUMN` — qual coluna UTM carrega o `Ad Name` do Meta
     (`utm_content`/`utm_term`/`utm_medium`). **Confira nos dados**: casar pela
     coluna errada zera as atribuições (ver "Problemas conhecidos" #10).
   - `COUNT_ALL_AS_PAID` (`True` se toda linha é venda paga)
4. [ ] **`build/config.py` — rótulos:** `CLIENT_NAME`, `CLIENT_SUB`, `TAX_LABEL`, `MAIN_PRODUCT`.
5. [ ] **`build/config.py` — metas da aba Relatórios:** `CAC_TARGET`, `ROAS_TARGET`
   (e, se quiser, `REPORT_BAND_LOW`/`REPORT_BAND_HIGH`).
6. [ ] **Teste local** com CSVs exportados das abas (não commitar os CSVs):
   `python build/build.py --meta-file meta.csv --sales-file sales.csv --out dist/index.html`
   — conferir as 4 abas, tema claro/escuro, filtros e se a aba Meta Ads mostra vendas.
7. [ ] **`config.js`** — `GITHUB_USERNAME`, `GITHUB_REPOSITORY`, `PROJECT_NAME`.
8. [ ] **`CLAUDE.md`** (seção "Fontes de dados" e "Convenções de campanha") —
   URL pública, cliente/funil, sigla, tabela de planilhas/gids/abas, colunas
   reais, pontos de atenção, convenção de nomes de campanha/conjunto/anúncio.
9. [ ] **`AGENTS.md`** — URL pública e cliente/funil no bloco "Projeto".
10. [ ] **`README.md`** — título, cliente/funil, produto principal, URL pública do Pages.
11. [ ] **`SETUP-CRON.md`** — owner/repo e URL do Pages; gerar um **token
    fine-grained novo** (só esse repo, Actions: Read and write) e cadastrá-lo
    **apenas no cron-job.org** (nunca commitar o token).
12. [ ] **GitHub Pages** — Settings → Pages → Source: **GitHub Actions**; rodar
    "Build & Deploy Dashboard" uma vez na `main`.
13. [ ] **Worker da IA Insights** (`SETUP-IA.md`) — criar o Worker na Cloudflare
    e colocar o mesmo nome em `ia-worker/wrangler.toml` (`name`).
14. [ ] **4 Secrets do repositório** (Settings → Secrets and variables → Actions):
    `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`,
    `INSIGHTS_PASSWORD` — valores só no GitHub, nunca em arquivo do repo.
15. [ ] **Deploy do Worker** — commit tocando `ia-worker/` (ou rodar
    `deploy-worker.yml` manualmente); conferir que o KV foi criado.
16. [ ] **`build/config.py` → `IA_WORKER_URL`** com a URL do Worker; novo build.
17. [ ] **Aba Relatórios** — rodar `gerar-relatorios-metrics.yml` uma vez e
    configurar a Routine diária dos briefings (`build/GUIA-RELATORIOS.md`).
18. [ ] **Testar** — Gerar insights na aba IA Insights e recarregar em outro navegador.
19. [ ] **Rodar o `grep` do topo** e confirmar que não sobrou nenhum marcador.

---

## O que é

Dashboard de **Controle de Tráfego Pago** — app de BI estático (HTML/CSS/JS + Chart.js
via CDN) publicado no **GitHub Pages**, que cruza o gerenciador **Meta Ads** com a lista
de **Compradores** e se atualiza a cada ~30 min (build na nuvem via GitHub Actions,
disparado pelo cron-job.org). **Somente leitura** das planilhas.

- **URL pública:** `https://scale-ag.github.io/dash-ecos-bf2026/`
- **Cliente/projeto:** Ecosmetics — Black Friday 2026 (E-commerce Nuvemshop)
  (rótulos exibidos vêm de `CLIENT_NAME`/`CLIENT_SUB` em `build/config.py`)
- **Tipo de funil:** e-commerce / tráfego direto (não há Leads/MQL nem VSL; o
  "lead" é a própria compra) — Anúncio → Página → Adição ao Carrinho → Checkout → Compra:
  `Gasto → Impressões → Cliques → Views da Página → Carrinhos → Checkouts → Compras → Faturamento`

## Fontes de dados (Google Sheets)

Leitura via export CSV, **somente leitura** (nunca modificar as planilhas). Neste
cliente são **duas planilhas** (`SPREADSHEET_ID` e `SPREADSHEET_ID_SALES`).

| Fonte | Planilha (`SPREADSHEET_ID*`) | gid | Aba |
|-------|------------------------------|-----|-----|
| **Meta Ads** | `1j62VMK7led4OIdt2_qKdd_ExE-VRjH_ya0r2HCmvvFw` ("Extração Dashboard Black Friday") | `0` | Página1 (única aba) |
| **Compradores** | `1B65YpgnjsvB0EaH0xWKnru_OAJKlwujQrK6dj1s4nFk` ("Vendas Nuvemshop - Ecosmetics") | `1257918218` | vendas |

**Colunas reais — Meta Ads** (o `header_index` do `build.py` casa por nome, a
ordem não importa):
Day · Campaign Name · Ad Set Name · Ad Name · Impressions · Link Clicks ·
Landing Page Views · Adds to Cart · Checkouts Initiated · Amount Spent ·
3-Second Video Views · ThruPlays · Video Watches at 25% / 50% / 75% / 95% / 100% ·
Video Average Watch Time · Creative Instagram Permalink
(`Amount Spent` com vírgula decimal; células vazias = 0. Vídeo é opcional: anúncios
de imagem/catálogo vêm sem essas colunas → "—" na tabela de criativos.)

**Colunas reais — Compradores** (as usadas pelo build: data, nome, e-mail,
produto, valor/faturamento, utm_campaign, utm_medium, coluna de `AD_UTM_COLUMN`,
status se houver):
id_pedido · numero · **data** · hora · criado_em · pago_em · atualizado_em · status ·
**status_pagamento** · subtotal · desconto · frete · **total** · cupom · meio_pagamento ·
parcelas · cliente_id · qtd_itens · **produtos** · landing_url · utm_source · **utm_medium** ·
**utm_campaign** · **utm_content** · utm_term · sincronizado_em · origem_detectada ·
influenciador · dispositivo

Usadas pelo build (via `SALES_COLUMNS` em `build/config.py`): data = `data`,
receita = **`total`** (valor do pedido com frete e desconto), status = `status_pagamento`
(só `paid` conta), itens = `produtos` ("1x Produto A | 2x Produto B"). Não há colunas
de nome nem de e-mail (a tabela de compradores mostra "—").

### Pontos de atenção deste cliente

Verificado em 02/11/2026:
- **`utm_content` = Ad Name** (53 valores batem com o Meta; `utm_term` bate 0 —
  traz o ID do anúncio ou o posicionamento `Instagram_Feed`/`Stories`).
  `utm_campaign` + `utm_content` casam com o par Campaign Name + Ad Name do Meta em
  52 pedidos de 01–02/11 (43 pagos).
- **Catálogo:** nas vendas da campanha `..._catalogo` o `utm_content` chega truncado
  ("CATÁLOGO", "CA", "C"...) e só parte delas casa com o Ad Name
  `CATÁLOGO ALL PRODUCTS` — essas vendas aparecem no Total, mas nem todas na aba Meta Ads.
- **UTM cortada no catálogo (verificado em 04/11/2026):** a `landing_url` dos pedidos é
  gravada com no máximo **255 caracteres**; anúncios de catálogo caem na página do
  produto (URL longa) e as UTMs no fim chegam truncadas (`utm_campaign=zenith_ecom`,
  `utm_content=CATÁ`...). Além disso o `&` de `auto_h&m_...` às vezes chega sem
  codificar e corta o `utm_medium` em `auto_h`. `FUZZY_UTM_MATCH = True` recupera essas
  vendas por prefixo (par campanha+anúncio único no Meta): catálogo 6 → 17 vendas.
  Correção na origem: parâmetros de URL curtos no Meta, sem `&`/acento nos nomes.
- **Mesmo anúncio em vários conjuntos (catálogo: 7d/180d/365d):** o conjunto da venda sai
  do `utm_medium` (exato ou prefixo único); se não der para saber (ex.: `auto_h`), a venda
  vai para "(conjunto não identificado)" em vez de inflar um conjunto. Verificado em
  04/11: 365d 8 · 7d 3 · 180d 3 · não identificado 3.
- **Status:** usar `status_pagamento` (paid/pending/voided/refunded), **não** a
  coluna `status` (open/closed/cancelled = status do pedido).
- **Histórico:** a aba `vendas` traz pedidos desde 2024; `DATE_MIN = "2026-11-01"`
  em `build/config.py` limita o dashboard ao período da Black Friday 2026.
- A aba **"Metas BF 2026"** da planilha de vendas **NÃO** é usada pelo build (é um
  painel de metas de faturamento). Bate com o build: 01/11 = 69 pedidos / R$ 21.472.

### Critério de MQL

Funil de e-commerce sem etapa de Leads/MQL — não há etapa de MQL nesta dashboard.

URL de export CSV: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv&gid={GID}`

### Métricas do funil (`build.py` + `template.html`)
`Gasto → Impressões → Cliques → Views da Página → Carrinhos → Checkouts → Compras → Faturamento`

Gasto · Impressões · CPM · Cliques · CPC · CTR · Views LP · **Custo/View** (Gasto/Views) ·
**Connect Rate** (Views/Cliques) · Carrinhos · **Custo/Carrinho** (Gasto/Carrinhos) ·
**Tx Carrinho** (Carrinhos/Views) · Checkouts · **Custo/Checkout** (Gasto/Checkouts) ·
**Tx Checkout** (Checkouts/Carrinhos) · Vendas · **Custo/Compra** = CAC (Gasto/Vendas) ·
**Tx Compra** (Vendas/Checkouts) · **Tx Conversão** (Vendas/Views) · Faturamento ·
ROAS (Faturamento/Gasto) · Ticket (Faturamento/Vendas).
A etapa Carrinho é lida da coluna `Adds to Cart` do Meta; se ela não existir, a engine
esconde as colunas de carrinho e a Tx Checkout volta a ser Checkouts/Views.

### Produto principal / atribuição
- **Produto principal** = `MAIN_PRODUCT_PREFIX` (definido em `build/config.py`) —
  neste cliente: **`"*"` — não há produto principal**; cada pedido pago = 1 venda
  (rótulo "Pedidos da loja"). A tabela "Vendas por produto" conta em quantos pedidos
  cada produto aparece.
- **Faturamento / ROAS** = soma de **todos os produtos** do funil (orderbumps/upsells).
- Uma venda entra no funil se: é o produto principal **OU** a combinação
  **`utm_campaign` + coluna de `AD_UTM_COLUMN`** (campanha + anúncio) casa com uma
  linha real do Meta (captura orderbumps/upsells que carregam a UTM do anúncio). O
  match exige campanha **e** anúncio juntos — nomes de anúncio (`AD01`, `AD02`...)
  podem se repetir entre campanhas diferentes; casar só pelo nome do anúncio
  atribuiria a venda à campanha errada. Quando casa, a venda herda a
  campanha/conjunto **reais do Meta** (fica na mesma linha do gasto nas tabelas) e
  recebe `meta=1` (é o que a aba Meta Ads considera tráfego pago). Vendas de outros
  funis (UTM/produto não relacionados) ficam de fora. Só conta status pago (ou todas
  as linhas, se `COUNT_ALL_AS_PAID = True`).
- Ecosmetics: como todo pedido pago é "produto principal", **toda venda paga entra no
  Total** (Visão Geral, qualquer origem: Meta, Google, influenciadores, orgânico); só as
  que casam campanha+anúncio com o Meta recebem `meta=1` e entram na aba Meta Ads.
- Se não houver coluna de Receita, não há Receita/ROAS/Ticket — ajuste o texto desta
  seção se o cliente tiver uma regra diferente.

### Imposto Meta Ads
Toggle ON aplica o `TAX_FACTOR` (definido em `build/config.py`) sobre os custos do Meta —
neste cliente **1,1215**. Metas da aba Relatórios: **ROAS 3,0** e **CAC R$ 99** (ticket
médio Meta de 01–02/11 ≈ R$ 297 ÷ 3; ajustar se o gestor definir um CAC próprio).

### Convenções de campanha
- Nomenclatura de campanha: `zenith_ecom_vendas_<DD-MM-AA de início>_<evento/tema>_<abo|cbo>_<estratégia>`
  (ex.: `zenith_ecom_vendas_01-11-26_black-friday-26_cbo_escala`,
  `..._abo_rmkt`, `..._abo_teste-criativos`, `..._cbo_bid-cap`, `zenith_ecom_vendas_01-11-26_catalogo`).
  Sigla do funil: **`zenith_ecom_vendas`** (todas as campanhas da aba Meta entram no dashboard).
- Nomenclatura de conjunto: `<auto|ig>_<gênero hm|h&m|m>_<faixa etária 25a64>_[br_]<público>`
  (ex.: `auto_hm_25a64_aberto-adv`, `auto_hm_25a64_engajamento-90D`,
  `auto_hm_25a64_visitantes-e-carrinhos-30D`, `auto_hm_25a64_clientes`).
- Nomenclatura de anúncio: `ADS<nº>[_RMKT]_<tema>_<formato>` (ex.: `ADS52_Black Friday_Loja_Out`,
  `ADS37_RMKT_Black Friday_Loja_Out`); catálogo: `CATÁLOGO ALL PRODUCTS`.
- Mapeamento UTM → Meta neste cliente (verificado nos dados):
  `utm_campaign → Campaign Name` · `utm_medium → Ad Set Name` ·
  `utm_content → Ad Name`.

O match com o Meta (campo `meta`, usado pela aba Meta Ads) exige `utm_campaign` +
a coluna de `AD_UTM_COLUMN` batendo com uma linha real do Meta; quando casa, a venda
herda a campanha/conjunto reais do Meta (para o gasto e a venda caírem na mesma linha
das tabelas).
## Mapa de calor de custos (aba Meta Ads — só na dashboard interna)

Tabelas por dia, campanha, conjunto e anúncio da aba Meta Ads: colunas **CPM, Custo/View,
Custo/Carrinho, Custo/Checkout e Custo/Compra** em vermelho (mais forte = mais caro),
cada coluna com a própria escala, **p10–p90** (custos extremos de poucos eventos não
achatam a cor). Configurado em `COST_HEAT_KEYS` no `build/app.js`.

## Vendas por origem (Visão Geral — só na dashboard interna)

Barras empilhadas de pedidos pagos por dia e por origem + tabela por origem (pedidos,
%, faturamento, ticket) com o detalhe de `utm_source` dentro de cada uma. Origem = coluna
`origem_detectada` da aba vendas (rótulos em `ORIGIN_LABELS` no `build/config.py`); se
vazia, usa o `utm_source`, senão "Sem origem". Os campos `org`/`src` **não** vão para o
HTML do cliente (`client_data()`). Verificado em 04/11: Meta 93 (meta-ads 71 ·
FacebookAds 17 · sem UTM 4 · ig 1) · Sem rastreio 51 · Google Ads 49 · E-mail 9 ·
Influenciador 7 · IG Shopping 1 · App Nuvemshop 1.

## Link do cliente (`/cliente/`)

`CLIENT_PAGE_DIR = "cliente"` em `build/config.py` faz o `build.py` gerar também
`dist/cliente/index.html` → **https://scale-ag.github.io/dash-ecos-bf2026/cliente/**
(sem senha; link para enviar ao cliente). Mostra só a Visão Geral (funil, evolução
diária, tabela por dia) + a tabela **Criativos** (por Ad Name): Gasto · CPM · CTR ·
**Hook Rate** (3s / Impressões) · **Hold Rate** (ThruPlays / 3s) · **Retenção 75%**
(Video Watches at 75% / 3s) · Vendas · ROAS + link do criativo. O HTML do cliente
leva **só** esses dados (`client_data()` no `build.py`): sem campanha/conjunto,
produtos, briefings nem Worker da IA.

## Clientes novos × recorrentes (Visão Geral — interna e `/cliente/`)

- **Novo** = 1ª compra paga na loja · **Recorrente** = já tinha compra paga antes —
  no histórico Nuvemshop (07/05/2024 → 31/10/2026, 9.831 clientes) **ou** mais cedo
  na própria aba vendas. Cards (qtd, % dos pedidos, faturamento, ticket) + barras
  empilhadas por dia com a linha % recorrentes.
- Cliente identificado pela coluna `cliente_id` da aba vendas
  (= `sha256(email minúsculo)[:16]`, verificado em 234/234 pedidos em comum).
- **Base histórica CIFRADA** em `build/clientes_hist.enc` (o repo é público): gerada
  localmente por `build/gerar_clientes_hist.py` a partir do export de Vendas da
  Nuvemshop (com a coluna E-mail — **nunca commitar esse CSV**). Conteúdo decifrado =
  só códigos `sha256(SALT + cliente_id)[:12]`, sem e-mail/nome/CPF. A chave fica no
  **Secret `CLIENTES_KEY`** do repositório; o `deploy.yml` a passa ao build. Sem o
  Secret o build segue normal e a seção fica escondida.
- Atualizar a base (ex.: novo export): `CLIENTES_KEY=<chave> python build/gerar_clientes_hist.py --csv Vendas.csv --ate AAAA-MM-DD` e commitar só o `.enc`.

## Quando e o que vende (Visão Geral — interna e `/cliente/`)

Seção abaixo do funil, seguindo o filtro de período (dados a partir de 01/11/2026):
- **Vendas por dia da semana** (Seg→Dom): vendas, faturamento, gasto Meta e ROAS.
- **Vendas por hora do dia** (coluna `hora` da aba vendas = hora do pedido na loja).
  **ROAS por hora** só aparece com gasto por hora do Meta: criar no Adveronix uma
  **aba separada** na planilha do Meta com detalhamento *Hour of day* (Day · Hour ·
  Amount Spent) e colocar o gid em `GID_META_HOURLY` (`build/config.py`). Não pôr
  a hora na aba Página1 (multiplica as linhas e quebra o match com as vendas).
- **Mapa de calor dia da semana × hora** (pedidos pagos; tooltip com faturamento).
- **Vendas por produto**: pedidos que contêm o produto, unidades (do "2x" em
  `produtos`) e % dos pedidos. Não há faturamento por produto: a planilha só traz o
  total do pedido.
- **Produtos mais vendidos para clientes novos** (logo abaixo): mesmo ranking, só com
  pedidos de clientes novos (`nr = 0`); some se a base de clientes (`CLIENTES_KEY`) faltar.
Vendas/Faturamento aqui = todos os pedidos pagos (todas as origens), como no funil.

## Aba Insights (interna e `/cliente/`) — produtos × clientes novos/recorrentes

Calculada no navegador sobre o período filtrado (atualiza a cada build). Só aparece com a
base de clientes (`CLIENTES_KEY`). Conteúdo: cards novos × recorrentes (pedidos, ticket,
produtos/unidades por pedido, % pedidos com 1 produto); **Principais leituras** (frases por
regras fixas, sem IA); **Análise de produtos** (pedidos novos/recorrentes, % sozinho entre
novos, perfil, # no histórico); **Combinações** mais compradas por novos.
- Perfis (mín. 5 pedidos no grupo, `INS_MIN` no `app.js`): **Entrada** = novos compram
  sozinho em ≥50% · **Complemento** = sozinho ≤25% · **Atrai novos** = participação entre
  novos ≥1,5× a dos recorrentes · **Recompra** = o inverso.
- **# no histórico**: `build/produtos_hist.enc` (cifrado, mesma chave; só a ORDEM dos
  nomes, sem quantidades), gerado junto com a base de clientes por `gerar_clientes_hist.py`.
  No export Nuvemshop só a 1ª linha do pedido tem data/status: contar produtos pelos
  pedidos pagos, nunca filtrando item por data (senão somem os itens 2+ do pedido).
- **Nomes com "|"** (ex.: "Ampola Cistina ... | Ecosmetics 12ml"): a coluna `produtos` usa
  "|" como separador; pedaço sem "Nx " é continuação do nome (`splitItems()` no `app.js`).

## IA Insights

Aba de análise por IA (Claude) do funil e das estruturas ativas — ver `SETUP-IA.md`
para o passo a passo completo de configuração do backend (Cloudflare Worker +
deploy automático via GitHub Actions).

**Persistência:** o último resultado gerado fica salvo no **Worker (KV namespace
`INSIGHTS_KV`)**, não no navegador — por isso qualquer visitante, em qualquer
navegador, vê os mesmos insights sem precisar gerar de novo. A URL do Worker vem
embutida no build (`IA_WORKER_URL` em `build/config.py`); a senha (`INSIGHTS_PASSWORD`)
só é exigida para **gerar** novos insights (POST), não para ler os já gerados
(GET, público). O workflow `deploy-worker.yml` cria o KV namespace sozinho no
primeiro deploy; se o `CLOUDFLARE_API_TOKEN` não tiver a permissão "Workers KV
Storage: Edit", ele publica o Worker sem persistência (volta ao comportamento
antigo, sem quebrar o deploy) e avisa no log do Actions.

## Arquitetura / arquivos

A dashboard é montada a partir de **arquivos separados** (visual x lógica), costurados
pelo `build.py` no `render()` — assim dá para mexer só em cor/layout sem tocar na lógica:

```
build/build.py             # ENGINE: lê os 2 CSVs (read-only), emite meta[]/sales[] e COSTURA os arquivos abaixo
build/config.py            # CONFIG DO CLIENTE (Ecosmetics — preenchido)
build/config.example.py    # modelo comentado de build/config.py
build/template.html        # esqueleto HTML (placeholders __STYLES__ / __APP_JS__ / __DATA_JSON__)
build/identidade-visual.css # ⭐ TODAS as cores (temas claro/escuro, paleta de gráficos, heatmap). Edite AQUI p/ mexer só em cor.
build/estilos.css          # layout/componentes (CSS não-cor)
build/app.js               # lógica + renderização (gráficos/heatmap leem as cores via CSS vars)
.github/workflows/deploy.yml         # roda build.py e publica no Pages
.github/workflows/deploy-worker.yml  # publica o Worker da IA Insights (Cloudflare)
.github/workflows/gerar-relatorios-metrics.yml # 23:50 BRT: busca as planilhas e commita relatorios_metrics.json
ia-worker/worker.js    # backend da aba IA Insights (ENGINE — não editar por cliente)
ia-worker/wrangler.toml # nome do Worker (ecosmetics-bf2026-ia-insights)
build/relatorios.json  # briefings do Gestor por período (aba Relatórios) — VERSIONADO (criado pela Routine; não vem no template)
build/relatorios_metrics.json # números por período (gerado pelo Actions, lido pela Routine) — VERSIONADO (criado pelo Actions; não vem no template)
build/gerar_relatorios.py # calcula as métricas por período (rodado pelo Actions, não pela Routine)
build/GUIA-RELATORIOS.md  # passo a passo da Routine que regenera os briefings
dist/index.html        # saída gerada (gitignored; o Actions reconstrói)
GUIA-REPLICACAO.md     # engine explicada + solução dos problemas de publicação
config.js               # metadados de publicação (GitHub) — scale-ag/dash-ecos-bf2026
config.example.js       # cópia vazia de config.js, para referência
AGENTS.md               # checklist + resumo para outros agentes (Codex etc.)
SETUP-CRON.md          # valores do cron-job.org (owner/repo com marcadores)
SETUP-IA.md            # passo a passo da aba IA Insights
```

### Aba Relatórios (relatórios automáticos do funil)
Aba entre **Meta Ads** e **IA Insights**. Reaproveita os filtros de data da topbar
e os dados já embutidos (`meta[]`/`sales[]`) — tudo calculado no navegador (custo
zero): cards **Visão Geral Total** (todas as vendas) e **Tráfego** (só Meta Ads),
tabela diária resumida (Total | Ads), visão por campanha, **Top 5 / Piores 5
anúncios** (com link do criativo via coluna *Creative Instagram Permalink* →
`ad_links`, se a planilha do cliente tiver essa coluna). **Código de cor**
(vermelho/amarelo/verde/ciano) só em **CAC** e **ROAS**, conforme
`CAC_TARGET`/`ROAS_TARGET` em `build/config.py` (desempenho = ROAS `valor/meta`,
CAC `meta/valor`).

O **Briefing do Gestor** (texto interpretativo por período) é **pré-gerado por IA**
e lido de `build/relatorios.json` — **sem chamada de API no navegador nem créditos
da Anthropic**. Regeneração em **2 etapas diárias** (o sandbox do agente não alcança
o Google Sheets, só o runner do GitHub Actions — ver "problemas conhecidos" #4):
**23:50 BRT** o workflow `gerar-relatorios-metrics.yml` busca as planilhas e commita
`build/relatorios_metrics.json` (só números); **23:59 BRT** uma **Routine do
Claude Code** lê esse arquivo, migra o texto que estava em "hoje" para "ontem" e
redige os 9 briefings do zero seguindo `build/GUIA-RELATORIOS.md`, commitando
`relatorios.json`. Rodar no fim do dia (não de manhã) garante que "hoje" seja
analisado com o dia quase completo. Se o JSON não existir, a aba mostra tudo
menos o briefing (cards/tabelas seguem funcionando). Configure essa Routine (ou
equivalente) por cliente — não vem pronta neste template.

O `build.py` **não agrega**: exporta as linhas cruas e toda a lógica (filtros, KPIs,
tabelas, gráficos, heatmap, imposto, tema) roda no navegador.

Teste local:
`python build/build.py --meta-file meta.csv --sales-file sales.csv --out dist/index.html`

## Publicação — problemas conhecidos e soluções

1. **Push com integração somente‑leitura:** se `git push`/MCP derem `403 Resource not
   accessible by integration`, faça push com o **PAT do usuário** direto ao github.com
   (`git push https://x-access-token:<TOKEN>@github.com/<owner>/<repo>.git main:main`).
   **Nunca** grave o token no `.git/config` (use a URL efêmera).
2. **cron-job.org só funciona na `main`:** `workflow_dispatch` só existe na branch padrão.
3. **Pages liga sozinho:** `actions/configure-pages@v5` com `enablement: true`
   (+ `permissions: {pages: write, id-token: write}`).
4. **Proxy do sandbox:** o agente NÃO alcança `docs.google.com`, `*.github.io` nem a API
   REST de Actions/Pages e nem `api.cloudflare.com` — mas o runner do Actions alcança
   tudo. Teste dados com CSV local; deploys da Cloudflare passam pelo GitHub Actions.
5. **Token exposto no chat:** revogar e gerar um novo (fine‑grained, só Actions: r/w no repo).
6. **"Senha incorreta" na aba IA Insights após um deploy:** normalmente indica que os
   secrets `ANTHROPIC_API_KEY`/`INSIGHTS_PASSWORD` não estão cadastrados como Secrets
   do repositório no GitHub — o workflow `deploy-worker.yml` os reaplica no Worker a
   cada deploy; sem eles cadastrados, o Worker fica sem senha válida.
7. **Insights "somem":** se estiverem salvos só no navegador (versões antigas do
   template), limpar dados do navegador apaga tudo. A partir desta versão a
   persistência é no Worker (KV) — ver seção "IA Insights" acima; confirme que
   `IA_WORKER_URL` está preenchido em `build/config.py` e que o log do deploy do Worker
   não mostrou o aviso de KV sem permissão.
9. **"A dash trava" / "não atualiza":** o build roda a cada 30 min e publica normalmente
   — confira em Actions antes de suspeitar do pipeline. Duas causas reais, ambas já
   corrigidas em `build/app.js`:
   - *Travar*: a versão antiga fazia `location.href=...` a cada 30 min, recarregando a
     página por cima do usuário. Filtros, seleção de campanha/anúncio e rolagem eram
     perdidos no meio da análise (parece travamento) e cada recarga empilhava uma
     entrada no histórico. Agora a página **não recarrega sozinha**: ela consulta a
     versão publicada e mostra um aviso "Novos dados publicados · Atualizar agora".
   - *Não atualizar*: as metatags `http-equiv="Cache-Control"` do `<head>` **não
     controlam o cache HTTP** — quem decide são os cabeçalhos da resposta, e no GitHub
     Pages não dá para defini-los. Abrir a URL "pelada" podia entregar uma cópia de
     cache mesmo com build novo publicado. O checador resolve isso comparando
     `<meta name="build">` (buscado com `cache:'no-store'`) com o `build_id` carregado.
   Para conferir qual build está na tela: rodapé do menu lateral (`build ...`) e
   "Última atualização" na topbar.
10. **Venda não aparece na aba Meta Ads (ou aparece na campanha errada):** confirme
   qual coluna UTM da planilha do cliente carrega o identificador real do anúncio do
   Meta (`Ad Name`) e ajuste `AD_UTM_COLUMN` em `build/config.py`. **Não assuma pela
   convenção** — há clientes em que é `utm_term` e o `utm_content` traz o
   posicionamento (`Instagram_Feed`/`Stories`); em outros é o contrário. Jeito rápido
   de decidir: contar, para cada coluna UTM, quantos valores batem exatamente com o
   conjunto de `Ad Name` do Meta — a coluna certa bate quase 100%, as outras batem 0.
   Casar pela coluna errada zera as atribuições. Além disso, nomes de anúncio podem se
   repetir entre campanhas diferentes — o match precisa ser **campanha+anúncio juntos**
   (`utm_campaign` + coluna de `AD_UTM_COLUMN`), senão a venda pode ser atribuída à campanha errada.
   Confira o valor real do `Ad Name` na API/painel do Meta e compare com as colunas
   UTM antes de mexer no alias.
