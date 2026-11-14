# Earth System Trend Detective

> **README temporário.** Será substituído por uma versão completa no fim do hackathon.

Projecto para o desafio **"Be An Earth System Trend Detective!"** do NASA Space Apps Challenge 2026.

Ferramenta web que permite escolher uma variável de ciência da Terra (precipitação, temperatura, umidade do solo, ...) e uma região, visualizar a sua série temporal e determinar **o que muda, onde, quanto e se a mudança é estatisticamente significativa**. O utilizador pode usar filtros, uma pergunta em linguagem natural, ou ambos.

## Equipa

| Pessoa | Responsabilidade |
|---|---|
| Hendry | Front-end (React) |
| Ruben | Back-end (API C#) |
| Justo | Apoio front-end e back-end |
| Hércules | Serviço de dados e IA (Python) |

## Arquitectura (resumo)

```
React (frontend)  ->  API C# (backend)  ->  Serviço Python (data-service)  ->  APIs NASA
```

- **frontend/**: tela única com filtros, campo de pesquisa com IA e gráfico.
- **backend/**: API pública (`POST /api/analise`, `GET /api/variaveis`, `GET /api/exemplos`, `GET /api/health`).
- **data-service/**: agente que interpreta a consulta, obtém os dados da NASA, calcula a estatística (Mann-Kendall, Sen's slope) e redige a resposta.

Detalhes e contrato JSON completo: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Estrutura do repositório

```
.
├── docs/                # arquitectura e contrato (JSON de exemplo)
├── frontend/            # React + TypeScript
├── backend/             # ASP.NET Core
├── data-service/        # FastAPI + agente de IA + conectores NASA
│   └── app/catalogo/catalogo.yml   # catálogo de variáveis
├── .env.example
└── README.md
```

## Pré-requisitos

- Node.js (versão LTS) e npm
- .NET SDK (versão a definir pelo Ruben)
- Python 3.11+
- Conta gratuita no [NASA Earthdata Login](https://urs.earthdata.nasa.gov/) (para o token)
- Chave de API do fornecedor de LLM escolhido

## Configuração

1. Copiar as variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
2. Preencher `EARTHDATA_TOKEN` e `LLM_API_KEY` no `.env`. **Nunca fazer commit do `.env`.**

## Como executar (desenvolvimento)

> Os comandos exactos serão confirmados por cada responsável. Valores abaixo são o ponto de partida.

**Serviço de dados** (porta 8000)
```bash
cd data-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**API** (porta 5000)
```bash
cd backend/TrendDetective.Api
dotnet run
```

**Front-end** (porta 5173)
```bash
cd frontend
npm install
npm run dev
```

## Validar o catálogo de variáveis

```bash
cd data-service
pip install pyyaml requests
python scripts/validar_catalogo.py
```

Confirma no CMR se os produtos do `catalogo.yml` existem e qual a cobertura temporal.

## Regras da equipa

- O contrato da API está em `docs/ARQUITETURA.md` (secção 2). **Qualquer alteração é comunicada ao grupo antes de ser implementada.**
- Segredos só no `.env` local. O `.env.example` é o único ficheiro de configuração versionado.
- Não fazer commit de ficheiros de dados descarregados (`.nc`, `.hdf`, etc.).

## Fontes de dados

NASA Earthdata (CMR, GES DISC, AppEEARS) e produtos GPM IMERG, MERRA-2, GLDAS e MODIS. Os dados NASA são abertos, mas cada serviço tem os seus termos de uso.

## Licença

A definir.
