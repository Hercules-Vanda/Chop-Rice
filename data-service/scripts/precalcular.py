# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "earthaccess", "requests", "xarray>=2025.4.0", "pydap>=3.5", "netCDF4",
#   "pandas", "numpy", "scipy", "pymannkendall", "pyyaml",
# ]
# ///
"""Pre-calcula series mensais (variaveis do catalogo x locais) e guarda-as em CSV.

Uso (a partir de data-service/):
    export EARTHDATA_TOKEN=...
    uv run scripts/precalcular.py temperatura_2m          # uma variavel (recomendado para comecar)
    uv run scripts/precalcular.py                         # as marcadas `precalcular: true` no catalogo
    uv run scripts/precalcular.py umidade_solo            # qualquer outra, pelo id
    uv run scripts/precalcular.py --inicio 2010-01-01     # periodo mais curto (teste rapido)
    uv run scripts/precalcular.py --forcar                # refaz mesmo que o CSV ja exista

Saida (para FAZER COMMIT; sao ficheiros pequenos):
    app/dados/<variavel>/<local>.csv      colunas: t, valor (ja na unidade de exibicao)
    app/dados/indice.json                 metadados de todas as series

Cada granulo (1 mes) e aberto UMA vez e le a grelha inteira; os N locais saem dessa grelha.
Produtos HDF5 (ex.: GPM IMERG) ficam de fora por agora: precisam de group="Grid".
NAO FOI EXECUTADO contra a NASA por quem o escreveu (sem acesso a rede).
"""
import argparse
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import earthaccess
import numpy as np
import pandas as pd
import pymannkendall as mk
import requests
import xarray as xr
import yaml
from pydap.net import create_session
from scipy.stats import theilslopes

RAIZ = Path(__file__).resolve().parent.parent          # data-service/
CATALOGO = RAIZ / "app" / "catalogo" / "catalogo.yml"
SAIDA = RAIZ / "app" / "dados"
TRABALHADORES = 6      # pedidos em paralelo (o guia da NASA pede juizo com o servidor)

# --- Locais (id, nome, lat, lon). EDITA A VONTADE: o custo quase nao muda com mais locais ---
LOCAIS = [
    ("luanda", "Luanda, Angola", -8.84, 13.23),
    ("benguela", "Benguela, Angola", -12.58, 13.41),
    ("huambo", "Huambo, Angola", -12.78, 15.74),
    ("lubango", "Lubango, Angola", -14.92, 13.50),
    ("cabinda", "Cabinda, Angola", -5.55, 12.20),
    ("lisboa", "Lisboa, Portugal", 38.72, -9.14),
    ("manaus", "Manaus, Amazonia, Brasil", -3.12, -60.02),
    ("niamey", "Niamey, Sael, Niger", 13.51, 2.11),
    ("deserto_sara", "Deserto do Sara (Argelia)", 23.00, 6.00),
    ("nova_deli", "Nova Deli, India", 28.61, 77.21),
    ("pequim", "Pequim, China", 39.90, 116.40),
    ("svalbard", "Svalbard, Artico (Noruega)", 78.22, 15.63),
]


# ----------------------------------------------------------------------------- utilitarios
def mes_do_url(url: str) -> pd.Timestamp:
    """AAAAMM a partir do nome do ficheiro (produtos mensais)."""
    nome = url.split("?")[0].rsplit("/", 1)[-1]
    m = re.search(r"(?<!\d)((?:19|20)\d{2})(0[1-9]|1[0-2])(?!\d)", nome)
    if not m:
        raise ValueError(f"Nao consegui ler o mes em {nome}")
    return pd.Timestamp(int(m.group(1)), int(m.group(2)), 1)


def converter(conv: dict | None, x):
    tipo = (conv or {}).get("tipo", "nenhuma")
    if tipo == "nenhuma":
        return x
    if tipo == "kelvin_para_celsius":
        return x - 273.15
    if tipo == "fluxo_para_mm_dia":                       # kg/m2/s -> mm/dia
        return x * 86400
    if tipo == "escala":
        return x * conv["fator"]
    raise ValueError(f"Conversao nao suportada: {tipo}")


def celula_valida(v: np.ndarray, lats, lons, lat: float, lon: float, raio: int = 3):
    """Celula mais proxima do ponto; se for NaN (ex.: oceano em modelos de terra), procura vizinhas."""
    i, j = int(np.abs(lats - lat).argmin()), int(np.abs(lons - lon).argmin())
    if not np.isnan(v[i, j]):
        return i, j
    melhor, dmin = None, None
    for di in range(-raio, raio + 1):
        for dj in range(-raio, raio + 1):
            ii, jj = i + di, j + dj
            if 0 <= ii < v.shape[0] and 0 <= jj < v.shape[1] and not np.isnan(v[ii, jj]):
                d = (lats[ii] - lat) ** 2 + (lons[jj] - lon) ** 2
                if dmin is None or d < dmin:
                    melhor, dmin = (ii, jj), d
    return melhor


def analisar(df: pd.DataFrame) -> dict:
    s = df.set_index("t")["valor"].resample("MS").mean()
    anom = (s - s.groupby(s.index.month).transform("mean")).dropna()      # remove o ciclo sazonal
    anos = anom.index.year + (anom.index.month - 0.5) / 12
    declive, _, lo, hi = theilslopes(anom.values, anos, alpha=0.95)
    t = mk.original_test(anom.values)
    return {"declive_por_ano": float(declive), "ic95": [float(lo), float(hi)],
            "p_valor": float(t.p), "significativo": bool(t.h)}


# ----------------------------------------------------------------------------- leitura
def ler_granulo(url: str, token: str, var: str):
    """Le a grelha de 1 mes e devolve (mes, [valor por local], [(lat_celula, lon_celula) por local])."""
    sessao = create_session(session_kwargs={"token": token})
    ds = xr.open_dataset(url, engine="pydap", session=sessao)
    da = ds[var]
    if "time" in da.dims:
        da = da.isel(time=0)
    da = da.transpose("lat", "lon").load()
    v, lats, lons = da.values.astype(float), da["lat"].values, da["lon"].values
    valores, celulas = [], []
    for _, _, lat, lon in LOCAIS:
        c = celula_valida(v, lats, lons, lat, lon)
        valores.append(float(v[c]) if c else np.nan)
        celulas.append((float(lats[c[0]]), float(lons[c[1]])) if c else (np.nan, np.nan))
    return mes_do_url(url), valores, celulas


def urls_opendap(short_name: str, versao: str, var: str, inicio: str, fim: str) -> list[str]:
    resultados = earthaccess.search_data(short_name=short_name, version=versao, temporal=(inicio, fim))
    urls = []
    for item in resultados:
        for u in item["umm"]["RelatedUrls"]:
            if "OPENDAP" in u.get("Description", "").upper():
                urls.append(u["URL"].replace("https", "dap4") + f"?dap4.ce=/{var}%3B/lat%3B/lon%3B/time")
    return urls


def testar_acesso(url: str, token: str) -> None:
    base, ce = url.split("?", 1)
    r = requests.get(f"{base.replace('dap4://', 'https://', 1)}.dmr?{ce}",
                     headers={"Authorization": f"Bearer {token}"}, timeout=60)
    print(f"  teste de acesso: HTTP {r.status_code}")
    if r.status_code in (401, 403):
        raise SystemExit("Sem autorizacao: ativa as apps 'NASA GES DISC DATA ARCHIVE' e "
                         "'Hyrax in the Cloud' no Earthdata e gera um token novo.")
    r.raise_for_status()


def ler_todos(urls: list[str], token: str, var: str):
    resultados, falhas = [], []
    t0 = time.time()
    with ThreadPoolExecutor(TRABALHADORES) as ex:
        futuros = {ex.submit(ler_granulo, u, token, var): u for u in urls}
        for i, f in enumerate(as_completed(futuros), 1):
            try:
                resultados.append(f.result())
            except Exception as e:                                        # noqa: BLE001
                falhas.append((futuros[f], e))
            print(f"  {i}/{len(urls)} granulos ({time.time() - t0:.0f}s)", end="\r", flush=True)
    print()
    return resultados, falhas


# ----------------------------------------------------------------------------- gravacao
def gravar(var_id: str, cfg: dict, resultados: list, args) -> list[dict]:
    resultados.sort(key=lambda r: r[0])
    pasta = SAIDA / var_id
    pasta.mkdir(parents=True, exist_ok=True)
    entradas = []
    for k, (loc_id, nome, lat, lon) in enumerate(LOCAIS):
        df = pd.DataFrame({"t": [r[0] for r in resultados], "valor": [r[1][k] for r in resultados]})
        df["valor"] = converter(cfg.get("conversao"), df["valor"]).round(4)
        df = df.dropna()
        if df.empty:
            print(f"  ! {loc_id}: sem valores validos (ignorado)")
            continue
        df.to_csv(pasta / f"{loc_id}.csv", index=False, date_format="%Y-%m-%d")
        lat_c, lon_c = resultados[0][2][k]
        prod = cfg["produtos"]["mensal"]
        entradas.append({
            "variavel": var_id, "local": loc_id, "arquivo": f"{var_id}/{loc_id}.csv",
            "unidade": cfg["unidade_exibicao"], "n_observacoes": len(df),
            "inicio": str(df["t"].min().date()), "fim": str(df["t"].max().date()),
            "produto": prod["short_name"], "versao": prod["versao"],
            "variavel_tecnica": cfg["variavel_tecnica"],
            "lat_celula": lat_c, "lon_celula": lon_c,
        })
    return entradas


def atualizar_indice(var_id: str, entradas: list[dict]) -> None:
    caminho = SAIDA / "indice.json"
    indice = json.loads(caminho.read_text(encoding="utf-8")) if caminho.exists() else {"series": []}
    indice["series"] = [s for s in indice["series"] if s["variavel"] != var_id] + entradas
    indice["locais"] = [{"id": i, "nome": n, "lat": la, "lon": lo} for i, n, la, lo in LOCAIS]
    indice["gerado_em"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    caminho.write_text(json.dumps(indice, ensure_ascii=False, indent=2), encoding="utf-8")


# ----------------------------------------------------------------------------- principal
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("variaveis", nargs="*", help="ids do catalogo (por omissao: todas as elegiveis)")
    ap.add_argument("--inicio", default="2000-01-01")
    ap.add_argument("--fim", default="2024-12-31")
    ap.add_argument("--forcar", action="store_true")
    args = ap.parse_args()

    catalogo = yaml.safe_load(CATALOGO.read_text(encoding="utf-8"))["variaveis"]
    elegiveis = {}
    for v in catalogo:
        prod = v.get("produtos", {}).get("mensal")
        if not prod or v.get("conector") == "appeears":
            continue
        if prod["short_name"].startswith("GPM_"):
            print(f"[salta] {v['id']}: produto HDF5 (IMERG) fica para a fase 2")
            continue
        elegiveis[v["id"]] = v
    escolhidas = args.variaveis or [i for i, v in elegiveis.items() if v.get("precalcular")]
    desconhecidas = [x for x in escolhidas if x not in elegiveis]
    if desconhecidas:
        raise SystemExit(f"Variaveis invalidas ou nao elegiveis: {desconhecidas}. Opcoes: {list(elegiveis)}")

    token = os.getenv("EARTHDATA_TOKEN")
    if not token:
        earthaccess.login()
        token = earthaccess.get_edl_token()["access_token"]

    for var_id in escolhidas:
        cfg = elegiveis[var_id]
        pasta = SAIDA / var_id
        if not args.forcar and pasta.exists() and len(list(pasta.glob("*.csv"))) >= len(LOCAIS):
            print(f"[ok ja existe] {var_id} (usa --forcar para refazer)")
            continue
        prod = cfg["produtos"]["mensal"]
        print(f"\n== {var_id}: {prod['short_name']} v{prod['versao']} / {cfg['variavel_tecnica']}")
        urls = urls_opendap(prod["short_name"], prod["versao"], cfg["variavel_tecnica"], args.inicio, args.fim)
        print(f"  {len(urls)} granulos com OPeNDAP")
        if not urls:
            print("  ! nenhum URL OPeNDAP: variavel ignorada")
            continue
        testar_acesso(urls[0], token)
        resultados, falhas = ler_todos(urls, token, cfg["variavel_tecnica"])
        if falhas:                                           # 2.a tentativa so para os que falharam
            print(f"  {len(falhas)} falharam; a repetir. Primeiro erro: {falhas[0][1]!r}")
            r2, falhas = ler_todos([u for u, _ in falhas], token, cfg["variavel_tecnica"])
            resultados += r2
        if falhas:
            print(f"  ! {len(falhas)} granulos continuam a falhar; a serie tera buracos")
        if not resultados:
            print("  ! nenhum granulo lido: variavel ignorada")
            continue
        atualizar_indice(var_id, gravar(var_id, cfg, resultados, args))
        print(f"  gravado em {pasta}")

    # Resumo: onde ha tendencia significativa (util para escolher os exemplos da demo)
    indice = json.loads((SAIDA / "indice.json").read_text(encoding="utf-8")) if (SAIDA / "indice.json").exists() else {"series": []}
    print("\n== Resumo das tendencias (Mann-Kendall + Sen, sazonalidade removida)")
    for s in sorted(indice["series"], key=lambda s: (s["variavel"], s["local"])):
        if s["variavel"] not in escolhidas:
            continue
        df = pd.read_csv(SAIDA / s["arquivo"], parse_dates=["t"])
        if len(df) < 30:
            continue
        a = analisar(df)
        marca = "SIGNIFICATIVO" if a["significativo"] else "nao signif."
        print(f"  {s['variavel']:<24}{s['local']:<14}{a['declive_por_ano']:+.4f} {s['unidade']}/ano  p={a['p_valor']:.3f}  {marca}")


if __name__ == "__main__":
    main()
