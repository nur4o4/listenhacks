# mlband

Hand tracking and finger gesture recognition using MediaPipe and OpenCV.

## What it does

`testhands.py` opens your webcam and tracks both hands in real time. It:
- Detects left and right hands (color-coded green and red)
- Counts how many fingers are extended on each hand (0–5)
- Labels the gesture on screen (Fist, One Finger, Two Fingers, ... Open Hand)

Press **ESC** to quit.

## Prerequisites

- **Python 3.10** — mediapipe does not reliably support Python 3.11+. You must use 3.10.
- **A webcam** — the script captures from your default camera.
- **macOS / Linux / Windows** — OpenCV and MediaPipe support all three, but setup steps below are for macOS/Linux. Windows users should use `venv310\Scripts\activate` instead of `source`.

### Installing Python 3.10

**macOS (Homebrew):**
```bash
brew install python@3.10
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3.10 python3.10-venv
```

**Windows:**

Download Python 3.10 from https://www.python.org/downloads/ and make sure to check "Add to PATH" during installation.

To verify:
```bash
python3.10 --version
# Should print: Python 3.10.x
```

## Setup

1. **Clone the repo:**
   ```bash
   git clone <repo-url>
   cd mlband
   ```

2. **Create a virtual environment with Python 3.10:**
   ```bash
   python3.10 -m venv venv310
   ```

3. **Activate the virtual environment:**

   macOS/Linux:
   ```bash
   source venv310/bin/activate
   ```

   Windows:
   ```cmd
   venv310\Scripts\activate
   ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Run the script:**
   ```bash
   python testhands.py
   ```

6. **Quit:** Press **ESC** in the OpenCV window.

## Troubleshooting

- **"Can't read camera. Exiting."** — Make sure your webcam is connected and not in use by another app.
- **macOS camera permission** — You may need to grant camera access to Terminal (or iTerm/VS Code) in System Settings > Privacy & Security > Camera.
- **pip can't find mediapipe** — You are probably not using Python 3.10. Run `python --version` inside your activated venv to check.
- **Window doesn't appear on macOS** — Try clicking on the Python icon in your dock. OpenCV windows sometimes open behind other apps.
