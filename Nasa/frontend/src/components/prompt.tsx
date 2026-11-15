import type { FiltrosForm, CampoFiltro, VariavelCatalogo, Resolucao} from '../utils/types'
import { PERIODO_INICIO_DISPONIVEL, ROTULO_RESOLUCAO, } from '../utils/handlers'

interface RodapeProps {
  filtros: FiltrosForm
  inferidos: CampoFiltro[]
  variaveis: VariavelCatalogo[]
  catalogoComErro: boolean
  consulta: string
  erroForm: string | null
  podeEnviar: boolean
  enviando: boolean
  aoAlterar: (grupo: CampoFiltro, patch: Partial<FiltrosForm>) => void
  aoMudarConsulta: (v: string) => void
  aoEnviar: () => void
}

function Campo({
  rotulo,
  inferido,
  children,
}: {
  rotulo: string
  inferido: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">
      <span>
        {rotulo}
        {inferido && (
          <span className="ml-1.5 rounded bg-teal-100 px-1.5 py-0.5 text-[11px] text-teal-900">
            inferido pela IA
          </span>
        )}
      </span>
      {children}
    </label>
  )
}

const ENTRADA = `w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-teal-600`


export default function Rodape(p: RodapeProps) {
  const { filtros: f, inferidos } = p
  const inf = (c: CampoFiltro) => inferidos.includes(c)
  const selecionada = p.variaveis.find((v) => v.id === f.variavel)
  const resolucoes: Resolucao[] = selecionada
    ? selecionada.resolucoes
    : Array.from(new Set(p.variaveis.flatMap((v) => v.resolucoes)))
  const min =
    selecionada?.periodo_disponivel.inicio ?? PERIODO_INICIO_DISPONIVEL
  const max = selecionada?.periodo_disponivel.fim

  return (
    <footer className="border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Campo rotulo="Latitude" inferido={inf('regiao')}>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min={-90}
              max={90}
              placeholder="Inferir"
              value={f.lat}
              onChange={(e) => p.aoAlterar('regiao', { lat: e.target.value })}
              className={ENTRADA}
            />
          </Campo>
          <Campo rotulo="Longitude" inferido={inf('regiao')}>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min={-180}
              max={180}
              placeholder="Inferir"
              value={f.lon}
              onChange={(e) => p.aoAlterar('regiao', { lon: e.target.value })}
              className={ENTRADA}
            />
          </Campo>
          <Campo rotulo="Resolução" inferido={inf('resolucao')}>
            <select
              value={f.resolucao}
              onChange={(e) =>
                p.aoAlterar('resolucao', {
                  resolucao: e.target.value as Resolucao | '',
                })
              }
              className={ENTRADA}
            >
              <option value="">Inferir</option>
              {resolucoes.map((r) => (
                <option key={r} value={r}>
                  {ROTULO_RESOLUCAO[r]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Variável" inferido={inf('variavel')}>
            <select
              value={f.variavel}
              onChange={(e) => {
                const v = p.variaveis.find((x) => x.id === e.target.value)
                const manterRes =
                  !v || f.resolucao === '' || v.resolucoes.includes(f.resolucao)
                p.aoAlterar('variavel', {
                  variavel: e.target.value,
                  ...(manterRes ? {} : { resolucao: '' as const }),
                })
              }}
              className={ENTRADA}
            >
              <option value="">Inferir</option>
              {p.variaveis.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Período: início" inferido={inf('periodo')}>
            <input
              type="month"
              min={min}
              max={max}
              placeholder="AAAA-MM"
              value={f.inicio}
              onChange={(e) =>
                p.aoAlterar('periodo', { inicio: e.target.value })
              }
              className={ENTRADA}
            />
          </Campo>
          <Campo rotulo="Período: fim" inferido={inf('periodo')}>
            <input
              type="month"
              min={min}
              max={max}
              placeholder="AAAA-MM"
              value={f.fim}
              onChange={(e) => p.aoAlterar('periodo', { fim: e.target.value })}
              className={ENTRADA}
            />
          </Campo>
        </div>

        <p className="text-xs text-slate-600" aria-live="polite">
          {p.erroForm ??
            (p.catalogoComErro
              ? 'Não foi possível carregar o catálogo de variáveis; pode escrever a variável na pergunta.'
              : selecionada
                ? selecionada.definicao
                : 'Campos vazios são inferidos a partir da pergunta.')}
        </p>

        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20">
          <textarea
            rows={1}
            value={p.consulta}
            onChange={(e) => p.aoMudarConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (p.podeEnviar) p.aoEnviar()
              }
            }}
            placeholder="Ex.: A precipitação em Luanda está a diminuir?"
            aria-label="Pergunta"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={p.aoEnviar}
            disabled={!p.podeEnviar}
            className={`h-10 shrink-0 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-teal-600`}
          >
            {p.enviando ? 'A analisar…' : 'Analisar'}
          </button>
        </div>
      </div>
    </footer>
  )
}