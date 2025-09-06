import { useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";

export default function DropZone({ files, setFiles, deletedFiles, setDeletedFiles }) {
  // Al soltar archivos nuevos
  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      isExisting: false,
      filename: file.name,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, [setFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  // Revocar blobs al desmontar el componente
  useEffect(() => {
    return () => {
      files.forEach(f => {
        if (!f.isExisting && f.preview.startsWith("blob:")) {
          URL.revokeObjectURL(f.preview);
        }
      });
    };
  }, [files]);

  // Eliminar una imagen de la lista
  const handleDelete = (file) => {
    // Si es blob local, revocamos su URL
    if (!file.isExisting && file.preview.startsWith("blob:")) {
      URL.revokeObjectURL(file.preview);
    }

    // Quitar del estado files
    setFiles(prev => prev.filter(f => f !== file));

    // Si es imagen existente, marcar para eliminar del servidor
    if (file.isExisting) {
      setDeletedFiles(prev => [...prev, file]);
    }
  };

  return (
    <div>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-6 rounded cursor-pointer text-center ${isDragActive ? "bg-blue-100" : "bg-gray-50"}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? <p>Suelta tus imágenes aquí...</p> : <p>Arrastra o selecciona imágenes</p>}
      </div>

      {/* Previews */}
      <div className="flex gap-2 flex-wrap mt-2">
        {files.map((file, i) => (
          <div key={i} className="w-24 h-24 relative">
            <span
              onClick={() => handleDelete(file)}
              className="absolute top-0 right-0 bg-white p-1 rounded-full cursor-pointer hover:bg-red-600 hover:text-white"
            >
              ✕
            </span>
            <img
              src={file.preview}
              alt={file.filename || "Imagen"}
              className="w-full h-full object-cover rounded"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
