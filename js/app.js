/**
 * app.js
 * ──────
 * Main application entry-point.  Orchestrates camera, hand detection,
 * gesture classification, UI updates, and text-to-speech.
 *
 * Detection loop:
 *   Camera frame → MediaPipe Hands → landmarks →
 *   classifyGesture() → UI update → TTS (debounced)
 */

import { CameraManager } from "./camera.js";
import { HandDetector } from "./handDetector.js";
import { classifyGesture } from "./gestureClassifier.js";
import { getGestureInfo } from "./gestureMap.js";
import { TTSManager } from "./tts.js";
import { UIManager } from "./ui.js";

/* ─── Configuration ────────────────────────────────────── */

const MIN_CONFIDENCE = 0.70; // 70 %

/* ─── Application state ───────────────────────────────── */

let camera, detector, tts, ui;
let detecting = false;
let animFrameId = null;

/* ─── Smoothing buffer ─────────────────────────────────── */
// Keep a buffer of recent classifications with hysteresis locking
// to eliminate jumping between two boundary gestures.

const SMOOTH_WINDOW = 7;
const gestureBuffer = [];
let currentLockedGesture = null;

/**
 * Returns a smoothed, hysteresis-locked gesture prediction.
 * Requires strong majority to switch away from the current gesture,
 * completely preventing rapid toggling between ambiguous hand shapes.
 */
function smoothGesture(gestureId, confidence) {
  gestureBuffer.push({ gestureId, confidence });
  if (gestureBuffer.length > SMOOTH_WINDOW) gestureBuffer.shift();

  if (gestureBuffer.length < 3) {
    return { gestureId: null, confidence: 0 };
  }

  // Count occurrences
  const counts = {};
  for (const entry of gestureBuffer) {
    if (entry.gestureId) {
      counts[entry.gestureId] = (counts[entry.gestureId] || 0) + 1;
    }
  }

  // Find candidate with most votes
  let candidate = null;
  let candidateCount = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (count > candidateCount) {
      candidate = id;
      candidateCount = count;
    }
  }

  const total = gestureBuffer.length;

  // ── Hysteresis stability lock ─────────────────────────
  if (currentLockedGesture && counts[currentLockedGesture]) {
    const lockedShare = counts[currentLockedGesture] / total;
    const candidateShare = candidateCount / total;

    // Switching requires solid consensus (>= 60%) to dethrone current gesture
    if (candidate !== currentLockedGesture && candidateShare >= 0.60) {
      currentLockedGesture = candidate;
    } else if (lockedShare >= 0.35) {
      candidate = currentLockedGesture;
    } else if (candidateShare >= 0.55) {
      currentLockedGesture = candidate;
    } else {
      currentLockedGesture = null;
      candidate = null;
    }
  } else if (candidate && (candidateCount / total) >= 0.55) {
    currentLockedGesture = candidate;
  } else {
    currentLockedGesture = null;
    candidate = null;
  }

  if (candidate) {
    const matching = gestureBuffer.filter((e) => e.gestureId === candidate);
    const avgConf = matching.reduce((s, e) => s + e.confidence, 0) / matching.length;
    return { gestureId: candidate, confidence: avgConf };
  }

  return { gestureId: null, confidence: 0 };
}

/* ─── Detection loop ───────────────────────────────────── */

async function detectionLoop() {
  if (!detecting) return;

  await detector.detect(camera.video);
  animFrameId = requestAnimationFrame(detectionLoop);
}

/**
 * Called by the HandDetector whenever new results are available.
 */
function onHandResults(results) {
  // Draw landmarks on the overlay canvas
  ui.drawLandmarks(results);

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    // No hand detected
    ui.showNoGesture();
    tts.onNoGesture();
    // Clear smoothing buffer and locked gesture
    gestureBuffer.length = 0;
    currentLockedGesture = null;
    return;
  }

  // Use the first detected hand
  const landmarks = results.multiHandLandmarks[0];
  const handedness =
    results.multiHandedness && results.multiHandedness[0]
      ? results.multiHandedness[0].label
      : "Right";

  // Classify
  const raw = classifyGesture(landmarks, handedness);
  const smoothed = smoothGesture(raw.gesture, raw.confidence);

  if (smoothed.gestureId && smoothed.confidence >= MIN_CONFIDENCE) {
    const info = getGestureInfo(smoothed.gestureId);
    if (info) {
      ui.showGesture(info, smoothed.confidence, smoothed.gestureId);
      tts.speakGesture(smoothed.gestureId, info.meaning);
    }
  } else {
    ui.showNoGesture();
    tts.onNoGesture();
  }
}

/* ─── Start / Stop ─────────────────────────────────────── */

async function startDetection() {
  ui.showLoading("Starting camera…");
  try {
    await camera.start();
  } catch (err) {
    ui.showLoading("Camera access denied. Please allow camera permissions.");
    console.error(err);
    return;
  }
  detecting = true;
  ui.setCameraRunning(true);
  ui.showNoGesture();
  detectionLoop();
}

function stopDetection() {
  detecting = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  camera.stop();
  ui.setCameraRunning(false);
  ui.showLoading("Camera stopped");
  ui.ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
}

/* ─── Initialisation ───────────────────────────────────── */

async function init() {
  const videoEl = document.getElementById("camera-video");

  // Instantiate modules
  camera = new CameraManager(videoEl);
  detector = new HandDetector();
  tts = new TTSManager();
  ui = new UIManager();

  // Wire up result callback
  detector.onResults = onHandResults;

  // Show loading state
  ui.showLoading("Loading MediaPipe Hands model…");

  // Initialise hand detector (downloads model on first load)
  await detector.init();

  ui.showLoading("Ready – press Start Camera");

  // ── Button event listeners ────────────────────────────
  document.getElementById("camera-btn").addEventListener("click", () => {
    if (camera.isRunning()) {
      stopDetection();
    } else {
      startDetection();
    }
  });

  document.getElementById("flip-btn").addEventListener("click", async () => {
    await camera.toggleCamera();
  });

  document.getElementById("repeat-btn").addEventListener("click", () => {
    tts.repeatLast();
  });

  document.getElementById("theme-toggle").addEventListener("click", () => {
    ui.toggleTheme();
  });

  // Clicking on any supported gesture chip speaks its pronunciation
  document.querySelectorAll(".gesture-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const gestureId = chip.dataset.gesture;
      const info = getGestureInfo(gestureId);
      if (info) {
        tts.speakText(`${info.name}. ${info.meaning}`);
      }
    });
  });

  // Resize canvas when window resizes
  window.addEventListener("resize", () => ui.resizeCanvas());
}

// Boot
init().catch((err) => {
  console.error("[App] Initialisation failed:", err);
  const name = document.getElementById("gesture-name");
  if (name) name.textContent = "Failed to load – check console";
});
