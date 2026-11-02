// Metadados de publicação (GitHub/infra) — TEMPLATE.
//
// Este arquivo NÃO é lido pelo dashboard em runtime (o app é um HTML estático
// gerado por build/build.py; os dados do funil e a senha da IA Insights são
// tratados separadamente — ver build/config.py e SETUP-IA.md). Ele serve como
// referência única para os valores que você repete manualmente nos marcadores
// <<PREENCHER: ...>> de SETUP-CRON.md, README.md, CLAUDE.md e AGENTS.md.
window.CONFIG = {
  // Usuário ou organização dona do repositório no GitHub.
  GITHUB_USERNAME: "<<PREENCHER: owner do GitHub (usuário ou organização)>>",

  // Nome do repositório do cliente no GitHub.
  GITHUB_REPOSITORY: "<<PREENCHER: nome do repositório do cliente>>",

  // Nome do projeto/cliente (referência em documentação).
  PROJECT_NAME: "<<PREENCHER: nome do cliente — nome do funil/lançamento>>",

  // Montado a partir de GITHUB_USERNAME/GITHUB_REPOSITORY acima — é a URL
  // pública que o dashboard terá depois de ativar o Pages.
  get PAGES_URL() {
    return `https://${this.GITHUB_USERNAME}.github.io/${this.GITHUB_REPOSITORY}/`;
  },
};
