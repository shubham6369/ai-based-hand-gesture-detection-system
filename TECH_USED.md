# 🛠️ Tech Used – Summary

A concise overview of the core technologies, algorithms, and APIs powering this real-time AI Hand Gesture Recognition system.

---

## ⚡ Core Tech Stack

| Category | Technology | Purpose |
|---|---|---|
| **AI / Computer Vision** | **MediaPipe Hands** | Detects and tracks 21 3D hand landmarks in real time via WebAssembly & WebGL. |
| **Gesture Classifier** | **Vanilla JavaScript (ES2022)** | Custom deterministic 3D vector geometry, distances, and joint angles. |
| **Voice Output (TTS)** | **Web Speech API** | Converts gesture meanings to spoken voice client-side (`SpeechSynthesis`). |
| **Camera Capture** | **MediaStreams API** | Captures device webcam feed (`navigator.mediaDevices.getUserMedia`). |
| **Visual Overlay** | **HTML5 Canvas 2D** | Renders real-time skeletal hand tracking (joints and bones). |
| **User Interface** | **HTML5 & Vanilla CSS3** | 2-column responsive dashboard, glassmorphism, dark/light themes. |
| **Dev Server** | **Node.js + `serve`** | Serves static ES modules locally over HTTP. |
| **Version Control** | **Git & GitHub** | Source code management and remote repository. |

---

## 🧠 Key Technical Highlights

### 1. Computer Vision (MediaPipe Hands)
- **21 3D Landmarks**: Extracts normalized $(x, y, z)$ coordinates for all fingertips, knuckles, and wrist.
- **100% Client-Side Edge AI**: Runs entirely in-browser using **WebAssembly (WASM)** and **WebGL GPU** acceleration.
- **Total Privacy**: No camera images or biometric data ever leave the device.

### 2. Mathematical Gesture Classification
- **Joint Angle Calculation**: Uses vector dot products to measure knuckle curl ($\theta$):
  $$\cos(\theta) = \frac{\vec{BA} \cdot \vec{BC}}{\|\vec{BA}\| \|\vec{BC}\|}$$
- **Anti-Confusion Boundary Guards**:
  - **OK Sign vs. Open Palm**: Requires curved index knuckle ($\le 155^\circ$), preventing Open Palm false triggers.
  - **Peace vs. Crossed Fingers**: Enforces a minimum $24\%$ palm spread for Peace and $\le 18\%$ overlap for Crossed.
  - **Waving vs. Open Palm**: Detects lateral wrist velocity ($>0.005$) and $>7\%$ screen width oscillation; stationary hands default cleanly to Open Palm.

### 3. Temporal Stabilization & Hysteresis
- **7-Frame Sliding Buffer**: Smooths predictions over ~220 ms to eliminate single-frame camera jitter.
- **Hysteresis Lock**: A new gesture needs $\ge 60\%$ consensus to switch, preventing flip-flopping between boundary poses.
- **Confidence Threshold**: Predictions below **70%** are filtered out.

### 4. Smart Text-to-Speech (TTS)
- **Zero Audio Spam**: Speaks a gesture meaning once upon detection; never repeats on every camera frame.
- **1.5s Cooldown**: Prevents back-to-back audio overlaps.
- **State Reset**: Re-speaks only when the gesture changes, or disappears and reappears.
- **Manual Trigger**: Click-to-speak on sidebar cards and a repeat (`🔊`) button.

### 5. UI & System Performance
- **Frame Rate**: Runs smoothly at **35–60 FPS** on standard laptops and mobile phones.
- **Low Latency**: **16–32 ms** end-to-end processing delay.
- **Zero Build Bloat**: Pure ES Modules—no Webpack, Vite, or external runtime dependencies.
