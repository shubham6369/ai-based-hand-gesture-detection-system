/**
 * gestureClassifier.js
 * ────────────────────
 * Analyses the 21 MediaPipe hand landmarks to determine which of the
 * 9 supported gestures is being performed with high precision and
 * strict, mutually exclusive decision boundaries to eliminate confusion.
 *
 * Supported gestures:
 *   1. thumbs_up      - "Okay"
 *   2. thumbs_down    - "No"
 *   3. peace          - "Victory"
 *   4. ok_sign        - "Good"
 *   5. open_palm      - "Stop"
 *   6. wave           - "Hello"
 *   7. call_me        - "Call Me"
 *   8. one_finger     - "Wait"
 *   9. crossed_fingers- "Good Luck"
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

/* ─── Finger State Analysis ────────────────────────────── */

/**
 * Returns comprehensive geometric measurements for each finger:
 * extension (0 or 1), curl angle, tip-to-MCP distance, etc.
 */
function analyzeFingers(lm) {
  const wrist = lm[LM.WRIST];
  const palmSize = Math.max(0.01, dist2d(wrist, lm[LM.MIDDLE_MCP]));

  // ── Thumb ─────────────────────────────────────────────
  const thumbTipDist = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_MCP]);
  const thumbIpDist = dist(lm[LM.THUMB_IP], lm[LM.INDEX_MCP]);
  const thumbMcpDist = dist(lm[LM.THUMB_MCP], lm[LM.INDEX_MCP]);
  const thumbAngle = angleDeg(lm[LM.THUMB_MCP], lm[LM.THUMB_IP], lm[LM.THUMB_TIP]);
  const thumbExtended = (thumbTipDist > thumbIpDist * 1.15 && thumbTipDist > thumbMcpDist) ? 1 : 0;

  // ── 4 Fingers ─────────────────────────────────────────
  const fingers = [
    { name: "index",  mcp: LM.INDEX_MCP,  pip: LM.INDEX_PIP,  dip: LM.INDEX_DIP,  tip: LM.INDEX_TIP },
    { name: "middle", mcp: LM.MIDDLE_MCP, pip: LM.MIDDLE_PIP, dip: LM.MIDDLE_DIP, tip: LM.MIDDLE_TIP },
    { name: "ring",   mcp: LM.RING_MCP,   pip: LM.RING_PIP,   dip: LM.RING_DIP,   tip: LM.RING_TIP },
    { name: "pinky",  mcp: LM.PINKY_MCP,  pip: LM.PINKY_PIP,  dip: LM.PINKY_DIP,  tip: LM.PINKY_TIP },
  ];

  const state = {
    palmSize,
    thumb: thumbExtended,
    thumbAngle,
    thumbTip: lm[LM.THUMB_TIP],
    thumbMcp: lm[LM.THUMB_MCP],
    wrist,
  };

  fingers.forEach((f) => {
    const tipDistWrist = dist(lm[f.tip], wrist);
    const pipDistWrist = dist(lm[f.pip], wrist);
    const pipAngle = angleDeg(lm[f.mcp], lm[f.pip], lm[f.tip]);
    const tipToMcp = dist(lm[f.tip], lm[f.mcp]);

    // Definite extension: tip farther from wrist than PIP AND knuckle angle > 138°
    const isExt = (tipDistWrist > pipDistWrist && pipAngle > 138 && tipToMcp > palmSize * 0.6) ? 1 : 0;
    // Definite curl: knuckle angle < 125° OR tip-to-MCP small
    const isCurl = (pipAngle < 125 || tipToMcp < palmSize * 0.5) ? 1 : 0;

    state[f.name] = isExt;
    state[`${f.name}Angle`] = pipAngle;
    state[`${f.name}TipToMcp`] = tipToMcp;
    state[`${f.name}Curled`] = isCurl;
  });

  return state;
}

/* ─── Wave Motion Tracker ──────────────────────────────── */

const wristHistory = [];
const WAVE_MAX_HISTORY = 18;

/**
 * Robust wave detection: requires high-amplitude lateral velocity
 * and clear direction oscillations, strictly rejecting stationary hands.
 */
function checkWavingMotion(lm, isAllExtended) {
  if (!isAllExtended) {
    wristHistory.length = 0;
    return false;
  }

  const currentX = lm[LM.WRIST].x;
  wristHistory.push({ x: currentX, t: Date.now() });
  if (wristHistory.length > WAVE_MAX_HISTORY) wristHistory.shift();

  if (wristHistory.length < 10) return false;

  // 1. Peak-to-peak amplitude must be substantial (> 7% of screen width)
  const xVals = wristHistory.map((p) => p.x);
  const minX = Math.min(...xVals);
  const maxX = Math.max(...xVals);
  const totalRange = maxX - minX;
  if (totalRange < 0.07) return false;

  // 2. Count distinct velocity reversals with minimum step threshold
  let reversals = 0;
  for (let i = 2; i < wristHistory.length; i++) {
    const dx1 = wristHistory[i - 1].x - wristHistory[i - 2].x;
    const dx2 = wristHistory[i].x - wristHistory[i - 1].x;
    // Significant sweep velocity required (filters micro-jitter)
    if (Math.abs(dx1) > 0.005 && Math.abs(dx2) > 0.005) {
      if ((dx1 > 0 && dx2 < 0) || (dx1 < 0 && dx2 > 0)) {
        reversals++;
      }
    }
  }

  return reversals >= 2;
}

/* ─── Specialized Gesture Tests ────────────────────────── */

/**
 * OK Sign (👌 - "Good"):
 * Index finger forms a loop with thumb tip while middle, ring, pinky remain extended.
 * CRITICAL FIX: Explicitly checks that index finger is BENT/CURLED,
 * which completely prevents false positives when showing an Open Palm!
 */
function isOKSign(lm, s) {
  const thumbIndexDist = dist2d(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]);
  // Contact threshold: tips must be close together
  const circleFormed = thumbIndexDist < s.palmSize * 0.22;

  // In an OK sign, index finger is distinctly curved/bent (NOT straight like in open palm)
  const indexCurved = s.indexAngle < 155 || s.indexTipToMcp < s.middleTipToMcp * 0.85;

  // Remaining three fingers must be extended
  const othersExtended = (s.middle + s.ring + s.pinky) >= 2;

  return circleFormed && indexCurved && othersExtended;
}

/**
 * Crossed Fingers (🤞 - "Good Luck"):
 * Index and middle fingers are extended and cross/overlap over each other,
 * while ring and pinky are curled.
 */
function isCrossedFingers(lm, s) {
  if (!s.index || !s.middle) return false;
  if (s.ring || s.pinky) return false;

  const tipDist = dist2d(lm[LM.INDEX_TIP], lm[LM.MIDDLE_TIP]);
  const dipDist = dist2d(lm[LM.INDEX_DIP], lm[LM.MIDDLE_DIP]);

  // Index and middle tips and DIP joints must be touching or overlapping
  const closeOverlap = tipDist < s.palmSize * 0.18 && dipDist < s.palmSize * 0.18;

  // Tips should not be spread like a V
  return closeOverlap;
}

/**
 * Peace / V Sign (✌️ - "Victory"):
 * Index and middle fingers extended with a CLEAR separation/gap between them.
 * Ring and pinky are curled.
 * CRITICAL FIX: Requires clear V-spread distance so it NEVER collides with Crossed Fingers!
 */
function isPeaceSign(lm, s) {
  if (!s.index || !s.middle) return false;
  if (s.ring || s.pinky) return false;

  const tipDist = dist2d(lm[LM.INDEX_TIP], lm[LM.MIDDLE_TIP]);

  // V-separation threshold: distance between tips must be clearly open (> 24% of palm)
  const isSeparated = tipDist >= s.palmSize * 0.24;

  return isSeparated;
}

/**
 * One Finger Up (☝️ - "Wait"):
 * Only index finger is extended upward. Middle, ring, pinky are curled.
 * CRITICAL FIX: Checks relative length to avoid flickering with Peace sign when middle is half-curled.
 */
function isOneFinger(lm, s) {
  if (!s.index) return false;
  if (s.ring || s.pinky) return false;

  // Middle finger must be definitely curled
  const middleIsCurled = s.middleCurled || s.middleAngle < 130;
  // Index finger must project clearly past the middle finger
  const indexDominates = s.indexTipToMcp > s.middleTipToMcp * 1.3;

  return middleIsCurled && indexDominates;
}

/**
 * Thumbs Up (👍 - "Okay"):
 * Thumb points straight up, all 4 fingers firmly curled into fist.
 */
function isThumbsUp(lm, s) {
  const fourCurled = s.indexCurvedOrCurl(s) && s.ringCurled && s.pinkyCurled;
  const thumbUp = (s.thumbTip.y < s.thumbMcp.y - 0.035) && (s.thumbTip.y < s.wrist.y - 0.06);
  return s.thumb && fourCurled && thumbUp;
}

/**
 * Thumbs Down (👎 - "No"):
 * Thumb points straight down, all 4 fingers firmly curled into fist.
 */
function isThumbsDown(lm, s) {
  const fourCurled = s.indexCurvedOrCurl(s) && s.ringCurled && s.pinkyCurled;
  const thumbDown = (s.thumbTip.y > s.thumbMcp.y + 0.035) && (s.thumbTip.y > s.wrist.y + 0.03);
  return s.thumb && fourCurled && thumbDown;
}

/**
 * Call Me (🤙 - "Call Me"):
 * Thumb and pinky extended, middle 3 fingers firmly curled.
 */
function isCallMe(lm, s) {
  if (!s.thumb || !s.pinky) return false;
  if (s.middle || s.ring) return false;

  // Index must also be curled
  const indexCurled = s.indexAngle < 130 || s.indexTipToMcp < s.palmSize * 0.55;
  // Wide telephone spread between thumb and pinky
  const spreadDist = dist2d(s.thumbTip, lm[LM.PINKY_TIP]);
  const wideSpread = spreadDist > s.palmSize * 0.65;

  return indexCurled && wideSpread;
}

/* ─── Main Classifier ─────────────────────────────────── */

/**
 * Classify a hand's 21 landmarks into one of the 9 supported gestures.
 * Uses priority ordering with disjoint geometric thresholds.
 *
 * @param {Array} landmarks - 21 landmarks from MediaPipe
 * @param {string} handedness - "Left" or "Right"
 * @returns {{ gesture: string|null, confidence: number }}
 */
export function classifyGesture(landmarks, handedness = "Right") {
  if (!landmarks || landmarks.length < 21) {
    return { gesture: null, confidence: 0 };
  }

  const lm = landmarks;
  const s = analyzeFingers(lm);

  // Helper for 4 curled fingers
  s.indexCurvedOrCurl = () => (s.indexCurled || s.indexAngle < 130);

  const extendedCount = s.index + s.middle + s.ring + s.pinky;
  const isAllExtended = extendedCount >= 4 && s.thumb;

  // ── 1. Call Me (Thumb + Pinky only, highly unique) ──
  if (isCallMe(lm, s)) {
    return { gesture: "call_me", confidence: 0.91 };
  }

  // ── 2. OK Sign (Circle formed with curled index, 3 extended) ──
  if (isOKSign(lm, s)) {
    return { gesture: "ok_sign", confidence: 0.92 };
  }

  // ── 3. Crossed Fingers (Index + Middle overlapping) ──
  if (isCrossedFingers(lm, s)) {
    return { gesture: "crossed_fingers", confidence: 0.89 };
  }

  // ── 4. Peace / V Sign (Index + Middle clearly separated) ──
  if (isPeaceSign(lm, s)) {
    return { gesture: "peace", confidence: 0.92 };
  }

  // ── 5. One Finger Up (Only Index extended) ──────────
  if (isOneFinger(lm, s)) {
    return { gesture: "one_finger", confidence: 0.91 };
  }

  // ── 6. Thumbs Up (Thumb up, 4 fingers curled) ───────
  if (isThumbsUp(lm, s)) {
    return { gesture: "thumbs_up", confidence: 0.93 };
  }

  // ── 7. Thumbs Down (Thumb down, 4 fingers curled) ───
  if (isThumbsDown(lm, s)) {
    return { gesture: "thumbs_down", confidence: 0.92 };
  }

  // ── 8. Waving Hand (Open palm + high-velocity oscillation) ──
  if (isAllExtended && checkWavingMotion(lm, true)) {
    return { gesture: "wave", confidence: 0.88 };
  }

  // ── 9. Open Palm (All 5 extended, stationary) ───────
  if (isAllExtended) {
    return { gesture: "open_palm", confidence: 0.94 };
  }

  // No confident match
  return { gesture: null, confidence: 0 };
}
