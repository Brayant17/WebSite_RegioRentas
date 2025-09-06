import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient";

export default function InfoUser() {

    const [user, setUser] = useState();
    const [avatar, setAvatar] = useState();

    useEffect(() => {
        
        const fetchUser = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) {
                console.error(error)
                return
            }

            setUser(user)
            // Guardamos la URL del avatar (puede ser Google o Supabase Storage)
            setAvatar(user.user_metadata.avatar_url || '#')
        }

        fetchUser()
    }, [])

    return (
        !user ? (
            <div className="border border-slate-200 rounded-md p-2.5 flex gap-2">
                <div>
                    <div className="rounded-md aspect-square w-12 animate-pulse bg-gray-300"></div>
                </div>
                <div className="w-full flex flex-col gap-2">
                    <div className="h-2 w-full rounded bg-gray-300"></div>
                    <div className="h-2 w-full rounded bg-gray-300"></div>
                </div>
            </div>
        ):
        (
            <div className="border border-slate-200 rounded-md p-2.5 flex gap-2">
                <div>
                    <img src={avatar} alt="imagen de usuario" className="rounded-md aspect-square w-12" />
                </div>
                <div>
                    <p className="text-xs text-slate-700 font-semibold">{user.user_metadata.full_name}</p>
                    <p className="text-slate-400 text-xs">{user.user_metadata.email}</p>
                </div>
            </div>
        )
    )
}