import type {
  PedidoAnalise,
  Resolucao,
  Interpretacao,
  FiltrosForm,
} from '../utils/types'

export const FILTROS_VAZIOS: FiltrosForm = {
  lat: '',
  lon: '',
  resolucao: '',
  variavel: '',
  inicio: '',
  fim: '',
}

/** Início do período disponível acordado; usado quando nenhuma variável está escolhida. */
export const PERIODO_INICIO_DISPONIVEL = '2001-01'

export const EXEMPLO_PROMPT =
  'A precipitação mensal em Luanda, Angola, diminuiu entre 2001 e 2024?'
export const PASSOS = ['A interpretar', 'A obter dados', 'A calcular']
export const ROTULO_RESOLUCAO: Record<Resolucao, string> = {
  mensal: 'Mensal',
  diaria: 'Diária',
}

export const temFiltro = (f: FiltrosForm) =>
  Object.values(f).some((v) => v.trim() !== '')

export function validar(f: FiltrosForm): string | null {
  const temLat = f.lat.trim() !== ''
  const temLon = f.lon.trim() !== ''
  if (temLat !== temLon)
    return 'Preencha latitude e longitude, ou deixe as duas vazias.'
  if (temLat) {
    const lat = Number(f.lat)
    const lon = Number(f.lon)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
      return 'A latitude deve estar entre -90 e 90.'
    if (!Number.isFinite(lon) || lon < -180 || lon > 180)
      return 'A longitude deve estar entre -180 e 180.'
  }
  if ((f.inicio === '') !== (f.fim === ''))
    return 'Preencha início e fim do período, ou deixe os dois vazios.'
  if (f.inicio && f.fim && f.inicio > f.fim)
    return 'O início do período deve ser anterior ao fim.'
  return null
}

export function montarPedido(consulta: string, f: FiltrosForm): PedidoAnalise {
  const c = consulta.trim()
  return {
    ...(c ? { consulta: c } : {}),
    filtros: {
      regiao:
        f.lat.trim() && f.lon.trim()
          ? { tipo: 'ponto', lat: Number(f.lat), lon: Number(f.lon) }
          : null,
      resolucao: f.resolucao || null,
      variavel: f.variavel || null,
      periodo: f.inicio && f.fim ? { inicio: f.inicio, fim: f.fim } : null,
    },
  }
}

/** `interpretacao` preenche os filtros com o que o agente entendeu; o utilizador vê e corrige. */
export function formDeInterpretacao(i: Interpretacao): FiltrosForm {
  return {
    lat: String(i.regiao.lat),
    lon: String(i.regiao.lon),
    resolucao: i.resolucao,
    variavel: i.variavel,
    inicio: i.periodo.inicio,
    fim: i.periodo.fim,
  }
}

const nf = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 3 })
export const fmt = (n: number) => nf.format(n)
