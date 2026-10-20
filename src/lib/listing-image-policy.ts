/** Decode bounded image headers only; no native decoder, EXIF or remote requests. */
export function listingImageDimensions(bytes: Uint8Array, mime: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at: number, text: string) =>
    [...text].every((c, n) => bytes[at + n] === c.charCodeAt(0));
  let width = 0,
    height = 0;
  if (
    mime === "image/png" &&
    bytes.length >= 33 &&
    bytes[0] === 137 &&
    ascii(1, "PNG\r\n\u001a\n") &&
    view.getUint32(8) === 13 &&
    ascii(12, "IHDR")
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) {
    let at = 2;
    while (at + 3 < bytes.length) {
      if (bytes[at++] !== 255) return null;
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (at + 2 > bytes.length) return null;
      const size = view.getUint16(at);
      if (size < 2 || at + size > bytes.length) return null;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (size < 8) return null;
        height = view.getUint16(at + 3);
        width = view.getUint16(at + 5);
        break;
      }
      at += size;
    }
  } else if (
    mime === "image/webp" &&
    bytes.length >= 30 &&
    ascii(0, "RIFF") &&
    ascii(8, "WEBP")
  ) {
    if (ascii(12, "VP8X") && view.getUint32(16, true) >= 10) {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (ascii(12, "VP8 ") && ascii(23, "\u009d\u0001\u002a")) {
      width = view.getUint16(26, true) & 16383;
      height = view.getUint16(28, true) & 16383;
    } else if (ascii(12, "VP8L") && bytes[20] === 47) {
      const packed = view.getUint32(21, true);
      width = (packed & 16383) + 1;
      height = ((packed >>> 14) & 16383) + 1;
    }
  }
  return width > 0 && height > 0 ? { width, height } : null;
}
export function listingImagePolicy(premium: boolean) {
  return {
    maxDimension: premium ? 3840 : 1920,
    jpegQuality: premium ? 0.9 : 0.8,
  };
}
