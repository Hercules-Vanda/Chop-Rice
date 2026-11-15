using Microsoft.AspNetCore.Mvc;

namespace TrendDetective.Api.Controllers
{
    [ApiController]
    [Route("api/analise")]
    [Route("api/analisar")]
    public class AnaliseController : ControllerBase
    {
        [HttpPost]
        [HttpGet]
        public IActionResult Analisar([FromBody] object? payload = null)
        {
            // Retorno direto em memória, imune a ficheiros em falta
            var resultadoMock = new
            {
                success = true,
                summary = "A precipitação mensal em Luanda apresentou variações consistentes, com uma ligeira tendência de decréscimo entre 2001 e 2024.",
                location = "Luanda, Angola",
                variable = "Precipitação Mensal",
                period = "2001 - 2024",
                metrics = new
                {
                    averageValue = "385.2 mm",
                    trendDirection = "Decrescente",
                    confidenceLevel = "94.5%"
                },
                chartData = new[]
                {
                    new { year = 2001, value = 430.0 },
                    new { year = 2005, value = 405.2 },
                    new { year = 2010, value = 440.8 },
                    new { year = 2015, value = 370.5 },
                    new { year = 2020, value = 350.1 },
                    new { year = 2024, value = 330.0 }
                }
            };

            return Ok(resultadoMock);
        }
    }
}