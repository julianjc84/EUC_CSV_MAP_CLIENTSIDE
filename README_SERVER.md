# EUC CSV Map - Server Setup

## Why a Server?

**This application is 100% client-side and offline**, but modern browsers require a web server to load ES6 modules due to CORS (Cross-Origin Resource Sharing) security restrictions. Opening `index.html` directly with the `file://` protocol will fail.

**The server's only job:** Serve static files (HTML, JavaScript, CSS). All CSV processing happens in your browser - no data is ever sent to the server.

**Think of it as:** A local file host, not a processing server.

## Quick Start

### Option A: Simple HTTP Server (No File Browser)

**Easiest method - no installation required:**

```bash
cd EUC_CSV_MAP_CLIENTSIDE
python3 -m http.server 8000
```

Then open: **http://localhost:8000**

Use drag & drop or file picker to load CSV files.

### Option B: Flask Server (With File Browser)

**For browsing multiple CSV files:**

#### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or with a virtual environment (recommended):

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 2. Create CSV Directory

The server looks for CSV files in the `csv/` directory:

```bash
mkdir csv
```

Place your CSV files in this directory.

#### 3. Start the Server

```bash
python server.py
```

The server will start at: **http://127.0.0.1:8000**

#### 4. Open in Browser

Open your browser and navigate to:
```
http://127.0.0.1:8000
```

You should see a file browser showing all CSV files in the `csv/` directory.

## Features

### File Browser
- Automatically lists all CSV files in the `csv/` directory
- Shows filename, size, and last modified date
- Click any file to load it
- Still supports drag & drop and file upload

### API Endpoints

- `GET /` - Main application
- `GET /api/files` - List all CSV files (JSON)
- `GET /api/csv/<filename>` - Download a specific CSV file
- `GET /<path>` - Serve static files (JS, CSS, images)

## Directory Structure

```
EUC_CSV_MAP_CLIENTSIDE/
├── server.py              # Flask server
├── requirements.txt       # Python dependencies
├── csv/                   # CSV files directory (create this)
│   ├── ride1.csv
│   ├── ride2.csv
│   └── ...
├── index.html
├── js/
├── css/
└── vendor/
```

## Troubleshooting

### Port 8000 Already in Use

If port 8000 is already in use, edit `server.py` and change:
```python
app.run(host='127.0.0.1', port=8000, debug=True)
```
to a different port (e.g., 8001, 8080, etc.)

### CSV Directory Not Found

Make sure the `csv/` directory exists in the same location as `server.py`:
```bash
mkdir csv
```

### CORS Errors

The server includes CORS headers for local development. If you still see CORS errors, make sure you're accessing the app through the server (http://127.0.0.1:8000) and not opening the HTML file directly.

**Common error when opening `index.html` directly:**
```
Access to script at 'file:///.../map-core.mjs' has been blocked by CORS policy
```

**Solution:** Always use a web server (`python3 -m http.server` or `python server.py`)

## Alternative Web Servers

### Node.js HTTP Server

```bash
# Install globally (one time)
npm install -g http-server

# Run server
cd EUC_CSV_MAP_CLIENTSIDE
http-server -p 8000
```

Or use `npx` (no installation needed):
```bash
npx http-server -p 8000
```

### PHP Built-in Server

```bash
cd EUC_CSV_MAP_CLIENTSIDE
php -S localhost:8000
```

### VS Code Live Server Extension

1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"

All of these serve static files only - your CSV data remains private and local.

## Security & Privacy Notes

### Client-Side Processing
- **All CSV processing happens in your browser** - The server never processes or stores your data
- CSV files are only read by JavaScript running in your browser
- No data is transmitted to any external servers or services
- Safe for sensitive ride data (location, speed, etc.)

### Server Security
- This server is intended for **local development only**
- Do not expose it to the internet without additional security measures
- The Flask server includes basic path traversal protection
- Only CSV files in the `csv/` directory are accessible via the API

### Recommended Use
- **Local only:** Run on `127.0.0.1` or `localhost` (default)
- **Trusted networks:** Only expose to trusted local networks if needed
- **Production:** For public hosting, use GitHub Pages or similar static hosting (no server-side processing anyway)
