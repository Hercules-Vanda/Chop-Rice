import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { IconeMenu } from '../icons/icons'
import { RESPOSTA_EXEMPLO } from '../utils/dados'
// Componentes
import BarraLateral from '../components/barralateral'
import RodapePrompt from '../components/prompt'
import RespostaIAView from '../components/resposta'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [menuAberto, setMenuAberto] = useState(false)

  const PERGUNTA_EXEMPLO =
    'Como evoluiu a anomalia de temperatura em Angola nos últimos 10 anos?'

  return (
    <div className="h-dvh bg-slate-50 text-slate-900">
      <BarraLateral aberta={menuAberto} aoFechar={() => setMenuAberto(false)} />

      <div className="flex h-full flex-col lg:pl-72">
        <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
          >
            <IconeMenu />
          </button>
          <span className="text-sm font-medium text-slate-900">
            Trend Detective
          </span>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Aqui será colocado um ciclo de repetição que vai renderizar condicionalmente as mensagens enviadas e recebidas */}

            {/* mensagem do utilizador */}
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-2.5 text-sm text-white">
                {PERGUNTA_EXEMPLO}
              </p>
            </div>

            {/* resposta da IA os dados que virão da API para facilitar a conexão virão já no formato definido por RespostaAI*/}
            <RespostaIAView dados={RESPOSTA_EXEMPLO} />
          </div>
        </main>

        <RodapePrompt />
      </div>
    </div>
  )
}
