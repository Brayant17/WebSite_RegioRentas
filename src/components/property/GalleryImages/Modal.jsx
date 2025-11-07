// Modal.jsx
import { createPortal } from "react-dom";

const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-auto flex justify-center items-center animate-fadeIn"
        onClick={(e) => e.stopPropagation()} // Evita cerrar al hacer clic dentro
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-6 z-10 text-white text-4xl font-light hover:text-gray-300 transition ring-1 ring-white/50 cursor-pointer bg-neutral-900 rounded-full w-11 h-11"
        >
          &times;
        </button>

        {/* Contenido (Slider) */}
        <div className="w-full max-h-[90vh]">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
