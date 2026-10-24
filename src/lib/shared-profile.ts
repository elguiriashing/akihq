/** Shared account contract v1: same profiles row and normal caller RLS in every product. */
import { z } from "zod";
export const sharedProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  username: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_]{3,30}$/),
  ]),
  bio: z.string().trim().max(2000),
  phone: z.string().trim().max(40),
  locality: z.string().trim().max(120),
  province: z.string().trim().max(120),
  preferredLocale: z.enum(["en", "es"]),
  profileVisibility: z.enum(["public", "members", "private"]),
  contactVisibility: z.enum(["public", "members", "private"]),
});
export function sharedProfileUpdate(
  input: z.infer<typeof sharedProfileSchema>,
) {
  return {
    display_name: input.displayName,
    username: input.username || null,
    bio: input.bio || null,
    phone: input.phone || null,
    locality: input.locality || null,
    province: input.province || null,
    preferred_locale: input.preferredLocale,
    profile_visibility: input.profileVisibility,
    contact_visibility: input.contactVisibility,
  };
}
