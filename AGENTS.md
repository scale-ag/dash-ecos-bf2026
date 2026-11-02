# AGENTS.md — Dashboard de Controle de Tráfego Pago (TEMPLATE)

> Instruções para agentes de código (Codex, Claude Code e afins). O contexto
> completo do projeto — fontes de dados, regra de atribuição, métricas,
> arquitetura e problemas conhecidos de publicação — está em **`CLAUDE.md`**:
> leia-o antes de mexer em qualquer coisa.

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

## Projeto

- **Cliente/funil:** <<PREENCHER: nome do cliente — nome do funil/lançamento>>
- **URL pública:** `<<PREENCHER: URL do GitHub Pages, ex.: https://<owner>.github.io/<repo>/>>`
- **Tipo de funil:** lançamento pago / tráfego direto —
  `Gasto → Impressões → Cliques → Page Views → Checkouts → Vendas → Faturamento`

## Regras para agentes

- **Engine x config:** não edite a engine por cliente (`build/build.py`,
  `build/template.html`, `build/app.js`, `build/estilos.css`,
  `build/identidade-visual.css`, `build/gerar_relatorios.py`,
  `ia-worker/worker.js`, `.github/workflows/*`, `GUIA-REPLICACAO.md`,
  `build/GUIA-RELATORIOS.md`). Valores do cliente vão em `build/config.py`,
  `config.js`, `ia-worker/wrangler.toml` e nos marcadores `<<PREENCHER>>` dos docs.
- **Somente leitura** das planilhas: o build só lê o export CSV público.
- **Nunca** grave tokens, chaves (`ANTHROPIC_API_KEY`), senha da IA Insights ou
  credenciais da Cloudflare em arquivos do repositório — elas vivem só nos
  Secrets do GitHub / Worker e no cron-job.org.
- Não commite `dist/`, CSVs de teste nem `.xlsx` (já estão no `.gitignore`).
- Teste local antes de commitar na `main`:
  `python build/build.py --meta-file meta.csv --sales-file sales.csv --out dist/index.html`
- Se `git push` der `403 Resource not accessible by integration`, avise o
  usuário antes de tentar qualquer contorno (ver `CLAUDE.md`, "Publicação —
  problemas conhecidos" #1) e **nunca** grave o token em `.git/config`.
