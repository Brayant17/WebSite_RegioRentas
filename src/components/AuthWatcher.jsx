// src/components/AuthWatcher.jsx
import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthWatcher() {
    useEffect(() => {
        const { data: subscription } = supabase.auth.onAuthStateChange(
            (event) => {
                if (event === 'SIGNED_OUT') {
                    window.location.href = '/'
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    return null
}
