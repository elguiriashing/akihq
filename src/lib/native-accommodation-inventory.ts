/** Independent property tables never alias the legacy venue inventory namespace. */
export const nativeAccommodationTables = {
  room_types: "accommodation_property_room_types",
  units: "accommodation_property_units",
  nightly_rates: "accommodation_property_nightly_rates",
  unit_blocks: "accommodation_property_unit_blocks",
  booking_settings: "accommodation_property_booking_settings",
  reservations: "accommodation_property_reservations",
  property_media: "accommodation_property_media",
} as const;
