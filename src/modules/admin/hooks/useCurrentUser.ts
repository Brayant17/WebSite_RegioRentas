import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export function useCurrentUser() {

  const [user, setUser] = useState<{ name: string; email: string; avatar: string }>({
    name: "",
    email: "",
    avatar: "",
  })

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {

    const { data } = await supabase.auth.getUser()

    if (data?.user) {
        data.user.user_metadata = data.user.user_metadata || {}
        const userData = {
            name: data.user.user_metadata.name || "Usuario",
            email: data.user.email || "",
            avatar: data.user.user_metadata.avatar_url || "https://i.pravatar.cc/150?img=3",
        }
        setUser(userData)

        console.log("Current user:", data)
    }
  }

  return { user }
}
