import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function UserProfile() {
  const [user, setUser] = useState(null)
  const [avatar, setAvatar] = useState('#')

  useEffect(() => {
    // Obtener tokens desde cookies
    // al parecer no se necesita obtener la session de nuevo, NO BORAR investigar mas a fondo
    // const access_token = document.cookie
    //   .split('; ')
    //   .find(row => row.startsWith('sb-access-token='))
    //   ?.split('=')[1]

    // const refresh_token = document.cookie
    //   .split('; ')
    //   .find(row => row.startsWith('sb-refresh-token='))
    //   ?.split('=')[1]

    // Si hay tokens, establecer la sesión
    // if (access_token && refresh_token) {
    //   supabase.auth.setSession({
    //     access_token,
    //     refresh_token
    //   })
    // }

    // Función para obtener usuario
    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        console.error(error)
        return
      }

      setUser(user)
      // Guardamos la URL del avatar (puede ser Google o Supabase Storage)
      setAvatar(user.user_metadata.avatar_url || '#')
    }

    // estado del user para ver si rendereiza al tiempo de servidor
    console.log(user);

    fetchUser()
  }, []) // solo se ejecuta al montar

  if (!user) return <div>Cargando usuario...</div>

  return (
    <div className='bg-slate-600 p-8 border border-slate-800'>
      <p>Esto es un componente de React</p>
      <h2>{user.user_metadata.full_name || user.email}</h2>
      {avatar !== '#' && (
        <img
          src={avatar}
          alt="Avatar"
          width={80}
          style={{ borderRadius: '50%' }}
          loading="lazy" // evita cargar muchas imágenes al mismo tiempo
        />
      )}
    </div>
  )
}
