"""
YouTube Download Server using yt-dlp
=====================================
Simple Flask server that downloads YouTube audio using yt-dlp
Can be deployed to Railway, Render, or Fly.io for free
"""

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import yt_dlp
import os
import tempfile
import uuid

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Temporary directory for downloads
TEMP_DIR = tempfile.gettempdir()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'youtube-audio-downloader'})


@app.route('/api/youtube/info', methods=['GET'])
def get_video_info():
    """Get video information without downloading"""
    video_id = request.args.get('videoId')
    url = request.args.get('url')
    
    if not video_id and not url:
        return jsonify({'error': 'Missing videoId or url parameter'}), 400
    
    # Construct YouTube URL
    if video_id:
        youtube_url = f'https://www.youtube.com/watch?v={video_id}'
    else:
        youtube_url = url
    
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            
            return jsonify({
                'videoId': info.get('id'),
                'title': info.get('title'),
                'duration': info.get('duration'),  # seconds
                'uploader': info.get('uploader'),
                'thumbnail': info.get('thumbnail'),
                'description': info.get('description', '')[:200] + '...',
                'formats_available': len(info.get('formats', []))
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/youtube/download', methods=['GET'])
def download_audio():
    """Download audio from YouTube video"""
    video_id = request.args.get('videoId')
    url = request.args.get('url')
    audio_format = request.args.get('format', 'mp3')  # mp3, m4a, wav
    
    if not video_id and not url:
        return jsonify({'error': 'Missing videoId or url parameter'}), 400
    
    # Construct YouTube URL
    if video_id:
        youtube_url = f'https://www.youtube.com/watch?v={video_id}'
        filename_base = video_id
    else:
        youtube_url = url
        filename_base = str(uuid.uuid4())[:8]
    
    # Output file path
    output_path = os.path.join(TEMP_DIR, f'{filename_base}.{audio_format}')
    
    try:
        # yt-dlp options
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path.replace(f'.{audio_format}', '.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': audio_format,
                'preferredquality': '192',
            }],
            'quiet': True,
            'no_warnings': True
        }
        
        # Download
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            title = info.get('title', 'audio')
        
        # Send file
        if os.path.exists(output_path):
            return send_file(
                output_path,
                mimetype=f'audio/{audio_format}',
                as_attachment=True,
                download_name=f'{title}.{audio_format}'
            )
        else:
            return jsonify({'error': 'Download failed - file not found'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    finally:
        # Cleanup - delete file after sending
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except:
            pass


@app.route('/api/youtube/search', methods=['GET'])
def search_youtube():
    """Search YouTube (requires YouTube Data API key)"""
    query = request.args.get('q')
    
    if not query:
        return jsonify({'error': 'Missing query parameter'}), 400
    
    # This would use YouTube Data API
    # For simplicity, redirect to use yt-dlp search
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'default_search': 'ytsearch10'
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(f'ytsearch10:{query}', download=False)
            
            videos = []
            for entry in result.get('entries', []):
                videos.append({
                    'videoId': entry.get('id'),
                    'title': entry.get('title'),
                    'uploader': entry.get('uploader'),
                    'duration': entry.get('duration'),
                    'thumbnail': entry.get('thumbnail'),
                    'url': entry.get('url')
                })
            
            return jsonify({'results': videos})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
