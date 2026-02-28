# Hand Tracking Application

Real-time hand detection and gesture recognition using MediaPipe and OpenCV.

## Features

- **Real-time hand detection** via webcam
- **Finger counting** (0-5 fingers)
- **Gesture recognition** - Detects fist, open hand, and finger counts
- **Dual hand support** - Track both left and right hands simultaneously
- **Visual feedback** - Color-coded landmarks and connections:
  - **Left hand**: Green landmarks and connections
  - **Right hand**: Red landmarks and connections
- **Hand labeling** - Displays hand type (Left/Right) and gesture label

## Prerequisites

1. **Python 3.7+**
2. **Webcam** for real-time video capture

## Installation

Install the required dependencies:

```bash
pip install opencv-python mediapipe
```

## Usage

Run the hand tracking application:

```bash
python testhands.py
```

### Controls

- **ESC** - Exit the application
- The camera feed is mirrored for better interaction

### Recognized Gestures

- **Fist** - All fingers closed
- **One Finger** - One finger extended
- **Two Fingers** - Two fingers extended (e.g., peace sign)
- **Three Fingers** - Three fingers extended
- **Four Fingers** - Four fingers extended
- **Open Hand** - All five fingers extended

## How It Works

The application uses:
- **MediaPipe Hands** - For hand landmark detection
- **OpenCV** - For video capture and display
- Custom finger counting algorithm that compares landmark positions to determine if fingers are extended

## Configuration

You can adjust visual settings in the CONFIG section of `testhands.py`:

- Landmark colors and sizes
- Connection line styles
- Text appearance

## Troubleshooting

**Camera not working?**
- Ensure your webcam is connected and not being used by another application
- Check camera permissions for Python/Terminal on macOS

**Hand detection not working?**
- Ensure good lighting conditions
- Keep hands clearly visible in the frame
- Adjust `min_detection_confidence` and `min_tracking_confidence` values if needed
