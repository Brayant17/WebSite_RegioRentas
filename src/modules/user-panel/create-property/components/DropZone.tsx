//DropZone.jsx
import { useCallback, useEffect } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import pkg from "react-sortablejs";
const { ReactSortable } = pkg;
import type { ImageItem } from "../types/ImageItem.type";

type DropZoneProps = {
  files: ImageItem[];
  setFiles: React.Dispatch<React.SetStateAction<ImageItem[]>>;
};

export default function DropZone({ files, setFiles }: DropZoneProps) {
  // Al soltar archivos nuevos
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      // Crear objetos para cada archivo nuevo
      const newFiles: ImageItem[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(), // ID único
        file: file,
        url: URL.createObjectURL(file),
        status: "new" as const,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    },
    [setFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  // Revocar blobs al desmontar
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        // Solo revocar blobs de archivos nuevos, no de los existentes
        if (f.status === "new" && f.url.startsWith("blob:")) {
          URL.revokeObjectURL(f.url);
        }
      });
    };
  }, []);

  // Eliminar una imagen
  const handleDelete = (file: ImageItem) => {
    setFiles((prev) => {
      if (file.status === "new") {
        URL.revokeObjectURL(file.url);
        return prev.filter((f) => f.id !== file.id);
      }

      if (file.status === "existing") {
        return prev.map((f) =>
          f.id === file.id ? { ...f, status: "deleted" } : f
        );
      }

      return prev;
    });
  };

  const visibleFiles = files.filter(f => f.status !== "deleted");


  return (
    <div>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-6 rounded cursor-pointer text-center ${isDragActive ? "bg-blue-100" : "bg-gray-50"
          }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Suelta tus imágenes aquí...</p>
        ) : (
          <p>Arrastra o selecciona imágenes</p>
        )}
      </div>

      {/* Preview de imágenes */}
      <ReactSortable
        list={visibleFiles}
        setList={(newList) => {
          setFiles((prevFiles) => {
            const deleted = prevFiles.filter(f => f.status === "deleted");
            return [...newList, ...deleted];
          });
        }}
        animation={150}
        ghostClass="ghost"
        className="flex gap-2 flex-wrap mt-2"
      >
        {visibleFiles.map((file) => (
          <div key={file.id} className="w-28 h-28 relative">
            <span
              onClick={() => handleDelete(file)}
              className="absolute top-0 right-0 bg-white ring-1 ring-gray-300 p-1 rounded-full cursor-pointer hover:bg-red-600 hover:text-white duration-300"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="icon icon-tabler icons-tabler-outline icon-tabler-x">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M18 6l-12 12" />
                <path d="M6 6l12 12" />
              </svg>
            </span>
            <img
              src={file.url}
              alt={file.file?.name || "Imagen"}
              className="w-full h-full object-cover rounded cursor-grab"
            />
          </div>
        ))}
      </ReactSortable>
    </div>
  );
}
