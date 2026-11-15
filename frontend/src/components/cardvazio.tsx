import { EXEMPLO_PROMPT } from '../utils/handlers'

export default function CartaoVazio({ aoUsarExemplo }: { aoUsarExemplo: () => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Como usar</h2>
      <p className="mt-2 max-w-prose leading-relaxed text-slate-700">
        Descreva a tendência que quer analisar ou escolha os filtros abaixo
        (região, resolução, variável e período). Os filtros que deixar vazios
        são inferidos a partir da sua pergunta; os preenchidos têm prioridade.
      </p>
      <p className="mt-3 max-w-prose leading-relaxed text-slate-700">
        Se deixar todos os filtros vazios, inclua na pergunta a variável, o
        local e o período, por exemplo:
      </p>
      <blockquote className="mt-2 rounded-lg border-l-4 border-teal-600 bg-teal-50 px-4 py-3 text-teal-950">
        {EXEMPLO_PROMPT}
      </blockquote>
      <button
        type="button"
        onClick={aoUsarExemplo}
        className={`mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600`}
      >
        Usar este exemplo
      </button>
      <p className="mt-4 max-w-prose text-sm text-slate-600">
        Depois da resposta, os filtros são preenchidos com o que a IA entendeu.
        Corrija o que for preciso e pergunte de novo.
      </p>
    </section>
  )
}
