# test_hands_finger_labels.py
import cv2
import mediapipe as mp

# ---------------- CONFIG ----------------
# Left hand style
LEFT_LANDMARK_COLOR = (0, 255, 0)   # green
LEFT_CONNECTION_COLOR = (0, 128, 0) # dark green
LEFT_TEXT_COLOR = (0, 255, 0)

# Right hand style
RIGHT_LANDMARK_COLOR = (0, 0, 255)   # red
RIGHT_CONNECTION_COLOR = (128, 0, 0) # dark red
RIGHT_TEXT_COLOR = (0, 0, 255)

LANDMARK_THICKNESS = 3
LANDMARK_RADIUS = 6
CONNECTION_THICKNESS = 3
CONNECTION_RADIUS = 2
TEXT_SCALE = 1
TEXT_THICKNESS = 2
# ----------------------------------------

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)

# Helper function to count extended fingers
def count_fingers(hand_landmarks, handedness_label):
    """
    Returns number of fingers up (0-5)
    Uses tip landmarks and compares to PIP/MCP for each finger.
    Thumb uses x-axis instead of y-axis
    """
    tips_ids = [4, 8, 12, 16, 20]  # thumb, index, middle, ring, pinky
    fingers = []

    # Thumb
    if handedness_label == 'Right':
        if hand_landmarks.landmark[4].x < hand_landmarks.landmark[3].x:
            fingers.append(1)
        else:
            fingers.append(0)
    else:  # Left hand
        if hand_landmarks.landmark[4].x > hand_landmarks.landmark[3].x:
            fingers.append(1)
        else:
            fingers.append(0)

    # Other fingers (index to pinky)
    for tip_id in tips_ids[1:]:
        if hand_landmarks.landmark[tip_id].y < hand_landmarks.landmark[tip_id - 2].y:
            fingers.append(1)
        else:
            fingers.append(0)

    return sum(fingers)


with mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    model_complexity=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
) as hands:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Can't read camera. Exiting.")
            break

        frame = cv2.flip(frame, 1)  # mirror view
        h, w, _ = frame.shape
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        results = hands.process(rgb)

        if results.multi_hand_landmarks and results.multi_handedness:
            for hand_landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
                label = handedness.classification[0].label  # 'Left' or 'Right'

                # Choose colors depending on hand
                if label == 'Left':
                    landmark_style = mp_drawing.DrawingSpec(
                        color=LEFT_LANDMARK_COLOR, thickness=LANDMARK_THICKNESS, circle_radius=LANDMARK_RADIUS
                    )
                    connection_style = mp_drawing.DrawingSpec(
                        color=LEFT_CONNECTION_COLOR, thickness=CONNECTION_THICKNESS, circle_radius=CONNECTION_RADIUS
                    )
                    text_color = LEFT_TEXT_COLOR
                else:  # Right
                    landmark_style = mp_drawing.DrawingSpec(
                        color=RIGHT_LANDMARK_COLOR, thickness=LANDMARK_THICKNESS, circle_radius=LANDMARK_RADIUS
                    )
                    connection_style = mp_drawing.DrawingSpec(
                        color=RIGHT_CONNECTION_COLOR, thickness=CONNECTION_THICKNESS, circle_radius=CONNECTION_RADIUS
                    )
                    text_color = RIGHT_TEXT_COLOR

                # Draw landmarks
                mp_drawing.draw_landmarks(
                    frame,
                    hand_landmarks,
                    mp_hands.HAND_CONNECTIONS,
                    landmark_style,
                    connection_style
                )

                # Get wrist landmark to place label
                wrist = hand_landmarks.landmark[0]
                x = int(wrist.x * w)
                y = int(wrist.y * h) - 40  # higher to make room for gesture label

                # Count fingers
                fingers_up = count_fingers(hand_landmarks, label)

                # Map number of fingers to action label
                if fingers_up == 0:
                    action_label = "Fist"
                elif fingers_up == 1:
                    action_label = "One Finger"
                elif fingers_up == 2:
                    action_label = "Two Fingers"
                elif fingers_up == 3:
                    action_label = "Three Fingers"
                elif fingers_up == 4:
                    action_label = "Four Fingers"
                elif fingers_up == 5:
                    action_label = "Open Hand"
                else:
                    action_label = f"{fingers_up} Fingers"

                # Draw hand label
                cv2.putText(frame, f"{label} Hand", (x, y),
                            cv2.FONT_HERSHEY_SIMPLEX, TEXT_SCALE, text_color, TEXT_THICKNESS, cv2.LINE_AA)

                # Draw action label (gesture)
                cv2.putText(frame, f"{action_label}", (x, y - 25),
                            cv2.FONT_HERSHEY_SIMPLEX, TEXT_SCALE, text_color, TEXT_THICKNESS, cv2.LINE_AA)

        cv2.imshow('MediaPipe Hands (Finger Gestures)', frame)
        if cv2.waitKey(5) & 0xFF == 27:  # ESC to exit
            break

cap.release()
cv2.destroyAllWindows()
