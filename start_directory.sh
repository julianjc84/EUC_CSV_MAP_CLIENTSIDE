#!/usr/bin/env bash

# EUC CSV Map - Directory Browser Start Script
# Sets up Python venv with Flask and starts file browser server

echo "🎯 EUC CSV Map - Directory Browser Mode"
echo "============================================="

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

# Check if Python 3.8+ is available
echo "📋 Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
required_version="3.8"

if ! python3 -c "import sys; exit(0 if sys.version_info >= (3,8) else 1)"; then
    echo "❌ Python 3.8+ is required. Current version: $(python3 --version)"
    exit 1
fi

echo "✅ Python $(python3 --version | awk '{print $2}') detected"

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "⚠️  This tool is designed for Linux. You may encounter issues on other platforms."
fi

# Check for python3-venv (needed for Python 3.12+)
if ! dpkg -l python3-venv >/dev/null 2>&1; then
    echo "⚠️  python3-venv package not found - required for virtual environment..."
    echo "🔧 SOLUTION: Install required packages:"
    echo "   sudo apt install python3-venv"
    echo ""
    read -p "Install now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo apt install python3-venv
    else
        echo "Continuing without python3-venv (may fail)..."
    fi
fi

# Check if virtual environment exists and is functional
if [ ! -f "venv/bin/activate" ]; then
    if [ -d "venv" ]; then
        echo "⚠️  Found incomplete virtual environment directory: venv/"
        echo "❌ Cannot proceed with incomplete venv. Please remove it manually:"
        echo "   rm -rf venv"
        echo "Then run this script again."
        exit 1
    fi

    echo "🔧 Creating Python virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        echo ""
        echo "🔧 SOLUTION: Install missing packages:"
        echo "   sudo apt install python3-venv python3-dev"
        echo ""
        echo "Then run this script again: ./start_directory.sh"
        exit 1
    fi
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment found"
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Verify activation worked
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "❌ Failed to activate virtual environment"
    echo "🔧 Try manually removing and recreating:"
    echo "   rm -rf venv"
    echo "   python3 -m venv venv"
    echo "   source venv/bin/activate"
    exit 1
fi

echo "✅ Virtual environment active"

# Install dependencies
echo "📦 Installing dependencies..."

# Upgrade pip first
pip install --upgrade pip

# Install dependencies with better error handling
echo "Installing Flask and CORS support..."
if ! pip install -r requirements.txt; then
    echo "❌ Failed to install dependencies"
    echo ""
    echo "🔧 COMMON SOLUTIONS:"
    echo "1. Ensure virtual environment is working:"
    echo "   source venv/bin/activate"
    echo "   which python  # Should show project venv/bin/python"
    echo ""
    echo "2. Try installing packages individually:"
    echo "   pip install Flask flask-cors"
    echo ""
    exit 1
fi

echo "✅ Dependencies installed"

# Run basic functionality test
echo "🧪 Running basic functionality test..."
python3 -c "
import sys

try:
    import flask
    print('✅ Flask imported successfully')

    import flask_cors
    print('✅ Flask-CORS imported successfully')

    # Test basic Flask app creation
    app = flask.Flask(__name__)
    print('✅ Flask app instance created')

    print('✅ Basic functionality test passed')

except ImportError as e:
    print(f'❌ Import error: {e}')
    print('')
    print('Missing dependencies. Try reinstalling:')
    print('  pip install -r requirements.txt')
    sys.exit(1)
except Exception as e:
    print(f'❌ Test error: {e}')
    sys.exit(1)
"

if [ $? -ne 0 ]; then
    echo "❌ Basic functionality test failed"
    exit 1
fi

# Create csv directory if it doesn't exist
if [ ! -d "csv" ]; then
    echo "📁 Creating csv directory..."
    mkdir csv
fi

# Display usage information
echo ""
echo "🚀 Setup Complete! CSV Directory Browser is ready!"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🌐 Starting Flask Server with File Browser..."
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "The application will be available at:"
echo "  → http://127.0.0.1:8000"
echo ""
echo "📁 CSV Directory: $PROJECT_DIR/csv"
echo ""
echo "📊 Features:"
echo "  • File browser showing all CSV files (with subdirectory support)"
echo "  • Click any file to load it instantly"
echo "  • Drag & drop files anywhere on the page"
echo "  • Auto-detect format (EUC World, WheelLog, DarknessBot)"
echo "  • Interactive GPS maps and synchronized charts"
echo ""
echo "📝 Usage:"
echo "  1. Place CSV files in the 'csv/' directory"
echo "  2. Organize files in subdirectories (e.g., csv/2024/january/)"
echo "  3. Open browser to http://127.0.0.1:8000"
echo "  4. Click any file from the browser to load it"
echo ""
echo "⚠️  Press CTRL+C to stop the server when done"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Start the Flask server
python server.py

# If the server stops, show restart instructions
echo ""
echo "📝 To restart the server later:"
echo ""
echo "  1. Navigate to project directory:"
echo "     cd $(basename $PROJECT_DIR)"
echo ""
echo "  2. Activate the virtual environment:"
echo "     source venv/bin/activate"
echo ""
echo "  3. Start the server:"
echo "     python server.py"
echo ""
echo "  OR simply run this script again:"
echo "     ./start_directory.sh"
echo ""
echo "🎉 Thank you for using EUC CSV Map!"
