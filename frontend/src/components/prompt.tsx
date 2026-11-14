import { useState } from 'react'
import { FILTROS } from '../utils/dados'
import { IconeEnviar } from '../icons/icons'

// Componente que renderiza os filtros

function Filtro({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string
  opcoes: readonly string[]
  valor: string
  aoMudar: (v: string) => void
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">
      {rotulo}
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="w-full truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-600"
      >
        {opcoes.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}

export default function RodapePrompt() {
  // O campo consulta será a variavel texto
  const [texto, setTexto] = useState('')

  // O "set" é uma função que mapeia as chaves dos filtros disponiveis ela retorna uma função que atualiza uma chave especifica k com um valor v esse processo acontece dentro do componente Filtro
  const set = (k: keyof typeof filtros) => (v: string) =>
    setFiltros((f) => ({ ...f, [k]: v }))

  // Objeto que guarda todos os estados dos filtros
  const [filtros, setFiltros] = useState({
    regiao: FILTROS.regiao[0],
    resolucao: FILTROS.resolucao[0],
    variavel: FILTROS.variavel[0],
    periodo: FILTROS.periodo[0],
  })


  return (
    <footer className="border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Filtro
            rotulo="Região"
            opcoes={FILTROS.regiao}
            valor={filtros.regiao}
            aoMudar={set('regiao')}
          />
          <Filtro
            rotulo="Resolução"
            opcoes={FILTROS.resolucao}
            valor={filtros.resolucao}
            aoMudar={set('resolucao')}
          />
          <Filtro
            rotulo="Variável"
            opcoes={FILTROS.variavel}
            valor={filtros.variavel}
            aoMudar={set('variavel')}
          />
          <Filtro
            rotulo="Período"
            opcoes={FILTROS.periodo}
            valor={filtros.periodo}
            aoMudar={set('periodo')}
          />
        </div>

        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20">
          <textarea
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Pergunte sobre uma tendência climática…"
            aria-label="Pergunta"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            aria-label="Enviar pergunta"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <IconeEnviar />
          </button>
        </div>
      </div>
    </footer>
  )
}
