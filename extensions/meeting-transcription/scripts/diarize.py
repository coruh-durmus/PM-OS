#!/usr/bin/env python3
"""Speaker diarization using Pyannote.

Usage: python diarize.py --audio input.wav --output output.json

Outputs JSON with format:
{
  "segments": [
    {"speaker": "SPEAKER_00", "start": 0.5, "end": 3.2},
    {"speaker": "SPEAKER_01", "start": 3.5, "end": 7.1}
  ]
}
"""
import argparse
import json
import sys
import os

def main():
    parser = argparse.ArgumentParser(description='Speaker diarization')
    parser.add_argument('--audio', required=True, help='Input audio file path')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    args = parser.parse_args()

    if not os.path.exists(args.audio):
        print(f"Error: Audio file not found: {args.audio}", file=sys.stderr)
        sys.exit(1)

    try:
        from pyannote.audio import Pipeline

        # Load pipeline (model path can be overridden via env var)
        model_path = os.environ.get('PYANNOTE_MODEL_PATH', 'pyannote/speaker-diarization-3.1')
        pipeline = Pipeline.from_pretrained(model_path)

        # Run diarization
        diarization = pipeline(args.audio)

        # Convert to our format
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "speaker": speaker,
                "start": round(turn.start, 2),
                "end": round(turn.end, 2),
            })

        result = {"segments": segments}

    except ImportError:
        # Pyannote not installed -- return empty result
        print("Warning: pyannote.audio not installed, returning empty diarization", file=sys.stderr)
        result = {"segments": []}
    except Exception as e:
        print(f"Error during diarization: {e}", file=sys.stderr)
        result = {"segments": []}

    with open(args.output, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"Diarization complete: {len(result['segments'])} segments", file=sys.stderr)

if __name__ == '__main__':
    main()
