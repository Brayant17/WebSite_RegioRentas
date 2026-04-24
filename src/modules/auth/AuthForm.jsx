import { useState } from "react";
import { supabase } from "../../lib/supabaseClient.js";
import LoginWithGoogle from "./LoginWithGoogle.jsx";

export default function AuthForm() {
    const [isLogin, setIsLogin] = useState(true);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: `${firstName} ${lastName}`,
                    avatar_url: null
                }
            },
        });

        if (error) setError(error.message);
        else console.log("Usuario registrado: ", data);

        setLoading(false);
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // mandar a llamar al endpoint del signin

        const miFormulario = new FormData();

        miFormulario.append('email', email);
        miFormulario.append('password', password);

        fetch("/api/auth/signin", {
            method: "POST",
            body: miFormulario
        })
            .then( response => {
                if (!response.ok) {
                    const errorData = response.text();
                    setError(errorData);
                    throw {
                        status: response.status,
                        ...errorData
                    };
                } 
            })

        setLoading(false);
    }

    return (
        <div className="max-w-sm mx-auto my-10 p-4 border border-slate-200 rounded">
            <h1 className="text-2xl font-semibold">Bienvenido de nuevo</h1>
            <p className="text-sm font-semibold text-slate-600 my-2">
                Introduzca sus datos {isLogin ? "para iniciar sesión" : "para registrarte"}.
            </p>
            <form className="flex flex-col pt-4 gap-4">
                {
                    isLogin
                        ? (
                            <>
                                <div className="flex flex-col">
                                    <label htmlFor="">Correo</label>
                                    <input
                                        type="email"
                                        placeholder="Correo"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="border p-2 rounded"
                                        id="username"
                                        name="username"
                                        autoComplete="username"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="">Contraseña</label>
                                    <input
                                        type="password"
                                        placeholder="Contraseña"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="border p-2 rounded"
                                        id="password"
                                        autoComplete="current-password"
                                    />
                                </div>

                                {error && <p className="text-red-500">{error}</p>}
                                {isLogin && (<span className="text-sm font-bold text-neutral-800 block my-2"><a href="#">Olvidé mi contraseña</a></span>)}
                                <button
                                    onClick={handleLogin}
                                    disabled={loading}
                                    className="mb-4 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-slate-950 text-white hover:bg-slate-800 cursor-pointer duration-300"
                                >
                                    <span className="font-semibold">Iniciar sesión</span>
                                </button>
                            </>
                        )
                        : (
                            <>
                                <div className="flex flex-col">
                                    <label htmlFor="">Nombre</label>
                                    <input
                                        id="firstName"
                                        name="firstName"
                                        type="text"
                                        placeholder="Nombre"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="border p-2 rounded"
                                        autoComplete="given-name"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="">Apellido</label>
                                    <input
                                        id="lastName"
                                        name="lastName"
                                        type="text"
                                        placeholder="Apellido"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="border p-2 rounded"
                                        autoComplete="family-name"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="">Correo</label>
                                    <input
                                        id="new-username"
                                        type="email"
                                        autoComplete="username"
                                        placeholder="Correo"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="border p-2 rounded"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <label htmlFor="">Contraseña</label>
                                    <input
                                        id="new-password"
                                        type="password"
                                        placeholder="Contraseña"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="border p-2 rounded"
                                        autoComplete="new-password"
                                        name="password"
                                    />
                                </div>

                                {error && <p className="text-red-500">{error}</p>}
                                <button
                                    onClick={handleSignup}
                                    disabled={loading}
                                    className="mb-4 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-slate-950 text-white hover:bg-slate-800 cursor-pointer duration-300"
                                >
                                    <span className="font-semibold">Regístrate</span>
                                </button>
                            </>
                        )
                }

            </form>

            <div className="flex flex-col">
                <LoginWithGoogle disabled={loading} />
            </div>
            <div className="pt-8">
                <p className="text-center">{isLogin ? "¿No tienes una cuenta?" : "¿Ya tienes una cuenta?"} <span className="cursor-pointer text-red-800 hover:text-red-600 font-semibold duration-300" onClick={() => setIsLogin(!isLogin)}>{isLogin ? "Regístrate" : "Iniciar sesión"}</span></p>
            </div>
        </div>
    );
}