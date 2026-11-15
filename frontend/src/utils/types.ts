export type Resolucao = 'diaria' | 'mensal'
export type CampoFiltro = 'regiao' | 'resolucao' | 'variavel' | 'periodo'

export interface FiltrosForm {
  lat: string
  lon: string
  resolucao: Resolucao | ''
  variavel: string
  inicio: string
  fim: string
}

interface Ponto {
  tipo: 'ponto'
  lat: number
  lon: number
}
interface Periodo {
  inicio: string // "AAAA-MM"
  fim: string // "AAAA-MM"
}

export interface PedidoAnalise {
  consulta?: string
  filtros: {
    regiao: Ponto | null
    resolucao: Resolucao | null
    variavel: string | null
    periodo: Periodo | null
  }
}

export interface Interpretacao {
  variavel: string
  regiao: Ponto & { nome?: string }
  resolucao: Resolucao
  periodo: Periodo
  inferido_pelo_agente: CampoFiltro[]
}

interface Estatistica {
  variavel: string
  n_observacoes: number
  media: number
  desvio_padrao: number
  minimo: number
  maximo: number
  unidade: string
}

interface Trend {
  variavel: string
  direcao: string
  declive: number
  unidade_declive: string
  ic95: [number, number]
  metodo: string
  estatistica: number
  p_valor: number
  significativo: boolean
  nivel_significancia: number
  dessazonalizado: boolean
}

export interface SerieDados {
  variavel: string
  nome: string
  unidade: string
  lat: number
  lon: number
  resolucao: Resolucao
  declive: number
  pontos: { t: string; valor: number }[]
  linha_tendencia: { t: string; valor: number }[]
}

interface Fonte {
  nome: string
  produto_id: string
  instituicao: string
  url: string
  acessado_em: string
}

export interface RespostaAnalise {
  interpretacao: Interpretacao
  resposta_IA: string
  resumo_executivo: string
  estatisticas: Estatistica[]
  trends: Trend[]
  dados: SerieDados[] // o MVP usa dados[0]
  fontes: Fonte[]
  avisos: string[]
}

type CodigoErro =
  | 'PEDIDO_INVALIDO'
  | 'VARIAVEL_NAO_IDENTIFICADA'
  | 'REGIAO_NAO_IDENTIFICADA'
  | 'SEM_DADOS'
  | 'SERIE_CURTA'
  | 'FONTE_INDISPONIVEL'
  | 'TIMEOUT'

export interface ErroApi {
  erro: { codigo: CodigoErro; mensagem: string; sugestoes?: string[] }
}

export interface VariavelCatalogo {
  id: string
  nome: string
  definicao: string
  unidade: string
  resolucoes: Resolucao[]
  periodo_disponivel: Periodo
  categoria: string
}

export interface DetalheErro {
  mensagem: string
  sugestoes?: string[]
}
