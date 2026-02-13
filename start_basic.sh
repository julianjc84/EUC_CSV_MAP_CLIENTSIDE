#!/usr/bin/env bash

# EUC CSV Map - Basic Start Script
# Runs simple Python HTTP server (no dependencies required)

echo "🎯 EUC CSV Map - Basic Mode"
echo "=============================="
echo ""

# Ensure we're in the project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
if [ "$(pwd)" != "$PROJECT_DIR" ]; then
    echo "📁 Changing to project directory..."
    cd "$PROJECT_DIR" || {
        echo "❌ Cannot find project directory: $PROJECT_DIR"
        exit 1
    }
fi

# Detect Python command
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Error: Python not found. Please install Python 3."
    echo ""
    echo "Install on Ubuntu/Debian:"
    echo "  sudo apt install python3"
    echo ""
    exit 1
fi

echo "✅ Python detected: $($PYTHON_CMD --version)"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🌐 Starting Simple HTTP Server..."
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "The application will be available at:"
echo "  → http://localhost:8000"
echo ""
echo "⚠️  Basic Mode (No File Browser)"
echo ""
echo "📝 Features:"
echo "  • Drag & drop CSV files anywhere on page"
echo "  • Upload files using the upload button"
echo "  • Auto-detect format (EUC World, WheelLog, DarknessBot)"
echo "  • Interactive GPS maps and synchronized charts"
echo ""
echo "💡 Want File Browser?"
echo "   Run: ./start_directory.sh"
echo "   (Automatically browses CSV files from ./csv directory)"
echo ""
echo "⚠️  Press CTRL+C to stop the server when done"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Start HTTP server with no-cache headers (prevents stale JS/CSS on refresh)
$PYTHON_CMD -c "
from http.server import HTTPServer, SimpleHTTPRequestHandler
class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
HTTPServer(('', 8000), NoCacheHandler).serve_forever()
"
