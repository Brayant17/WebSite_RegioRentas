import { useState } from "react";
import Modal from "../React/Modal"

export default function ButtonModal({ children }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="w-max">
            <button onClick={() => setIsOpen(true)} className="px-4 py-2 text-gray-700 text-sm font-medium flex items-center gap-2 border border-gray-300 rounded-md hover:bg-neutral-900 hover:text-white cursor-pointer ease-in-out duration-100">
                {children}
            </button>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} titleModal={"Filtros"}>
                <div>
                    aqui iran los filtros, poner despues
                </div>
            </Modal>
        </div>
    )
}