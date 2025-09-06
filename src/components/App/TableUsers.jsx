import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient"

export default function TableProperty() {

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fechaParsed = (fecha) => {
        const date = new Date(fecha.slice(0, 23));
        const legible = date.toLocaleString("es-ES", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        })

        return legible;
    }

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            const { data, error } = await supabase.from("users").select();
            if (error) setError(error.message);
            else setUsers(data);
            setLoading(false)
        }

        fetch();
    }, [])

    useEffect(() => {
        console.log(users);
    }, [users])

    const handleStatusChange = async (userId, newStatus) => {
        try {
            const {error} = await supabase
            .from("users")
            .update({approval_status: newStatus})
            .eq("id", userId)

            if(error) throw error;

            // Actualizamos el estado local de react sin necesidad de hacer fetch
            setUsers((prev)=>
                prev.map((u)=>
                    u.id === userId ? { ...u, approval_status: newStatus } : u
                )
            );
        } catch (err) {
            console.log("Error al actualizar el estado: ", err.message);
            setError(err.message);
        }
    }

    if (loading) return <p>Cargando propiedades...</p>
    if (error) return <p className="text-red-500">Error: {error}</p>

    return (
        <div className="w-full relative overflow-x-auto shadow-md sm:rounded-lg border border-slate-200">
            <table className="w-full text-sm text-left rtl:text-right text-slate-500">
                <thead className="text-xs text-slate-600 uppercase bg-[#fafafa]">
                    <tr>
                        <th scope="col" className="px-6 py-3">
                            Usuario
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Correo
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Tipo
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Registrado desde
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Estado
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Action
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {users && (
                        users.map(user => (
                            <tr key={user.id} className="odd:bg-gray-200 even:bg-gray-50 border-b border-gray-200">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                    {user.full_name}
                                </th>
                                <td className="px-6 py-4">
                                    {user.email}
                                </td>
                                <td className="px-6 py-4">
                                    {user.role}
                                </td>
                                <td className="px-6 py-4">
                                    {fechaParsed(user.created_at)}
                                </td>
                                <td className="px-6 py-4">
                                    <select name="estado" id={`status-${user.id}`} value={user.approval_status} onChange={(e)=>handleStatusChange(user.id, e.target.value)}>
                                        <option value="pending">pending</option>
                                        <option value="approved">approved</option>
                                        <option value="rejected">rejected</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4">
                                    <a href="#" className="font-medium text-blue-600 dark:text-blue-500 hover:underline">Edit</a>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            <div className="flex justify-between gap-2 p-3 border-t border-slate-200 bg-[#fafafa]">
                <div className="flex gap-1 items-center">
                    <span>Mostrando por página</span>
                    <select name="" id="" className="border border-slate-300 px-1 py-0.5 rounded">
                        <option value="">1</option>
                        <option value="">2</option>
                        <option value="">3</option>
                        <option value="">4</option>
                        <option value="">5</option>
                    </select>
                </div>
                <nav aria-label="Table pagination" className="flex flex-row gap-1 items-center">
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">{"<"}</button>
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">1</button>
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">2</button>
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">3</button>
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">{">"}</button>
                </nav>
            </div>
        </div>
    )
}