# Hand Gesture Recognition – Real-Time AI

A real-time **hand gesture recognition** web application that uses your device camera to detect hand gestures, display their meaning, and speak it aloud using Text-to-Speech.

Built with **MediaPipe Hands** for hand landmark detection and custom JavaScript gesture classification.

---

## ✋ Supported Gestures

| # | Gesture | Meaning |
|---|---------|---------|
| 1 | 👍 Thumbs Up | "Okay" |
| 2 | 👎 Thumbs Down | "No" |
| 3 | ✌️ Peace / V Sign | "Victory" |
| 4 | 👌 OK Sign | "Good" |
| 5 | ✋ Open Palm | "Stop" |
| 6 | 👋 Waving Hand | "Hello" |
| 7 | 🤙 Call Me | "Call Me" |
| 8 | ☝️ One Finger Up | "Wait" |
| 9 | 🤞 Crossed Fingers | "Good Luck" |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v16 or newer) — only needed for the local HTTP server
- A modern browser (Chrome, Edge, or Firefox recommended)
- A webcam / device camera

### Run locally

```bash
# 1. Open a terminal in the project folder
cd "ai based gesture detection system"

# 2. Start the local dev server
npm run dev
```

Then open **http://localhost:3000** in your browser.

> **Note:** The app loads the MediaPipe Hands model from the internet on first use (~5 MB). Ensure you have an internet connection.

### Alternative (without Node.js)

You can use any static HTTP server, for example Python:

```bash
python -m http.server 3000
```

Then visit `http://localhost:3000`.

---

## 🖥️ How to Use

1. Click **Start Camera** and allow camera access.
2. Hold your hand in front of the camera.
3. The app detects your hand, draws landmarks, and classifies the gesture.
4. The recognized gesture name and meaning appear on screen.
5. The meaning is spoken aloud via Text-to-Speech (once per new gesture).
6. Press **🔊 Repeat** to hear the last meaning again.
7. Use **🔄 Flip** to switch between front and rear cameras (mobile).
8. Toggle the **🌓** button for dark / light theme.

---

## 📁 Project Structure

```
├── index.html              # Main HTML page
├── css/
│   └── styles.css          # Dark/light theme, animations, responsive
├── js/
│   ├── app.js              # Application orchestrator (entry point)
│   ├── camera.js           # Camera start / stop / flip
│   ├── handDetector.js     # MediaPipe Hands wrapper
│   ├── gestureClassifier.js# Landmark analysis → gesture classification
│   ├── gestureMap.js       # Gesture ID → name / meaning / emoji mapping
│   ├── tts.js              # Text-to-Speech with debounce
│   └── ui.js               # DOM updates, canvas drawing, theme
├── package.json            # Dev server script
└── README.md               # This file
```

---

## ⚡ Performance Notes

- Detection runs at camera frame rate using `requestAnimationFrame`.
- A **smoothing buffer** (5 frames) stabilises predictions and prevents flickering.
- TTS has a **1.5 s cooldown** to avoid repeated announcements.
- The same gesture is spoken only once until it changes or disappears.
- Minimum confidence threshold: **70%**.

---

## 🧪 Testing Checklist

- [x] All 10 gestures individually
- [x] No hand in frame → shows "No gesture detected"
- [x] Multiple hands → uses first detected hand
- [x] Left hand / right hand
- [x] Different distances from camera
- [x] Fast hand movement
- [x] Same gesture held continuously → spoken only once
- [x] Gesture disappears then reappears → spoken again
- [x] Dark / light theme toggle

---

## 🛠️ Technology

| Layer | Technology |
|-------|-----------|
| Hand Detection | MediaPipe Hands (WASM, loaded from CDN) |
| Gesture Classification | Custom JS using landmark geometry |
| Text-to-Speech | Web Speech API (`SpeechSynthesisUtterance`) |
| UI | Vanilla HTML / CSS / JavaScript (ES Modules) |
| Dev Server | `serve` via npx |

---

## 📝 License

MIT – free to use, modify, and distribute.
