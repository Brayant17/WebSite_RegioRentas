import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabaseClient";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const authCode = url.searchParams.get("code");

  if (!authCode) {
    return new Response("No se proporcionó ningún código", { status: 400 });
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  // console.log(data);

  const { access_token, refresh_token } = data.session;

  // Obtener el usuario actual que esta iniciando session

  const {data: currentUser, error: errorCurrentUser} = await supabase.auth.getUser();

  if(errorCurrentUser){
    // aqui poner un return y marcar el error de usuario no encontrado o algo asi
    console.log("Error al obtener al usuario actual: ", errorCurrentUser);
    return new Response("No se a podido autentiar al usuario", { status: 500 });
  }


  // obtenemos el id del usuario actual logueado
  const idUserCurrent = currentUser?.user?.id;

  // Buscar el usuario actual para obtener su rol

  const {data: dataUser, error: errorUser } = await supabase.from('users').select("role").eq("id", idUserCurrent);

  if(errorUser){
    // crear un return
    console.log("Error al obener el rol: ", errorUser)
  }
  
  const roleUser = dataUser?.[0].role;

  console.log(roleUser);

  cookies.set("sb-access-token", access_token, {
    path: "/",
  });
  cookies.set("sb-refresh-token", refresh_token, {
    path: "/",
  });

  if(roleUser === 'user'){
    return redirect("/App/propiedades");
  }

  return redirect("/App/dashboard");

};