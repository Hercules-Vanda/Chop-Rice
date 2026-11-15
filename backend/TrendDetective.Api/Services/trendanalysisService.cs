using System;
using System.Text.Json;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;

namespace TrendDetective.Api.Services
{
    public interface ITrendAnalysisService
    {
        Task<JsonElement> ProcessarAnaliseAsync(object request);
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

        public async Task<JsonElement> ProcessarAnaliseAsync(object request)
        {
            try
            {
                var response = await _pythonClient.PostAsJsonAsync("internal/analisar", request, _jsonOptions);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return JsonSerializer.Deserialize<JsonElement>(content);
                }
            }
            catch 
            {
            }

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

        private JsonElement CarregarMockEstático(string nomeFicheiro)
        {
            string jsonSucesso = """
            {
                "resumo_executivo": "A precipitação mensal em Luanda apresentou variações consistentes, com uma ligeira tendência de decréscimo entre 2001 e 2024.",
                "summary": "A precipitação mensal em Luanda apresentou variações consistentes, com uma ligeira tendência de decréscimo entre 2001 e 2024.",
                "grafico": {
                    "titulo": "Precipitação mensal em Luanda",
                    "unidade": "mm/mês",
                    "serie": [
                        { "periodo": "2001", "valor": 430.0 },
                        { "periodo": "2005", "valor": 405.2 },
                        { "periodo": "2010", "valor": 440.8 },
                        { "periodo": "2015", "valor": 370.5 },
                        { "periodo": "2020", "valor": 350.1 },
                        { "periodo": "2024", "valor": 330.0 }
                    ]
                },
                "estatisticas": [
                    { "rotulo": "Média do período", "valor": "385.2 mm" },
                    { "rotulo": "Máximo", "valor": "440.8 mm", "detalhe": "2010" },
                    { "rotulo": "Mínimo", "valor": "330.0 mm", "detalhe": "2024" },
                    { "rotulo": "Desvio-padrão", "valor": "42.1 mm" }
                ],
                "trends": [
                    {
                        "variavel": "Precipitação Mensal",
                        "inclinacao": "−4,1 mm / ano",
                        "p_valor": "0,03",
                        "significativo": true
                    }
                ],
                "resposta_IA": "Os dados indicam uma redução gradual na precipitação acumulada ao longo das últimas duas décadas em Luanda, com oscilações interanuais marcadas.",
                "fontes": [
                    {
                        "titulo": "Reanálise ERA5 / Séries Climáticas",
                        "instituicao": "Copernicus / ECMWF",
                        "url": "https://cds.climate.copernicus.eu"
                    }
                ],
                "avisos": [
                    "Dados de teste fornecidos em ambiente de desenvolvimento."
                ]
            }
            """;

            return JsonSerializer.Deserialize<JsonElement>(jsonSucesso);
        }
    }
}