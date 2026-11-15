import logging
import math
import multiprocessing
import os
import time
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError, model_validator

# Agentspan/Conductor usa "spawn" por omissao, o que falha ao serializar os workers
# das tools neste tipo de app. Tem de ser definido ANTES de importar o Agentspan.
os.environ.setdefault("CONDUCTOR_MP_START_METHOD", "fork")
try:
    multiprocessing.set_start_method("fork", force=True)
except Exception:
    pass

from agentspan.agents import Agent, AgentRuntime, run  # noqa: E402

import dados  # noqa: E402
from dados import ErroDados  # noqa: E402
from tools import buscar_serie  # noqa: E402

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ============================================================================
# Pedido  (contrato: ARQUITETURA.md, secção 2.1 — request)
# ============================================================================
class Regiao(BaseModel):
    tipo: Literal["ponto"] = "ponto"          # MVP: só ponto (bbox fica de fora)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    nome: str | None = None


class Periodo(BaseModel):
    inicio: str = Field(pattern=r"^\d{4}-\d{2}$")     # "AAAA-MM"
    fim: str = Field(pattern=r"^\d{4}-\d{2}$")


class Filtros(BaseModel):
    regiao: Regiao | None = None
    resolucao: Literal["diaria", "mensal"] | None = None
    variavel: str | None = None                       # id do catálogo
    periodo: Periodo | None = None


class AnaliseRequest(BaseModel):
    consulta: str | None = None
    filtros: Filtros = Field(default_factory=Filtros)

    @model_validator(mode="after")
    def exige_consulta_ou_filtro(self):
        tem_consulta = bool(self.consulta and self.consulta.strip())
        tem_filtro = any(v is not None for v in self.filtros.model_dump().values())
        if not (tem_consulta or tem_filtro):
            raise ValueError("Indica uma consulta ou pelo menos um filtro.")
        return self


# ============================================================================
# Resposta  (contrato: ARQUITETURA.md, secção 2.1 — response 200)
# ============================================================================
class LocalUsado(BaseModel):
    id: str
    nome: str
    distancia_km: float


class Interpretacao(BaseModel):
    variavel: str | None = None
    regiao: Regiao | None = None
    resolucao: Literal["diaria", "mensal"] | None = None
    periodo: Periodo | None = None
    inferido_pelo_agente: list[str] = Field(default_factory=list)
    local_usado: LocalUsado | None = None             # secção 4.6 (dados pré-calculados)


class Estatistica(BaseModel):
    variavel: str
    n_observacoes: int
    media: float
    desvio_padrao: float
    minimo: float
    maximo: float
    unidade: str


class Trend(BaseModel):
    variavel: str
    direcao: Literal["crescente", "decrescente", "sem_tendencia"]
    declive: float
    unidade_declive: str
    ic95: list[float] = Field(min_length=2, max_length=2)
    metodo: str
    estatistica: float
    p_valor: float
    significativo: bool
    nivel_significancia: float = 0.05
    dessazonalizado: bool = True


class Ponto(BaseModel):
    t: str                                            # "AAAA-MM-DD"
    valor: float


class SerieDados(BaseModel):
    variavel: str
    nome: str
    unidade: str
    lat: float
    lon: float
    resolucao: Literal["diaria", "mensal"]
    declive: float | None = None                      # preenchido pela tool de tendencia
    pontos: list[Ponto] = Field(default_factory=list)
    linha_tendencia: list[Ponto] = Field(default_factory=list)


class Fonte(BaseModel):
    nome: str
    produto_id: str
    instituicao: str
    url: str
    acessado_em: str                                  # ISO 8601


class ResponseModel(BaseModel):
    interpretacao: Interpretacao | None = None
    resposta_IA: str
    resumo_executivo: str
    estatisticas: list[Estatistica] = Field(default_factory=list)
    trends: list[Trend] = Field(default_factory=list)
    dados: list[SerieDados] = Field(default_factory=list)
    fontes: list[Fonte] = Field(default_factory=list)
    avisos: list[str] = Field(default_factory=list)


# ============================================================================
# Erros  (contrato: { "erro": { "codigo", "mensagem", "sugestoes" } })
# ============================================================================
class ErroApi(Exception):
    def __init__(self, status_code: int, codigo: str, mensagem: str, sugestoes: list[str] | None = None):
        self.status_code, self.codigo, self.mensagem = status_code, codigo, mensagem
        self.sugestoes = sugestoes or []


def corpo_erro(codigo: str, mensagem: str, sugestoes: list[str] | None = None) -> dict:
    return {"erro": {"codigo": codigo, "mensagem": mensagem, "sugestoes": sugestoes or []}}


# ============================================================================
# Saida do AGENTE (pequena de proposito: o LLM so decide a intencao e escreve texto.
# Series, estatisticas, fontes e avisos de dados sao montados pelo CODIGO.)
# ============================================================================
class SaidaAgente(BaseModel):
    variavel: str | None = None        # id usado na tool (ou null se nao identificou)
    local: str | None = None           # id de local usado na tool
    lat: float | None = None           # so se o utilizador deu coordenadas em vez de local
    lon: float | None = None
    periodo: Periodo | None = None     # so se o periodo veio do texto/filtros
    resposta_IA: str
    resumo_executivo: str
    avisos: list[str] = Field(default_factory=list)


def montar_instrucoes() -> str:
    vars_ = "\n".join(
        f"- {v['id']}: {v['nome']} [{v['unidade']}] (palavras-chave: {', '.join(v['palavras_chave'])})"
        for v in dados.variaveis_disponiveis()) or "- (nenhuma: dados pre-calculados em falta)"
    locais = "\n".join(f"- {l['id']}: {l['nome']} ({l['lat']}, {l['lon']})" for l in dados.locais_disponiveis()) or "- (nenhum)"
    return f"""
Es o agente do "Earth System Trend Detective" (NASA Space Apps). Recebes JSON com `consulta` (texto, opcional)
e `filtros` (regiao, resolucao, variavel, periodo; todos opcionais). Responde de forma concisa e so no formato pedido.

VARIAVEIS DISPONIVEIS (usa o id exato):
{vars_}

LOCAIS DISPONIVEIS (usa o id exato):
{locais}

FLUXO (obrigatorio, sem passos extra):
1. Identifica variavel, local e periodo. Os filtros explicitos TEM PRIORIDADE sobre o texto.
2. Se identificaste variavel e (local OU coordenadas), chama `buscar_serie` UMA so vez.
   - Local da lista -> passa `local`. Coordenadas sem local da lista -> passa `lat` e `lon` (o codigo escolhe o local mais proximo).
   - So dados mensais existem; se pedirem diarios, usa mensais e diz-o.
3. Se nao conseguires identificar a variavel ou o local, NAO chames a tool: deixa-os null e explica em `resposta_IA`.
4. Preenche `variavel`, `local`, `lat`, `lon` e `periodo` com EXATAMENTE os argumentos que usaste na tool.
5. Escreve `resposta_IA` (3 a 5 frases, em portugues) e `resumo_executivo` (1 frase) usando SO os valores que a tool devolveu.
   - Nao calcules nada. Nao inventes numeros. A tendencia (a subir/descer, significancia) NAO esta disponivel:
     nunca a afirmes; diz que apenas tens estatisticas descritivas e que o teste de tendencia nao esta ligado.
   - Se a tool devolveu ok=false, explica o motivo e sugere alternativas da lista.
6. Nunca atribuas causalidade; correlacao nao e causa.
""".strip()


MODELO = os.getenv("LLM_MODEL") or "google_gemini/gemini-3.1-flash-lite"

pesquisador = Agent(
    name="pesquisador",
    model=MODELO,
    instructions=montar_instrucoes(),      # gerado no arranque a partir de indice.json + catalogo.yml
    tools=[buscar_serie],
    output_type=SaidaAgente,
)

runtime_instance = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global runtime_instance
    try:                                    # aquece os caches antes de aceitar pedidos
        n = len(dados.indice()["series"])
        log.info("Dados pre-calculados: %d series, %d variaveis, %d locais",
                 n, len(dados.variaveis_disponiveis()), len(dados.locais_disponiveis()))
    except ErroDados as exc:
        log.warning("%s", exc.mensagem)
    runtime_instance = AgentRuntime()
    runtime_instance.__enter__()
    yield
    runtime_instance.__exit__(None, None, None)


app = FastAPI(title="Trend Detective — data-service", lifespan=lifespan)

HTTP_POR_CODIGO = {"PEDIDO_INVALIDO": 400, "SEM_DADOS": 404, "VARIAVEL_NAO_IDENTIFICADA": 422,
                   "REGIAO_NAO_IDENTIFICADA": 422}


@app.exception_handler(ErroApi)
async def tratar_erro_api(_: Request, exc: ErroApi):
    return JSONResponse(status_code=exc.status_code, content=corpo_erro(exc.codigo, exc.mensagem, exc.sugestoes))


@app.exception_handler(ErroDados)
async def tratar_erro_dados(_: Request, exc: ErroDados):
    return JSONResponse(status_code=HTTP_POR_CODIGO.get(exc.codigo, 422),
                        content=corpo_erro(exc.codigo, exc.mensagem, exc.sugestoes))


@app.exception_handler(RequestValidationError)
async def tratar_pedido_invalido(_: Request, exc: RequestValidationError):
    primeiro = exc.errors()[0]
    onde = ".".join(str(p) for p in primeiro["loc"] if p != "body")
    msg = primeiro["msg"].removeprefix("Value error, ")
    return JSONResponse(status_code=400, content=corpo_erro("PEDIDO_INVALIDO", f"{onde}: {msg}" if onde else msg))


# ============================================================================
# Montagem da resposta (CODIGO, nao LLM)
# ============================================================================
def extrair_saida(output) -> SaidaAgente:
    """Normaliza o que o Agentspan devolve (objeto, dict, ou dict embrulhado em 'result')."""
    if hasattr(output, "model_dump"):
        output = output.model_dump()
    if isinstance(output, dict) and isinstance(output.get("result"), dict):
        output = output["result"]
    try:
        return SaidaAgente.model_validate(output)
    except ValidationError as exc:
        log.error("Saida do agente invalida: %s", exc)
        raise ErroApi(502, "RESPOSTA_INVALIDA", "O agente devolveu uma resposta fora do formato esperado.") from exc


def montar_resposta(req: AnaliseRequest, saida: SaidaAgente) -> dict:
    f = req.filtros
    # Prioridade: filtros explicitos > o que o agente decidiu
    variavel = f.variavel or saida.variavel or ""
    lat, lon, local = (f.regiao.lat, f.regiao.lon, "") if f.regiao else (saida.lat, saida.lon, saida.local or "")
    periodo = f.periodo or saida.periodo
    inicio, fim = (periodo.inicio, periodo.fim) if periodo else ("", "")

    r = dados.consultar(variavel, local, lat, lon, inicio, fim)       # levanta ErroDados -> 404/422
    ini_real, fim_real = r.periodo
    est = r.estatisticas
    meta = r.meta
    lat_s = meta.get("lat_celula")
    lon_s = meta.get("lon_celula")
    ok_celula = lat_s is not None and lon_s is not None and not (math.isnan(lat_s) or math.isnan(lon_s))

    inferido = [campo for campo, dado in (("variavel", f.variavel), ("regiao", f.regiao)) if dado is None]
    if f.periodo is None and saida.periodo is not None:
        inferido.append("periodo")

    avisos = list(r.avisos)
    if f.resolucao == "diaria":
        avisos.append("Resolucao diaria indisponivel; foram usados dados mensais.")
    avisos.append("Teste de tendencia ainda nao ligado nesta fase: apenas estatisticas descritivas.")
    # O texto do LLM pode ter sido escrito para outros dados se os filtros o contrariaram
    if (saida.variavel and saida.variavel != r.variavel) or (saida.local and saida.local != r.local["id"]):
        log.warning("Agente usou (%s, %s) mas os filtros resolveram para (%s, %s)",
                    saida.variavel, saida.local, r.variavel, r.local["id"])
        avisos.append("Atencao: o texto pode referir-se a outra variavel/local; os dados mostrados seguem os filtros.")
    avisos += [a for a in saida.avisos if a not in avisos]

    regiao = f.regiao or Regiao(lat=r.local["lat"], lon=r.local["lon"], nome=r.local["nome"])
    interpretacao = Interpretacao(
        variavel=r.variavel, regiao=regiao, resolucao="mensal",
        periodo=Periodo(inicio=ini_real, fim=fim_real), inferido_pelo_agente=inferido,
        local_usado=LocalUsado(id=r.local["id"], nome=r.local["nome"], distancia_km=round(r.distancia_km, 1)),
    )
    serie = SerieDados(
        variavel=r.variavel, nome=r.nome, unidade=r.unidade,
        lat=lat_s if ok_celula else r.local["lat"], lon=lon_s if ok_celula else r.local["lon"],
        resolucao="mensal",
        pontos=[Ponto(t=t.strftime("%Y-%m-%d"), valor=float(v)) for t, v in zip(r.df["t"], r.df["valor"])],
    )
    fonte = Fonte(
        nome=f"{meta['produto']} v{meta['versao']} (variavel {meta['variavel_tecnica']})",
        produto_id=f"{meta['produto']}_{meta['versao']}", instituicao="NASA GES DISC",
        url=f"https://cmr.earthdata.nasa.gov/search/collections.json?short_name={meta['produto']}&version={meta['versao']}",
        acessado_em=dados.indice().get("gerado_em", ""),             # data de geracao dos dados pre-calculados
    )
    return ResponseModel(
        interpretacao=interpretacao, resposta_IA=saida.resposta_IA, resumo_executivo=saida.resumo_executivo,
        estatisticas=[Estatistica(variavel=r.variavel, unidade=r.unidade, **est)],
        trends=[Trend(**t) for t in dados.calcular_tendencias(r)],
        dados=[serie], fontes=[fonte], avisos=avisos,
    ).model_dump()


@app.post("/webhook")                 # endpoint de teste
@app.post("/internal/analisar")       # endpoint definido na ARQUITETURA.md (chamado pela API C#)
async def analisar(req: AnaliseRequest):
    entrada = req.model_dump(mode="json", exclude_none=True)         # menos tokens para o LLM
    log.info("Pedido recebido: %s", entrada)
    t0 = time.time()
    try:
        resultado = run(pesquisador, entrada, runtime=runtime_instance)
    except Exception as exc:
        log.exception("Falha ao executar o agente.")
        raise ErroApi(502, "FONTE_INDISPONIVEL", f"Falha no serviço de IA: {exc}") from exc
    t_agente = time.time() - t0
    saida = extrair_saida(resultado.output)
    resposta = montar_resposta(req, saida)
    log.info("Tempos: agente=%.1fs, montagem=%.3fs", t_agente, time.time() - t0 - t_agente)
    return resposta


@app.get("/internal/health")
async def health():
    return {"servico_dados": "ok"}