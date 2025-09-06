// src/components/LoginWithGoogle.jsx
// import { supabase } from '../../lib/supabaseClient'

export default function LoginWithGoogle({ disabled = false }) {

    return (
        <form action="/api/auth/signin" method="post" className="w-full">
            <button
                value="google" name="provider" type="submit"
                disabled={disabled}
                className="flex justify-center w-full items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-100 cursor-pointer duration-300"
            >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                <span>Iniciar sesión con Google</span>
            </button>
        </form>
    )
}