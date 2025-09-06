import { useEffect, useRef, useState } from "react";

export default function Dropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null)

  useEffect(()=>{
    function handleClickOutside(event){
        if(dropdownRef.current && !dropdownRef.current.contains(event.target)){
            setOpen(false);
        }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside)
    }
  },[])

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Botón */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
      >
        Opciones
        <svg
          className="ml-2 -mr-1 h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Lista desplegable */}
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <a
              href="http://localhost:4321/login"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Iniciar sesión
            </a>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Configuración
            </a>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cerrar sesión
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
