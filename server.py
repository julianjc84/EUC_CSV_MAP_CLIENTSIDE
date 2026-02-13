#!/usr/bin/env python3
"""
Simple Flask server for EUC CSV Map Client-Side Application
Provides file listing API for CSV directory browsing
"""

from flask import Flask, jsonify, send_from_directory, send_file
from flask_cors import CORS
import os
from datetime import datetime

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for local development

@app.after_request
def add_no_cache_headers(response):
    """Prevent browser caching of JS/CSS/HTML during development"""
    if response.content_type and any(t in response.content_type for t in ['javascript', 'css', 'html']):
        response.headers['Cache-Control'] = 'no-cache'
    return response

# CSV directory path (relative to this file)
CSV_DIR = os.path.join(os.path.dirname(__file__), 'csv')

# Ensure CSV directory exists
os.makedirs(CSV_DIR, exist_ok=True)

# Format detection cache (path -> format)
format_cache = {}

def detect_csv_format(filepath):
    """
    Detect CSV format by reading only the header line.
    Returns: 'eucworld', 'wheellog', 'darknessbot', or 'unknown'
    """
    # Check cache first
    if filepath in format_cache:
        return format_cache[filepath]

    try:
        # Read only first line (header) - lightweight operation
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            header_line = f.readline().strip()

        # Parse columns from header
        columns = [col.strip().lower() for col in header_line.split(',')]
        columns_set = set(columns)

        # Detection logic (matching format-detector.js)

        # EUC World: has 'extra' + 'datetime'
        if 'extra' in columns_set and 'datetime' in columns_set:
            format_cache[filepath] = 'eucworld'
            return 'eucworld'

        # DarknessBot: has 'Date' + specific columns (Pitch, Total mileage, Battery level)
        # Note: We need case-sensitive check for 'Date' vs 'date'
        columns_original = [col.strip() for col in header_line.split(',')]
        columns_original_set = set(columns_original)

        if ('Date' in columns_original_set and
            'Battery level' in columns_original_set and
            'Pitch' in columns_original_set and
            'Total mileage' in columns_original_set):
            format_cache[filepath] = 'darknessbot'
            return 'darknessbot'

        # WheelLog: has separate 'date' and 'time' columns (not 'datetime' or 'Date')
        if 'date' in columns_set and 'time' in columns_set and 'extra' not in columns_set:
            format_cache[filepath] = 'wheellog'
            return 'wheellog'

        # Unknown format
        format_cache[filepath] = 'unknown'
        return 'unknown'

    except Exception as e:
        print(f"[SERVER] Format detection error for {filepath}: {e}")
        return 'unknown'

@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_file('index.html')

@app.route('/api/files')
def list_csv_files():
    """List all CSV files in the csv directory (including subdirectories)"""
    try:
        if not os.path.exists(CSV_DIR):
            return jsonify({'error': 'CSV directory not found', 'files': []})

        files = []

        # Walk through csv directory and all subdirectories
        for root, dirs, filenames in os.walk(CSV_DIR):
            for filename in filenames:
                if filename.endswith('.csv'):
                    filepath = os.path.join(root, filename)
                    stat = os.stat(filepath)

                    # Get relative path from CSV_DIR
                    rel_path = os.path.relpath(filepath, CSV_DIR)

                    # Detect CSV format (lightweight - only reads header)
                    csv_format = detect_csv_format(filepath)

                    files.append({
                        'name': filename,
                        'path': rel_path,  # Relative path including subdirectories
                        'folder': os.path.dirname(rel_path) if os.path.dirname(rel_path) else '/',
                        'size': stat.st_size,
                        'modified': stat.st_mtime,
                        'modified_date': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                        'format': csv_format  # Add format field
                    })

        # Sort by folder, then by filename
        files.sort(key=lambda x: (x['folder'], x['name']))

        return jsonify({
            'success': True,
            'count': len(files),
            'files': files
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'files': []
        }), 500

@app.route('/api/csv/<path:filename>')
def get_csv_file(filename):
    """Serve a specific CSV file"""
    try:
        # Security: prevent directory traversal
        if '..' in filename or filename.startswith('/'):
            return jsonify({'error': 'Invalid filename'}), 400

        return send_from_directory(CSV_DIR, filename)

    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files (JS, CSS, images, etc.)"""
    return send_from_directory('.', path)

if __name__ == '__main__':
    print(f"[SERVER] Starting EUC CSV Map server...")
    print(f"[SERVER] CSV directory: {os.path.abspath(CSV_DIR)}")
    print(f"[SERVER] Server running at: http://127.0.0.1:8000")
    print(f"[SERVER] Press Ctrl+C to stop")

    app.run(host='127.0.0.1', port=8000, debug=True)
