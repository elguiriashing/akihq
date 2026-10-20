import { describe, expect, it } from "vitest";
import {
  listingImageDimensions,
  listingImagePolicy,
} from "../src/lib/listing-image-policy";
describe("listing image upload header policy", () => {
  it("uses explicit free/Premium resolution and compression profiles", () => {
    expect(listingImagePolicy(false)).toEqual({
      maxDimension: 1920,
      jpegQuality: 0.8,
    });
    expect(listingImagePolicy(true)).toEqual({
      maxDimension: 3840,
      jpegQuality: 0.9,
    });
  });
  it("reads PNG dimensions and refuses truncated/forged content types", () => {
    const b = new Uint8Array(58);
    b.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const v = new DataView(b.buffer);
    v.setUint32(8, 13);
    b.set([73, 72, 68, 82], 12);
    v.setUint32(16, 3840);
    v.setUint32(20, 1920);
    v.setUint32(33, 1);
    b.set([73, 68, 65, 84], 37);
    v.setUint32(46, 0);
    b.set([73, 69, 78, 68], 50);
    expect(listingImageDimensions(b, "image/png")).toEqual({
      width: 3840,
      height: 1920,
    });
    expect(listingImageDimensions(b, "image/jpeg")).toBeNull();
    expect(listingImageDimensions(b.slice(0, 20), "image/png")).toBeNull();
  });
  it("reads JPEG start-of-frame dimensions without trusting the file name", () => {
    const b = Uint8Array.from([
      255, 216, 255, 192, 0, 11, 8, 4, 56, 7, 128, 1, 1, 17, 0, 255, 218, 0, 8,
      1, 1, 0, 0, 63, 0, 0, 255, 217,
    ]);
    expect(listingImageDimensions(b, "image/jpeg")).toEqual({
      width: 1920,
      height: 1080,
    });
    b[5] = 255;
    expect(listingImageDimensions(b, "image/jpeg")).toBeNull();
  });
  it("rejects arbitrary bytes and zero dimensions without invoking native decoding", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      expect(listingImageDimensions(new Uint8Array(), mime)).toBeNull();
      expect(listingImageDimensions(new Uint8Array(64), mime)).toBeNull();
    }
  });
  it("rejects WebP canvas spoofing, animation, extra frames and trailing bytes", () => {
    const make = (canvasWidth: number, frameWidth: number) => {
      const b = new Uint8Array(48),
        v = new DataView(b.buffer);
      b.set(Buffer.from("RIFF"));
      v.setUint32(4, 40, true);
      b.set(Buffer.from("WEBPVP8X"), 8);
      v.setUint32(16, 10, true);
      b[24] = (canvasWidth - 1) & 255;
      b[25] = (canvasWidth - 1) >> 8;
      b.set(Buffer.from("VP8 "), 30);
      v.setUint32(34, 10, true);
      b.set([157, 1, 42], 41);
      v.setUint16(44, frameWidth, true);
      v.setUint16(46, 1, true);
      return b;
    };
    expect(listingImageDimensions(make(1920, 1920), "image/webp")).toEqual({
      width: 1920,
      height: 1,
    });
    expect(listingImageDimensions(make(1, 3840), "image/webp")).toBeNull();
    const animated = make(1920, 1920);
    animated[20] = 2;
    expect(listingImageDimensions(animated, "image/webp")).toBeNull();
    expect(
      listingImageDimensions(
        new Uint8Array([...make(1920, 1920), 0]),
        "image/webp",
      ),
    ).toBeNull();
  });
  it("rejects JPEG additional frames and PNG animation or missing image data", () => {
    const jpeg = Uint8Array.from([
      255, 216, 255, 192, 0, 11, 8, 0, 1, 0, 1, 1, 1, 17, 0, 255, 218, 0, 8, 1,
      1, 0, 0, 63, 0, 0, 255, 217,
    ]);
    expect(
      listingImageDimensions(new Uint8Array([...jpeg, ...jpeg]), "image/jpeg"),
    ).toBeNull();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=",
      "base64",
    );
    expect(listingImageDimensions(png, "image/png")).toEqual({
      width: 1,
      height: 1,
    });
    const animated = Uint8Array.from(png);
    animated.set(Buffer.from("acTL"), 37);
    expect(listingImageDimensions(animated, "image/png")).toBeNull();
  });
});
