import { useState } from "react";
import Modal from "./Modal"

export default function ButtonModal({ children }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="w-max">
            <button onClick={() => setIsOpen(true)} className="py-3 px-6 flex items-center gap-2 border border-gray-300 rounded-full hover:bg-neutral-900 hover:text-white cursor-pointer ease-in-out duration-100">
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