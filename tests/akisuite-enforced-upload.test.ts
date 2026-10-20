import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  storeListingUpload,
  discardListingUpload,
} from "../src/lib/listing-upload";
const venue = "20000000-0000-4000-8000-000000000001",
  id = "50000000-0000-4000-8000-000000000001";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=",
  "base64",
);
function clients(
  options: {
    swap?: boolean;
    quota?: boolean;
    committed?: boolean;
    closed?: boolean;
  } = {},
) {
  let uploaded = new Uint8Array();
  const userStorage = {
    upload: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
  };
  const userRpc = vi.fn(async (name: string) =>
    name === "listing_limits_info"
      ? { data: { uploads_enforced: !options.closed }, error: null }
      : options.quota
        ? {
            data: null,
            error: {
              code: "PT402",
              message: "Image resolution allowance exceeded",
            },
          }
        : { data: { id, path: `${venue}/${id}.png` }, error: null },
  );
  const serviceStorage = {
    upload: vi.fn(async (_path: string, bytes: Uint8Array) => {
      uploaded = new Uint8Array(bytes);
      return { error: null };
    }),
    download: vi.fn(async () => {
      const bytes = new Uint8Array(uploaded);
      if (options.swap) bytes[bytes.length - 1] ^= 1;
      return { data: new Blob([bytes]), error: null };
    }),
    remove: vi.fn(async () => ({ error: null })),
  };
  const serviceRpc = vi.fn(async (name: string) => ({
    data: name === "cancel_listing_upload" ? !options.committed : true,
    error: null,
  }));
  const db = {
    rpc: userRpc,
    storage: { from: () => userStorage },
  } as unknown as SupabaseClient;
  const service = {
    rpc: serviceRpc,
    storage: { from: () => serviceStorage },
  } as unknown as SupabaseClient;
  return {
    db,
    service,
    userRpc,
    userStorage,
    serviceRpc,
    serviceStorage,
    factory: () => service,
  };
}
beforeEach(() => {
  process.env.AKISUITE_LISTING_UPLOADS_READY = "true";
});
afterEach(() => {
  delete process.env.AKISUITE_LISTING_UPLOADS_READY;
  vi.restoreAllMocks();
});
describe("server-owned upload adapter", () => {
  it("hashes actual bytes, reserves computed dimensions and writes only with service credentials", async () => {
    const c = clients();
    const file = new File([png], "image.png", { type: "image/png" });
    const result = await storeListingUpload(c.db, venue, file, null, c.factory);
    const sha = createHash("sha256").update(png).digest("hex");
    expect(c.userRpc).toHaveBeenCalledWith(
      "reserve_listing_upload",
      expect.objectContaining({
        p_venue: venue,
        p_digest: sha,
        p_width: 1,
        p_height: 1,
        p_bytes: png.length,
      }),
    );
    expect(c.userStorage.upload).not.toHaveBeenCalled();
    expect(c.serviceStorage.upload).toHaveBeenCalledWith(
      `${venue}/${id}.png`,
      expect.any(Uint8Array),
      expect.objectContaining({
        upsert: false,
        metadata: { listing_upload_id: id, sha256: sha },
      }),
    );
    expect(c.serviceStorage.download).toHaveBeenCalledOnce();
    expect(c.serviceRpc).toHaveBeenCalledWith("complete_listing_upload", {
      p_reservation: id,
      p_digest: sha,
    });
    expect(result).toEqual({ path: `${venue}/${id}.png`, reservationId: id });
  });
  it("rejects a stored-byte substitution before issuing receipt and cleans only uncommitted objects", async () => {
    const c = clients({ swap: true });
    await expect(
      storeListingUpload(
        c.db,
        venue,
        new File([png], "x.png", { type: "image/png" }),
        null,
        c.factory,
      ),
    ).rejects.toThrow("storage");
    expect(c.serviceRpc).not.toHaveBeenCalledWith(
      "complete_listing_upload",
      expect.anything(),
    );
    expect(c.serviceRpc).toHaveBeenCalledWith("cancel_listing_upload", {
      p_reservation: id,
    });
    expect(c.serviceStorage.remove).toHaveBeenCalledOnce();
  });
  it("does not remove committed media after an ambiguous insert response", async () => {
    const c = clients({ committed: true });
    await discardListingUpload(
      c.db,
      { path: `${venue}/${id}.png`, reservationId: id },
      c.factory,
    );
    expect(c.serviceStorage.remove).not.toHaveBeenCalled();
  });
  it("rejects spoofed image content and quota errors before service storage upload", async () => {
    const c = clients();
    await expect(
      storeListingUpload(
        c.db,
        venue,
        new File(["not an image"], "x.png", { type: "image/png" }),
        null,
        c.factory,
      ),
    ).rejects.toThrow("invalid-file");
    const q = clients({ quota: true });
    await expect(
      storeListingUpload(
        q.db,
        venue,
        new File([png], "x.png", { type: "image/png" }),
        null,
        q.factory,
      ),
    ).rejects.toThrow("resolution");
    expect(c.serviceStorage.upload).not.toHaveBeenCalled();
    expect(q.serviceStorage.upload).not.toHaveBeenCalled();
  });
  it("preserves legacy upload during staged rollout while strict database gate is closed", async () => {
    const c = clients({ closed: true });
    const file = new File([png], "x.png", { type: "image/png" });
    const result = await storeListingUpload(c.db, venue, file, null, c.factory);
    expect(result.reservationId).toBeNull();
    expect(c.userStorage.upload).toHaveBeenCalledOnce();
    expect(c.serviceStorage.upload).not.toHaveBeenCalled();
  });
});
