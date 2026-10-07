/**
 * ui.js
 * ─────
 * Manages all DOM updates: detected gesture display, confidence bar,
 * theme toggling, status messages, and landmark drawing on the canvas.
 */

export class UIManager {
  constructor() {
    // Cache DOM references
    this.gestureEmoji = document.getElementById("gesture-emoji");
    this.gestureName = document.getElementById("gesture-name");
    this.gestureMeaning = document.getElementById("gesture-meaning");
    this.confidenceValue = document.getElementById("confidence-value");
    this.confidenceBar = document.getElementById("confidence-bar");
    this.statusText = document.getElementById("status-text");
    this.canvas = document.getElementById("hand-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.themeToggle = document.getElementById("theme-toggle");
    this.cameraBtn = document.getElementById("camera-btn");
    this.cameraBtnText = document.getElementById("camera-btn-text");
    this.flipBtn = document.getElementById("flip-btn");
    this.repeatBtn = document.getElementById("repeat-btn");
    this.video = document.getElementById("camera-video");

    // Camera badge
    this.cameraBadge = document.getElementById("camera-badge");
    this.badgeEmoji = document.getElementById("badge-emoji");
    this.badgeMeaning = document.getElementById("badge-meaning");

    // Gesture chips in the side panel
    this.gestureChips = document.querySelectorAll(".gesture-chip");

    // Pulse animation state
    this._lastGestureId = null;

    // Theme
    this._applyStoredTheme();
  }

  /* ─── Gesture display ────────────────────────────────── */

  /**
   * Show a detected gesture in the UI.
   * @param {{ name, meaning, emoji }} info – from gestureMap
   * @param {number} confidence – 0..1
   */
  showGesture(info, confidence, gestureId) {
    const pct = Math.round(confidence * 100);

    this.gestureEmoji.textContent = info.emoji;
    this.gestureName.textContent = info.name.toUpperCase();
    this.gestureMeaning.textContent = `"${info.meaning}"`;
    this.confidenceValue.textContent = `Confidence: ${pct}%`;
    this.confidenceBar.style.width = `${pct}%`;

    // Colour the confidence bar
    if (pct >= 85) {
      this.confidenceBar.className = "confidence-bar high";
    } else if (pct >= 70) {
      this.confidenceBar.className = "confidence-bar medium";
    } else {
      this.confidenceBar.className = "confidence-bar low";
    }

    this.statusText.textContent = "Gesture Detected";
    this.statusText.className = "status-text detected";

    // Update corner badge in camera view
    if (this.cameraBadge) {
      this.badgeEmoji.textContent = info.emoji;
      this.badgeMeaning.textContent = info.meaning;
      this.cameraBadge.classList.add("visible");
    }

    // Highlight active chip in the side panel
    this.gestureChips.forEach((chip) => {
      if (chip.dataset.gesture === gestureId) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    });

    // Trigger a subtle pulse when gesture changes
    if (gestureId !== this._lastGestureId) {
      this.gestureEmoji.classList.remove("pulse");
      // Force reflow so re-adding the class restarts the animation
      void this.gestureEmoji.offsetWidth;
      this.gestureEmoji.classList.add("pulse");
      this._lastGestureId = gestureId;
    }
  }

  /**
   * Show the "no gesture" placeholder state.
   */
  showNoGesture() {
    this.gestureEmoji.textContent = "🖐️";
    this.gestureName.textContent = "No gesture detected";
    this.gestureMeaning.textContent = "Show your hand to the camera";
    this.confidenceValue.textContent = "Confidence: --";
    this.confidenceBar.style.width = "0%";
    this.confidenceBar.className = "confidence-bar";
    this.statusText.textContent = "Waiting for hand…";
    this.statusText.className = "status-text waiting";

    // Hide camera badge
    if (this.cameraBadge) {
      this.cameraBadge.classList.remove("visible");
    }

    // Clear active chip highlight
    this.gestureChips.forEach((chip) => chip.classList.remove("active"));

    this._lastGestureId = null;
  }

  /**
   * Show a loading / initialisation message.
   */
  showLoading(message = "Loading…") {
    this.gestureName.textContent = message;
    this.gestureMeaning.textContent = "";
    this.statusText.textContent = "Initialising";
    this.statusText.className = "status-text loading";
  }

  /* ─── Camera button state ────────────────────────────── */

  setCameraRunning(running) {
    if (running) {
      this.cameraBtnText.textContent = "Stop Camera";
      this.cameraBtn.classList.add("active");
    } else {
      this.cameraBtnText.textContent = "Start Camera";
      this.cameraBtn.classList.remove("active");
    }
  }

  /* ─── Canvas / landmark drawing ─────────────────────── */

  /**
   * Resize the overlay canvas to match the video element dimensions.
   */
  resizeCanvas() {
    const rect = this.video.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  /**
   * Draw hand landmarks and connections on the overlay canvas.
   * @param {Object} results – MediaPipe Hands results
   */
  drawLandmarks(results) {
    this.resizeCanvas();
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!results || !results.multiHandLandmarks) return;

    // Connection pairs (MediaPipe hand topology)
    const connections = [
      [0,1],[1,2],[2,3],[3,4],         // Thumb
      [0,5],[5,6],[6,7],[7,8],         // Index
      [0,9],[9,10],[10,11],[11,12],    // Middle – actually 5-9 not 0-9
      [0,13],[13,14],[14,15],[15,16],  // Ring
      [0,17],[17,18],[18,19],[19,20],  // Pinky
      [5,9],[9,13],[13,17],            // Palm
    ];

    for (const landmarks of results.multiHandLandmarks) {
      // Draw connections
      ctx.strokeStyle = "rgba(0, 230, 118, 0.6)";
      ctx.lineWidth = 2;
      for (const [i, j] of connections) {
        const a = landmarks[i];
        const b = landmarks[j];
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      }

      // Draw landmark dots
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const x = lm.x * w;
        const y = lm.y * h;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = i === 0 ? "#ff4081" : "#00e676";
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  /* ─── Theme ──────────────────────────────────────────── */

  _applyStoredTheme() {
    const stored = localStorage.getItem("gesture-theme");
    if (stored === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("gesture-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("gesture-theme", "light");
    }
  }
}
