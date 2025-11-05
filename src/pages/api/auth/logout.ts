// src/pages/api/logout.ts
import type { APIRoute } from 'astro'
import { supabaseServer } from '../../../lib/supabaseServer.js'

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const supabase = supabaseServer(cookies)

  await supabase.auth.signOut()

  // 👇 Limpieza adicional por si acaso
  cookies.delete('sb-access-token', { path: '/' })
  cookies.delete('sb-refresh-token', { path: '/' })

  // Redirige al login
  return redirect('/')
}
