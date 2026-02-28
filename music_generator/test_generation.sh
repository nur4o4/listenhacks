#!/bin/bash
cd /Users/nuthanantharmarajah/testing
python3 generate_singing.py \
  --lyrics "La la la, singing through the day, la la la, in every way!" \
  --voice-id cgSgspJ2msm6clMCkdW9 \
  --stability 0.3 \
  --similarity 0.75 \
  --style 0.7 \
  --output test_expressive.mp3
