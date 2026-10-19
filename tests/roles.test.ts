import { describe, expect, it } from "vitest";
import {
  canModerate,
  isAdministrator,
  roleCapabilities,
  roleLabel,
} from "../src/lib/roles";

describe("account roles", () => {
  it("maps internal roles to product language", () => {
    expect(roleLabel("consumer", "en")).toBe("User");
    expect(roleLabel("organiser", "en")).toBe("Business");
    expect(roleLabel("moderator", "en")).toBe("Staff");
    expect(roleLabel("administrator", "es")).toBe("Administrador");
  });
  it("keeps staff moderation and admin access distinct", () => {
    expect(canModerate("moderator")).toBe(true);
    expect(canModerate("administrator")).toBe(true);
    expect(isAdministrator("moderator")).toBe(false);
    expect(isAdministrator("administrator")).toBe(true);
  });
  it("makes account capabilities additive without granting staff business ownership", () => {
    expect(roleCapabilities("consumer")).toEqual({
      useConsumerFeatures: true,
      manageOwnedVenues: false,
      moderatePlatform: false,
      administerPlatform: false,
    });
    expect(roleCapabilities("organiser").manageOwnedVenues).toBe(true);
    expect(roleCapabilities("moderator").manageOwnedVenues).toBe(false);
    expect(roleCapabilities("moderator").moderatePlatform).toBe(true);
    expect(roleCapabilities("administrator")).toEqual({
      useConsumerFeatures: true,
      manageOwnedVenues: true,
      moderatePlatform: true,
      administerPlatform: true,
    });
  });
});
