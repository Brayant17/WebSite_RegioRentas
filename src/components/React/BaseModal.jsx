//BaseModal.jsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function BaseModal({ isOpen, onClose, children, titleModal, options = {} }) {
    const opts = {
        size: 'md',
        position: 'center',
        closeButton: true,
        overlay: true,
        contentPadding: 'p-4',
        rounded: 'rounded-lg',
        ...options,
    };

    const [show, setShow] = useState(false);

    // Abrir/cerrar con animación
    useEffect(() => {
        if (isOpen) {
            setShow(true);
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
        } else {
            // Espera la animación antes de quitar del DOM
            setTimeout(() => setShow(false), 300);
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
    }, [isOpen]);

    if (!show) return null;

    const sizeMap = {
        sm: 'max-w-sm w-10/12',
        md: 'max-w-md w-11/12',
        lg: 'max-w-lg w-10/12',
        xl: 'max-w-xl w-10/12',
    };

    const positionMap = {
        top: 'items-start pt-10',
        center: 'items-center',
        bottom: 'items-end pb-10',
    };

    return createPortal(
        <div
            className={`fixed inset-0 flex justify-center ${positionMap[opts.position]} z-[9999] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={onClose}
        >
            {opts.overlay && <div className={`absolute inset-0 bg-neutral-900 transition-opacity duration-300 ${isOpen ? 'opacity-70' : 'opacity-0'}`}></div>}

            <div
                className={`bg-white relative ${sizeMap[opts.size]} ${opts.rounded} transform transition-all duration-300 ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}
                onClick={e => e.stopPropagation()}
            >
                {opts.closeButton && (
                    <button
                        className="absolute top-3 right-3 border-0 bg-none text-xl cursor-pointer px-4"
                        onClick={onClose}
                    >
                        ✕
                    </button>
                )}

                {titleModal && <div className="block border-b border-slate-300 p-3 font-semibold">{titleModal}</div>}
                <div className={opts.contentPadding}>{children}</div>
            </div>
        </div>,
        document.body
    );
}
