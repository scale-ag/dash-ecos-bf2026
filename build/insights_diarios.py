#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Análise diária de tráfego (Meta) para a rotina de insights — só NÚMEROS, sem IA.

Lê as mesmas planilhas do build (export CSV público, somente leitura), reaproveita
build.process() e imprime um relatório em texto com:
  * resumo de ontem × média dos 3 dias anteriores (gasto, CPM, CTR, funil, ROAS pixel/UTM,
    pedidos da loja);
  * campanhas: ontem, últimos 3 dias e tendência;
  * "ralo": anúncios ativos gastando sem retorno (regras fixas);
  * "escalar": anúncios ativos com retorno bem acima da média e pouca verba;
  * "fadiga": anúncios cujo ROAS dos últimos 3 dias caiu muito frente aos anteriores.
Quem lê (pessoa ou rotina do Claude) interpreta e escreve as recomendações.

Uso:
    python build/insights_diarios.py                     # busca as planilhas ao vivo
    python build/insights_diarios.py --meta-file m.csv --sales-file s.csv
    python build/insights_diarios.py --ref 2026-11-17    # "ontem" = esta data

Gasto sempre COM o imposto Meta (TAX_FACTOR). ROAS pixel = Purchases Conversion Value /
gasto (atribuição do Meta); ROAS UTM = pedidos pagos da loja casados pela UTM / gasto.
"""
from __future__ import annotations

import argparse
import collections
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build  # noqa: E402

# Regras (mesmas do plano de otimização combinado com o gestor)
CAC_ALVO = build.cfg.CAC_TARGET or 99.0
RALO_SEM_COMPRA = 1.5 * CAC_ALVO      # gastou isso (3 dias) sem compra no pixel nem na UTM
RALO_ROAS_UTM, RALO_GASTO_MIN = 1.0, 300.0
ESCALA_ROAS_PX, ESCALA_ROAS_UTM, ESCALA_GASTO_MAX = 4.0, 2.0, 0.08   # <8% do gasto da conta
FADIGA_QUEDA = 0.5                    # ROAS 3d < 50% do ROAS anterior


def r(a, b):
    return a / b if b else None


def f(x, p=0, pre=""):
    if x is None:
        return "-"
    s = f"{x:,.{p}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return pre + s


def pct(x, p=1):
    return "-" if x is None else f(100 * x, p) + "%"


def bucket():
    return collections.defaultdict(float)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--meta-file")
    ap.add_argument("--sales-file")
    ap.add_argument("--ref", help="data de referência (ontem), YYYY-MM-DD; padrão: ontem em BRT")
    a = ap.parse_args()

    data = build.process(build.load_rows(build.META_CSV_URL, a.meta_file),
                         build.load_rows(build.SALES_CSV_URL, a.sales_file))
    T = data["build"]["tax_factor"]
    hoje = data["build"]["today"]
    ref = a.ref or (date.fromisoformat(hoje) - timedelta(days=1)).isoformat()
    d0 = date.fromisoformat(ref)
    prev3 = {(d0 - timedelta(days=i)).isoformat() for i in (1, 2, 3)}
    last3 = {(d0 - timedelta(days=i)).isoformat() for i in (0, 1, 2)}
    before3 = {(d0 - timedelta(days=i)).isoformat() for i in (3, 4, 5, 6, 7, 8)}

    day = collections.defaultdict(bucket)
    camp = collections.defaultdict(lambda: collections.defaultdict(bucket))
    ad = collections.defaultdict(lambda: collections.defaultdict(bucket))
    ad_where = collections.defaultdict(set)
    for m in data["meta"]:
        d = m["d"]
        if not d:
            continue
        sp = m["sp"] * T
        for X in (day[d],):
            X["sp"] += sp; X["im"] += m["im"]; X["cl"] += m["cl"]; X["pv"] += m["pv"]
            X["atc"] += m.get("atc", 0); X["ck"] += m["ck"]; X["pu"] += m.get("pu", 0); X["pval"] += m.get("pval", 0)
        for X, k in ((camp, m["camp"]), (ad, m["ad"])):
            b = X[k][d]
            b["sp"] += sp; b["im"] += m["im"]; b["cl"] += m["cl"]; b["pu"] += m.get("pu", 0); b["pval"] += m.get("pval", 0)
        if sp > 0:
            ad_where[m["ad"]].add(m["camp"].replace("zenith_ecom_vendas_", ""))
    for s in data["sales"]:
        d = s["d"]
        if not d:
            continue
        day[d]["lq"] += s["main"]; day[d]["lf"] += s["val"]
        if s.get("nr") == 0:
            day[d]["nov"] += s["main"]
        if s["meta"]:
            day[d]["uq"] += s["main"]; day[d]["uf"] += s["val"]
            camp[s["camp"]][d]["uf"] += s["val"]; camp[s["camp"]][d]["uq"] += s["main"]
            ad[s["ad"]][d]["uf"] += s["val"]; ad[s["ad"]][d]["uq"] += s["main"]

    def soma(series, days):
        t = bucket()
        for d in days:
            for k, v in series.get(d, {}).items():
                t[k] += v
        return t

    def linha(t, n=1):
        return (f"gasto {f(t['sp'] / n, 0, 'R$ ')} | CPM {f(r(t['sp'] * 1000, t['im']), 1)} | CTR {pct(r(t['cl'], t['im']), 2)} | "
                f"connect {pct(r(t['pv'], t['cl']), 0)} | tx carrinho {pct(r(t['atc'], t['pv']))} | tx checkout {pct(r(t['ck'], t['atc']))} | "
                f"tx compra px {pct(r(t['pu'], t['ck']))} | compras px {f(t['pu'] / n, 1)} | CPA px {f(r(t['sp'], t['pu']), 0, 'R$ ')} | "
                f"ROAS px {f(r(t['pval'], t['sp']), 2)} | ROAS UTM {f(r(t['uf'], t['sp']), 2)} | "
                f"loja {f(t['lq'] / n, 1)} pedidos {f(t['lf'] / n, 0, 'R$ ')} | % novos {pct(r(t['nov'], t['lq']), 0)}")

    print(f"# Insights diários — referência {ref} (dados até {hoje}; hoje parcial fica de fora)\n")
    print("## Conta (Meta + loja)")
    print(f"- ONTEM {ref}: " + linha(day.get(ref, bucket())))
    print(f"- média 3 dias anteriores: " + linha(soma(day, prev3), 3))
    print("- últimos 7 dias, dia a dia (gasto | ROAS px | ROAS UTM | pedidos loja):")
    for i in range(6, -1, -1):
        k = (d0 - timedelta(days=i)).isoformat()
        t = day.get(k, bucket())
        print(f"    {k[8:]}/{k[5:7]}: {f(t['sp'], 0, 'R$ ')} | {f(r(t['pval'], t['sp']), 2)} | {f(r(t['uf'], t['sp']), 2)} | {f(t['lq'])}")

    tot3 = soma(day, last3)
    print("\n## Campanhas (ontem · últimos 3 dias · 6 dias antes) — gasto | ROAS px | ROAS UTM")
    rows = []
    for c, ser in camp.items():
        y, l3, b3 = ser.get(ref, bucket()), soma(ser, last3), soma(ser, before3)
        if l3["sp"] <= 0:
            continue
        rows.append((l3["sp"], c, y, l3, b3))
    for _, c, y, l3, b3 in sorted(rows, reverse=True):
        print(f"- {c.replace('zenith_ecom_vendas_', '')}: ontem {f(y['sp'], 0, 'R$ ')} {f(r(y['pval'], y['sp']), 2)} {f(r(y['uf'], y['sp']), 2)} · "
              f"3d {f(l3['sp'], 0, 'R$ ')} ({pct(r(l3['sp'], tot3['sp']), 0)} da verba) {f(r(l3['pval'], l3['sp']), 2)} {f(r(l3['uf'], l3['sp']), 2)} · "
              f"antes {f(b3['sp'], 0, 'R$ ')} {f(r(b3['pval'], b3['sp']), 2)} {f(r(b3['uf'], b3['sp']), 2)}")

    ralo, escala, fadiga = [], [], []
    for k, ser in ad.items():
        y, l3, b3 = ser.get(ref, bucket()), soma(ser, last3), soma(ser, before3)
        if y["sp"] <= 0 and l3["sp"] <= 0:
            continue
        ativo = y["sp"] > 0
        rp, ru = r(l3["pval"], l3["sp"]), r(l3["uf"], l3["sp"])
        info = (f"{k} [{', '.join(sorted(ad_where[k]))[:90]}] — 3d: gasto {f(l3['sp'], 0, 'R$ ')}, compras px {f(l3['pu'])}, "
                f"ROAS px {f(rp, 2)}, vendas UTM {f(l3['uq'])}, ROAS UTM {f(ru, 2)}, CTR {pct(r(l3['cl'], l3['im']), 2)}")
        if ativo and l3["sp"] >= RALO_SEM_COMPRA and l3["pu"] == 0 and l3["uq"] == 0:
            ralo.append((l3["sp"], "sem nenhuma compra · " + info))
        elif ativo and l3["sp"] >= RALO_GASTO_MIN and (ru or 0) < RALO_ROAS_UTM and (rp or 0) < 2:
            ralo.append((l3["sp"], "retorno fraco · " + info))
        if (ativo and (rp or 0) >= ESCALA_ROAS_PX and (ru or 0) >= ESCALA_ROAS_UTM
                and l3["sp"] < ESCALA_GASTO_MAX * tot3["sp"] and l3["pu"] >= 2):
            escala.append((rp, info))
        rb = r(b3["pval"], b3["sp"])
        if ativo and b3["sp"] >= 200 and l3["sp"] >= 150 and rb and rb >= 2.5 and (rp or 0) < FADIGA_QUEDA * rb:
            fadiga.append((l3["sp"], f"ROAS px {f(rb, 2)} → {f(rp, 2)} · " + info))

    print(f"\n## Ralo — anúncios ativos gastando sem retorno (3 dias; sem compra após {f(RALO_SEM_COMPRA, 0, 'R$ ')} "
          f"ou ROAS UTM < {RALO_ROAS_UTM} e px < 2 após {f(RALO_GASTO_MIN, 0, 'R$ ')})")
    for _, s in sorted(ralo, reverse=True) or [(0, "nenhum")]:
        print("- " + s)
    print(f"  total no ralo (3d): {f(sum(x for x, _ in ralo), 0, 'R$ ')} de {f(tot3['sp'], 0, 'R$ ')}")
    print(f"\n## Escalar — ativos com ROAS px ≥ {ESCALA_ROAS_PX} e UTM ≥ {ESCALA_ROAS_UTM} recebendo < {int(ESCALA_GASTO_MAX * 100)}% da verba")
    for _, s in sorted(escala, reverse=True) or [(0, "nenhum")]:
        print("- " + s)
    print(f"\n## Fadiga — ROAS px dos últimos 3 dias abaixo de {int(FADIGA_QUEDA * 100)}% do período anterior")
    for _, s in sorted(fadiga, reverse=True) or [(0, "nenhum")]:
        print("- " + s)


if __name__ == "__main__":
    main()
