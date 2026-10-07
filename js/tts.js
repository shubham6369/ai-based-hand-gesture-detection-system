/**
 * tts.js
 * ──────
 * Text-to-Speech manager using the Web Speech API.
 * Includes debounce / cooldown logic so the same gesture meaning
 * is not spoken on every frame.
 *
 * Rules:
 *  - A meaning is spoken once.
 *  - It is spoken again only when:
 *      a) The gesture changes to a different gesture, OR
 *      b) The gesture disappears then reappears, OR
 *      c) The user manually triggers repeat via the speaker button.
 */

export class TTSManager {
  constructor() {
    this.synth = window.speechSynthesis;
    this.lastSpokenMeaning = null;
    this.lastGestureId = null;
    this.gestureDisappeared = false;
    this.cooldownMs = 1500; // minimum gap between automatic speaks
    this.lastSpeakTime = 0;
    this.speaking = false;
  }

  /**
   * Speak the meaning of a gesture, respecting debounce rules.
   * @param {string} gestureId – the gesture key, e.g. "thumbs_up"
   * @param {string} meaning   – the human-readable meaning text
   * @returns {boolean} true if speech was initiated
   */
  speakGesture(gestureId, meaning) {
    const now = Date.now();

    // Same gesture still being held – do not repeat
    if (gestureId === this.lastGestureId && !this.gestureDisappeared) {
      return false;
    }

    // Cooldown guard
    if (now - this.lastSpeakTime < this.cooldownMs) {
      return false;
    }

    // All checks passed – speak
    this._speak(meaning);
    this.lastGestureId = gestureId;
    this.lastSpokenMeaning = meaning;
    this.gestureDisappeared = false;
    this.lastSpeakTime = now;
    return true;
  }

  /**
   * Call when the detection result is "no gesture".
   * This resets the disappeared flag so the same gesture can
   * be spoken again when it reappears.
   */
  onNoGesture() {
    if (this.lastGestureId !== null) {
      this.gestureDisappeared = true;
    }
  }

  /**
   * Manually repeat the last spoken meaning (for the 🔊 button).
   * Ignores cooldown.
   */
  repeatLast() {
    if (this.lastSpokenMeaning) {
      this._speak(this.lastSpokenMeaning);
    }
  }

  /**
   * Speak arbitrary text (manual trigger).
   */
  speakText(text) {
    this._speak(text);
  }

  /* ─── internal ───────────────────────────────────────── */

  _speak(text) {
    // Cancel any ongoing utterance to avoid queue build-up
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = "en-US";

    utterance.onstart = () => { this.speaking = true; };
    utterance.onend = () => { this.speaking = false; };
    utterance.onerror = () => { this.speaking = false; };

    this.synth.speak(utterance);
  }

  /**
   * @returns {boolean} true if currently speaking
   */
  isSpeaking() {
    return this.speaking;
  }
}
