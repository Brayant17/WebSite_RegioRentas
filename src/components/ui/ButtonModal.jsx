//ButtonModal.jsx
import { useState } from "react";
import BaseModal from "../React/BaseModal";

export default function ButtonModal({ titleButton, title, children, options }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-max">
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-gray-700 text-sm font-medium flex items-center gap-2 border border-gray-300 rounded-md hover:bg-neutral-900 hover:text-white cursor-pointer ease-in-out duration-100"
      >
        {titleButton}
      </button>

      <BaseModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        titleModal={title}
        options={options}
      >
        {children}
      </BaseModal>
    </div>
  );
}
