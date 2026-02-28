"""
Flask API for Song Generation
Provides HTTP endpoint for generating music from conversation context
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
from pathlib import Path
from generate_music import ElevenLabsMusicGenerator
import logging

app = Flask(__name__)
CORS(app)  # Enable CORS for requests from Node.js server

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Output directory for generated songs
OUTPUT_DIR = Path(__file__).parent.parent / 'mixer' / 'audio_files'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'music-generator'}), 200

@app.route('/generate', methods=['POST'])
def generate_song():
    """
    Generate a song from conversation analysis
    
    Expected JSON body:
    {
        "lyrics": "Song lyrics",
        "genre": "pop/rock/etc",
        "mood": "happy/sad/etc",
        "tempo": "slow/moderate/fast",
        "length_ms": 25000
    }
    """
    try:
        data = request.json
        logger.info(f"Received generation request: {json.dumps(data, indent=2)}")
        
        # Validate required fields
        required_fields = ['lyrics', 'genre', 'mood', 'tempo']
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Extract parameters
        lyrics = data['lyrics']
        genre = data.get('genre', 'pop')
        mood = data.get('mood', 'expressive')
        tempo = data.get('tempo', 'moderate')
        length_ms = data.get('length_ms', 25000)
        
        # Generate output filename
        import time
        timestamp = int(time.time() * 1000)
        filename = f"generated_song_{timestamp}.mp3"
        output_path = OUTPUT_DIR / filename
        
        logger.info(f"Generating song to: {output_path}")
        logger.info(f"Lyrics: {lyrics}")
        logger.info(f"Genre: {genre} | Mood: {mood} | Tempo: {tempo}")
        
        # Initialize generator
        generator = ElevenLabsMusicGenerator()
        
        # Use a cappella genre for vocals-only
        actual_genre = 'a cappella'
        
        # Generate the music
        result_path = generator.generate_music_from_lyrics(
            lyrics=lyrics,
            output_path=str(output_path),
            genre=actual_genre,
            tempo=tempo,
            mood=mood,
            music_length_ms=length_ms,
            use_composition_plan=False
        )
        
        logger.info(f"Song generated successfully: {result_path}")
        
        # Get file size
        file_size = os.path.getsize(result_path)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'path': str(result_path),
            'size': file_size,
            'lyrics': lyrics,
            'genre': actual_genre,
            'mood': mood,
            'tempo': tempo,
            'length_ms': length_ms
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating song: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Failed to generate song',
            'details': str(e)
        }), 500

@app.route('/download/<filename>', methods=['GET'])
def download_song(filename):
    """Download a generated song file"""
    try:
        file_path = OUTPUT_DIR / filename
        if not file_path.exists():
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(
            file_path,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run on port 5000 by default
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting music generator API on port {port}")
    logger.info(f"Output directory: {OUTPUT_DIR}")
    app.run(host='0.0.0.0', port=port, debug=True)
