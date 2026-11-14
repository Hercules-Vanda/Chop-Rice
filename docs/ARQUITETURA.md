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
                                                          │ CMR (descoberta) · Data Rods / OPeNDAP /    │
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
      "metodo": "mann_kendall + sen_slope",
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
  conector: data_rods
  resolucoes: [mensal]
evapotranspiracao:
  nome: Evapotranspiração
  produto: GLDAS_NOAH025_M_v2.1        # variável Evap_tavg
  conector: data_rods
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

Implementações (por ordem de prioridade): `DataRodsConector`, `OpendapConector`, `AppeearsConector`. Ver secção 6.

### 4.4 Estatística

1. Agregar/limpar: remover `fill values`, ordenar, detectar buracos.
2. **Remover o ciclo sazonal** (o próprio desafio diz que, sem isso, muitas tendências não aparecem): usar anomalias mensais (valor − climatologia do mês).
3. **Mann-Kendall** (`pymannkendall.original_test` ou `seasonal_test`) → `p_valor`, `direcao`.
4. **Sen's slope** → `declive` robusto + `ic95`.
5. Converter o declive para unidade legível (por ano/década).
6. Bloquear se `n < 30` (erro `SERIE_CURTA`) ou avisar se há muitos buracos.
7. Atenção: a autocorrelação serial infla a significância; usar `hamed_rao_modification_test` como alternativa.

### 4.5 Segurança e custos do agente

- Saída do agente de intenção validada com **Pydantic**; se falhar, 1 retry; senão `422`.
- Prompt de redação instruído a **só usar os números fornecidos** e a não afirmar causas (correlação ≠ causa).
- Timeouts de 30–45 s no total; cache por `(variavel, lat, lon, resolucao, periodo)` (arredondar lat/lon a ~0,25°).

---

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
| **Hydrology Time Series / Data Rods (GES DISC)** | Série temporal de um **ponto** (GLDAS, NLDAS, etc.) | HTTP GET com `variable`, `location`, `startDate`, `endDate` → texto/CSV | Mais simples para o MVP; confirmar quais produtos estão activos |
| **OPeNDAP / earthaccess** | Séries de qualquer produto com subsetting por ponto/região | `earthaccess` (Python) ou OPeNDAP + `xarray` | Mais geral; requer mais código |
| **AppEEARS** | MODIS/VIIRS (NDVI, temperatura da superfície) | REST **assíncrono** (submeter tarefa → esperar → descarregar) | Lento: usar só se for imprescindível ou pré-calculado |
| **Giovanni** | Visualização/validação manual | Interface web | Usar para **comparar** os teus resultados; não é uma API estável |

## 7. Plano de integração

1. **Hora 0–2:** acordar este contrato; Hércules publica JSON mock; Ruben devolve o mock; Hendry desenha o gráfico a partir do mock.
2. **Hora 2–10:** Hércules: 1 variável ponta a ponta (precipitação, Luanda) com dados reais + estatística. Ruben: proxy real + validação + CORS. Hendry: filtros e estados.
3. **Hora 10–20:** agente de intenção; mais variáveis no catálogo; erros e avisos; cache.
4. **Hora 20+:** exemplos de demo, polimento, ensaio da apresentação.

**Regra:** qualquer mudança no contrato (secção 2.1) é avisada ao grupo **antes** de ser implementada.
