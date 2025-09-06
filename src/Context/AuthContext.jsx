import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        // supabase.auth.getUser().then(({ data }) => setUser(data.user));
        supabase.auth.getSession().then(({ data: { session }})=>{
            setUser(session?.user ?? null);
        });

        // Escuchar cambios en el auth
        // const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        //     setUser(session?.user ?? null);
        // });
        // Escuchar cambioes en el auth
        const { data: {subscription} } = supabase.auth.onAuthStateChange((_event, session)=>{
            setUser(session?.user ?? null);
        });
        console.log(user)
        // return () => listener.subscription.unsubscribe();
        return () => subscription.unsubscribe();
    }, [])

    return (
        <AuthContext.Provider value={{ user, setUser }}>
            {children}
        </AuthContext.Provider>
    )
}


export const useAuth = ()=> useContext(AuthContext);