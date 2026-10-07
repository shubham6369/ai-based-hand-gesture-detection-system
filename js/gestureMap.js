/**
 * gestureMap.js
 * ─────────────
 * Central mapping of gesture IDs to human-readable names, meanings,
 * and emoji representations.  Every other module references this map
 * so adding / editing a gesture is a single-file change.
 */

export const GESTURE_MAP = {
  thumbs_up: {
    name: "Thumbs Up",
    meaning: "Okay",
    emoji: "👍",
  },
  thumbs_down: {
    name: "Thumbs Down",
    meaning: "No",
    emoji: "👎",
  },
  peace: {
    name: "Peace / V Sign",
    meaning: "Victory",
    emoji: "✌️",
  },
  ok_sign: {
    name: "OK Sign",
    meaning: "Okay",
    emoji: "👌",
  },
  open_palm: {
    name: "Open Palm",
    meaning: "Stop",
    emoji: "✋",
  },
  wave: {
    name: "Waving Hand",
    meaning: "Hello",
    emoji: "👋",
  },
  call_me: {
    name: "Call Me",
    meaning: "Call Me",
    emoji: "🤙",
  },
  one_finger: {
    name: "One Finger Up",
    meaning: "Wait",
    emoji: "☝️",
  },
  crossed_fingers: {
    name: "Crossed Fingers",
    meaning: "Good Luck",
    emoji: "🤞",
  },
};

/**
 * Look up a gesture by its ID.
 * Returns { name, meaning, emoji } or null if unknown.
 */
export function getGestureInfo(gestureId) {
  return GESTURE_MAP[gestureId] ?? null;
}

/**
 * Return a flat list of all supported gesture IDs.
 */
export function getSupportedGestureIds() {
  return Object.keys(GESTURE_MAP);
}
