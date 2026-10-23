import { useEffect, useState } from 'react'
import { Loading } from './components/Status'
import { currentAccount, signOut, type Account } from './features/conta/usuario'
import { routes, useHashRoute } from './hooks/useHashRoute'
import { SESSION_EXPIRED } from './lib/api'
import { Admin } from './pages/Admin'
import { Conta } from './pages/Conta'
import { AlreadySignedIn, Entrar } from './pages/Entrar'
import { Inicio } from './pages/Inicio'
import { PerfilPrestador } from './pages/PerfilPrestador'
import { Publicar } from './pages/Publicar'
import { Servicos } from './pages/Servicos'

function App() {
  const route = useHashRoute()
  // undefined = ainda conferindo a sessão guardada nesta aba
  const [account, setAccount] = useState<Account | null | undefined>(undefined)
  // Página para onde voltar depois de entrar
  const [returnTo, setReturnTo] = useState<string>(routes.inicio)

  useEffect(() => {
    currentAccount().then((found) => setAccount(found ?? null))
    // Sessão vencida no meio do uso: volta a mostrar as telas como visitante
    const expired = () => setAccount(null)
    window.addEventListener(SESSION_EXPIRED, expired)
    return () => window.removeEventListener(SESSION_EXPIRED, expired)
  }, [])

  if (account === undefined) {
    return (
      <div className="app">
        <main className="page">
          <Loading />
        </main>
      </div>
    )
  }

  const signedIn = account ?? undefined
  const isLoggedIn = signedIn !== undefined

  function login() {
    const current = window.location.hash
    setReturnTo(current && !/^#\/(entrar|cadastro)/.test(current) ? current : routes.inicio)
    window.location.hash = routes.entrar
  }

  function handleSignedIn(next: Account, nextRoute?: string) {
    setAccount(next)
    // Quem administra cai direto no painel, se não estava indo para outra página
    const fallback = next.isAdmin && returnTo === routes.inicio ? routes.admin : returnTo
    window.location.hash = nextRoute ?? fallback
    setReturnTo(routes.inicio)
  }

  function logout() {
    setAccount(null)
    signOut().catch(() => {})
  }

  if (route.name === 'entrar') {
    // Voltar pelo navegador depois de entrar não mostra o formulário de novo
    if (signedIn) return <AlreadySignedIn name={signedIn.name} />
    return <Entrar mode={route.mode} onSignedIn={handleSignedIn} />
  }
  if (route.name === 'perfil') {
    return (
      <PerfilPrestador
        key={`${route.id}-${signedIn?.id}`}
        id={route.id}
        isLoggedIn={isLoggedIn}
        onLogin={login}
      />
    )
  }
  if (route.name === 'servicos') {
    return <Servicos key={signedIn?.id} account={signedIn} onLogin={login} onAccountChange={setAccount} />
  }
  if (route.name === 'admin') {
    return <Admin account={signedIn} onLogin={login} />
  }
  if (route.name === 'publicar') {
    return <Publicar account={signedIn} onLogin={login} />
  }
  if (route.name === 'conta') {
    return <Conta account={signedIn} onLogin={login} onLogout={logout} onAccountChange={setAccount} />
  }
  return (
    <Inicio
      key={signedIn?.id}
      isLoggedIn={isLoggedIn}
      isAdmin={signedIn?.isAdmin ?? false}
      userName={signedIn?.name ?? ''}
      onLogin={login}
      onLogout={logout}
    />
  )
}

export default App
