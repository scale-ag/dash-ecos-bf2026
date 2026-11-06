#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera, a partir do export de Vendas da Nuvemshop, dois arquivos CIFRADOS:
  * build/clientes_hist.enc — clientes que já compraram antes do período do funil
    (marca cada venda como "novo" ou "recorrente");
  * build/produtos_hist.enc — ranking histórico de produtos (só a ORDEM dos nomes,
    por nº de pedidos pagos; sem quantidades), usado na aba Insights.

Entrada: export de Vendas da Nuvemshop (CSV ";" latin-1, com a coluna E-mail).
Rode LOCALMENTE; o CSV tem dados pessoais e NUNCA deve ser commitado.

Privacidade (o repositório é público):
  * o que vai para o repo é só o arquivo CIFRADO (AES-256-CBC + PBKDF2, via openssl);
  * a chave fica no Secret do GitHub `CLIENTES_KEY` (e no ambiente de quem gera);
  * mesmo decifrado, o conteúdo é só uma lista de códigos irreversíveis:
        cliente_id = sha256(email.strip().lower())[:16]   (= coluna cliente_id da aba vendas)
        chave      = sha256(SALT + cliente_id)[:12]
    — nenhum e-mail, nome, CPF ou telefone.

Uso:
    CLIENTES_KEY=<chave> python build/gerar_clientes_hist.py --csv Vendas.csv --ate 2026-10-31
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime

SALT = "clientes-hist-v1|"
PAID = {"confirmado", "pago", "paid", "aprovado"}
OPENSSL_ARGS = ["-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-salt", "-pass", "env:CLIENTES_KEY"]


def cliente_id(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:16]


def chave(cid: str) -> str:
    return hashlib.sha256((SALT + cid).encode()).hexdigest()[:12]


def encrypt(plain: bytes) -> bytes:
    return subprocess.run(["openssl", "enc", "-e", *OPENSSL_ARGS], input=plain,
                          capture_output=True, check=True).stdout


def decrypt(blob: bytes) -> bytes:
    return subprocess.run(["openssl", "enc", "-d", *OPENSSL_ARGS], input=blob,
                          capture_output=True, check=True).stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--ate", required=True, help="última data incluída (YYYY-MM-DD)")
    ap.add_argument("--encoding", default="latin-1")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "clientes_hist.enc"))
    ap.add_argument("--produtos-out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "produtos_hist.enc"))
    a = ap.parse_args()
    if not os.environ.get("CLIENTES_KEY"):
        sys.exit("ERRO: defina a variável de ambiente CLIENTES_KEY (mesmo valor do Secret do GitHub).")

    rows = list(csv.DictReader(open(a.csv, encoding=a.encoding, newline=""), delimiter=";"))
    if not rows or "E-mail" not in rows[0]:
        sys.exit("ERRO: o CSV precisa da coluna 'E-mail' (export de Vendas da Nuvemshop).")
    pedido_col = next(c for c in rows[0] if c.lower().startswith("n") and "pedido" in c.lower())
    seen, keys, n_paid, dmin, dmax = set(), set(), 0, None, None
    paid_orders = set()
    for r in rows:
        num = (r.get(pedido_col) or "").strip()
        if not num or num in seen:          # 1 linha por item: vale a 1ª linha do pedido
            continue
        seen.add(num)
        if (r.get("Status do Pagamento") or "").strip().lower() not in PAID:
            continue
        try:
            d = datetime.strptime((r.get("Data") or "")[:10], "%d/%m/%Y").date().isoformat()
        except ValueError:
            continue
        if d > a.ate or "@" not in (r.get("E-mail") or ""):
            continue
        n_paid += 1
        paid_orders.add(num)
        keys.add(chave(cliente_id(r["E-mail"])))
        dmin = min(dmin or d, d)
        dmax = max(dmax or d, d)

    plain = json.dumps({"gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M"), "de": dmin, "ate": dmax,
                        "pedidos_pagos": n_paid, "clientes": len(keys), "chaves": sorted(keys)},
                       separators=(",", ":")).encode()
    blob = encrypt(plain)
    assert decrypt(blob) == plain
    with open(a.out, "wb") as f:
        f.write(blob)
    print(f"ok: {len(seen)} pedidos lidos · {n_paid} pagos de {dmin} a {dmax} · "
          f"{len(keys)} clientes · cifrado -> {a.out}", file=sys.stderr)

    # Ranking histórico de produtos: nº de pedidos pagos em que cada produto aparece
    # (1 linha por item no export). Só a ORDEM vai para o arquivo (sem quantidades).
    prod_orders = {}
    for r in rows:
        num = (r.get(pedido_col) or "").strip()
        nome = (r.get("Nome do Produto") or "").strip()
        if num in paid_orders and nome:
            prod_orders.setdefault(nome, set()).add(num)
    ranking = [p for p, _ in sorted(prod_orders.items(), key=lambda kv: (-len(kv[1]), kv[0]))]
    plain_p = json.dumps({"de": dmin, "ate": dmax, "ranking": ranking}, ensure_ascii=False,
                         separators=(",", ":")).encode()
    blob_p = encrypt(plain_p)
    assert decrypt(blob_p) == plain_p
    with open(a.produtos_out, "wb") as f:
        f.write(blob_p)
    print(f"ok: ranking de {len(ranking)} produtos · cifrado -> {a.produtos_out}", file=sys.stderr)


if __name__ == "__main__":
    main()
