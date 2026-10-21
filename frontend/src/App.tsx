import { useState } from 'react'
import { getAccount, type Account } from './features/conta/usuario'
import { routes, useHashRoute } from './hooks/useHashRoute'
import { Admin } from './pages/Admin'
import { Conta } from './pages/Conta'
import { Entrar } from './pages/Entrar'
import { Inicio } from './pages/Inicio'
import { PerfilPrestador } from './pages/PerfilPrestador'
import { Publicar } from './pages/Publicar'
import { Servicos } from './pages/Servicos'

function App() {
  const route = useHashRoute()
  // TODO: trocar pela sessão do Supabase Auth. Por enquanto a sessão vive só nesta aba.
  const [accountId, setAccountId] = useState<string | null>(null)
  // Página para onde voltar depois de entrar
  const [returnTo, setReturnTo] = useState<string>(routes.inicio)

  const account = accountId ? getAccount(accountId) : undefined
  const isLoggedIn = account != null

  function login() {
    const current = window.location.hash
    setReturnTo(current && !/^#\/(entrar|cadastro)/.test(current) ? current : routes.inicio)
    window.location.hash = routes.entrar
  }

  function handleSignedIn(signedIn: Account, next?: string) {
    setAccountId(signedIn.id)
    // Quem administra cai direto no painel, se não estava indo para outra página
    const fallback = signedIn.isAdmin && returnTo === routes.inicio ? routes.admin : returnTo
    window.location.hash = next ?? fallback
    setReturnTo(routes.inicio)
  }

  const logout = () => setAccountId(null)

  if (route.name === 'entrar') {
    return <Entrar mode={route.mode} onSignedIn={handleSignedIn} />
  }
  if (route.name === 'perfil') {
    return (
      <PerfilPrestador
        id={route.id}
        isLoggedIn={isLoggedIn}
        isOwner={account?.professionalId === route.id}
        onLogin={login}
      />
    )
  }
  if (route.name === 'servicos') {
    return <Servicos key={account?.id} account={account} onLogin={login} />
  }
  if (route.name === 'admin') {
    return <Admin account={account} onLogin={login} />
  }
  if (route.name === 'publicar') {
    return <Publicar account={account} onLogin={login} />
  }
  if (route.name === 'conta') {
    return <Conta account={account} onLogin={login} onLogout={logout} />
  }
  return (
    <Inicio
      isLoggedIn={isLoggedIn}
      isAdmin={account?.isAdmin ?? false}
      userName={account?.name ?? ''}
      onLogin={login}
      onLogout={logout}
    />
  )
}

export default App
