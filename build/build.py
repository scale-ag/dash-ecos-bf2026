#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dashboard de Controle de Tráfego Pago — Funil VSL/tráfego direto (Meta Ads × Compradores).
Os valores do cliente (planilha, produto, taxa, rótulos, metas, worker da IA)
ficam em `build/config.py` — veja `build/config.example.py` para o modelo e
comentários de cada campo. Este arquivo (build.py) é a ENGINE, genérica para
qualquer cliente; não deve ser editado por cliente.

Lê duas abas de uma planilha Google (export CSV público) e emite os REGISTROS
BRUTOS (meta[] / sales[]) dentro do HTML. Todo o cálculo/filtro/gráfico roda no
navegador (ver build/template.html). Somente leitura; nunca escreve nas planilhas.

Funil de tráfego direto (VSL ou e-commerce) — não há etapa de "Leads"/"MQL":
    Gasto → Impressões → Cliques → Page Views → [Carrinhos] → Checkouts → Vendas → Faturamento
(a etapa Carrinhos usa a coluna "Adds to Cart" do Meta, se existir.)

Teste local: python build/build.py --meta-file meta.csv --sales-file sales.csv --out dist/index.html
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone, timedelta

try:
    import config as cfg
except ImportError:
    sys.exit(
        "ERRO: build/config.py não encontrado.\n"
        "Copie o modelo e preencha os valores do cliente:\n"
        "    cp build/config.example.py build/config.py\n"
        "Veja os comentários em cada campo de build/config.example.py."
    )

_REQUIRED = ("SPREADSHEET_ID", "GID_META", "GID_SALES", "MAIN_PRODUCT_PREFIX",
             "CLIENT_NAME", "MAIN_PRODUCT")
_missing = [name for name in _REQUIRED if not getattr(cfg, name, "")]
if _missing:
    sys.exit(
        "ERRO: build/config.py está com campo(s) obrigatório(s) vazio(s): "
        + ", ".join(_missing) + ".\n"
        "Preencha build/config.py antes de rodar o build (ver build/config.example.py)."
    )

# Template: qualquer campo de texto que ainda tenha o marcador <<PREENCHER ...>>
# interrompe o build com uma mensagem clara (em vez de um 404 da planilha).
_pendentes = [name for name in dir(cfg)
              if name.isupper() and isinstance(getattr(cfg, name), str)
              and "<<PREENCHER" in getattr(cfg, name)]
if _pendentes:
    sys.exit(
        "ERRO: build/config.py ainda tem marcador(es) <<PREENCHER>> em: "
        + ", ".join(sorted(_pendentes)) + ".\n"
        "Siga o CHECKLIST DE NOVO CLIENTE no topo do CLAUDE.md."
    )

SPREADSHEET_ID = cfg.SPREADSHEET_ID
# Compradores pode estar em OUTRA planilha (cliente com 2 arquivos separados).
# Ausente/vazio -> mesma planilha do Meta Ads (comportamento original).
SPREADSHEET_ID_SALES = getattr(cfg, "SPREADSHEET_ID_SALES", "") or SPREADSHEET_ID
GID_META = cfg.GID_META
GID_SALES = cfg.GID_SALES
TAX_FACTOR = cfg.TAX_FACTOR
MAIN_PRODUCT_PREFIX = cfg.MAIN_PRODUCT_PREFIX
COUNT_ALL_AS_PAID = cfg.COUNT_ALL_AS_PAID
CLIENT_NAME = cfg.CLIENT_NAME
CLIENT_SUB = cfg.CLIENT_SUB
TAX_LABEL = cfg.TAX_LABEL
MAIN_PRODUCT = cfg.MAIN_PRODUCT
CAC_TARGET = cfg.CAC_TARGET
ROAS_TARGET = cfg.ROAS_TARGET
REPORT_BAND_LOW = cfg.REPORT_BAND_LOW
REPORT_BAND_HIGH = cfg.REPORT_BAND_HIGH
IA_WORKER_URL = cfg.IA_WORKER_URL
# Qual coluna UTM da planilha de Compradores carrega o Ad Name do Meta.
# Varia por cliente conforme o parametrizador de URL usado no anuncio:
# uns mandam o nome do anuncio em utm_content, outros em utm_term (e ai o
# utm_content costuma trazer o POSICIONAMENTO). Ausente/vazio -> utm_content
# (padrao do template). Casar pela coluna errada zera as atribuicoes.
_AD_UTM_VALIDAS = ("utm_content", "utm_term", "utm_medium")
AD_UTM_COLUMN = getattr(cfg, "AD_UTM_COLUMN", "") or "utm_content"
if AD_UTM_COLUMN not in _AD_UTM_VALIDAS:
    sys.exit(
        f"ERRO: AD_UTM_COLUMN={AD_UTM_COLUMN!r} em build/config.py nao e valido.\n"
        "Use um de: " + ", ".join(_AD_UTM_VALIDAS) + "."
    )
# MAIN_PRODUCT_PREFIX = "*" -> todo pedido conta como venda (e-commerce: não há
# produto principal; a "venda" é o pedido, qualquer que seja o produto).
ALL_PRODUCTS_MAIN = MAIN_PRODUCT_PREFIX.strip() == "*"
# Sobrescreve os aliases de colunas da aba de Compradores (por chave interna:
# created, name, email, prod, val, utm_*, status). Lista vazia = coluna ausente.
SALES_COLUMNS = getattr(cfg, "SALES_COLUMNS", {}) or {}
# Descarta linhas (Meta e vendas) anteriores a esta data (YYYY-MM-DD). Vazio = tudo.
DATE_MIN = (getattr(cfg, "DATE_MIN", "") or "").strip()
# Página enxuta para o CLIENTE (Visão Geral + tabela de criativos), publicada em
# <saída>/<CLIENT_PAGE_DIR>/index.html. Vazio = não gera.
CLIENT_PAGE_DIR = (getattr(cfg, "CLIENT_PAGE_DIR", "") or "").strip().strip("/")
# OPCIONAL — aba do Meta com gasto por HORA (detalhamento "Hour of day" no
# Adveronix: Day · Hour · Amount Spent). Habilita o ROAS por hora. Vazio = sem.
GID_META_HOURLY = (getattr(cfg, "GID_META_HOURLY", "") or "").strip()

EXPORT_URL = "https://docs.google.com/spreadsheets/d/{sid}/export?format=csv&gid={gid}"
META_CSV_URL = EXPORT_URL.format(sid=SPREADSHEET_ID, gid=GID_META)
SALES_CSV_URL = EXPORT_URL.format(sid=SPREADSHEET_ID_SALES, gid=GID_SALES)
META_HOURLY_CSV_URL = EXPORT_URL.format(sid=SPREADSHEET_ID, gid=GID_META_HOURLY) if GID_META_HOURLY else ""
BRT = timezone(timedelta(hours=-3))   # horário de Brasília (exibição)


# --------------------------------------------------------------------------- #
# Leitura (só leitura das planilhas)
# --------------------------------------------------------------------------- #
def fetch_csv(url: str) -> list[list[str]]:
    req = urllib.request.Request(url, headers={"User-Agent": "dash-vsl-bot/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    return list(csv.reader(io.StringIO(raw)))


def read_csv_file(path: str) -> list[list[str]]:
    with open(path, "r", encoding="utf-8", errors="replace", newline="") as f:
        return list(csv.reader(f))


def load_rows(url: str, local: str | None) -> list[list[str]]:
    return read_csv_file(local) if local else fetch_csv(url)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm(s: str | None) -> str:
    return strip_accents((s or "").strip().lower())


def to_float(v) -> float:
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^\d,.\-]", "", str(v).strip())
    if not s:
        return 0.0
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_date(v: str) -> str | None:
    if not v:
        return None
    s = str(v).strip()
    if not s:
        return None
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%d/%m/%y", "%b %d, %Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_hour(v: str):
    """'14:40', '14:40:55', '2026-11-01 14:40:55', '14:00:00 - 14:59:59', '14' -> 14."""
    s = str(v or "").strip()
    m = re.search(r"(?:^|\s|T)(\d{1,2}):\d{2}", s) or re.fullmatch(r"(\d{1,2})", s)
    if not m:
        return None
    h = int(m.group(1))
    return h if 0 <= h <= 23 else None


def is_test_row(rowtext: str) -> bool:
    return "<test lead" in rowtext.lower()


def is_paid(status: str) -> bool:
    """Considera venda apenas status pago/aprovado. Sem coluna Status -> conta."""
    sn = norm(status)
    if not sn:
        return True
    return any(k in sn for k in ("pag", "aprov", "paid", "conclu", "complet", "ativ"))


def is_main_product(prod: str) -> bool:
    if ALL_PRODUCTS_MAIN:
        return True
    return norm(prod).startswith(MAIN_PRODUCT_PREFIX)


# ----- Máscara de PII (a página publicada é pública) ----- #
def mask_email(e: str) -> str:
    e = (e or "").strip()
    if "@" not in e:
        return "—"
    user, dom = e.split("@", 1)
    keep = user[:2] if len(user) > 2 else user[:1]
    return f"{keep}****@{dom}"


def first_last_initial(name: str) -> str:
    parts = (name or "").strip().split()
    if not parts:
        return "—"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][:1]}."


# --------------------------------------------------------------------------- #
# Indexação de colunas (por nome, com fallback posicional)
# --------------------------------------------------------------------------- #
def header_index(header, wanted, fallback):
    idx = {}
    hn = [norm(h) for h in header]
    for key, aliases in wanted.items():
        found = None
        # 1ª passada: nome EXATO (evita "total" casar com "subtotal", "status"
        # com "status_pagamento" etc.); 2ª passada: nome contido no cabeçalho.
        for exact in (True, False):
            for a in aliases:
                a = norm(a)
                for i, h in enumerate(hn):
                    if h == a or (not exact and a and a in h):
                        found = i
                        break
                if found is not None:
                    break
            if found is not None:
                break
        idx[key] = found if found is not None else fallback.get(key)
    return idx


def cell(row, i):
    if i is None or i < 0 or i >= len(row):
        return ""
    return (row[i] or "").strip()


# --------------------------------------------------------------------------- #
# Processamento -> registros brutos
# --------------------------------------------------------------------------- #
def process(meta_rows, sales_rows):
    # ---------------- Aba META ADS ----------------
    # Colunas reais: Day · Campaign Name · Ad Set Name · Ad Name · Amount Spent ·
    #   Impressions · Link Clicks · Landing Page Views · Checkouts Initiated · ...
    mheader = meta_rows[0] if meta_rows else []
    midx = header_index(
        mheader,
        {"day": ["day", "data"], "campaign": ["campaign name", "campaign"],
         "adset": ["ad set name", "adset", "ad set"], "ad": ["ad name"],
         "spent": ["amount spent", "valor gasto", "gasto"], "impr": ["impressions", "impress"],
         "clicks": ["link clicks", "clicks", "cliques"],
         "pv": ["landing page views", "page views", "pageview", "landing"],
         "atc": ["adds to cart", "add to cart", "adicoes ao carrinho", "carrinho"],
         # Métricas de vídeo (criativos): Hook = 3s/Impressões · Hold = ThruPlays/3s ·
         # Retenção 75% = plays a 75%/3s. Opcionais (ausentes -> 0).
         "v3": ["3-second video views", "3-second video plays", "video plays 3s", "3-second"],
         "thru": ["thruplays", "thruplay"],
         "p75": ["video watches at 75%", "video plays at 75%", "video p75"],
         "ck": ["checkouts initiated", "checkouts", "initiate checkout", "checkout"],
         # Link do criativo no Instagram (coluna acrescentada pelo cliente na aba
         # Meta Ads). Usada na aba Relatórios (Top/Piores anúncios) para linkar o
         # anúncio. Aliases cobrem variações do cabeçalho.
         "link": ["creative instagram permalink", "instagram permalink", "permalink",
                  "creative link", "link do anuncio", "link do criativo"]},
        {"day": 0, "campaign": 1, "adset": 2, "ad": 3, "spent": 4, "impr": 5,
         "clicks": 6, "pv": 7, "ck": 8},
    )

    meta = []
    # (campanha, anúncio) normalizados -> (campanha, conjunto) reais do Meta.
    # A chave inclui a CAMPANHA porque o mesmo nome de anúncio (ex. "AD01") se
    # repete em campanhas diferentes; casar só pelo nome do anúncio atribuiria a
    # venda à campanha errada. Guardar os nomes
    # do Meta também alinha a venda à mesma linha do gasto nas tabelas.
    ad_map = {}
    # Anúncio (nome, ex. "AD01") -> 1 permalink do Instagram. "Qualquer um
    # correlato" ao anúncio serve (o mesmo criativo pode rodar em várias
    # campanhas); guardamos o primeiro link não-vazio encontrado.
    ad_links = {}
    for row in meta_rows[1:]:
        if not any((c or "").strip() for c in row):
            continue
        if is_test_row(" ".join(str(c) for c in row)):
            continue
        mday = parse_date(cell(row, midx["day"]))
        if DATE_MIN and mday and mday < DATE_MIN:
            continue
        camp = cell(row, midx["campaign"]) or "(sem campanha)"
        adset = cell(row, midx["adset"]) or "(sem conjunto)"
        ad = cell(row, midx["ad"]) or "(sem anúncio)"
        key = (norm(camp), norm(ad))
        if key not in ad_map:
            ad_map[key] = (camp, adset)
        link = cell(row, midx["link"])
        if link and ad not in ad_links:
            ad_links[ad] = link
        meta.append({
            "d": mday,
            "camp": camp, "adset": adset, "ad": ad,
            "sp": round(to_float(cell(row, midx["spent"])), 4),
            "im": to_float(cell(row, midx["impr"])),
            "cl": to_float(cell(row, midx["clicks"])),
            "pv": to_float(cell(row, midx["pv"])),
            "atc": to_float(cell(row, midx["atc"])) if midx["atc"] is not None else 0.0,
            "ck": to_float(cell(row, midx["ck"])),
            "v3": to_float(cell(row, midx["v3"])) if midx["v3"] is not None else 0.0,
            "thru": to_float(cell(row, midx["thru"])) if midx["thru"] is not None else 0.0,
            "p75": to_float(cell(row, midx["p75"])) if midx["p75"] is not None else 0.0,
        })

    # ---------------- Aba COMPRADORES ----------------
    # Colunas reais: Data de Criação · Cliente / Nome · Cliente / E-mail · Produto ·
    #   Valor da Venda · UTM Content · UTM Campaign · UTM Medium · UTM Source · Status
    sheader = sales_rows[0] if sales_rows else []
    swanted = {"created": ["data de criacao", "data", "created", "created_time"],
         "name": ["cliente / nome", "nome", "full_name"],
         "email": ["cliente / e-mail", "e-mail", "email"],
         "prod": ["produto", "product"],
         # Receita do funil = coluna "Faturamento" (Valor + orderbumps por comprador),
         # por isso "faturamento" vem ANTES de "valor" nos aliases.
         "val": ["faturamento", "valor da venda", "valor", "value", "amount"],
         "hour": ["hora", "hour", "horario"],
         "utm_content": ["utm content", "utm_content"],
         "utm_term": ["utm term", "utm_term"],
         "utm_campaign": ["utm campaign", "utm_campaign"],
         "utm_medium": ["utm medium", "utm_medium"],
         "status": ["status"]}
    sfallback = {"created": 3, "name": 1, "email": 2, "prod": 0, "val": 6}
    # Overrides do cliente (build/config.py -> SALES_COLUMNS): lista de nomes
    # de coluna; lista vazia = coluna inexistente (sem fallback posicional).
    for k, v in SALES_COLUMNS.items():
        swanted[k] = list(v)
        sfallback.pop(k, None)
    sidx = header_index(
        sheader,
        swanted,
        # Fallback posicional só p/ colunas que existem nesta planilha
        # (Produto·Nome·Email·Data·Valor·Taxas·Faturamento). Sem fallback p/
        # utm_*/status: a planilha não tem essas colunas, então ausência -> vazio
        # (evita casar por posição com Taxas/Faturamento). Se um dia houver colunas
        # UTM nomeadas, o match por nome acima as detecta normalmente.
        sfallback,
    )
    for k, v in SALES_COLUMNS.items():
        if not v:
            sidx[k] = None

    sales = []
    for row in sales_rows[1:]:
        if not any((c or "").strip() for c in row):
            continue
        if is_test_row(" ".join(str(c) for c in row)):
            continue
        if not COUNT_ALL_AS_PAID and not is_paid(cell(row, sidx["status"])):
            continue
        sday = parse_date(cell(row, sidx["created"]))
        if DATE_MIN and sday and sday < DATE_MIN:
            continue
        prod = cell(row, sidx["prod"])
        # O identificador do anúncio no Meta (Ad Name) vem da coluna UTM apontada
        # por AD_UTM_COLUMN em build/config.py — que coluna é depende do
        # parametrizador de URL do cliente. A outra normalmente carrega o
        # POSICIONAMENTO (Instagram_Feed/Stories, Facebook_Mobile_Feed), que não
        # casa com nada do Meta; conferir antes de mudar.
        ad = cell(row, sidx[AD_UTM_COLUMN]) or "(sem anúncio)"
        sale_camp = cell(row, sidx["utm_campaign"]) or "(sem campanha)"
        main = is_main_product(prod)
        # Match com o Meta = campanha + anúncio juntos (o mesmo Ad Name se repete
        # entre campanhas; casar só pelo anúncio atribui a venda à campanha errada).
        meta_key = (norm(sale_camp), norm(ad))
        meta_hit = ad_map.get(meta_key)
        # Atribuição ao tráfego rastreado: produto principal OU par campanha+anúncio
        # que existe no Meta (captura orderbumps/upsells que carregam a UTM do anúncio).
        attributed = main or (meta_hit is not None)
        if not attributed:
            continue
        # Quando casa com o Meta, usa a campanha/conjunto REAIS do Meta (mantém a
        # venda na mesma linha do gasto nas tabelas). Senão, usa as UTMs da venda.
        if meta_hit is not None:
            camp, adset = meta_hit
        else:
            camp = sale_camp
            adset = cell(row, sidx["utm_medium"]) or "(sem conjunto)"
        sales.append({
            "d": sday,
            "camp": camp, "adset": adset, "ad": ad,
            "prod": prod or "—",
            "h": parse_hour(cell(row, sidx["hour"])),
            "val": round(to_float(cell(row, sidx["val"])), 2),
            "main": 1 if main else 0,
            # meta=1 quando a venda casa com campanha+anúncio real do Meta (tráfego
            # pago). Vendas do produto principal sem esse match (orgânico/direto, ou
            # UTM sem anúncio identificável) têm meta=0.
            "meta": 1 if meta_hit is not None else 0,
            "nm": first_last_initial(cell(row, sidx["name"])),
            "em": mask_email(cell(row, sidx["email"])),
        })

    dates = sorted({d for d in ([m["d"] for m in meta if m["d"]] + [s["d"] for s in sales if s["d"]])})
    now_brt = datetime.now(BRT)
    return {
        "build": {
            "generated_at_brt": now_brt.strftime("%d/%m/%Y %H:%M"),
            "build_id": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
            "today": now_brt.strftime("%Y-%m-%d"),
            "date_min": dates[0] if dates else None,
            "date_max": dates[-1] if dates else None,
            "tax_factor": TAX_FACTOR,
            "client_name": CLIENT_NAME,
            "client_sub": CLIENT_SUB,
            "tax_label": TAX_LABEL,
            "main_product": MAIN_PRODUCT,
            "main_product_prefix": MAIN_PRODUCT_PREFIX,
            "all_products_main": ALL_PRODUCTS_MAIN,
            "has_atc": midx["atc"] is not None,
            "has_video": midx["v3"] is not None,
            "client_mode": False,
            "ia_worker_url": IA_WORKER_URL,
            # Metas da aba Relatórios (código de cor de CAC/ROAS)
            "cac_target": CAC_TARGET,
            "roas_target": ROAS_TARGET,
            "report_band_low": REPORT_BAND_LOW,
            "report_band_high": REPORT_BAND_HIGH,
        },
        "meta": meta,
        "sales": sales,
        "ad_links": ad_links,
        # Briefings do Gestor por período (gerados por IA 1x/dia via Routine e
        # salvos em build/relatorios.json). Preenchido em process()/main via
        # load_briefings(); fica {} se o arquivo não existir.
        "briefings": {},
    }


# --------------------------------------------------------------------------- #
# Briefings do Gestor (aba Relatórios) — texto gerado por IA 1x/dia
# --------------------------------------------------------------------------- #
def load_briefings(path: str) -> dict:
    """Lê build/relatorios.json (gerado pela Routine diária). Estrutura:
        {"generated_at": "...", "periodos": {"<preset>": {...}, ...}}
    Retorna o dict de períodos (ou {} se o arquivo não existir/for inválido).
    A geração NÃO acontece aqui — este build só lê o texto já pronto, sem
    chamar nenhuma API (custo zero no build/no navegador)."""
    if not path or not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            obj = json.load(f)
        return obj if isinstance(obj, dict) else {}
    except (ValueError, OSError):
        return {}


# --------------------------------------------------------------------------- #
# Gasto por hora (opcional) -> ROAS por hora
# --------------------------------------------------------------------------- #
def process_hourly(rows):
    """Agrega a aba horária do Meta em [{d, h, sp}] (soma de todas as campanhas)."""
    if not rows:
        return []
    idx = header_index(
        rows[0],
        {"day": ["day", "data", "date"],
         "hour": ["hour of day", "time of day", "hourly stats", "hour", "hora"],
         "spent": ["amount spent", "valor gasto", "gasto", "spend"]},
        {},
    )
    if idx["day"] is None or idx["hour"] is None or idx["spent"] is None:
        print("AVISO: aba de gasto por hora sem colunas Day/Hour/Amount Spent — ignorada.", file=sys.stderr)
        return []
    agg = {}
    for row in rows[1:]:
        d = parse_date(cell(row, idx["day"]))
        h = parse_hour(cell(row, idx["hour"]))
        if not d or h is None or (DATE_MIN and d < DATE_MIN):
            continue
        agg[(d, h)] = agg.get((d, h), 0.0) + to_float(cell(row, idx["spent"]))
    return [{"d": d, "h": h, "sp": round(sp, 4)} for (d, h), sp in sorted(agg.items())]


# --------------------------------------------------------------------------- #
# Página do cliente — só os dados que a Visão Geral + criativos usam
# --------------------------------------------------------------------------- #
def client_data(data: dict) -> dict:
    """Cópia enxuta para o link do cliente: sem campanha/conjunto, sem produtos,
    sem nome/e-mail, sem briefings nem Worker da IA. O que não está no HTML não
    pode ser visto nem pelo código-fonte da página."""
    b = dict(data["build"], client_mode=True, ia_worker_url="")
    meta = [{k: v for k, v in m.items() if k not in ("camp", "adset")} for m in data["meta"]]
    sales = [{"d": s["d"], "h": s.get("h"), "prod": s["prod"], "ad": s["ad"] if s["meta"] else "",
              "val": s["val"], "main": s["main"], "meta": s["meta"]} for s in data["sales"]]
    used_ads = {m["ad"] for m in meta}
    links = {k: v for k, v in data.get("ad_links", {}).items() if k in used_ads}
    return {"build": b, "meta": meta, "sales": sales, "meta_h": data.get("meta_h", []),
            "ad_links": links, "briefings": {}}


# --------------------------------------------------------------------------- #
# Render
# --------------------------------------------------------------------------- #
def render(data, template_path):
    # A dashboard é montada a partir de arquivos separados (visual x lógica):
    #   template.html          -> esqueleto HTML (com placeholders __STYLES__/__APP_JS__)
    #   identidade-visual.css  -> TODAS as cores (edite aqui p/ mexer só em cor)
    #   estilos.css            -> layout/componentes
    #   app.js                 -> lógica + renderização
    # Esta função só COSTURA os arquivos e injeta os dados; não altera nada deles.
    base = os.path.dirname(os.path.abspath(template_path))
    def readf(name):
        with open(os.path.join(base, name), "r", encoding="utf-8") as f:
            return f.read()
    with open(template_path, "r", encoding="utf-8") as f:
        tpl = f.read()
    styles = readf("identidade-visual.css") + "\n" + readf("estilos.css")
    tpl = tpl.replace("__STYLES__", styles)
    tpl = tpl.replace("__APP_JS__", readf("app.js"))
    tpl = tpl.replace("__DATA_JSON__", json.dumps(data, ensure_ascii=False))
    tpl = tpl.replace("__BUILD_ID__", data["build"]["build_id"])
    tpl = tpl.replace("__GENERATED_BRT__", data["build"]["generated_at_brt"])
    return tpl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--meta-file")
    ap.add_argument("--sales-file")
    ap.add_argument("--meta-hourly-file", help="CSV local da aba de gasto por hora (opcional)")
    ap.add_argument("--template", default="build/template.html")
    ap.add_argument("--out", default="dist/index.html")
    args = ap.parse_args()

    meta_rows = load_rows(META_CSV_URL, args.meta_file)
    sales_rows = load_rows(SALES_CSV_URL, args.sales_file)
    data = process(meta_rows, sales_rows)
    hourly_rows = []
    if args.meta_hourly_file:
        hourly_rows = read_csv_file(args.meta_hourly_file)
    elif META_HOURLY_CSV_URL:
        try:
            hourly_rows = fetch_csv(META_HOURLY_CSV_URL)
        except Exception as e:  # aba opcional: nunca derruba o build
            print(f"AVISO: não consegui ler a aba de gasto por hora ({e}).", file=sys.stderr)
    data["meta_h"] = process_hourly(hourly_rows)
    data["build"]["has_hourly_spend"] = bool(data["meta_h"])

    # Briefings do Gestor (texto por IA, gerado 1x/dia pela Routine) — lidos do
    # arquivo versionado ao lado do template. Sem chamada de API no build.
    briefings_path = os.path.join(os.path.dirname(os.path.abspath(args.template)), "relatorios.json")
    data["briefings"] = load_briefings(briefings_path)

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(render(data, args.template))
    if CLIENT_PAGE_DIR:
        cout = os.path.join(os.path.dirname(args.out) or ".", CLIENT_PAGE_DIR, "index.html")
        os.makedirs(os.path.dirname(cout), exist_ok=True)
        with open(cout, "w", encoding="utf-8") as f:
            f.write(render(client_data(data), args.template))
        print(f"  cliente : {cout}", file=sys.stderr)

    b = data["build"]
    vendas = sum(s["main"] for s in data["sales"])
    fat = sum(s["val"] for s in data["sales"])
    print("== build ok ==", file=sys.stderr)
    print(f"  periodo : {b['date_min']} -> {b['date_max']}", file=sys.stderr)
    print(f"  meta    : {len(data['meta'])} linhas", file=sys.stderr)
    print(f"  sales   : {len(data['sales'])} linhas (funil) · Vendas(principal): {vendas} · Fat: R$ {fat:,.2f}", file=sys.stderr)
    print(f"  out     : {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
