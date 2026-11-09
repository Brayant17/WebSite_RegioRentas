export class PdfError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PdfError";
    this.status = status;
    this.code = code;
  }
}
