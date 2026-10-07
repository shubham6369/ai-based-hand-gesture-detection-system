/**
 * camera.js
 * ─────────
 * Handles camera acquisition, switching between front / rear cameras,
 * and providing the raw MediaStream to consumers.
 */

export class CameraManager {
  /**
   * @param {HTMLVideoElement} videoElement – the <video> element to stream into
   */
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.facingMode = "user"; // "user" = front, "environment" = rear
    this.running = false;
  }

  /* ─── public API ─────────────────────────────────────── */

  /**
   * Start the camera with the current facingMode.
   * Resolves once the video is actually playing.
   */
  async start() {
    // Stop any previous stream
    this.stopStream();

    const constraints = {
      video: {
        facingMode: this.facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

      // Wait until video metadata is loaded so width/height are available
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      this.running = true;
      return true;
    } catch (err) {
      console.error("[CameraManager] Failed to start camera:", err);
      this.running = false;
      throw err;
    }
  }

  /**
   * Stop the camera completely.
   */
  stop() {
    this.stopStream();
    this.video.srcObject = null;
    this.running = false;
  }

  /**
   * Toggle between front and rear cameras.
   * On desktop (where there is typically only one camera) this may
   * just restart the same camera.
   */
  async toggleCamera() {
    this.facingMode = this.facingMode === "user" ? "environment" : "user";
    if (this.running) {
      await this.start(); // restart with new facing mode
    }
  }

  /**
   * @returns {boolean} true if the camera stream is active
   */
  isRunning() {
    return this.running;
  }

  /* ─── internal helpers ───────────────────────────────── */

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
