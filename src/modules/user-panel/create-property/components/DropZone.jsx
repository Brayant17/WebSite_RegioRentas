//DropZone.jsx
import { useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import pkg from "react-sortablejs";
const { ReactSortable } = pkg;

export default function DropZone({ files, setFiles, deletedFiles, setDeletedFiles }) {
  // Al soltar archivos nuevos
  const onDrop = useCallback(
    (acceptedFiles) => {
      const newFiles = acceptedFiles.map((file, index) => ({
        id: Date.now() + "-" + index, // ID único
        file,
        preview: URL.createObjectURL(file),
        isExisting: false,
        filename: file.name,
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
        if (!f.isExisting && f.preview.startsWith("blob:")) {
          URL.revokeObjectURL(f.preview);
        }
      });
    };
  }, [files]);

  // Eliminar una imagen
  const handleDelete = (file) => {
    if (!file.isExisting && file.preview.startsWith("blob:")) {
      URL.revokeObjectURL(file.preview);
    }
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (file.isExisting) {
      setDeletedFiles((prev) => [...prev, file]);
    }
  };

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

      {/* Previews */}

      <ReactSortable list={files} setList={setFiles} animation={150} ghostClass="ghost" className="flex gap-2 flex-wrap mt-2">
        {files.map((file) => (
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
              src={file.preview}
              alt={file.filename || "Imagen"}
              className="w-full h-full object-cover rounded cursor-grab"
            />
          </div>
        ))}
      </ReactSortable>
    </div>
  );
}
