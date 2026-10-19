import type { Event, Venue } from "./domain";

export const venues: Venue[] = [];

export function fixtureEvents(_now = new Date()): Event[] {
  void _now;
  return [];
}
