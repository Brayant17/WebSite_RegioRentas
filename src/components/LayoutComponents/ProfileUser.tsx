import { useEffect, useState, useRef } from 'react';
import { supabase } from "../../lib/supabaseClient";

interface NavbarProps {
    initialUser?: {
        id: string;
        email?: string;
        user_metadata?: {
            full_name?: string;
            avatar_url?: string;
        };
    } | null;
}
export default function ProfileUser({ initialUser }: NavbarProps) {
    const [user, setUser] = useState(initialUser);
    const [open, setOpen] = useState(false);
    const ProfileUserRef = useRef(null);


    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ProfileUserRef.current && !(ProfileUserRef.current as any).contains(event.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        // Mantener sesión actualizada en el cliente
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        return () => listener.subscription.unsubscribe();
    }, []);

    async function handleLogout() {
        // 👇 Llama a la API del servidor
        await fetch('/api/auth/logout', { method: 'GET' })
        // El servidor ya redirige, pero por compatibilidad:
        window.location.href = '/'
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user ? (
                <div className='relative inline-block text-left' ref={ProfileUserRef}>
                    <div
                        className='flex items-center gap-2 ring-1 ring-neutral-700 rounded-full ring-offset-4 cursor-pointer'
                        onClick={() => setOpen(!open)}
                    >
                        {
                            user.user_metadata?.avatar_url ? (
                                <img
                                    src={user.user_metadata?.avatar_url || '/default-avatar.png'}
                                    alt="avatar"
                                    width={32}
                                    height={32}
                                    style={{ borderRadius: '50%' }}
                                />
                            )
                                : (
                                    <p>{user.user_metadata?.full_name?.[0]}</p>
                                )
                        }

                    </div>
                    {/* Lista desplegable */}
                    {open && (
                        <div
                            className="absolute left-0 mt-7 min-w-full w-max max-w-[350px] 
                     rounded-xs shadow-lg bg-white ring-1 ring-gray-300 ring-opacity-5 z-50 px-1 py-1"
                        >
                            <div className="p-1">
                                <div className='flex items-center gap-2 p-2 rounded-sm'>
                                    <p className='text-sm'>{user.user_metadata?.full_name}</p>
                                </div>
                            </div>
                            <div className="p-1">
                                <a
                                    href="/panel/favoritos"
                                    className='flex items-center gap-2 p-2 rounded-sm hover:bg-gray-100'
                                >
                                    <svg
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="icon icon-tabler icons-tabler-outline icon-tabler-heart">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                        <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                                    </svg>
                                    <span className='text-sm'>Favoritos</span>
                                </a>
                            </div>
                            <div className="p-1">
                                <a
                                    href="/panel/publicaciones"
                                    className='flex items-center gap-2 p-2 rounded-sm hover:bg-gray-100'
                                >
                                    <svg
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="icon icon-tabler icons-tabler-outline icon-tabler-building-community">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                        <path d="M8 9l5 5v7h-5v-4m0 4h-5v-7l5 -5m1 1v-6a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v17h-8" />
                                        <path d="M13 7l0 .01" />
                                        <path d="M17 7l0 .01" />
                                        <path d="M17 11l0 .01" />
                                        <path d="M17 15l0 .01" />
                                    </svg>
                                    <span className='text-sm'>Mis publicaciones</span>
                                </a>
                            </div>
                            <div className="p-1">
                                <button
                                    onClick={handleLogout}
                                    className='flex items-center gap-2 p-2 cursor-pointer rounded-sm hover:bg-gray-100 w-full'
                                >
                                    <svg
                                        width="22"
                                        height="22"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="icon icon-tabler icons-tabler-outline icon-tabler-logout">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                        <path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
                                        <path d="M9 12h12l-3 -3" />
                                        <path d="M18 15l3 -3" />
                                    </svg>
                                    <span className='text-sm'>Cerrar Sesion</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <a
                    href="/login"
                    className="block px-4 py-2 text-sm font-semibold text-gray-800 rounded transition-all duration-200 hover:-translate-y-0.5"
                >
                    Iniciar sesión
                </a>
            )}
        </div>
    );
}