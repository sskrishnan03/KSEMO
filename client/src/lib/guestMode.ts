// Tracks whether the app is currently in "guest" (signed-out preview) mode.
// Used by main.tsx to suppress the auto-redirect-to-login that normally fires
// when an authenticated API call returns a 401. While a guest explores the
// app, expired/unauthorized calls must not yank them to the sign-in screen.
let guestModeActive = false;

export function setGuestModeActive(active: boolean) {
  guestModeActive = active;
}

export function isGuestModeActive() {
  return guestModeActive;
}