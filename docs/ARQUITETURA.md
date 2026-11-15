# Earth System Trend Detective — Arquitetura

> NASA Space Apps 2026 · Desafio "Be An Earth System Trend Detective!"
> Stack: **React** (front) · **C# / ASP.NET Core** (API) · **Python** (serviço de dados + agente IA)

## 1. Visão geral

Uma única tela. O utilizador escolhe filtros (região, resolução, variável, período) e/ou escreve uma pergunta em linguagem natural. O sistema devolve: texto explicativo, estatísticas, teste de tendência e séries temporais para desenhar o gráfico.

```
┌──────────┐  POST /api/analise   ┌────────────┐  POST /internal/analisar  ┌──────────────────────────┐
│  React   │ ───────────────────► │  API C#    │ ────────────────────────► │  Serviço Data/IA (Python) │
│ (Hendry) │ ◄─────────────────── │  (Ruben)   │ ◄──────────────────────── │  (Hércules)               │
└──────────┘      JSON            └────────────┘          JSON             │  1. Agente de intenção    │
                                                                           │  2. Tool de dados         │
                                                                           │  3. Estatística (código)  │
                                                                           │  4. Agente de redação     │
                                                                           └────────────┬─────────────┘
                                                                                        │ HTTPS
                                                          ┌─────────────────────────────┴───────────────┐
                                                          │ CMR (descoberta) · Cloud OPeNDAP /    │
                                                          │ Harmony / AppEEARS (valores)                │
                                                          └─────────────────────────────────────────────┘
```

### Princípio de design (importante)

**O LLM nunca calcula números.** O LLM faz duas coisas: (a) interpretar a consulta → parâmetros estruturados; (b) redigir o texto a partir de números já calculados. Declive, p-valor e médias são calculados por código determinístico (numpy/scipy/pymannkendall). Isto evita alucinação estatística, que é o pior defeito possível num projecto de "significância estatística".

### Responsabilidades

| Pessoa | Módulo |
|---|---|
| Hendry | Front React (tela única, gráfico, filtros) |
| Ruben | API C# (contrato público, validação, proxy para o serviço Python, cache) |
| Justo | Apoio front + back (integração, tipos partilhados, testes ponta a ponta) |
| Hércules | Serviço Data/IA (agente, tools de dados, estatística) |

---

## 2. Endpoints públicos (Front → API C#)

Base: `/api`. JSON em `snake_case` (configurar `JsonNamingPolicy.SnakeCaseLower` no C#).

### 2.1 `POST /api/analise` — endpoint principal

**Request**

```json
{
  "consulta": "A precipitação em Luanda está a diminuir?",
  "filtros": {
    "regiao": { "tipo": "ponto", "lat": -8.84, "lon": 13.23 },
    "resolucao": "mensal",
    "variavel": "precipitacao",
    "periodo": { "inicio": "2000-01", "fim": "2024-12" }
  }
}
```

Regras:

- `consulta` é opcional se houver filtros; **pelo menos um dos dois** é obrigatório (senão `400`).
- Todos os campos de `filtros` são **opcionais**. Campos `null`/ausentes → o agente tenta inferir a partir de `consulta`.
- **Filtros explícitos têm prioridade** sobre o que o agente inferir da consulta.
- `regiao.tipo`: `"ponto"` (`lat`, `lon`) ou `"bbox"` (`sul`, `oeste`, `norte`, `leste`). **MVP: só `ponto`.** `bbox` é o plano B (devolve a média espacial).
- `resolucao`: `"diaria"` | `"mensal"`. Por omissão: `"mensal"`.
- `variavel`: um `id` do catálogo (ver `GET /api/variaveis`).
- `periodo`: opcional. Por omissão: o máximo disponível para a variável (idealmente ≥ 10 anos).

**Response `200`**

```json
{
  "interpretacao": {
    "variavel": "precipitacao",
    "regiao": { "tipo": "ponto", "lat": -8.84, "lon": 13.23, "nome": "Luanda, Angola" },
    "resolucao": "mensal",
    "periodo": { "inicio": "2000-01", "fim": "2024-12" },
    "inferido_pelo_agente": ["regiao", "variavel"]
  },
  "resposta_IA": "Em Luanda, a precipitação mensal mostra uma tendência de ...",
  "resumo_executivo": "Tendência decrescente significativa (p < 0,05) de -0,8 mm/mês por década.",
  "estatisticas": [
    {
      "variavel": "precipitacao",
      "n_observacoes": 300,
      "media": 42.1,
      "desvio_padrao": 51.3,
      "minimo": 0.0,
      "maximo": 312.4,
      "unidade": "mm/mês"
    }
  ],
  "trends": [
    {
      "variavel": "precipitacao",
      "direcao": "decrescente",
      "declive": -0.08,
      "unidade_declive": "mm/mês por ano",
      "ic95": [-0.14, -0.02],
      "metodo": "Mann-Kendall + declive de Sen (medias anuais)",
      "estatistica": -2.41,
      "p_valor": 0.016,
      "significativo": true,
      "nivel_significancia": 0.05,
      "dessazonalizado": true
    }
  ],
  "dados": [
    {
      "variavel": "precipitacao",
      "nome": "Precipitação",
      "unidade": "mm/mês",
      "lat": -8.84,
      "lon": 13.23,
      "resolucao": "mensal",
      "declive": -0.08,
      "pontos": [
        { "t": "2000-01-01", "valor": 98.2 },
        { "t": "2000-02-01", "valor": 110.7 }
      ],
      "linha_tendencia": [
        { "t": "2000-01-01", "valor": 45.3 },
        { "t": "2024-12-01", "valor": 43.3 }
      ]
    }
  ],
  "fontes": [
    {
      "nome": "GPM IMERG Monthly v07",
      "produto_id": "GPM_3IMERGM_07",
      "instituicao": "NASA GES DISC",
      "url": "https://...",
      "acessado_em": "2026-10-04T14:22:00Z"
    }
  ],
  "avisos": [
    "Série com 25 anos; tendência calculada após remoção do ciclo sazonal."
  ]
}
```

Notas para o front:

- `dados` é um **array** (uma série por variável) para permitir comparar variáveis no futuro. O MVP usa `dados[0]`.
- O gráfico usa `pontos` (linha/pontos) + `linha_tendencia` (linha tracejada). O front **não recalcula nada**.
- `interpretacao` serve para o front **preencher os filtros** com o que o agente entendeu. O utilizador vê e corrige.
- `avisos` deve ser mostrado visivelmente (ex.: série curta, buracos nos dados, p-valor perto do limite).

**Erros** (formato único)

```json
{ "erro": { "codigo": "VARIAVEL_NAO_IDENTIFICADA", "mensagem": "Não consegui perceber que variável estudar.", "sugestoes": ["precipitacao", "temperatura_2m"] } }
```

| HTTP | `codigo` | Quando |
|---|---|---|
| 400 | `PEDIDO_INVALIDO` | Sem consulta e sem filtros; lat/lon fora de intervalo |
| 422 | `VARIAVEL_NAO_IDENTIFICADA` | Agente não consegue mapear para o catálogo |
| 422 | `REGIAO_NAO_IDENTIFICADA` | Agente não consegue obter coordenadas |
| 404 | `SEM_DADOS` | Variável/região/período sem cobertura |
| 422 | `SERIE_CURTA` | Menos de ~30 pontos mensais (teste não fiável) |
| 502 | `FONTE_INDISPONIVEL` | NASA fora do ar / erro de autenticação |
| 504 | `TIMEOUT` | Pedido excedeu o limite |

### 2.2 `GET /api/variaveis` — catálogo para os filtros

Alimenta o dropdown de variáveis (e é o mesmo catálogo que o agente usa).

```json
{
  "variaveis": [
    {
      "id": "precipitacao",
      "nome": "Precipitação",
      "definicao": "Quantidade de chuva acumulada.",
      "unidade": "mm/mês",
      "resolucoes": ["mensal"],
      "periodo_disponivel": { "inicio": "2000-06", "fim": "2025-12" },
      "categoria": "atmosfera"
    }
  ]
}
```

A `definicao` simples é pedida pelo desafio (público-alvo: estudantes).

### 2.3 `GET /api/exemplos` — demos pré-calculadas

Lista 2–3 análises prontas (mesmo formato do `200` acima, já em cache) para o utilizador "ver como funciona" e para a demo ao júri funcionar mesmo sem internet/NASA.

### 2.4 `GET /api/health`

`{ "api": "ok", "servico_dados": "ok" }`

---

## 3. Contrato interno (API C# → Serviço Python)

Serviço FastAPI. **Não exposto ao front.**

### `POST /internal/analisar`

- **Request:** idêntico ao de `POST /api/analise`.
- **Response:** idêntica ao `200` de `POST /api/analise`.
- **Erros:** mesmo formato `{ "erro": {...} }` com o mesmo `codigo`; o C# apenas repassa.

Assim o C# é uma camada fina: validar, cache, autenticação, CORS, logging, timeouts. **O contrato é um só**, e Ruben e Hércules podem trabalhar em paralelo com um JSON de exemplo (mock) desde o minuto 1.

Também: `GET /internal/variaveis` (catálogo) e `GET /internal/health`.

> **Entrega imediata (antes de tudo):** Hércules publica 2 ficheiros JSON de exemplo (`exemplo_sucesso.json`, `exemplo_erro.json`). Ruben faz o endpoint devolver esse mock; Hendry constrói o gráfico em cima dele.

---

## 4. Serviço Data/IA (Hércules)

### 4.1 Pipeline

```
consulta + filtros
      │
      ▼
[1] Agente de intenção (LLM, saída estruturada JSON)
      → variavel_id, lat/lon (geocodificação), resolucao, periodo
      │      (filtros explícitos sobrepõem-se)
      ▼
[2] Tool: obter_serie_temporal(variavel_id, lat, lon, resolucao, periodo)
      → lookup no catálogo → chama o conector certo → DataFrame (t, valor)
      │
      ▼
[3] Estatística (código, sem LLM)
      → limpeza, dessazonalização, Mann-Kendall, Sen's slope, IC95, estatísticas descritivas
      │
      ▼
[4] Agente de redação (LLM)
      → recebe os números calculados → escreve resposta_IA + resumo_executivo + avisos
      │
      ▼
montar JSON de resposta
```

Os passos [1] e [4] podem ser o mesmo modelo com prompts diferentes. O passo [3] **não é** um agente.

### 4.2 Catálogo curado de variáveis (decisão-chave)

Não deixar o agente "pesquisar" livremente em todo o CMR. Construir um **catálogo de ~10–15 variáveis** em `catalogo.yaml`, cada uma com o produto, o nome técnico da variável e o conector. Exemplo:

```yaml
precipitacao:
  nome: Precipitação
  produto: GPM_3IMERGM_07            # confirmar no CMR
  conector: opendap
  resolucoes: [mensal]
temperatura_2m:
  nome: Temperatura do ar a 2 m
  produto: MERRA2_400.tavgM_2d_slv_Nx   # variável T2M; confirmar no CMR
  conector: opendap
  resolucoes: [mensal]
umidade_solo:
  nome: Umidade do solo (0–10 cm)
  produto: GLDAS_NOAH025_M_v2.1        # variável SoilMoi0_10cm_inst
  conector: opendap
  resolucoes: [mensal]
evapotranspiracao:
  nome: Evapotranspiração
  produto: GLDAS_NOAH025_M_v2.1        # variável Evap_tavg
  conector: opendap
  resolucoes: [mensal]
ndvi:
  nome: Índice de vegetação (NDVI)
  produto: MOD13C2 (MODIS)
  conector: appeears
  resolucoes: [mensal]
```

O agente de intenção só pode escolher `id`s deste catálogo (isto também dá a lista para `GET /api/variaveis`). O CMR serve para **validar/confirmar** os produtos e as datas de cobertura e para listar o que existe.

### 4.3 Conectores de dados

Interface única para todas as fontes:

```python
class Conector(Protocol):
    def obter_serie(self, produto: str, variavel: str, lat: float, lon: float,
                    inicio: str, fim: str) -> pd.DataFrame:  # colunas: t, valor
        ...
```

Implementações (por ordem de prioridade): `OpendapConector`, `OpendapConector`, `AppeearsConector`. Ver secção 6.

### 4.4 Estatística (código, sem LLM — `dados.calcular_tendencia`, chamada dentro de `consultar`)

**Método único.** Não há uma tool por método: escolher o teste é uma decisão analítica fixa em código.

1. Usar só **anos completos** (12 meses). A média anual já remove o ciclo sazonal.
2. **Mann-Kendall** sobre as médias anuais → `p_valor`, `estatistica` (Z) e `direcao`.
3. **Declive de Sen** por ano (+ **IC95**) sobre as mesmas médias anuais (mesma série ⇒ `p_valor` e `ic95` coerentes).
4. `direcao` = `crescente`/`decrescente` **só se significativo** (alfa = `NIVEL_SIGNIFICANCIA`); caso contrário `sem_tendencia` (o `declive` continua a ser devolvido, com IC que inclui o zero).
5. `linha_tendencia`: 2 pontos (primeiro e último mês) da reta de Sen.
6. **Menos de `MIN_ANOS_TENDENCIA` (10) anos completos** → `trends` vazio, `dados[].declive = null` e um aviso. Não é erro.
7. Avisos automáticos: autocorrelação mensal alta (lag-1 ≥ 0,5) e "não significativo ≠ sem tendência".

**Porque médias anuais (simulação própria, 300 séries mensais sazonais, ruído AR(1) φ = 0,6, sem tendência real):** o Mann-Kendall sazonal, o MK em anomalias mensais e o OLS declararam tendência em ~30–36 % dos casos (nominal: 5 %); o Hamed-Rao, ~16–18 %; o pré-branqueamento (TFPW), ~42 %; o MK em médias anuais, ~5 %. O custo é o poder (≈28 % para 0,03/ano com 25 anos). O teste ADF (artigo de referência) **não** é teste de tendência (testa raiz unitária) e foi excluído. A autocorrelação (φ) é um pressuposto da simulação: confirmar com as séries reais.

### 4.5 Segurança e custos do agente

- Saída do agente de intenção validada com **Pydantic**; se falhar, 1 retry; senão `422`.
- Prompt de redação instruído a **só usar os números fornecidos** e a não afirmar causas (correlação ≠ causa).
- Timeouts de 30–45 s no total; cache por `(variavel, lat, lon, resolucao, periodo)` (arredondar lat/lon a ~0,25°).

---

### 4.6 Dados pré-calculados (decisão: a NASA é lenta de mais para pedidos ao vivo)

Ler 25 anos de um ponto via Cloud OPeNDAP demora ~12 min (≈2,4 s por granulo mensal), muito acima de um pedido interativo. Por isso as séries são **geradas offline** por `scripts/precalcular.py` e guardadas no repositório:

```
data-service/app/dados/
├── indice.json                  # locais, variáveis, unidades, produto/versão, célula de grelha usada
└── <variavel>/<local>.csv       # colunas: t, valor (já na unidade de exibição)
```

Consequências para o contrato:

- O agente escolhe **variável + local entre os pré-calculados**. Se o utilizador der coordenadas, usa-se o **local pré-calculado mais próximo** e devolve-se a distância; acima de um limite (ex.: 300 km) → erro `SEM_DADOS` com sugestões.
- `interpretacao` ganha o campo `local_usado`: `{ "id": "luanda", "nome": "Luanda, Angola", "distancia_km": 0.0 }`.
- Novo endpoint **`GET /api/locais`** (lista de locais disponíveis, de `indice.json`) para o front oferecer um seletor/mapa com marcadores em vez de clique livre.
- `periodo` passa a poder ser **cortado** (a série guardada é sempre 2000–2024; o filtro só restringe a janela).
- Estatística (Mann-Kendall, Sen) **continua a ser calculada no pedido**, a partir do CSV (milissegundos).
- `ANALISE_TIMEOUT_SECONDS` pode baixar para ~15 s (o gargalo passa a ser só o LLM).
- Para atualizar os dados: `uv run scripts/precalcular.py --forcar` e fazer commit dos CSV.
- `dados[].declive` é `null` (e `trends` vem vazio) quando a série tem menos de 10 anos completos.

> Mudança de contrato (`/api/locais`, `interpretacao.local_usado`): **avisar Ruben e Hendry antes de implementar.**

## 5. Front React (Hendry, com Justo)

Tela única:

- **Barra de pesquisa IA** (campo de texto + botão "Analisar").
- **Filtros**: seletor de região (mapa clicável → lat/lon e/ou inputs), `mensal/diária`, dropdown de variável (`GET /api/variaveis`), período.
- **Resultado**: `resumo_executivo` em destaque → gráfico (série + linha de tendência) → cartões de `estatisticas` e `trends` (badge "significativo / não significativo") → `resposta_IA` → `fontes` → `avisos`.
- Estados: *loading* (pode demorar 10–40 s: mostrar passos "A interpretar → A obter dados → A calcular"), erro (mostrar `mensagem` + `sugestoes` clicáveis), vazio.
- Biblioteca de gráficos sugerida: Recharts ou Plotly.js.
- Tipos TypeScript gerados a partir do contrato da secção 2.1 (única fonte de verdade).

> Se der tempo: globo 3D / mapa. **Não é pré-requisito** do desafio. Primeiro o fluxo ponta a ponta com um gráfico.

## 6. Acesso aos dados NASA

Ver secção "Fontes de dados" abaixo e o resumo na conversa. Requisitos comuns:

- Conta **NASA Earthdata Login** (gratuita) → criar **token** (Bearer) e guardá-lo em variável de ambiente, nunca no repositório.
- Cada API acima exige o token (ou `.netrc`) para descarregar dados.

### Fontes de dados

| Fonte | Para quê | Como acedemos | Notas |
|---|---|---|---|
| **CMR** (`cmr.earthdata.nasa.gov/search`) | Descobrir colecções/variáveis/cobertura. **Não devolve valores.** | REST (`/collections.json`, `/variables.json`) | Usar só para catálogo e metadados |
| **Cloud OPeNDAP (earthaccess + pydap + xarray)** | Série temporal de um ponto, sem descarregar ficheiros inteiros | `earthaccess.search_data` → URLs OPeNDAP com `?dap4.ce=/VAR;/lat;/lon;/time` → `xarray.open_mfdataset(engine="pydap")` | Base: notebook oficial do GES DISC. Requer as apps "NASA GES DISC DATA ARCHIVE" e "Hyrax in the Cloud" ativas no Earthdata. Data Rods (descontinuado) e a API de séries do Giovanni (500) foram descartados |
| **AppEEARS** | MODIS/VIIRS (NDVI, temperatura da superfície) | REST **assíncrono** (submeter tarefa → esperar → descarregar) | Lento: usar só se for imprescindível ou pré-calculado |
| **Giovanni** | Visualização/validação manual | Interface web | Usar para **comparar** os teus resultados; não é uma API estável |

## 7. Plano de integração

1. **Hora 0–2:** acordar este contrato; Hércules publica JSON mock; Ruben devolve o mock; Hendry desenha o gráfico a partir do mock.
2. **Hora 2–10:** Hércules: 1 variável ponta a ponta (precipitação, Luanda) com dados reais + estatística. Ruben: proxy real + validação + CORS. Hendry: filtros e estados.
3. **Hora 10–20:** agente de intenção; mais variáveis no catálogo; erros e avisos; cache.
4. **Hora 20+:** exemplos de demo, polimento, ensaio da apresentação.

**Regra:** qualquer mudança no contrato (secção 2.1) é avisada ao grupo **antes** de ser implementada.