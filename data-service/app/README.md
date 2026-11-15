## Primeiro passo: Executar o servidor agentspan
    uv run agentspan doctor // Para saber o estado do servidor, se está instalado corretamente, se falta java, etc 
    
    uv run agentspan server start
## Caso não reconhecer as chaves da API, execute isso no terminal (nesta pasta) antes de executar:
    $env:GEMINI_API_KEY="chavedeapi" // windows

    $env:GOOGLE_CLOUD_PROJECT="gen-lang-client-000000" // windows

    ou

    export GEMINI_API_KEY="chavedeapi" // linux

    export GOOGLE_CLOUD_PROJECT="gen-lang-client-000000" // linux

    CHAVE DE API GRAÇA: https://aistudio.google.com/app/api-keys

## Outros modelos para usar no .env:
    google_gemini/gemini-3.8-flash
    google_gemini/gemini-3.8-flash-lite

## Comandos útils
    uv run agentspan doctor
    uv run agentspan server start
    uv run agentspan server stop
## Execução: 
    uv run uvicorn main:app --reload
    Se tudo der certo, ele estará pronto para receber um POST em:
    http://localhost:8000/webhook
    Podes executar um POST De teste enquanto está a executar: 
    uv run webhook.py so_consulta

## Testar webhook:
    uv run .\webhook.py