/**
 * handDetector.js
 * ───────────────
 * Wraps the MediaPipe Hands solution to detect hand landmarks from a
 * video frame.  Returns an array of hand results, each containing
 * 21 normalised landmarks (x, y, z) and a handedness label.
 *
 * MediaPipe Hands landmark indices:
 *   0  – WRIST
 *   1  – THUMB_CMC          5  – INDEX_MCP        9  – MIDDLE_MCP
 *   2  – THUMB_MCP          6  – INDEX_PIP       10  – MIDDLE_PIP
 *   3  – THUMB_IP           7  – INDEX_DIP       11  – MIDDLE_DIP
 *   4  – THUMB_TIP          8  – INDEX_TIP       12  – MIDDLE_TIP
 *  13  – RING_MCP          17  – PINKY_MCP
 *  14  – RING_PIP          18  – PINKY_PIP
 *  15  – RING_DIP          19  – PINKY_DIP
 *  16  – RING_TIP          20  – PINKY_TIP
 */

export class HandDetector {
  constructor() {
    this.hands = null;
    this.ready = false;
    this.latestResults = null;

    // Callback set by the consumer to receive results
    this.onResults = null;
  }

  /**
   * Initialise MediaPipe Hands.
   * We load the WASM + model files from the jsdelivr CDN so no local
   * downloads are required.
   */
  async init() {
    /* global Hands */
    this.hands = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,        // 0 = lite, 1 = full
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });

    // Internal result handler
    this.hands.onResults((results) => {
      this.latestResults = results;
      if (this.onResults) this.onResults(results);
    });

    // Warm-up: send a blank frame to trigger lazy-load of model files.
    // Create a small off-screen canvas for this purpose.
    const warmUpCanvas = document.createElement("canvas");
    warmUpCanvas.width = 10;
    warmUpCanvas.height = 10;
    await this.hands.send({ image: warmUpCanvas });

    this.ready = true;
    console.log("[HandDetector] MediaPipe Hands initialised.");
  }

  /**
   * Send a video frame for processing.
   * @param {HTMLVideoElement} videoElement
   */
  async detect(videoElement) {
    if (!this.ready) return;
    await this.hands.send({ image: videoElement });
  }
}
