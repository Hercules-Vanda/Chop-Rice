import type { Conversa, RespostaIA } from './types'

export const PERGUNTA_EXEMPLO =
  'Como evoluiu a anomalia de temperatura em Angola nos últimos 10 anos?'

export const RESPOSTA_EXEMPLO: RespostaIA = {
  resumo_executivo:
    'A temperatura média da superfície em Angola subiu cerca de 0,70 °C por década entre 2015 e 2024, com a anomalia a passar de +0,42 °C para +1,21 °C. A tendência é estatisticamente significativa.',
  grafico: {
    titulo: 'Anomalia anual da temperatura da superfície',
    unidade: '°C',
    serie: [
      { periodo: '2015', valor: 0.42 },
      { periodo: '2016', valor: 0.71 },
      { periodo: '2017', valor: 0.55 },
      { periodo: '2018', valor: 0.49 },
      { periodo: '2019', valor: 0.78 },
      { periodo: '2020', valor: 0.83 },
      { periodo: '2021', valor: 0.62 },
      { periodo: '2022', valor: 0.88 },
      { periodo: '2023', valor: 1.05 },
      { periodo: '2024', valor: 1.21 },
    ],
  },
  estatisticas: [
    { rotulo: 'Média do período', valor: '+0,75 °C' },
    { rotulo: 'Máximo', valor: '+1,21 °C', detalhe: '2024' },
    { rotulo: 'Mínimo', valor: '+0,42 °C', detalhe: '2015' },
    { rotulo: 'Desvio-padrão', valor: '0,25 °C' },
  ],
  trends: [
    {
      variavel: 'Temperatura da superfície',
      inclinacao: '+0,70 °C / década',
      p_valor: '0,002',
      significativo: true,
    },
    {
      variavel: 'Precipitação anual',
      inclinacao: '−12 mm / década',
      p_valor: '0,41',
      significativo: false,
    },
  ],
  resposta_IA:
    'Os dados mostram um aquecimento consistente ao longo da última década, com os anos de 2023 e 2024 a registarem os dois maiores valores da série. A variabilidade entre anos continua presente (por exemplo, a queda de 2021), mas a linha de tendência ajustada por regressão linear indica uma subida média de 0,07 °C por ano. A precipitação, ao contrário, não apresenta uma tendência distinguível da variabilidade natural neste período.',
  fontes: [
    {
      titulo: 'Reanálise ERA5 – temperatura a 2 m',
      instituicao: 'Copernicus / ECMWF',
      url: 'https://cds.climate.copernicus.eu',
    },
    {
      titulo: 'GISTEMP v4 – anomalias de temperatura',
      instituicao: 'NASA GISS',
      url: 'https://data.giss.nasa.gov/gistemp',
    },
  ],
  avisos: [
    'Dados ilustrativos, apenas para demonstração da interface.',
    'Uma década é um período curto para separar tendência de variabilidade climática.',
  ],
}

export const CONVERSAS: Conversa[] = [
  { id: '1', titulo: 'Anomalia de temperatura em Angola', grupo: 'Hoje' },
  { id: '2', titulo: 'Precipitação no Sahel, 2000–2020', grupo: 'Hoje' },
  { id: '3', titulo: 'Gelo marinho do Ártico', grupo: 'Ontem' },
  { id: '4', titulo: 'CO₂ atmosférico vs. temperatura', grupo: 'Ontem' },
  {
    id: '5',
    titulo: 'Nível do mar na costa atlântica',
    grupo: 'Últimos 7 dias',
  },
  { id: '6', titulo: 'Seca na Bacia do Cunene', grupo: 'Últimos 7 dias' },
]

export const FILTROS = {
  regiao: ['Angola', 'África Austral', 'África', 'Global'],
  resolucao: ['0,25°', '0,5°', '1°', '2,5°'],
  variavel: [
    'Temperatura da superfície',
    'Precipitação',
    'Umidade do solo',
    'Nível do mar',
    'Gelo marinho',
  ],
  periodo: ['2015–2024', '2005–2024', '1995–2024', '1980–2024'],
} as const
