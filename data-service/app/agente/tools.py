from agentspan.agents import tool

from dados import ErroDados, consultar, resumo_para_llm


@tool
def buscar_serie(variavel: str, local: str = "", lat: str = "", lon: str = "", inicio: str = "", fim: str = "") -> dict:
    """Procura nos dados pre-calculados a serie mensal de UMA variavel num local e devolve um resumo
    (unidade, periodo, estatisticas descritivas, avisos). Nao devolve a serie completa nem tendencias.

    Args:
        variavel: id exato da variavel (ex.: "temperatura_2m").
        local: id exato de um local da lista disponivel (ex.: "luanda"). Vazio se so houver coordenadas.
        lat: latitude em graus decimais, so se o utilizador deu coordenadas em vez de um local. Senao vazio.
        lon: longitude em graus decimais (par de `lat`). Senao vazio.
        inicio: primeiro mes pedido, formato AAAA-MM. Vazio = desde o inicio da serie.
        fim: ultimo mes pedido, formato AAAA-MM. Vazio = ate ao fim da serie.
    """
    try:
        return resumo_para_llm(consultar(variavel, local, lat, lon, inicio, fim))
    except ErroDados as e:
        return {"ok": False, "codigo": e.codigo, "mensagem": e.mensagem, "sugestoes": e.sugestoes}
