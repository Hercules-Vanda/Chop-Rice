export interface PontoSerie {
  periodo: string
  valor: number
}

export interface Estatistica {
  rotulo: string
  valor: string
  detalhe?: string
}

export interface Trend {
  variavel: string
  inclinacao: string
  p_valor: string
  significativo: boolean
}

export interface Fonte {
  titulo: string
  instituicao: string
  url?: string
}

export interface RespostaIA {
  resumo_executivo: string
  grafico: {
    titulo: string
    unidade: string
    serie: PontoSerie[]
  }
  estatisticas: Estatistica[]
  trends: Trend[]
  resposta_IA: string
  fontes: Fonte[]
  avisos: string[]
}

export interface Conversa {
  id: string
  titulo: string
  grupo: 'Hoje' | 'Ontem' | 'Últimos 7 dias'
}
