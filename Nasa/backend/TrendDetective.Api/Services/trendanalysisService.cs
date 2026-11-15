using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using TrendDetective.Api.Models;

namespace TrendDetective.Api.Services;

/// <summary>
/// Interface que define os contratos de serviços de análise de tendências.
/// Facilita a manutenção e testes unitários.
/// </summary>
public interface ITrendAnalysisService
{
    Task<JsonElement> ProcessarAnaliseAsync(AnaliseRequest request);
    Task<JsonElement> ObterVariaveisAsync();
    Task<JsonElement> ObterExemplosAsync();
}

/// <summary>
/// Implementação do serviço responsável por comunicar com o motor Python
/// e garantir o mecanismo de fallback caso o Python ainda esteja offline.
/// </summary>
public class TrendAnalysisService : ITrendAnalysisService
{
    private readonly HttpClient _pythonClient;
    private readonly IWebHostEnvironment _env;
    private readonly JsonSerializerOptions _jsonOptions;

    public TrendAnalysisService(IHttpClientFactory httpClientFactory, IWebHostEnvironment env)
    {
        _pythonClient = httpClientFactory.CreateClient("PythonDataService");
        _env = env;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        };
    }

    /// <summary>
    /// Envia o pedido de análise para o FastAPI em Python.
    /// Se o Python falhar (ex: Hércules ainda a iniciar o script), ativa o Mock de segurança.
    /// </summary>
    public async Task<JsonElement> ProcessarAnaliseAsync(AnaliseRequest request)
    {
        try
        {
            var response = await _pythonClient.PostAsJsonAsync("http://127.0.0.1:8000", request, _jsonOptions);
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<JsonElement>(content);
            }
        }
        catch 
        {
            // Silencia a exceção de rede para permitir o fallback automático no hackathon
        }

        // FALLBACK: Devolve o JSON estático de sucesso se o motor Python não responder
        return CarregarMockEstático("exemplo_sucesso.json");
    }

    /// <summary>
    /// Obtém as variáveis ambientais suportadas pelo sistema.
    /// </summary>
    public async Task<JsonElement> ObterVariaveisAsync()
    {
        try
        {
            var response = await _pythonClient.GetAsync("internal/variaveis");
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<JsonElement>(content);
            }
        }
        catch { }

        // Fallback de segurança para catálogo de variáveis
        string jsonFallback = """
        {
            "variaveis": [
                {
                    "id": "precipitacao",
                    "nome": "Precipitação",
                    "definicao": "Quantidade de chuva acumulada em mm/mês.",
                    "unidade": "mm/mês",
                    "resolucoes": ["mensal"],
                    "categoria": "atmosfera"
                }
            ]
        }
        """;
        return JsonSerializer.Deserialize<JsonElement>(jsonFallback);
    }

    public async Task<JsonElement> ObterExemplosAsync()
    {
        return await Task.FromResult(CarregarMockEstático("exemplo_sucesso.json"));
    }

    /// <summary>
    /// Método auxiliar privado para ler ficheiros JSON locais de mock na pasta raiz/docs.
    /// </summary>
    private JsonElement CarregarMockEstático(string nomeFicheiro)
    {
        string caminho = Path.Combine(_env.ContentRootPath, "..", "..", "json", nomeFicheiro);
        if (!File.Exists(caminho))
        {
            caminho = Path.Combine(_env.ContentRootPath, nomeFicheiro);
        }

        if (File.Exists(caminho))
        {
            string jsonText = File.ReadAllText(caminho);
            return JsonSerializer.Deserialize<JsonElement>(jsonText);
        }

        string emergencia = """{ "erro": { "codigo": "MOCK_NAO_ENCONTRADO", "mensagem": "Ficheiro de mock não encontrado." } }""";
        return JsonSerializer.Deserialize<JsonElement>(emergencia);
    }
}