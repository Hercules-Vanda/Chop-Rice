import { queryOptions } from "@tanstack/react-query"
import type {
  PedidoAnalise,
  RespostaAnalise,
  ErroApi,
  VariavelCatalogo,
  DetalheErro,
} from '../utils/types'

const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  detalhe: DetalheErro
  constructor(detalhe: DetalheErro) {
    super(detalhe.mensagem)
    this.detalhe = detalhe
  }
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${caminho}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError({
      mensagem:
        'Não foi possível contactar a API. Verifique a ligação e tente novamente.',
    })
  }
  if (!res.ok) {
    let corpo: ErroApi | null = null
    try {
      corpo = (await res.json()) as ErroApi
    } catch {
      /* resposta sem JSON */
    }
    throw new ApiError(
      corpo?.erro ?? { mensagem: `Erro ${res.status} ao contactar a API.` },
    )
  }
  return (await res.json()) as T
}

export const analisar = (pedido: PedidoAnalise) =>
  pedir<RespostaAnalise>('/analise', {
    method: 'POST',
    body: JSON.stringify(pedido),
  })

export const variaveisQueryOptions = queryOptions({
  queryKey: ['variaveis'],
  queryFn: () => pedir<{ variaveis: VariavelCatalogo[] }>('/variaveis'),
  staleTime: 5 * 60 * 1000,
})
