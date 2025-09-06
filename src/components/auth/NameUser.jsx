import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient"

export default function Perfil({email}) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    // 1. Obtener la sesión actual
    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) console.error("Error obteniendo sesión:", error)
      setSession(data.session)
    }
    getSession()

    // 2. Escuchar cambios en la sesión
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // 3. Limpiar el listener cuando el componente se desmonta
    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!session) {
    return <p>No has iniciado sesión</p>
  }

  return (
    <div>
      <h2>Bienvenido {session.user.email}</h2>
      <button onClick={() => supabase.auth.signOut()}>
        Cerrar sesión
      </button>
      <h1 className="text-2xl text-black">{email}</h1>
    </div>
  )
}
