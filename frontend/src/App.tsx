import { useState } from 'react'
import { useHashRoute } from './hooks/useHashRoute'
import { AreaPrestador } from './pages/AreaPrestador'
import { Inicio } from './pages/Inicio'
import { PerfilPrestador } from './pages/PerfilPrestador'

function App() {
  const route = useHashRoute()
  // TODO: trocar pelo login do Supabase Auth. Por enquanto "Entrar" só simula a sessão.
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const login = () => setIsLoggedIn(true)
  const logout = () => setIsLoggedIn(false)

  if (route.name === 'perfil') {
    return <PerfilPrestador id={route.id} isLoggedIn={isLoggedIn} onLogin={login} />
  }
  if (route.name === 'area') {
    return <AreaPrestador isLoggedIn={isLoggedIn} onLogin={login} />
  }
  return <Inicio isLoggedIn={isLoggedIn} onLogin={login} onLogout={logout} />
}

export default App
