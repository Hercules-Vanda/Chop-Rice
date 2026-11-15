namespace TrendDetective.Api.Models;

public record AnaliseRequest(
    string? Consulta,
    FiltrosDto? Filtros
);

public record FiltrosDto(
    RegiaoDto? Regiao,
    string? Resolucao,
    string? Variavel,
    PeriodoDto? Periodo
);

public record RegiaoDto(
    string Tipo,
    double? Lat,
    double? Lon,
    double? Sul,
    double? Oeste,
    double? Norte,
    double? Leste
);

public record PeriodoDto(
    string? Inicio,
    string? Fim
);