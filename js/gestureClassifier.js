/**
 * gestureClassifier.js
 * ────────────────────
 * Analyses the 21 MediaPipe hand landmarks to determine which of the
 * 10 supported gestures is being performed.
 *
 * The classifier works in three stages:
 *   1.  Compute per-finger "extended" state using landmark distances.
 *   2.  Determine thumb direction (up / down / neutral).
 *   3.  Match the finger state pattern against known gesture templates,
 *       scoring each match to produce a confidence value.
 *
 * Landmark indices used:
 *   WRIST = 0
 *   THUMB:  CMC=1, MCP=2, IP=3,  TIP=4
 *   INDEX:  MCP=5, PIP=6, DIP=7, TIP=8
 *   MIDDLE: MCP=9, PIP=10,DIP=11,TIP=12
 *   RING:   MCP=13,PIP=14,DIP=15,TIP=16
 *   PINKY:  MCP=17,PIP=18,DIP=19,TIP=20
 */

/* ─── Landmark index constants ─────────────────────────── */
const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};

/* ─── Vector math helpers ──────────────────────────────── */

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function dist2d(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Angle (in degrees) formed at point B by vectors BA and BC.
 */
function angleDeg(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/* ─── Finger state analysis ────────────────────────────── */

/**
 * Determine whether each finger is extended.
 * For the four fingers (index, middle, ring, pinky) a finger is
 * considered extended when its TIP is farther from the WRIST than
 * its PIP, AND the PIP-DIP-TIP chain is relatively straight.
 *
 * The thumb uses a different heuristic: it is extended when its TIP
 * is farther from the INDEX_MCP than its IP joint.
 *
 * @param {Array} lm – array of 21 landmarks {x, y, z}
 * @param {string} handedness – "Left" or "Right"
 * @returns {{ thumb, index, middle, ring, pinky }} each a number 0..1
 */
function getFingerStates(lm, handedness) {
  const wrist = lm[LM.WRIST];

  // ── Thumb ────────────────────────────────────────────
  // Thumb extended: TIP far from palm centre (INDEX_MCP).
  const thumbTipDist = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_MCP]);
  const thumbIpDist = dist(lm[LM.THUMB_IP], lm[LM.INDEX_MCP]);
  const thumbMcpDist = dist(lm[LM.THUMB_MCP], lm[LM.INDEX_MCP]);
  const thumbExtended = thumbTipDist > thumbIpDist ? 1 : 0;

  // Also check thumb curl angle
  const thumbAngle = angleDeg(lm[LM.THUMB_MCP], lm[LM.THUMB_IP], lm[LM.THUMB_TIP]);

  // ── Fingers (index / middle / ring / pinky) ──────────
  const fingerDefs = [
    { mcp: LM.INDEX_MCP, pip: LM.INDEX_PIP, dip: LM.INDEX_DIP, tip: LM.INDEX_TIP },
    { mcp: LM.MIDDLE_MCP, pip: LM.MIDDLE_PIP, dip: LM.MIDDLE_DIP, tip: LM.MIDDLE_TIP },
    { mcp: LM.RING_MCP, pip: LM.RING_PIP, dip: LM.RING_DIP, tip: LM.RING_TIP },
    { mcp: LM.PINKY_MCP, pip: LM.PINKY_PIP, dip: LM.PINKY_DIP, tip: LM.PINKY_TIP },
  ];

  const fingerStates = fingerDefs.map((f) => {
    const tipDist = dist(lm[f.tip], wrist);
    const pipDist = dist(lm[f.pip], wrist);
    // Finger curl angle at PIP joint
    const curlAngle = angleDeg(lm[f.mcp], lm[f.pip], lm[f.tip]);
    // A finger is extended if tip is farther from wrist than pip
    // AND the PIP angle is relatively open (> ~140°)
    const isExtended = tipDist > pipDist && curlAngle > 140;
    return isExtended ? 1 : 0;
  });

  return {
    thumb: thumbExtended,
    index: fingerStates[0],
    middle: fingerStates[1],
    ring: fingerStates[2],
    pinky: fingerStates[3],
    // Extra data for specialised checks
    _thumbAngle: thumbAngle,
    _thumbTipY: lm[LM.THUMB_TIP].y,
    _wristY: wrist.y,
    _thumbTipX: lm[LM.THUMB_TIP].x,
    _wristX: wrist.x,
  };
}

/**
 * Determine thumb direction: "up", "down", or "neutral".
 * In MediaPipe's normalised coordinate space y increases downward,
 * so thumb_tip.y < wrist.y means the thumb points upward.
 */
function getThumbDirection(lm) {
  const wrist = lm[LM.WRIST];
  const thumbTip = lm[LM.THUMB_TIP];
  const thumbCmc = lm[LM.THUMB_CMC];
  const dy = thumbTip.y - wrist.y;
  // Threshold: require significant vertical displacement
  const threshold = 0.08;
  if (dy < -threshold) return "up";
  if (dy > threshold) return "down";
  return "neutral";
}

/* ─── OK-sign specific check ───────────────────────────── */

/**
 * The OK sign is formed when the thumb tip and index tip are close
 * together forming a circle while the remaining fingers are extended.
 */
function isOKSign(lm, fs) {
  const thumbIndexDist = dist2d(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]);
  const palmSize = dist2d(lm[LM.WRIST], lm[LM.MIDDLE_MCP]);
  // Thumb and index tips within ~25% of palm size
  const circleFormed = thumbIndexDist < palmSize * 0.3;
  // Other three fingers should be relatively extended
  const othersExtended = fs.middle + fs.ring + fs.pinky >= 2;
  return circleFormed && othersExtended;
}

/* ─── Crossed-fingers specific check ───────────────────── */

/**
 * Crossed fingers: index and middle are extended and their tips are
 * very close (overlapping).  Other fingers curled.
 */
function isCrossedFingers(lm, fs) {
  // Both index and middle extended
  if (!fs.index || !fs.middle) return false;
  // Ring and pinky curled
  if (fs.ring || fs.pinky) return false;
  // Index and middle tips close together
  const tipDist = dist2d(lm[LM.INDEX_TIP], lm[LM.MIDDLE_TIP]);
  const palmSize = dist2d(lm[LM.WRIST], lm[LM.MIDDLE_MCP]);
  // Also check that the DIP joints are close (crossing)
  const dipDist = dist2d(lm[LM.INDEX_DIP], lm[LM.MIDDLE_DIP]);
  return tipDist < palmSize * 0.2 && dipDist < palmSize * 0.2;
}

/* ─── Wave detection (motion-based) ────────────────────── */

// We keep a short history of wrist x-positions to detect lateral motion.
const wristHistory = [];
const WAVE_HISTORY_LENGTH = 15;
const WAVE_THRESHOLD = 0.04; // minimum x-range to count as waving

/**
 * Returns true if the hand is performing a waving motion.
 * A wave is detected when the wrist has moved back-and-forth
 * laterally across several recent frames with all fingers extended.
 */
function isWaving(lm, fs) {
  const allExtended = fs.thumb + fs.index + fs.middle + fs.ring + fs.pinky >= 4;
  if (!allExtended) {
    wristHistory.length = 0;
    return false;
  }

  wristHistory.push(lm[LM.WRIST].x);
  if (wristHistory.length > WAVE_HISTORY_LENGTH) wristHistory.shift();

  if (wristHistory.length < 8) return false;

  // Count direction changes
  let dirChanges = 0;
  for (let i = 2; i < wristHistory.length; i++) {
    const prev = wristHistory[i - 1] - wristHistory[i - 2];
    const curr = wristHistory[i] - wristHistory[i - 1];
    if ((prev > 0.002 && curr < -0.002) || (prev < -0.002 && curr > 0.002)) {
      dirChanges++;
    }
  }

  // A wave has at least 2 direction changes
  const xMin = Math.min(...wristHistory);
  const xMax = Math.max(...wristHistory);
  const xRange = xMax - xMin;

  return dirChanges >= 2 && xRange > WAVE_THRESHOLD;
}

/* ─── Main classifier ─────────────────────────────────── */

/**
 * Classify a single hand's landmarks into one of the 10 supported gestures.
 *
 * @param {Array} landmarks – 21 landmarks from MediaPipe
 * @param {string} handedness – "Left" or "Right"
 * @returns {{ gesture: string|null, confidence: number }}
 */
export function classifyGesture(landmarks, handedness = "Right") {
  if (!landmarks || landmarks.length < 21) {
    return { gesture: null, confidence: 0 };
  }

  const lm = landmarks;
  const fs = getFingerStates(lm, handedness);
  const thumbDir = getThumbDirection(lm);

  // Count how many fingers are extended (excluding thumb)
  const extendedCount = fs.index + fs.middle + fs.ring + fs.pinky;
  const allExtended = extendedCount >= 4;
  const allCurled = extendedCount === 0;

  // ── 1. OK Sign (check first – specific shape) ───────
  if (isOKSign(lm, fs)) {
    return { gesture: "ok_sign", confidence: 0.88 };
  }

  // ── 2. Crossed Fingers ──────────────────────────────
  if (isCrossedFingers(lm, fs)) {
    return { gesture: "crossed_fingers", confidence: 0.82 };
  }

  // ── 3. Thumbs Up ────────────────────────────────────
  if (fs.thumb && allCurled && thumbDir === "up") {
    return { gesture: "thumbs_up", confidence: 0.92 };
  }

  // ── 4. Thumbs Down ─────────────────────────────────
  if (fs.thumb && allCurled && thumbDir === "down") {
    return { gesture: "thumbs_down", confidence: 0.90 };
  }

  // ── 5. Waving Hand (motion + open palm) ────────────
  if (isWaving(lm, fs)) {
    return { gesture: "wave", confidence: 0.80 };
  }

  // ── 6. Open Palm (all fingers extended, no wave) ───
  if (allExtended && fs.thumb) {
    return { gesture: "open_palm", confidence: 0.90 };
  }

  // ── 7. Peace / V Sign ─────────────────────────────
  if (fs.index && fs.middle && !fs.ring && !fs.pinky) {
    // Ensure they're not crossed (already handled above)
    return { gesture: "peace", confidence: 0.88 };
  }

  // ── 8. Call Me (thumb + pinky extended) ───────────
  if (fs.thumb && fs.pinky && !fs.index && !fs.middle && !fs.ring) {
    return { gesture: "call_me", confidence: 0.87 };
  }

  // ── 9. One Finger Up (only index extended) ────────
  if (fs.index && !fs.middle && !fs.ring && !fs.pinky) {
    return { gesture: "one_finger", confidence: 0.89 };
  }

  // ── No match ─────────────────────────────────────
  return { gesture: null, confidence: 0 };
}
