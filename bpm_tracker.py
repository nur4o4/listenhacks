import librosa
import numpy as np


def track_bpm(audio_path: str):
    """Analyze a song to find its BPM and the timestamps of every beat."""
    y, sr = librosa.load(audio_path)
    duration = librosa.get_duration(y=y, sr=sr)

    # Estimate global tempo and extract beat frame positions
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])

    # Convert beat frames to timestamps (seconds)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    print(f"File:     {audio_path}")
    print(f"Duration: {duration:.2f}s")
    print(f"BPM:      {bpm:.1f}")
    print(f"Beats:    {len(beat_times)}")
    print()
    print("Beat markers (seconds):")
    for i, t in enumerate(beat_times, 1):
        print(f"  {i:4d}  {t:8.3f}s")

    return bpm, beat_times


if __name__ == "__main__":
    bpm, markers = track_bpm("Taylor Swift - Welcome To New York Lyrics.mp3")
