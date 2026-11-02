# Ativação + configuração do cron-job.org

> owner/repo: `<<PREENCHER: owner do GitHub>>/<<PREENCHER: nome do repositório>>` · URL do Pages:
> `https://<<PREENCHER: owner do GitHub>>.github.io/<<PREENCHER: nome do repositório>>/` (mesmos valores de `config.js`). O **token
> nunca é comitado** no repositório: ele vai apenas no cron-job.org.

## Passo 1 — Colocar na branch `main` (uma vez)

`workflow_dispatch` (o que o cron-job.org chama) **só existe na branch padrão**.
Confirme que `.github/workflows/deploy.yml` já está na `main`.

⚠️ **O Pages precisa ser ligado uma vez, na mão.** O workflow tenta ligá-lo
sozinho (`actions/configure-pages` com `enablement: true`), mas o `GITHUB_TOKEN`
do Actions não tem permissão para **criar** o site do Pages — o passo falha com
`Create Pages site failed: Resource not accessible by integration`. Criar o site
exige permissão de **administração do repositório**, que o token do Actions não
tem por design (não é questão de escopo do workflow: o passo que precisa de
`contents: write` funciona normalmente).

Ligue uma vez em **Settings → Pages → Build and deployment → Source: GitHub
Actions** e re-execute o workflow. A partir daí todos os builds seguintes
publicam sozinhos.

URL pública após publicar: `https://<<PREENCHER: owner do GitHub>>.github.io/<<PREENCHER: nome do repositório>>/`

Disparar a 1ª execução na mão: aba **Actions** → *Build & Deploy Dashboard* → **Run workflow**.

## Passo 2 — Token (fine-grained, recomendado)

GitHub → *Settings* → *Developer settings* → **Fine-grained tokens** → *Generate*:
- Repository access: **Only select repositories → `<<PREENCHER: nome do repositório>>`**
- Permissions → **Actions: Read and write**

Guarde o token; ele vai só no cron-job.org.

## Passo 3 — Criar o cron job em https://cron-job.org

### URL
```
https://api.github.com/repos/<<PREENCHER: owner do GitHub>>/<<PREENCHER: nome do repositório>>/actions/workflows/deploy.yml/dispatches
```
### Método
```
POST
```
### Schedule
```
A cada 30 minutos  (Every 30 minutes)
```
### Headers (um por linha)
```
Accept: application/vnd.github+json
```
```
Authorization: Bearer <<PREENCHER: token fine-grained do Passo 2 — só no cron-job.org, nunca no repo>>
```
```
X-GitHub-Api-Version: 2022-11-28
```
```
Content-Type: application/json
```
### Request body
```
{"ref":"main"}
```

## Como saber se funcionou
- Resposta esperada da API: **HTTP 204 No Content**.
- Em **Actions** aparece uma nova execução a cada disparo.
- 401/403 = token errado/sem permissão **Actions: write**.
- 404 = confira owner/repo/nome do arquivo (`deploy.yml`) e se está na `main`.
- 422 = o workflow ainda não está na `main`.

## Observações
- A página lê as planilhas **somente leitura**; nunca escreve nelas.
- O `schedule` nativo (`*/30 * * * *`) fica como backup; o cron-job.org é a fonte
  principal de pontualidade.
