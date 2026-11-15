import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { IconeMenu } from '../icons/icons'
// API
import { analisar, variaveisQueryOptions, ApiError } from '../api/api'
// Utilitarios
import {
  FILTROS_VAZIOS,
  montarPedido,
  formDeInterpretacao,
  validar,
  temFiltro,
  EXEMPLO_PROMPT
} from '../utils/handlers'
import type {
  RespostaAnalise,
  DetalheErro,
  FiltrosForm,
  CampoFiltro,
  PedidoAnalise,
} from '../utils/types'
// Componentes
import BarraLateral from '../components/barralateral'
import Rodape from '../components/prompt'
import RespostaView from '../components/resposta'
import CartaoErro from '../components/carderro'
import CartaoVazio from '../components/cardvazio'
import Carregando from '../components/carregando'

export const Route = createFileRoute('/')({ component: Home })

interface Turno {
  id: number
  consulta: string
  estado: 'carregando' | 'ok' | 'erro'
  resposta?: RespostaAnalise
  erro?: DetalheErro
}

function Home() {
    const [menuAberto, setMenuAberto] = useState(false)
    const [turnos, setTurnos] = useState<Turno[]>([])
    const [filtros, setFiltros] = useState<FiltrosForm>(FILTROS_VAZIOS)
    const [inferidos, setInferidos] = useState<CampoFiltro[]>([])
    const [consulta, setConsulta] = useState('')
    const proximoId = useRef(0)
    const fimRef = useRef<HTMLDivElement>(null)

    const catalogo = useQuery(variaveisQueryOptions)
    const variaveis = catalogo.data?.variaveis ?? []
    const nomeDe = (id: string) =>
      variaveis.find((v) => v.id === id)?.nome ?? id

    const analise = useMutation<RespostaAnalise, ApiError, PedidoAnalise>({
      mutationFn: analisar,
    })

    const erroForm = validar(filtros)
    const podeEnviar =
      !analise.isPending &&
      !erroForm &&
      (consulta.trim() !== '' || temFiltro(filtros))

    useEffect(() => {
      const reduzir = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      fimRef.current?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth' })
    }, [turnos])

    function alterar(grupo: CampoFiltro, patch: Partial<FiltrosForm>) {
      setFiltros((f) => ({ ...f, ...patch }))
      setInferidos((s) => s.filter((c) => c !== grupo)) // o utilizador corrigiu: deixa de ser "inferido"
    }

    async function enviar() {
      const texto = consulta.trim()
      const pedido = montarPedido(texto, filtros)
      const id = ++proximoId.current
      setTurnos((t) => [...t, { id, consulta: texto, estado: 'carregando' }])
      setConsulta('')
      try {
        const r = await analise.mutateAsync(pedido)
        setTurnos((t) =>
          t.map((x) => (x.id === id ? { ...x, estado: 'ok', resposta: r } : x)),
        )
        setFiltros(formDeInterpretacao(r.interpretacao))
        setInferidos(r.interpretacao.inferido_pelo_agente)
      } catch (e) {
        const erro =
          e instanceof ApiError
            ? e.detalhe
            : { mensagem: 'Ocorreu um erro inesperado.' }
        setTurnos((t) =>
          t.map((x) => (x.id === id ? { ...x, estado: 'erro', erro } : x)),
        )
      }
    }

    /** Sugestão de erro: se for um id do catálogo, vira filtro de variável; senão vai para a pergunta. */
    function aplicarSugestao(s: string) {
      if (variaveis.some((v) => v.id === s))
        alterar('variavel', { variavel: s })
      else setConsulta((c) => (c ? `${c} ${s}` : s))
    }

    function novaConversa() {
      // TODO(nova conversa): ver passo 4 do fluxo no topo do ficheiro.
      setTurnos([])
      setFiltros(FILTROS_VAZIOS)
      setInferidos([])
      setConsulta('')
      setMenuAberto(false)
    }


    return (
      <div className="h-dvh bg-slate-50 text-slate-900">
        <BarraLateral
          aberta={menuAberto}
          aoFechar={() => setMenuAberto(false)}
          aoNovaConversa={novaConversa}
          conversas={[]}
        />

        <div className="flex h-full flex-col lg:pl-72">
          <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              className={`rounded-md p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600`}
              aria-label="Abrir menu do histórico"
              aria-expanded={menuAberto}
            >
              <IconeMenu />
            </button>
            <span className="text-sm font-medium">
              Earth System Trend Detective
            </span>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-3xl space-y-8">
              {turnos.length === 0 && (
                <CartaoVazio
                  aoUsarExemplo={() => setConsulta(EXEMPLO_PROMPT)}
                />
              )}

              {turnos.map((t) => (
                <div key={t.id} className="space-y-4">
                  <div className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-2.5 text-sm text-white">
                      {t.consulta ||
                        'Análise apenas com os filtros selecionados.'}
                    </p>
                  </div>
                  {t.estado === 'carregando' && <Carregando />}
                  {t.estado === 'erro' && t.erro && (
                    <CartaoErro
                      erro={t.erro}
                      nomeDe={nomeDe}
                      aoSugerir={aplicarSugestao}
                    />
                  )}
                  {t.estado === 'ok' && t.resposta && (
                    <RespostaView r={t.resposta} nomeDe={nomeDe} />
                  )}
                </div>
              ))}
              <div ref={fimRef} />
            </div>
          </main>

          <Rodape
            filtros={filtros}
            inferidos={inferidos}
            variaveis={variaveis}
            catalogoComErro={catalogo.isError}
            consulta={consulta}
            erroForm={erroForm}
            podeEnviar={podeEnviar}
            enviando={analise.isPending}
            aoAlterar={alterar}
            aoMudarConsulta={setConsulta}
            aoEnviar={enviar}
          />
        </div>
      </div>
    )
}
