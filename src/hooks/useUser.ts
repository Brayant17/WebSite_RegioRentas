import { supabase } from "@/lib/supabaseClient";
import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

export function useUser() {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // Simulate fetching user data from an authentication service
        // Replace this with actual authentication logic
        // 1. Obtener la seccion actual al montar
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
            }
        });

        // 2 escuchar cambios en la auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
            if (session?.user) {
                setUser(session.user);
                setSession(session);
            } else {
                setUser(null);
                setSession(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Placeholder for user state management logic
    return { user, idUser: user?.id || null, session };
}