import { z } from "zod";

export const behaviourEventTypes = [
  "event_impression",
  "event_opened",
  "event_skipped",
  "event_quick_exit",
  "entity_view_duration",
  "event_saved",
  "event_unsaved",
  "event_shared",
  "event_going",
  "event_not_interested",
  "event_directions_clicked",
  "event_ticket_clicked",
  "event_booking_clicked",
  "event_calendar_added",
  "event_rating_submitted",
  "event_review_submitted",
  "event_photo_uploaded",
  "event_comment_posted",
  "event_promoted_clicked",
  "venue_impression",
  "venue_opened",
  "venue_followed",
  "venue_unfollowed",
  "venue_shared",
  "venue_directions_clicked",
  "venue_phone_clicked",
  "venue_website_clicked",
  "venue_instagram_clicked",
  "venue_whatsapp_clicked",
  "venue_hidden",
  "search_performed",
  "search_result_clicked",
  "search_abandoned",
  "feed_scrolled",
  "feed_refreshed",
  "filter_changed",
  "map_opened",
  "map_pin_clicked",
  "notification_opened",
  "notification_dismissed",
  "email_clicked",
  "recommendation_clicked",
  "promotion_clicked",
] as const;

export type BehaviourEventType = (typeof behaviourEventTypes)[number];
export type BehaviourEntityType =
  | "event"
  | "venue"
  | "category"
  | "artist"
  | "organiser"
  | "passport"
  | "community_post"
  | "notification"
  | "search"
  | "feed";

const scalar = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const properties = z
  .record(scalar)
  .refine((value) => Object.keys(value).length <= 20, "too many properties");

export const behaviourEventSchema = z
  .object({
    event_id: z.string().uuid(),
    schema_version: z.literal(1),
    event_type: z.enum(behaviourEventTypes),
    entity_type: z
      .enum([
        "event",
        "venue",
        "category",
        "artist",
        "organiser",
        "passport",
        "community_post",
        "notification",
        "search",
        "feed",
      ])
      .optional(),
    entity_id: z.string().uuid().optional(),
    occurred_at: z.string().datetime({ offset: true }),
    surface: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    position: z.number().int().min(0).max(500).optional(),
    recommendation_request_id: z.string().uuid().optional(),
    context: properties.optional(),
    metadata: properties.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.entity_type) === Boolean(value.entity_id), {
    message: "entity_type and entity_id must be supplied together",
  });

export const behaviourBatchSchema = z
  .object({ events: z.array(behaviourEventSchema).min(1).max(25) })
  .strict();

export type BehaviourEvent = z.infer<typeof behaviourEventSchema>;
