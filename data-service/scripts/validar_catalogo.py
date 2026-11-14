"""Valida os produtos do catalogo.yml contra o CMR (so metadados, nao precisa de token).

Uso (a partir de data-service/):
    pip install pyyaml requests
    python scripts/validar_catalogo.py
"""
from pathlib import Path

import requests
import yaml

CMR = "https://cmr.earthdata.nasa.gov/search/collections.json"
CATALOGO = Path(__file__).resolve().parent.parent / "app" / "catalogo" / "catalogo.yml"


def main() -> None:
    catalogo = yaml.safe_load(CATALOGO.read_text(encoding="utf-8"))
    vistos = set()
    for var in catalogo["variaveis"]:
        for resolucao, prod in var["produtos"].items():
            chave = (prod["short_name"], prod["versao"])
            if chave in vistos:
                continue
            vistos.add(chave)
            r = requests.get(
                CMR,
                params={"short_name": prod["short_name"], "version": prod["versao"]},
                timeout=30,
            )
            r.raise_for_status()
            itens = r.json()["feed"]["entry"]
            if not itens:
                print(f"[FALHOU] {var['id']} ({resolucao}): {chave} nao encontrado no CMR")
                continue
            c = itens[0]
            print(
                f"[OK]     {var['id']} ({resolucao}): {c['title']} | "
                f"{c.get('time_start', '?')[:10]} -> {c.get('time_end', 'presente')[:10]}"
            )


if __name__ == "__main__":
    main()
