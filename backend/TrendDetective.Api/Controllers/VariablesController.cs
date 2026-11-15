using Microsoft.AspNetCore.Mvc;

namespace TrendDetective.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VariablesController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetVariables()
        {
            var variables = new[]
            {
                new { id = "precipitation", name = "Precipitação Mensal", unit = "mm", description = "Quantidade de precipitação acumulada." },
                new { id = "temperature", name = "Temperatura Média de Superfície", unit = "°C", description = "Temperatura média registada." },
                new { id = "soil_moisture", name = "Humidade do Solo", unit = "%", description = "Nível de humidade nas camadas superiores do solo." },
                new { id = "vegetation_index", name = "Índice de Vegetação (NDVI)", unit = "índice", description = "Indicador de cobertura vegetal e saúde da planta." }
            };

            return Ok(variables);
        }
    }
}