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
    const b = new Uint8Array(33);
    b.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const v = new DataView(b.buffer);
    v.setUint32(8, 13);
    b.set([73, 72, 68, 82], 12);
    v.setUint32(16, 3840);
    v.setUint32(20, 1920);
    expect(listingImageDimensions(b, "image/png")).toEqual({
      width: 3840,
      height: 1920,
    });
    expect(listingImageDimensions(b, "image/jpeg")).toBeNull();
    expect(listingImageDimensions(b.slice(0, 20), "image/png")).toBeNull();
  });
  it("reads JPEG start-of-frame dimensions without trusting the file name", () => {
    const b = Uint8Array.from([
      255, 216, 255, 192, 0, 11, 8, 4, 56, 7, 128, 1, 1, 17, 0, 255, 217,
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
});
