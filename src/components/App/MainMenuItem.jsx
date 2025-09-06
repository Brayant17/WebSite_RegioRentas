import { useEffect, useState } from "react";


export default function MainMenuItem({ pathname, nameItem, link, children }) {

    const [active, setActive] = useState(false)

    // Recordar que necesitamos poner validaciones para el menu, dependiendo de quien este logueado, mostrar cieras opeciones en el menu

    pathname = pathname.replace("/", '');

    useEffect(() => {
        setActive(pathname.toUpperCase() == nameItem.toUpperCase());
    }, [])

    const styleActive = active ? "bg-white shadow-xs border border-slate-100" : "";

    return (
        <a href={link}>
            <li
                className={`flex items-center justify-start text-xs font-semibold gap-2.5 p-3 text-slate-700 rounded-sm ${styleActive} cursor-pointer border border-transparent hover:bg-white hover:shadow-xs  hover:border-slate-100 duration-300`}
            >
                {children}
                <p className="leading-normal">{nameItem}</p>
            </li>
        </a>
    );
}