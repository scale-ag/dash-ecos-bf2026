# CLAUDE.md — Dashboard de Controle de Tráfego Pago (TEMPLATE)

> Este arquivo é lido automaticamente pelo Claude Code ao abrir o repositório.
> **TEMPLATE** — configurado para o cliente **<<PREENCHER: nome do cliente>>**
> (funil "<<PREENCHER: nome do funil/lançamento>>", sigla `<<PREENCHER: sigla do funil usada nas campanhas>>`).
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

- **URL pública:** `<<PREENCHER: URL do GitHub Pages, ex.: https://<owner>.github.io/<repo>/>>`
- **Cliente/projeto:** <<PREENCHER: nome do cliente — nome do funil/lançamento>>
  (rótulos exibidos vêm de `CLIENT_NAME`/`CLIENT_SUB` em `build/config.py`)
- **Tipo de funil:** lançamento pago / tráfego direto (não há etapa de Leads/MQL) —
  `Gasto → Impressões → Cliques → Page Views → Checkouts → Vendas → Faturamento`

## Fontes de dados (Google Sheets)

Leitura via export CSV, **somente leitura**. Por padrão Meta Ads e Compradores
ficam na mesma planilha (mudam só os gids); se o cliente usar duas planilhas,
preencha também `SPREADSHEET_ID_SALES` em `build/config.py`.

| Fonte | Planilha (`SPREADSHEET_ID*`) | gid | Aba |
|-------|------------------------------|-----|-----|
| **Meta Ads** | `<<PREENCHER: SPREADSHEET_ID>>` | `<<PREENCHER: GID_META>>` | <<PREENCHER: nome da aba Meta Ads>> |
| **Compradores** | `<<PREENCHER: SPREADSHEET_ID_SALES ou o mesmo SPREADSHEET_ID>>` | `<<PREENCHER: GID_SALES>>` | <<PREENCHER: nome da aba de Compradores/Vendas>> |

**Colunas reais — Meta Ads** (o `header_index` do `build.py` casa por nome, a
ordem não importa):
<<PREENCHER: lista das colunas da aba Meta Ads, ex.: Day · Campaign Name · Ad Set Name · Ad Name · Amount Spent · Impressions · Link Clicks · Landing Page Views · Checkouts Initiated>>

**Colunas reais — Compradores** (as usadas pelo build: data, nome, e-mail,
produto, valor/faturamento, utm_campaign, utm_medium, coluna de `AD_UTM_COLUMN`,
status se houver):
<<PREENCHER: lista das colunas da aba de Compradores e qual delas é a receita>>

### Pontos de atenção deste cliente

<<PREENCHER: particularidades verificadas na planilha (data da verificação) —
ex.: qual coluna UTM carrega o Ad Name e quantos valores batem com o Meta,
janelas de data sem sobreposição, ausência de coluna de status, coluna de
receita (bruta/líquida), ausência da coluna de permalink do criativo, abas que
NÃO devem ser usadas. Apague este bloco se não houver nada a registrar.>>

### Critério de MQL

Funil de lançamento pago sem etapa de Leads/MQL. <<PREENCHER: confirmar com o
gestor se há critério de MQL; se não houver, manter "não há etapa de MQL nesta dashboard".>>

URL de export CSV: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv&gid={GID}`

### Métricas do funil (`build.py` + `template.html`)
`Gasto → Impressões → Cliques → Page Views → Checkouts → Vendas → Faturamento`

Gasto · Impressões · CPM · Cliques · CPC · CTR · Page Views · CPV · CR (Cliques/PageViews) ·
Checkouts · CPIC · VisCHK (Checkouts/PageViews) · Vendas · CAC (Gasto/Vendas) ·
ConvCHK (Vendas/Checkouts) · Faturamento · ROAS (Faturamento/Gasto) · Ticket (Faturamento/Vendas).

### Produto principal / atribuição
- **Produto principal** = `MAIN_PRODUCT_PREFIX` (definido em `build/config.py`) —
  neste cliente: <<PREENCHER: nome do produto principal como aparece na planilha>>.
  Base de **Vendas / CAC / ConvCHK / Ticket**.
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
- <<PREENCHER: regra de atribuição específica deste cliente, se diferente da padrão acima; senão apague esta linha.>>
- Se não houver coluna de Receita, não há Receita/ROAS/Ticket — ajuste o texto desta
  seção se o cliente tiver uma regra diferente.

### Imposto Meta Ads
Toggle ON aplica o `TAX_FACTOR` (definido em `build/config.py`) sobre os custos do Meta.

### Convenções de campanha
- Nomenclatura de campanha: `<<PREENCHER: padrão do nome de campanha, ex.: SIGLA | ETAPA | TEMPERATURA | ...>>`
- Nomenclatura de conjunto: `<<PREENCHER: padrão do nome de conjunto>>`
- Nomenclatura de anúncio: `<<PREENCHER: padrão do nome de anúncio>>`
- Mapeamento UTM → Meta neste cliente (verificado nos dados):
  `utm_campaign → Campaign Name` · `utm_medium → Ad Set Name` ·
  `<<PREENCHER: coluna de AD_UTM_COLUMN>> → Ad Name`.

O match com o Meta (campo `meta`, usado pela aba Meta Ads) exige `utm_campaign` +
a coluna de `AD_UTM_COLUMN` batendo com uma linha real do Meta; quando casa, a venda
herda a campanha/conjunto reais do Meta (para o gasto e a venda caírem na mesma linha
das tabelas).
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
build/config.py            # CONFIG DO CLIENTE (troque os marcadores <<PREENCHER>>)
build/config.example.py    # modelo comentado de build/config.py
build/template.html        # esqueleto HTML (placeholders __STYLES__ / __APP_JS__ / __DATA_JSON__)
build/identidade-visual.css # ⭐ TODAS as cores (temas claro/escuro, paleta de gráficos, heatmap). Edite AQUI p/ mexer só em cor.
build/estilos.css          # layout/componentes (CSS não-cor)
build/app.js               # lógica + renderização (gráficos/heatmap leem as cores via CSS vars)
.github/workflows/deploy.yml         # roda build.py e publica no Pages
.github/workflows/deploy-worker.yml  # publica o Worker da IA Insights (Cloudflare)
.github/workflows/gerar-relatorios-metrics.yml # 23:50 BRT: busca as planilhas e commita relatorios_metrics.json
ia-worker/worker.js    # backend da aba IA Insights (ENGINE — não editar por cliente)
ia-worker/wrangler.toml # nome do Worker (marcador <<PREENCHER>> no campo name)
build/relatorios.json  # briefings do Gestor por período (aba Relatórios) — VERSIONADO (criado pela Routine; não vem no template)
build/relatorios_metrics.json # números por período (gerado pelo Actions, lido pela Routine) — VERSIONADO (criado pelo Actions; não vem no template)
build/gerar_relatorios.py # calcula as métricas por período (rodado pelo Actions, não pela Routine)
build/GUIA-RELATORIOS.md  # passo a passo da Routine que regenera os briefings
dist/index.html        # saída gerada (gitignored; o Actions reconstrói)
GUIA-REPLICACAO.md     # engine explicada + solução dos problemas de publicação
config.js               # metadados de publicação (GitHub) — marcadores <<PREENCHER>>
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
