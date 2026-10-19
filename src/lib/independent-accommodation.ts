import { z } from "zod";

const uuid = z.string().uuid();
export const accommodationProfile = z
  .object({
    name: z.string().trim().min(2).max(120),
    address: z.string().max(500),
    city: z.string().max(160),
    latitude: z.number().min(-85).max(85).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    accommodation_type: z.enum([
      "hotel",
      "apartment",
      "rural_house",
      "hostel",
      "guest_house",
      "campsite",
      "motel",
      "student_accommodation",
    ]),
    website_url: z.string().url().startsWith("https://").max(2000).nullable(),
    description_es: z.string().max(6000),
    description_en: z.string().max(6000),
  })
  .strict();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const accommodationOperation = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("member"),
      property: uuid,
      profile: uuid,
      role: z.literal("manager").nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("profile"),
      property: uuid,
      profile: accommodationProfile,
      submit: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("review"),
      revision: uuid,
      property: uuid,
      publish: z.boolean(),
      reason: z.string().trim().min(10).max(2000),
    })
    .strict(),
  z
    .object({
      action: z.literal("create"),
      name: z.string().trim().min(2).max(120),
      workspace: z.string().min(3).max(80).nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("room_type"),
      property: uuid,
      id: uuid.optional(),
      name: z.string().trim().min(2).max(120),
      maxGuests: z.number().int().min(1).max(30),
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("unit"),
      property: uuid,
      id: uuid.optional(),
      roomType: uuid,
      name: z.string().trim().min(1).max(120),
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("rate"),
      property: uuid,
      roomType: uuid,
      start: date,
      end: date,
      cents: z.number().int().min(0).max(2147483647),
      minimumNights: z.number().int().min(1).max(365),
    })
    .strict(),
  z
    .object({
      action: z.literal("block"),
      property: uuid,
      unit: uuid,
      start: date,
      end: date,
    })
    .strict(),
  z
    .object({ action: z.literal("remove_rate"), property: uuid, id: uuid })
    .strict(),
  z
    .object({ action: z.literal("remove_block"), property: uuid, id: uuid })
    .strict(),
  z
    .object({
      action: z.literal("settings"),
      property: uuid,
      mode: z.enum(["disabled", "external", "request"]),
      externalUrl: z.string().url().startsWith("https://").max(2000).nullable(),
      policy: z.string().max(4000),
      notificationEmail: z.string().email().max(254).nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("status"),
      property: uuid,
      reservation: uuid,
      status: z.enum([
        "confirmed",
        "declined",
        "cancelled",
        "checked_in",
        "completed",
      ]),
    })
    .strict(),
]);
export const accommodationPropertyId = uuid;
