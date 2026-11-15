"""Acesso aos dados pre-calculados (app/dados/*.csv + indice.json).

Sem dependencia do Agentspan. E usado em DOIS sitios, sempre com a MESMA funcao `consultar`:
  1. pela tool `buscar_serie` (o LLM recebe so um RESUMO, nunca os pontos);
  2. por `main.montar_resposta` (o codigo monta `dados`, `estatisticas`, `fontes` a partir do CSV).
Assim o LLM nao copia series (lento e sujeito a erros) e os numeros nunca passam por ele.
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import pandas as pd
import yaml

RAIZ = Path(__file__).resolve().parent
DADOS_DIR = Path(os.getenv("DADOS_DIR", RAIZ / "app" / "dados"))
CATALOGO = Path(os.getenv("CATALOGO_PATH", RAIZ / "app" / "catalogo" / "catalogo.yml"))
LIMITE_KM = float(os.getenv("DISTANCIA_MAX_KM", "300"))     # distancia maxima ao local pre-calculado


class ErroDados(Exception):
    def __init__(self, codigo: str, mensagem: str, sugestoes: list[str] | None = None):
        super().__init__(mensagem)
        self.codigo, self.mensagem, self.sugestoes = codigo, mensagem, sugestoes or []


# ----------------------------------------------------------------------------- carregamento
@lru_cache(maxsize=1)
def indice() -> dict:
    caminho = DADOS_DIR / "indice.json"
    if not caminho.exists():
        raise ErroDados("SEM_DADOS", f"Dados pre-calculados nao encontrados em {DADOS_DIR} (corre scripts/precalcular.py).")
    return json.loads(caminho.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def catalogo() -> dict:
    if not CATALOGO.exists():
        return {}
    dados = yaml.safe_load(CATALOGO.read_text(encoding="utf-8")) or {}
    return {v["id"]: v for v in dados.get("variaveis", [])}


@lru_cache(maxsize=256)
def _ler_csv(arquivo: str) -> pd.DataFrame:
    return pd.read_csv(DADOS_DIR / arquivo, parse_dates=["t"])      # nunca alterar o df devolvido


def variaveis_disponiveis() -> list[dict]:
    try:
        idx = indice()
    except ErroDados:
        return []
    cat, out = catalogo(), []
    for vid in sorted({s["variavel"] for s in idx["series"]}):
        c = cat.get(vid, {})
        unidade = next(s["unidade"] for s in idx["series"] if s["variavel"] == vid)
        out.append({"id": vid, "nome": c.get("nome", vid), "unidade": unidade,
                    "palavras_chave": c.get("palavras_chave", [])})
    return out


def locais_disponiveis() -> list[dict]:
    try:
        idx = indice()
    except ErroDados:
        return []
    com_dados = {s["local"] for s in idx["series"]}
    return sorted((l for l in idx["locais"] if l["id"] in com_dados), key=lambda l: l["id"])


# ----------------------------------------------------------------------------- utilitarios
def _id(x) -> str:
    return str(x or "").strip().lower().replace(" ", "_").replace("-", "_")


def _num(x) -> float | None:
    if x is None or str(x).strip() == "":
        return None
    try:
        return float(str(x).replace(",", "."))
    except ValueError:
        raise ErroDados("PEDIDO_INVALIDO", f"Valor numerico invalido: {x!r}")


def _mes(s: str) -> pd.Timestamp:
    try:
        return pd.Timestamp(f"{str(s).strip()[:7]}-01")
    except Exception:                                             # noqa: BLE001
        raise ErroDados("PEDIDO_INVALIDO", f"Periodo invalido: {s!r} (usa AAAA-MM).")


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(a))


# ----------------------------------------------------------------------------- consulta
@dataclass
class Resultado:
    variavel: str
    nome: str
    unidade: str
    local: dict
    distancia_km: float
    meta: dict                      # entrada da serie no indice.json
    df: pd.DataFrame                # colunas: t, valor
    avisos: list[str] = field(default_factory=list)

    @property
    def periodo(self) -> tuple[str, str]:
        return self.df["t"].min().strftime("%Y-%m"), self.df["t"].max().strftime("%Y-%m")

    @property
    def estatisticas(self) -> dict:
        v = self.df["valor"]
        return {"n_observacoes": int(len(v)), "media": round(float(v.mean()), 4),
                "desvio_padrao": round(float(v.std()), 4) if len(v) > 1 else 0.0,
                "minimo": round(float(v.min()), 4), "maximo": round(float(v.max()), 4)}


def consultar(variavel: str, local: str = "", lat=None, lon=None, inicio: str = "", fim: str = "") -> Resultado:
    idx = indice()
    disponiveis = {v["id"] for v in variaveis_disponiveis()}
    vid = _id(variavel)
    if vid not in disponiveis:
        msg = f"Variavel {variavel!r} nao disponivel." if vid else "Nao foi possivel identificar a variavel."
        raise ErroDados("VARIAVEL_NAO_IDENTIFICADA", msg, sorted(disponiveis))

    series = {s["local"]: s for s in idx["series"] if s["variavel"] == vid}
    locais = {l["id"]: l for l in idx["locais"] if l["id"] in series}
    lat, lon, local_id = _num(lat), _num(lon), _id(local)
    tem_coords = lat is not None and lon is not None

    if local_id:
        if local_id not in locais:
            raise ErroDados("REGIAO_NAO_IDENTIFICADA", f"Local {local!r} sem dados para {vid}.", sorted(locais))
        loc = locais[local_id]
        dist = _haversine_km(lat, lon, loc["lat"], loc["lon"]) if tem_coords else 0.0
    elif tem_coords:
        loc, dist = min(((l, _haversine_km(lat, lon, l["lat"], l["lon"])) for l in locais.values()), key=lambda x: x[1])
        if dist > LIMITE_KM:
            raise ErroDados("SEM_DADOS", f"O local com dados mais proximo ({loc['nome']}) esta a {dist:.0f} km "
                            f"(limite: {LIMITE_KM:.0f} km).", sorted(locais))
    else:
        raise ErroDados("REGIAO_NAO_IDENTIFICADA", "Indica um local da lista ou coordenadas.", sorted(locais))

    meta = series[loc["id"]]
    df = _ler_csv(meta["arquivo"])
    if inicio:
        df = df[df["t"] >= _mes(inicio)]
    if fim:
        df = df[df["t"] <= _mes(fim)]
    if df.empty:
        raise ErroDados("SEM_DADOS", f"Sem dados no periodo pedido. Disponivel: {meta['inicio'][:7]} a {meta['fim'][:7]}.")

    cat = catalogo().get(vid, {})
    avisos = []
    if dist > 1:
        avisos.append(f"Usado o local pre-calculado mais proximo: {loc['nome']} (a {dist:.0f} km do ponto pedido).")
    lat_c, lon_c = meta.get("lat_celula"), meta.get("lon_celula")
    if lat_c is not None and lon_c is not None and not (math.isnan(lat_c) or math.isnan(lon_c)):
        res = cat.get("resolucao_espacial_graus")
        avisos.append(f"Os valores correspondem a celula de grelha centrada em ({lat_c:.2f}, {lon_c:.2f})"
                      + (f", com resolucao de ~{res} graus" if res else "") + ", nao ao ponto exato.")
    if str(meta["produto"]).startswith(("M2", "GLDAS")):
        avisos.append(f"Produto de reanalise/modelo ({meta['produto']} v{meta['versao']}), nao uma medicao direta.")
    if len(df) < 30:
        avisos.append("Serie curta (< 30 observacoes): conclusoes estatisticas pouco fiaveis.")

    return Resultado(vid, cat.get("nome", vid), meta["unidade"], loc, dist, meta, df, avisos)


def resumo_para_llm(r: Resultado) -> dict:
    """O que o LLM ve: pequeno, sem pontos da serie."""
    ini, fim = r.periodo
    return {
        "ok": True, "variavel": r.variavel, "nome": r.nome, "unidade": r.unidade,
        "local": {"id": r.local["id"], "nome": r.local["nome"], "distancia_km": round(r.distancia_km, 1)},
        "periodo": {"inicio": ini, "fim": fim}, "estatisticas": r.estatisticas, "avisos": r.avisos,
        "nota": "A tendencia (sobe/desce, significancia) NAO foi calculada. Nao a afirmes nem a estimes.",
    }


def calcular_tendencias(_: Resultado) -> list[dict]:
    """PLACEHOLDER: o modulo/tool de tendencia (Mann-Kendall + Sen) liga-se aqui. Devolve dicts de `Trend`."""
    return []
