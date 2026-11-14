import { useMemo } from 'react'
import type { RespostaIA, PontoSerie } from '../utils/types'
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

function BadgeSignificancia({ significativo }: { significativo: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        significativo
          ? 'bg-teal-100 text-teal-900'
          : 'bg-slate-200 text-slate-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          significativo ? 'bg-teal-600' : 'bg-slate-500'
        }`}
        aria-hidden
      />
      {significativo ? 'Significativo' : 'Não significativo'}
    </span>
  )
}

// Função que calcula a tendencia e retorna a serie de pontos com a tendencia esta parte será alterada visto que esses calculos virão já feitos do backend
function comTendencia(serie: PontoSerie[]) {
  const n = serie.length
  const xs = serie.map((_, i) => i)
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = serie.reduce((a, p) => a + p.valor, 0) / n
  const sxy = serie.reduce((a, p, i) => a + (i - mx) * (p.valor - my), 0)
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  const b = sxy / sxx
  const a = my - b * mx
  return serie.map((p, i) => ({
    ...p,
    tendencia: Number((a + b * i).toFixed(3)),
  }))
}

export default function RespostaIAView({ dados }: { dados: RespostaIA }) {
  const serie = useMemo(() => comTendencia(dados.grafico.serie), [dados])

  return (
    <article className="space-y-5">
      {/* resumo executivo em destaque */}
      <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <h2 className="text-sm font-semibold text-teal-900">
          Resumo executivo
        </h2>
        <p className="mt-2 text-lg leading-relaxed text-teal-950">
          {dados.resumo_executivo}
        </p>
      </section>

      {/* gráfico: série + linha de tendência */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {dados.grafico.titulo}{' '}
          <span className="font-normal text-slate-500">
            ({dados.grafico.unidade})
          </span>
        </h3>
        {/* Codigo do gráfico */}
        <div className="mt-3 h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            {/* Aqui serie é um vetor que vai ser usado como dado para desenhar todo o gráfico */}
            <ComposedChart
              data={serie} 
              margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="periodo"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                unit={` ${dados.grafico.unidade}`}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
                formatter={(v: number) => [
                  `${v.toFixed(2)} ${dados.grafico.unidade}`,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="valor"
                name="Série observada"
                stroke="#0f766e"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="linear"
                dataKey="tendencia"
                name="Linha de tendência"
                stroke="#d97706"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* cartões de estatísticas */}
      <section aria-labelledby="estatisticas-titulo">
        <h3
          id="estatisticas-titulo"
          className="mb-2 text-sm font-semibold text-slate-900"
        >
          Estatísticas
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dados.estatisticas.map((e) => (
            <div
              key={e.rotulo}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <p className="text-xs text-slate-500">{e.rotulo}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {e.valor}
              </p>
              {e.detalhe && (
                <p className="text-xs text-slate-500">{e.detalhe}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* cartões de trends */}
      <section aria-labelledby="trends-titulo">
        <h3
          id="trends-titulo"
          className="mb-2 text-sm font-semibold text-slate-900"
        >
          Tendências
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {dados.trends.map((t) => (
            <div
              key={t.variavel}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">
                  {t.variavel}
                </p>
                <BadgeSignificancia significativo={t.significativo} />
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {t.inclinacao}
              </p>
              <p className="text-xs text-slate-500">p = {t.p_valor}</p>
            </div>
          ))}
        </div>
      </section>

      {/* resposta_IA */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Resposta</h3>
        <p className="max-w-prose leading-relaxed text-slate-800">
          {dados.resposta_IA}
        </p>
      </section>

      {/* fontes */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Fontes</h3>
        <ul className="space-y-1.5 text-sm">
          {dados.fontes.map((f) => (
            <li key={f.titulo} className="text-slate-700">
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-teal-800 underline underline-offset-2 hover:text-teal-950"
                >
                  {f.titulo}
                </a>
              ) : (
                <span className="font-medium">{f.titulo}</span>
              )}
              <span className="text-slate-500"> — {f.instituicao}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* avisos */}
      {dados.avisos.length > 0 && (
        <section
          role="note"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          <h3 className="text-sm font-semibold text-amber-950">Avisos</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-amber-950">
            {dados.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
