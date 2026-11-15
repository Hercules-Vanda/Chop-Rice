using System.Text.Json;
using System.Text.Json.Serialization;
using TrendDetective.Api.Models;
using TrendDetective.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ==========================================
// 1. CONFIGURAÇÕES GLOBAIS DA API
// ==========================================

// Configura o serializador JSON para usar snake_case (exigido pelo contrato unificado com o React)
// e ignora propriedades nulas para limpar o payload enviado ao front-end.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

// Configura o cliente HTTP unificado para comunicar com o microsserviço Python (FastAPI)
// Porta padrão do Python: 8000
builder.Services.AddHttpClient("PythonDataService", client =>
{
    client.BaseAddress = new Uri("http://localhost:8000/");
    client.Timeout = TimeSpan.FromSeconds(50); // Timeout alargado para processamento pesado de satélite
});

// Regista o serviço de negócio no contentor de Injeção de Dependências (DI)
builder.Services.AddScoped<ITrendAnalysisService, TrendAnalysisService>();

// Configura o CORS para permitir que a aplicação React (porta 5173 do Vite) aceda a esta API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Ativa as políticas de CORS e redirecionamento HTTPS
app.UseCors("AllowReactApp");
app.UseHttpsRedirection();

// ==========================================
// 2. DEFINIÇÃO DE ENDPOINTS PÚBLICOS
// ==========================================

/// <summary>
/// POST /api/analise
/// Endpoint principal: Recebe a consulta em linguagem natural ou filtros do utilizador,
/// reencaminha para o Python processar a tendência estatística e devolve o resultado.
/// </summary>
app.MapPost("/api/analise", async (AnaliseRequest request, ITrendAnalysisService service) =>
{
    // Validação básica de segurança do pedido
    if (string.IsNullOrWhiteSpace(request.Consulta) && request.Filtros == null)
    {
        return Results.BadRequest(new { 
            erro = new { 
                codigo = "PEDIDO_INVALIDO", 
                mensagem = "Deve fornecer pelo menos uma consulta em linguagem natural ou filtros válidos." 
            } 
        });
    }

    var resultado = await service.ProcessarAnaliseAsync(request);
    return Results.Ok(resultado);
});

/// <summary>
/// GET /api/variaveis
/// Devolve o catálogo de variáveis de satélite disponíveis (ex: Precipitação, Temperatura)
/// para popular os filtros dinâmicos na interface do React.
/// </summary>
app.MapGet("/api/variaveis", async (ITrendAnalysisService service) =>
{
    var variaveis = await service.ObterVariaveisAsync();
    return Results.Ok(variaveis);
});

/// <summary>
/// GET /api/exemplos
/// Devolve demonstrações pré-calculadas para testes rápidos do front-end.
/// </summary>
app.MapGet("/api/exemplos", async (ITrendAnalysisService service) =>
{
    var exemplos = await service.ObterExemplosAsync();
    return Results.Ok(exemplos);
});

/// <summary>
/// GET /api/health
/// Endpoint de diagnóstico unificado: Verifica se o C# e o serviço Python estão online.
/// </summary>
app.MapGet("/api/health", async (IHttpClientFactory clientFactory) =>
{
    try
    {
        var client = clientFactory.CreateClient("PythonDataService");
        var response = await client.GetAsync("health");
        var pythonStatus = response.IsSuccessStatusCode ? "ok" : "degraded";
        return Results.Ok(new { api = "ok", servico_dados = pythonStatus });
    }
    catch
    {
        return Results.Ok(new { api = "ok", servico_dados = "offline (usando fallback mock de segurança)" });
    }
});

// Arranca a API na porta 5000
app.Run("http://localhost:5000");