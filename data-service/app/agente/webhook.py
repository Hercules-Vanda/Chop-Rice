# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""Cliente de teste do main.py (simula a API C#).

    uv run uvicorn main:app --port 8000        # terminal 1
    uv run webhook.py                          # terminal 2: corre todos os casos
    uv run webhook.py so_consulta              # terminal 2: corre um caso
"""
import json
import os
import sys
import time

import requests

WEBHOOK_URL = os.getenv("WEBHOOK_URL", "http://localhost:8000/webhook")

CASOS = {
    # --- devem dar 200 ---------------------------------------------------------------
    # Filtros completos (como o front enviaria)
    "completo": {
        "consulta": "A precipitação em Luanda está a diminuir?",
        "filtros": {
            "regiao": {"tipo": "ponto", "lat": -8.84, "lon": 13.23},
            "resolucao": "mensal",
            "variavel": "precipitacao",
            "periodo": {"inicio": "2000-01", "fim": "2024-12"},
        },
    },
    # Só texto: o agente tem de inferir variável e local
    "so_consulta": {"consulta": "A temperatura no Ártico está a subir?", "filtros": {}},
    # Só filtros, sem consulta
    "so_filtros": {
        "consulta": None,
        "filtros": {"variavel": "aerossois", "regiao": {"tipo": "ponto", "lat": 28.61, "lon": 77.21}},
    },
    # Coordenadas perto de Luanda (mas não iguais): deve usar o local mais próximo e avisar
    "coordenadas_proximas": {
        "consulta": "Como está a temperatura aqui?",
        "filtros": {"regiao": {"tipo": "ponto", "lat": -8.95, "lon": 13.10}, "variavel": "temperatura_2m"},
    },
    # Período cortado
    "periodo_curto": {"consulta": "Temperatura em Luanda entre 2015 e 2020", "filtros": {}},
    # --- devem dar erro de dados (404/422) ------------------------------------------------
    "longe_de_tudo": {   # meio do Atlântico: sem local pré-calculado perto -> 404 SEM_DADOS
        "consulta": "temperatura aqui",
        "filtros": {"regiao": {"tipo": "ponto", "lat": 0.0, "lon": -30.0}, "variavel": "temperatura_2m"},
    },
    "variavel_inexistente": {"consulta": "A cor do mar em Luanda mudou?", "filtros": {}},   # 422
    "sem_local": {"consulta": "A precipitação está a diminuir?", "filtros": {}},            # 422
    # --- devem dar 400 PEDIDO_INVALIDO ----------------------------------------------------
    "invalido": {"consulta": "", "filtros": {}},
    "lat_invalida": {"consulta": "teste", "filtros": {"regiao": {"tipo": "ponto", "lat": 123, "lon": 0}}},
}


def enviar(nome: str, payload: dict) -> None:
    print(f"\n=== {nome} ===")
    print("PEDIDO:", json.dumps(payload, ensure_ascii=False))
    t0 = time.time()
    r = requests.post(WEBHOOK_URL, json=payload, timeout=180)
    print(f"HTTP {r.status_code} em {time.time() - t0:.1f}s")
    try:
        print(json.dumps(r.json(), ensure_ascii=False, indent=2))
    except ValueError:
        print(r.text)


if __name__ == "__main__":
    escolhidos = sys.argv[1:] or list(CASOS)
    desconhecidos = [c for c in escolhidos if c not in CASOS]
    if desconhecidos:
        sys.exit(f"Casos desconhecidos: {desconhecidos}. Opções: {list(CASOS)}")
    for c in escolhidos:
        enviar(c, CASOS[c])
