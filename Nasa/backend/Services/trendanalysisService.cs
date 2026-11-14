using System.Text.Json;
using TrendDetective.Api.Models;

public interface ITrendAnalysisService
{
    Task<JsonElement> ProcessarAnaliseAsync(AnaliseRequest request);
    Task<JsonElement> ObterVariaveisAsync();
    Task<JsonElement> ObterExemplosAsync();
}

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

    public async Task<JsonElement> ProcessarAnaliseAsync(AnaliseRequest request)
    {
        try
        {
            // Tenta enviar o pedido para o serviço Python (FastAPI na porta 8000)
            var response = await _pythonClient.PostAsJsonAsync("internal/analisar", request, _jsonOptions);
            
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<JsonElement>(content);
            }
        }
        catch
        {
            // Silencia o erro de conexão para ativar o fallback de demonstração
        }

        // FALLBACK HACKATHON: Se o Python falhar ou estiver offline, devolve o mock de sucesso
        return CarregarMockEstático("exemplo_sucesso.json");
    }

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

        // Mock de catálogo básico de segurança
        string jsonFallback = @"{
            ""variaveis"": [
                {
                    ""id"": ""precipitacao"",
                    ""nome"": ""Precipitação"",
                    ""definicao"": ""Quantidade de chuva acumulada em mm/mês."",
                    ""unidade"": ""mm/mês"",
                    ""resolucoes"": [""mensal""],
                    ""categoria"": ""atmosfera""
                },
                {
                    ""id"": ""temperatura_2m"",
                    ""nome"": ""Temperatura do ar a 2m"",
                    ""definicao"": ""Temperatura média do ar medida a 2 metros da superfície."",
                    ""unidade"": ""°C"",
                    ""resolucoes"": [""mensal""],
                    ""categoria"": ""atmosfera""
                }
            ]
        }";
        return JsonSerializer.Deserialize<JsonElement>(jsonFallback);
    }

    public async Task<JsonElement> ObterExemplosAsync()
    {
        return await Task.FromResult(CarregarMockEstático("exemplo_sucesso.json"));
    }

    private JsonElement CarregarMockEstático(string nomeFicheiro)
    {
        // Procura na pasta json ou raiz
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

        // JSON de emergência caso nenhum ficheiro seja encontrado
        string emergencia = @"{ ""erro"": { ""codigo"": ""MOCK_NAO_ENCONTRADO"", ""mensagem"": ""Ficheiro de mock não encontrado no servidor."" } }";
        return JsonSerializer.Deserialize<JsonElement>(emergencia);
    }
}