using System.Text.Json;
using System.Text.Json.Serialization;
using TrendDetective.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Configurar conversão estrita para snake_case exigida pelo contrato com o React
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

// 2. Configurar cliente HTTP para comunicar com o Serviço Python (FastAPI na porta 8000)
builder.Services.AddHttpClient("PythonDataService", client =>
{
    client.BaseAddress = new Uri("http://localhost:8000/");
    client.Timeout = TimeSpan.FromSeconds(50);
});

// 3. Registar o serviço de lógica de negócio
builder.Services.AddScoped<ITrendAnalysisService, TrendAnalysisService>();

// 4. Configurar CORS para permitir que o Front-end React (porta 5173) consuma a API
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

app.UseCors("AllowReactApp");
app.UseHttpsRedirection();

// ==========================================
// ENDPOINTS PÚBLICOS (Contrato Seccao 2)
// ==========================================

// POST /api/analise — Endpoint principal
app.MapPost("/api/analise", async (AnaliseRequest request, ITrendAnalysisService service) =>
{
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

// GET /api/variaveis — Catálogo de variáveis para os filtros do Front
app.MapGet("/api/variaveis", async (ITrendAnalysisService service) =>
{
    var variaveis = await service.ObterVariaveisAsync();
    return Results.Ok(variaveis);
});

// GET /api/exemplos — Demos pré-calculadas para testar o sistema
app.MapGet("/api/exemplos", async (ITrendAnalysisService service) =>
{
    var exemplos = await service.ObterExemplosAsync();
    return Results.Ok(exemplos);
});

// GET /api/health — Verificação de saúde unificada
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
        return Results.Ok(new { api = "ok", servico_dados = "offline (usando fallback mock)" });
    }
});

app.Run("http://localhost:5000");