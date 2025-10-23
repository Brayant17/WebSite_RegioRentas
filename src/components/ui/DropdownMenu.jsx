//DropdownMenu.jsx
import { useEffect, useRef, useState } from "react";

export default function Dropdown({ title, options, onSelect, initialSelect }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [select, setSelect] = useState(initialSelect);

  useEffect(()=>{
    setSelect(initialSelect);
  }, [initialSelect]);

  const handleSelect = (option) => {
    onSelect(option);
    setSelect(option.label);
    setOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Botón principal */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-between 
                   rounded-md border border-gray-300/20 shadow-sm 
                   px-3 py-2 bg-white text-xs md:text-sm font-medium 
                   text-gray-700 hover:bg-gray-50 focus:outline-none cursor-pointer 
                   min-w-[120px] max-w-[180px] sm:max-w-[200px] md:max-w-none 
                   truncate"
      >
        <span className="truncate">{select ? select : title}</span>
        <svg
          className="ml-2 h-4 w-4 flex-shrink-0 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Lista desplegable */}
      {open && (
        <div
          className="absolute left-0 mt-2 min-w-full w-max max-w-[250px] 
                     rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
        >
          <div className="p-1">
            {options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(option)}
                title={option.label}
                className={`block w-full text-left px-4 py-2 text-gray-700 text-xs md:text-sm truncate ${select === option.label ? "bg-gray-100 font-medium" : ""
                  } hover:bg-gray-100`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}