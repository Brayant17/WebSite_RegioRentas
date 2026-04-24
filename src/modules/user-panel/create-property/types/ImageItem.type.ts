export type ImageItem = {
  id: string; // ID único para cada imagen, puede ser un string o número id real o crypto generado
  name?: string; // Nombre del archivo, opcional para archivos nuevos
  file?: File;
  url: string;
  status: "existing" | "new" | "deleted";
  order?: number;
}