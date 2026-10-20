/** Bounded structural parsing of actual image bytes, never client-supplied dimensions. */
export function listingImageDimensions(bytes: Uint8Array, mime: string) {
  if (bytes.byteLength > 10485760) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at: number, text: string) =>
    [...text].every((c, n) => bytes[at + n] === c.charCodeAt(0));
  const result = (width: number, height: number) =>
    width > 0 && height > 0 ? { width, height } : null;
  if (mime === "image/png") {
    if (bytes.length < 45 || bytes[0] !== 137 || !ascii(1, "PNG\r\n\u001a\n"))
      return null;
    let at = 8,
      width = 0,
      height = 0,
      seenData = false;
    while (at + 12 <= bytes.length) {
      const size = view.getUint32(at),
        kind = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
      if (size > bytes.length - at - 12) return null;
      if (kind === "IHDR") {
        if (at !== 8 || size !== 13) return null;
        width = view.getUint32(at + 8);
        height = view.getUint32(at + 12);
      } else if (kind === "IDAT") seenData = true;
      else if (["acTL", "fcTL", "fdAT"].includes(kind))
        return null; // Canonical still images only.
      else if (kind === "IEND")
        return size === 0 && at + 12 === bytes.length && seenData
          ? result(width, height)
          : null;
      at += size + 12;
    }
    return null;
  }
  if (mime === "image/jpeg") {
    if (bytes[0] !== 255 || bytes[1] !== 216) return null;
    let at = 2,
      width = 0,
      height = 0,
      seenScan = false,
      entropy = false;
    while (at < bytes.length) {
      if (entropy) {
        while (at < bytes.length && bytes[at] !== 255) at++;
        if (at >= bytes.length) return null;
      }
      if (bytes[at++] !== 255) return null;
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (entropy && (marker === 0 || (marker >= 208 && marker <= 215)))
        continue;
      entropy = false;
      if (marker === 217)
        return at === bytes.length && seenScan ? result(width, height) : null;
      if (marker === 216 || marker === 0 || marker === 220) return null; // Extra images / dynamic-height frames.
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (at + 2 > bytes.length) return null;
      const size = view.getUint16(at);
      if (size < 2 || at + size > bytes.length) return null;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (
          ![192, 193, 194].includes(marker) ||
          width ||
          size < 11 ||
          bytes[at + 2] !== 8
        )
          return null;
        const components = bytes[at + 7];
        if (![1, 3, 4].includes(components) || size !== 8 + 3 * components)
          return null;
        height = view.getUint16(at + 3);
        width = view.getUint16(at + 5);
        if (!result(width, height)) return null;
      }
      if (marker === 218) {
        if (!width || size < 6) return null;
        seenScan = true;
        entropy = true;
      }
      at += size;
    }
    return null;
  }
  if (mime === "image/webp") {
    if (
      bytes.length < 26 ||
      !ascii(0, "RIFF") ||
      !ascii(8, "WEBP") ||
      view.getUint32(4, true) !== bytes.length - 8
    )
      return null;
    let at = 12,
      width = 0,
      height = 0,
      canvas: { width: number; height: number } | null = null;
    while (at + 8 <= bytes.length) {
      const size = view.getUint32(at + 4, true),
        start = at + 8;
      if (size > bytes.length - start) return null;
      if (ascii(at, "VP8X")) {
        if (canvas || at !== 12 || size !== 10 || bytes[start] & 2) return null;
        canvas = {
          width:
            1 +
            bytes[start + 4] +
            (bytes[start + 5] << 8) +
            (bytes[start + 6] << 16),
          height:
            1 +
            bytes[start + 7] +
            (bytes[start + 8] << 8) +
            (bytes[start + 9] << 16),
        };
      } else if (ascii(at, "VP8 ")) {
        if (
          width ||
          size < 10 ||
          bytes[start] & 1 ||
          !ascii(start + 3, "\u009d\u0001\u002a")
        )
          return null;
        width = view.getUint16(start + 6, true) & 16383;
        height = view.getUint16(start + 8, true) & 16383;
      } else if (ascii(at, "VP8L")) {
        if (width || size < 5 || bytes[start] !== 47) return null;
        const packed = view.getUint32(start + 1, true);
        if (packed >>> 29) return null;
        width = (packed & 16383) + 1;
        height = ((packed >>> 14) & 16383) + 1;
      } else if (ascii(at, "ANIM") || ascii(at, "ANMF")) return null;
      at = start + size + (size % 2);
    }
    if (
      at !== bytes.length ||
      (canvas && (canvas.width !== width || canvas.height !== height))
    )
      return null;
    return result(width, height);
  }
  return null;
}
export function listingImagePolicy(premium: boolean) {
  return {
    maxDimension: premium ? 3840 : 1920,
    jpegQuality: premium ? 0.9 : 0.8,
  };
}
