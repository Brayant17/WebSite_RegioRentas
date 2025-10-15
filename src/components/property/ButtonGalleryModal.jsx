// ButtonGalleryModal.jsx
import { useState } from "react";
import Modal from "./GalleryImages/Modal";
import SliderGalleryProperty from "./SliderGalleryProperty";

function ButtonGalleryModal({ listImages }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-gray-700 text-sm font-medium flex items-center gap-2 border border-gray-300 rounded-md hover:bg-neutral-900 hover:text-white transition cursor-pointer"
      >
        Ver más imágenes ({listImages.length})
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <SliderGalleryProperty listImages={listImages} />
      </Modal>
    </div>
  );
}

export default ButtonGalleryModal;
