import { useMemo } from 'react'
// Utilitários
import { fmt, ROTULO_RESOLUCAO } from '../utils/handlers'
import type { SerieDados, RespostaAnalise } from '../utils/types'
// Grafico
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function Badge({ significativo }: { significativo: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        significativo
          ? 'bg-teal-100 text-teal-900'
          : 'bg-slate-200 text-slate-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${significativo ? 'bg-teal-600' : 'bg-slate-500'}`}
        aria-hidden
      />
      {significativo ? 'Significativo' : 'Não significativo'}
    </span>
  )
}

function Grafico({ serie }: { serie: SerieDados }) {
  // Apenas junta pontos e linha_tendencia pelo instante `t`; o front não recalcula nada.
  const linhas = useMemo(() => {
    const m = new Map<
      number,
      { ts: number; valor?: number; tendencia?: number }
    >()
    for (const p of serie.pontos) {
      const ts = Date.parse(p.t)
      m.set(ts, { ts, valor: p.valor })
    }
    for (const p of serie.linha_tendencia) {
      const ts = Date.parse(p.t)
      m.set(ts, { ...(m.get(ts) ?? { ts }), tendencia: p.valor })
    }
    return Array.from(m.values()).sort((a, b) => a.ts - b.ts)
  }, [serie])

  const data = (ts: number) =>
    new Date(ts).toISOString().slice(0, serie.resolucao === 'mensal' ? 7 : 10)

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={linhas}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ts: number) =>
              String(new Date(ts).getUTCFullYear())
            }
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
            labelFormatter={(ts) => data(Number(ts))}
            formatter={(v, n) => [`${fmt(Number(v))} ${serie.unidade}`, n]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="valor"
            name="Série observada"
            stroke="#0f766e"
            strokeWidth={2}
            dot={linhas.length <= 60}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="tendencia"
            name="Linha de tendência"
            stroke="#d97706"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function RespostaView({
  r,
  nomeDe,
}: {
  r: RespostaAnalise
  nomeDe: (id: string) => string
}) {
  const serie = r.dados[0]
  const nomeRegiao =
    r.interpretacao.regiao.nome ??
    `${fmt(r.interpretacao.regiao.lat)}, ${fmt(r.interpretacao.regiao.lon)}`

  return (
    <article className="space-y-5">
      <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <h2 className="text-sm font-semibold text-teal-900">
          Resumo executivo
        </h2>
        <p className="mt-2 text-lg leading-relaxed text-teal-950">
          {r.resumo_executivo}
        </p>
      </section>

      {(
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {serie.nome}{' '}
            <span className="font-normal text-slate-500">
              ({serie.unidade})
            </span>
          </h3>
          <p className="text-xs text-slate-600">
            {nomeRegiao}, {ROTULO_RESOLUCAO[serie.resolucao].toLowerCase()},{' '}
            {r.interpretacao.periodo.inicio} a {r.interpretacao.periodo.fim}
          </p>
          <div className="mt-3">
            <Grafico serie={serie} />
          </div>
        </section>
      )}

      <section aria-labelledby="estatisticas-titulo">
        <h3
          id="estatisticas-titulo"
          className="mb-2 text-sm font-semibold text-slate-900"
        >
          Estatísticas
        </h3>
        <div className="space-y-3">
          {r.estatisticas.map((e) => {
            const campos: [string, string][] = [
              ['Observações', String(e.n_observacoes)],
              ['Média', `${fmt(e.media)} ${e.unidade}`],
              ['Desvio-padrão', `${fmt(e.desvio_padrao)} ${e.unidade}`],
              ['Mínimo', `${fmt(e.minimo)} ${e.unidade}`],
              ['Máximo', `${fmt(e.maximo)} ${e.unidade}`],
            ]
            return (
              <div key={e.variavel}>
                {r.estatisticas.length > 1 && (
                  <p className="mb-1 text-xs text-slate-600">
                    {nomeDe(e.variavel)}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {campos.map(([rotulo, valor]) => (
                    <div
                      key={rotulo}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <p className="text-xs text-slate-500">{rotulo}</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {valor}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="trends-titulo">
        <h3
          id="trends-titulo"
          className="mb-2 text-sm font-semibold text-slate-900"
        >
          Tendências
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {r.trends.map((t) => (
            <div
              key={t.variavel}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">
                  {nomeDe(t.variavel)}
                </p>
                <Badge significativo={t.significativo} />
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {fmt(t.declive)}{' '}
                <span className="text-sm font-normal text-slate-600">
                  {t.unidade_declive}
                </span>
              </p>
              <p className="text-sm text-slate-700 first-letter:uppercase">
                {t.direcao}
              </p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-500">IC 95%</dt>
                <dd className="text-slate-800">
                  {fmt(t.ic95[0])} a {fmt(t.ic95[1])}
                </dd>
                <dt className="text-slate-500">p-valor</dt>
                <dd className="text-slate-800">
                  {fmt(t.p_valor)} (nível {fmt(t.nivel_significancia)})
                </dd>
                <dt className="text-slate-500">Estatística</dt>
                <dd className="text-slate-800">{fmt(t.estatistica)}</dd>
                <dt className="text-slate-500">Método</dt>
                <dd className="text-slate-800">
                  {t.metodo.replaceAll('_', ' ')}
                </dd>
                <dt className="text-slate-500">Sazonalidade</dt>
                <dd className="text-slate-800">
                  {t.dessazonalizado
                    ? 'Ciclo sazonal removido'
                    : 'Ciclo sazonal mantido'}
                </dd>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Resposta</h3>
        <p className="max-w-prose whitespace-pre-line leading-relaxed text-slate-800">
          {r.resposta_IA}
        </p>
      </section>

      {r.fontes.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Fontes</h3>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {r.fontes.map((f) => (
              <li key={f.produto_id}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-teal-800 underline underline-offset-2 hover:text-teal-950"
                >
                  {f.nome}
                </a>
                <span className="text-slate-600">
                  {' '}
                  — {f.instituicao}, produto {f.produto_id}, acedido em{' '}
                  {new Intl.DateTimeFormat('pt-PT', {
                    dateStyle: 'medium',
                  }).format(new Date(f.acessado_em))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.avisos.length > 0 && (
        <section
          role="note"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          <h3 className="text-sm font-semibold text-amber-950">Avisos</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-amber-950">
            {r.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
