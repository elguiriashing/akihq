// Motion stays on-device; this preference is separate from analytics and ads.
const preferenceKey = "akipasa:passport-motion";
export const motionPreferenceEvent = "akipasa:motion-preference";
export const motionPermissionEvent = "akipasa:motion-permission";
export type MotionEventType = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};
export function readMotionPreference(): boolean | null {
  try {
    const value = localStorage.getItem(preferenceKey);
    return value === null ? null : value === "on";
  } catch {
    return null;
  }
}
export function writeMotionPreference(enabled: boolean) {
  try {
    localStorage.setItem(preferenceKey, enabled ? "on" : "off");
  } catch {
    // The current page still applies the preference without storage.
  }
  window.dispatchEvent(
    new CustomEvent(motionPreferenceEvent, { detail: enabled }),
  );
}
// Call directly from the user's click, before any unrelated await.
export async function requestPassportMotion(): Promise<boolean> {
  if (!window.isSecureContext || !window.DeviceOrientationEvent) return false;
  const permission = (window.DeviceOrientationEvent as MotionEventType)
    .requestPermission;
  try {
    const granted =
      !permission ||
      (await permission.call(window.DeviceOrientationEvent)) === "granted";
    window.dispatchEvent(
      new CustomEvent(motionPermissionEvent, { detail: granted }),
    );
    return granted;
  } catch {
    window.dispatchEvent(
      new CustomEvent(motionPermissionEvent, { detail: false }),
    );
    return false;
  }
}
