#!/usr/bin/env python3
"""
distort.py - Simple WAV distortion (waveshaper) processor.

How it works:
1) Reads a WAV file as float32 in [-1, 1]
2) Applies pre-gain from --drive_db
3) Distorts with either tanh or hard clipping
4) Blends wet/dry with --mix
5) Applies output gain from --out_db and clips to [-1, 1]
6) Writes a WAV with the original sample rate

Usage:
  python distort.py input.wav output.wav --drive_db 12 --mix 1.0 --out_db -1 --mode tanh
  python distort.py --self_test
"""

from __future__ import annotations

import argparse
import sys
from typing import Tuple

import numpy as np

_HAS_SF = False
_HAS_SCIPY = False

try:
  import soundfile as sf  # type: ignore
  _HAS_SF = True
except Exception:
  sf = None  # type: ignore

if not _HAS_SF:
  try:
    from scipy.io import wavfile  # type: ignore
    _HAS_SCIPY = True
  except Exception:
    wavfile = None  # type: ignore


def _ensure_audio_backend() -> None:
  if not (_HAS_SF or _HAS_SCIPY):
    raise RuntimeError(
      "No WAV backend found. Install 'soundfile' (preferred) or 'scipy'."
    )


def _to_float32_minus1_to_1(x: np.ndarray) -> np.ndarray:
  """Convert numpy audio array to float32 in [-1, 1]."""
  x = np.asarray(x)
  if np.issubdtype(x.dtype, np.floating):
    return np.clip(x.astype(np.float32), -1.0, 1.0)

  if np.issubdtype(x.dtype, np.integer):
    info = np.iinfo(x.dtype)
    scale = float(max(abs(info.min), info.max))
    return np.clip(x.astype(np.float32) / scale, -1.0, 1.0)

  raise TypeError(f"Unsupported audio dtype: {x.dtype}")


def read_wav(path: str) -> Tuple[np.ndarray, int]:
  """Read WAV -> (audio_float32_in_-1..1, sample_rate). Supports mono/stereo."""
  _ensure_audio_backend()

  if _HAS_SF:
    data, sr = sf.read(path, dtype="float32", always_2d=False)  # type: ignore
    return _to_float32_minus1_to_1(data), int(sr)

  sr, data = wavfile.read(path)  # type: ignore
  return _to_float32_minus1_to_1(data), int(sr)


def write_wav(path: str, audio: np.ndarray, sr: int) -> None:
  """Write float32 audio in [-1, 1] as WAV."""
  _ensure_audio_backend()
  audio = np.clip(np.asarray(audio, dtype=np.float32), -1.0, 1.0)

  if _HAS_SF:
    sf.write(path, audio, sr, subtype="PCM_16")  # type: ignore
  else:
    wavfile.write(path, sr, audio)  # type: ignore


def distort_audio(
  x: np.ndarray,
  drive_db: float = 12.0,
  mix: float = 1.0,
  out_db: float = -1.0,
  mode: str = "tanh",
) -> np.ndarray:
  """Apply distortion to mono/stereo float32 audio in [-1, 1]."""
  x = _to_float32_minus1_to_1(x)
  mix = float(np.clip(mix, 0.0, 1.0))

  pre_gain = 10.0 ** (float(drive_db) / 20.0)
  xg = x * pre_gain

  if mode == "tanh":
    y = np.tanh(xg)
  elif mode == "hardclip":
    y = np.clip(xg, -1.0, 1.0)
  else:
    raise ValueError(f"Unsupported mode: {mode}")

  out = (1.0 - mix) * x + mix * y
  out_gain = 10.0 ** (float(out_db) / 20.0)
  out = out * out_gain
  out = np.clip(out, -1.0, 1.0).astype(np.float32)
  return out


def self_test() -> None:
  """Minimal runtime check for processor behavior."""
  sr = 48_000
  duration_s = 1.0
  t = np.arange(int(sr * duration_s), dtype=np.float32) / sr
  sine = 0.25 * np.sin(2.0 * np.pi * 440.0 * t).astype(np.float32)

  out = distort_audio(
    sine,
    drive_db=12.0,
    mix=1.0,
    out_db=-1.0,
    mode="tanh",
  )

  assert np.max(out) <= 1.0 + 1e-6
  assert np.min(out) >= -1.0 - 1e-6
  assert not np.allclose(out, sine), "Output should differ from input for drive_db > 0"

  stereo = np.stack([sine, sine], axis=1)
  out_st = distort_audio(stereo, drive_db=12.0, mix=0.7, out_db=-1.0, mode="hardclip")
  assert out_st.shape == stereo.shape
  assert np.max(out_st) <= 1.0 + 1e-6
  assert np.min(out_st) >= -1.0 - 1e-6

  print("Self-test passed.")


def parse_args(argv: list[str]) -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Simple WAV distortion processor")
  parser.add_argument("input", nargs="?", help="Input WAV path")
  parser.add_argument("output", nargs="?", help="Output WAV path")
  parser.add_argument("--drive_db", type=float, default=12.0, help="Pre-gain in dB (default: 12)")
  parser.add_argument("--mix", type=float, default=1.0, help="Wet mix 0..1 (default: 1.0)")
  parser.add_argument("--out_db", type=float, default=-1.0, help="Output gain in dB (default: -1)")
  parser.add_argument(
    "--mode",
    choices=("tanh", "hardclip"),
    default="tanh",
    help="Distortion mode (default: tanh)",
  )
  parser.add_argument(
    "--self_test",
    action="store_true",
    help="Run minimal self-test and exit",
  )
  return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
  args = parse_args(sys.argv[1:] if argv is None else argv)

  if args.self_test:
    self_test()
    return 0

  if not args.input or not args.output:
    print("Error: input and output are required unless --self_test is used.", file=sys.stderr)
    return 2

  x, sr = read_wav(args.input)
  y = distort_audio(
    x,
    drive_db=args.drive_db,
    mix=args.mix,
    out_db=args.out_db,
    mode=args.mode,
  )
  write_wav(args.output, y, sr)
  print(f"Wrote: {args.output} (sr={sr}, shape={y.shape}, mode={args.mode})")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
