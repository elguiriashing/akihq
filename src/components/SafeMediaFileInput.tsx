"use client";

import { useState, type ChangeEvent } from "react";

const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2560;
const MAX_PDF_PAGES = 20;
const MAX_RENDER_HEIGHT = 14_000;
const MAX_RENDER_WIDTH = 1_600;

let pdfWorker: Worker | null = null;

function setSubmitDisabled(input: HTMLInputElement, disabled: boolean) {
  input
    .closest("form")
    ?.querySelectorAll<HTMLButtonElement>('button[type="submit"]')
    .forEach((button) => {
      button.disabled = disabled;
      button.setAttribute("aria-disabled", disabled ? "true" : "false");
    });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("image_conversion_failed"));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function renderPdfAsSafeJpeg(file: File) {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfWorker) {
    pdfWorker = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
  }
  pdfjs.GlobalWorkerOptions.workerPort = pdfWorker;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    enableXfa: false,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;

  if (pdf.numPages < 1 || pdf.numPages > MAX_PDF_PAGES) {
    await pdf.destroy();
    throw new Error("pdf_page_limit");
  }

  const pages: Array<{
    page: Awaited<ReturnType<typeof pdf.getPage>>;
    width: number;
    height: number;
  }> = [];
  let maxWidth = 0;
  let totalHeight = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ page, width: viewport.width, height: viewport.height });
    maxWidth = Math.max(maxWidth, viewport.width);
    totalHeight += viewport.height;
  }

  const gap = 14;
  const availableHeight =
    MAX_RENDER_HEIGHT - Math.max(0, pages.length - 1) * gap;
  const scale = Math.min(
    2,
    MAX_RENDER_WIDTH / Math.max(maxWidth, 1),
    availableHeight / Math.max(totalHeight, 1),
  );

  const outputWidth = Math.max(1, Math.round(maxWidth * scale));
  const renderedHeights = pages.map((item) =>
    Math.max(1, Math.round(item.height * scale)),
  );
  const outputHeight =
    renderedHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, pages.length - 1) * gap;

  const output = document.createElement("canvas");
  output.width = outputWidth;
  output.height = outputHeight;
  const outputContext = output.getContext("2d", { alpha: false });
  if (!outputContext) {
    await pdf.destroy();
    throw new Error("canvas_unavailable");
  }
  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, output.width, output.height);

  let offsetY = 0;
  for (let index = 0; index < pages.length; index += 1) {
    const item = pages[index];
    const viewport = item.page.getViewport({ scale });
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = Math.max(1, Math.round(viewport.width));
    pageCanvas.height = Math.max(1, Math.round(viewport.height));
    const pageContext = pageCanvas.getContext("2d", { alpha: false });
    if (!pageContext) {
      await pdf.destroy();
      throw new Error("canvas_unavailable");
    }
    pageContext.fillStyle = "#ffffff";
    pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    await item.page.render({
      canvas: pageCanvas,
      viewport,
    }).promise;

    const x = Math.max(0, Math.round((outputWidth - pageCanvas.width) / 2));
    outputContext.drawImage(pageCanvas, x, offsetY);
    offsetY += pageCanvas.height + gap;
    item.page.cleanup();
  }

  await pdf.destroy();

  let blob = await canvasToBlob(output, 0.88);
  if (blob.size > 9.5 * 1024 * 1024) {
    blob = await canvasToBlob(output, 0.7);
  }
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error("converted_file_too_large");
  }

  const baseName = file.name.replace(/\.pdf$/i, "").slice(0, 120) || "document";
  return new File([blob], `${baseName}-sanitized.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function compressImage(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("unsupported_image");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    let width = Math.min(bitmap.width, MAX_IMAGE_DIMENSION);
    let height = Math.min(bitmap.height, MAX_IMAGE_DIMENSION);
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    width = Math.max(1, Math.round(bitmap.width * scale));
    height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("canvas_unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    let blob = await canvasToBlob(canvas, 0.85);
    if (blob.size > MAX_UPLOAD_BYTES) blob = await canvasToBlob(canvas, 0.68);
    if (blob.size > MAX_UPLOAD_BYTES)
      throw new Error("converted_file_too_large");
    const basename = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "photo";
    return new File([blob], `${basename}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

export function SafeMediaFileInput({
  locale,
  name,
  required = false,
  multiple = false,
  maxFiles = 20,
}: {
  locale: "es" | "en";
  name: string;
  required?: boolean;
  multiple?: boolean;
  maxFiles?: number;
}) {
  const es = locale === "es";
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    setStatus("");
    setError("");
    if (!files.length) return;

    if (files.length > maxFiles) {
      input.value = "";
      setError(
        es
          ? `Puedes subir un máximo de ${maxFiles} archivos de una vez.`
          : `You can upload up to ${maxFiles} files at once.`,
      );
      return;
    }

    const oversized = files.find((file) => file.size > MAX_INPUT_BYTES);
    if (oversized) {
      input.value = "";
      setError(
        es
          ? `${oversized.name} supera 50 MB.`
          : `${oversized.name} is larger than 50 MB.`,
      );
      return;
    }

    setSubmitDisabled(input, true);
    setStatus(
      es
        ? "Preparando y comprimiendo imágenes…"
        : "Preparing and compressing images…",
    );

    try {
      const transfer = new DataTransfer();
      for (const file of files) {
        const isPdf =
          file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        transfer.items.add(
          isPdf ? await renderPdfAsSafeJpeg(file) : await compressImage(file),
        );
      }
      input.files = transfer.files;
      setStatus(
        es
          ? `${transfer.files.length} archivo${transfer.files.length === 1 ? "" : "s"} listo${transfer.files.length === 1 ? "" : "s"} y comprimido${transfer.files.length === 1 ? "" : "s"}.`
          : `${transfer.files.length} file${transfer.files.length === 1 ? "" : "s"} compressed and ready.`,
      );
    } catch (conversionError) {
      input.value = "";
      setStatus("");
      setError(
        conversionError instanceof Error &&
          conversionError.message === "pdf_page_limit"
          ? es
            ? `Cada PDF debe tener entre 1 y ${MAX_PDF_PAGES} páginas.`
            : `Each PDF must contain between 1 and ${MAX_PDF_PAGES} pages.`
          : es
            ? "No se pudo procesar un archivo. Prueba otra imagen o PDF."
            : "A file could not be processed. Try another image or PDF.",
      );
    } finally {
      setSubmitDisabled(input, false);
    }
  }

  return (
    <span className="safe-media-file-input">
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
        required={required}
        multiple={multiple}
        onChange={handleChange}
      />
      {status && <small className="safe-media-status">{status}</small>}
      {error && (
        <small className="safe-media-status error" role="alert">
          {error}
        </small>
      )}
    </span>
  );
}
