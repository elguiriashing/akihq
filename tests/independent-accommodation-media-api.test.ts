import { afterEach, beforeEach, expect, it, vi } from "vitest";
const terms = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/accommodation-api-terms", () => ({
  accommodationApiTerms: terms,
}));
const mock = vi.hoisted(() => ({
  db: {
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
  store: { upload: vi.fn(), remove: vi.fn(), createSignedUrls: vi.fn() },
}));
vi.mock("../src/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => mock.db,
}));
import { GET, POST } from "../src/app/api/business/accommodations/media/route";
const property = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  path = property + "/photo.png";
function query(
  data: unknown = [
    { id, storage_path: path, alt_text: "Photo", public_position: null },
  ],
  error: unknown = null,
) {
  const q: Record<string, unknown> = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "order",
    "limit",
  ])
    q[method] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve);
  q.maybeSingle = vi.fn(async () => ({
    data: Array.isArray(data) ? (data[0] ?? null) : data,
    error,
  }));
  return q;
}
function json(body: unknown) {
  return new Request("https://akihq.app/api/business/accommodations/media", {
    method: "POST",
    headers: {
      origin: "https://akihq.app",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
function upload(
  type = "image/png",
  bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
) {
  const form = new FormData();
  form.set("property", property);
  form.set("altText", "Private picture");
  form.set("file", new File([bytes], "image.png", { type }));
  return new Request("https://akihq.app/api/business/accommodations/media", {
    method: "POST",
    headers: { origin: "https://akihq.app" },
    body: form,
  });
}
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.stubEnv("AKISUITE_ACCOMMODATION_READY", "true");
  vi.clearAllMocks();
  terms.mockResolvedValue(null);
  mock.db.auth.getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  mock.db.rpc.mockResolvedValue({ data: true, error: null });
  mock.db.from.mockReturnValue(query());
  mock.db.storage.from.mockReturnValue(mock.store);
  mock.store.upload.mockResolvedValue({ error: null });
  mock.store.remove.mockResolvedValue({ error: null });
  mock.store.createSignedUrls.mockResolvedValue({
    data: [{ path, signedUrl: "https://signed.invalid/private" }],
    error: null,
  });
});
it("denies cross-origin requests and malformed/oversized files before storage", async () => {
  const foreign = json({});
  foreign.headers.set("origin", "https://other.invalid");
  expect((await POST(foreign)).status).toBe(403);
  expect((await POST(upload("text/html"))).status).toBe(400);
  expect((await POST(upload("image/png", new Uint8Array(12)))).status).toBe(
    400,
  );
  const large = upload();
  large.headers.set("content-length", String(12 * 1024 * 1024));
  expect((await POST(large)).status).toBe(413);
  expect(mock.store.upload).not.toHaveBeenCalled();
});
it("requires authenticated live membership for reads and uploads", async () => {
  mock.db.auth.getUser.mockResolvedValue({ data: { user: null } });
  expect(
    (
      await GET(
        new Request(
          `https://akihq.app/api/business/accommodations/media?property=${property}`,
        ),
      )
    ).status,
  ).toBe(401);
  mock.db.auth.getUser.mockResolvedValue({
    data: { user: { id: "outsider" } },
  });
  mock.db.rpc.mockResolvedValue({ data: false, error: null });
  expect((await POST(upload())).status).toBe(403);
  expect(mock.store.upload).not.toHaveBeenCalled();
});
it("uploads a unique property path and creates private metadata only", async () => {
  const q = query();
  mock.db.from.mockReturnValue(q);
  expect((await POST(upload())).status).toBe(201);
  expect(mock.db.storage.from).toHaveBeenCalledWith("accommodation-media");
  expect(mock.store.upload).toHaveBeenCalledWith(
    expect.stringMatching(new RegExp(`^${property}/[a-f0-9-]+\\.png$`)),
    expect.any(Uint8Array),
    { contentType: "image/png", upsert: false },
  );
  expect(q.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      property_id: property,
      alt_text: "Private picture",
    }),
  );
  expect(q.insert).not.toHaveBeenCalledWith(
    expect.objectContaining({ public_position: expect.anything() }),
  );
});
it("does not create metadata after upload failure and cleans a failed metadata insert", async () => {
  const q = query();
  mock.db.from.mockReturnValue(q);
  mock.store.upload.mockResolvedValue({ error: { message: "offline" } });
  expect((await POST(upload())).status).toBe(503);
  expect(q.insert).not.toHaveBeenCalled();
  mock.store.upload.mockResolvedValue({ error: null });
  mock.db.from.mockReturnValue(query(null, { message: "denied" }));
  expect((await POST(upload())).status).toBe(503);
  expect(mock.store.remove).toHaveBeenCalledTimes(1);
});
it("signs only scoped metadata and exposes errors as unavailable", async () => {
  const response = await GET(
    new Request(
      `https://akihq.app/api/business/accommodations/media?property=${property}`,
    ),
  );
  expect(await response.json()).toEqual({
    media: [
      {
        id,
        altText: "Photo",
        position: null,
        url: "https://signed.invalid/private",
      },
    ],
  });
  expect(mock.store.createSignedUrls).toHaveBeenCalledWith([path], 600);
  mock.store.createSignedUrls.mockResolvedValue({
    data: null,
    error: { message: "offline" },
  });
  expect(
    (
      await GET(
        new Request(
          `https://akihq.app/api/business/accommodations/media?property=${property}`,
        ),
      )
    ).status,
  ).toBe(503);
});
it("scopes placement and deletion by actual property, preserving metadata on storage failure", async () => {
  const q = query();
  mock.db.from.mockReturnValue(q);
  expect(
    (await POST(json({ action: "place", property, id, position: 0 }))).status,
  ).toBe(200);
  expect(q.eq).toHaveBeenCalledWith("property_id", property);
  expect(q.eq).toHaveBeenCalledWith("id", id);
  mock.store.remove.mockResolvedValue({ error: { message: "offline" } });
  expect((await POST(json({ action: "remove", property, id }))).status).toBe(
    503,
  );
  expect(q.delete).not.toHaveBeenCalled();
  mock.db.from.mockReturnValue(query([]));
  expect((await POST(json({ action: "remove", property, id }))).status).toBe(
    404,
  );
});

it("denies missing current terms before inventory or media access", async () => {
  terms.mockResolvedValue("terms_required");
  const response = await GET(
    new Request(
      "https://akihq.app/api/business/accommodations?property=" + property,
    ),
  );
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "terms_required" });
});
