"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function useUserModals() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [user, setUser] = useState(null);

  function openModal(modalType, modalUser) {
    setType(modalType);
    setUser(modalUser);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  function Modal() {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {type === "edit" && "Editar usuario"}
              {type === "details" && "Detalles del usuario"}
              {type === "suspend" && "Suspender usuario"}
              {type === "delete" && "Eliminar usuario"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {type === "details" && <pre>{JSON.stringify(user, null, 2)}</pre>}

            {type === "delete" && (
              <p>¿Seguro que quieres eliminar este usuario?</p>
            )}
          </div>

          {type === "delete" && (
            <button
              className="bg-red-500 text-white px-4 py-2 rounded"
              onClick={() => {
                console.log("Eliminar:", user);
                closeModal();
              }}
            >
              Eliminar
            </button>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return { openModal, closeModal, Modal };
}
