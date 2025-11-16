# EUC Ride Data Viewer - Client Side

**Pure JavaScript** version of the EUC ride data visualization dashboard. Fully offline, privacy-first design.

## 🚀 Features

- ✅ **Client-Side Only** - All processing happens in your browser
- ✅ **Privacy First** - CSV files never leave your computer
- ✅ **Multi-Format Support** - EUC World, WheelLog, DarknessBot
- ✅ **Interactive GPS Maps** - Leaflet-based route visualization
- ✅ **Real-time Charts** - Canvas-based synchronized charts
- ✅ **100% Offline** - All dependencies bundled locally, no internet needed
- ✅ **Fast & Responsive** - Instant interactions, no network latency

**Note:** Requires a basic web server to run (Python, Node.js, etc.) due to browser security restrictions with ES6 modules. The web server only serves static files - all data processing is still 100% client-side and offline.

## 🔧 How to Use

### Required: Local Web Server

**Why a web server?** Modern browsers block ES6 modules when opening HTML files directly (`file://` protocol) for security reasons. A simple web server bypasses this restriction while keeping all processing local.

### Option 1: Python Simple HTTP Server (Easiest)

```bash
cd EUC_CSV_MAP_CLIENTSIDE
python3 -m http.server 8000

# Then open: http://localhost:8000
```

### Option 2: Python Flask Server (File Browser)

For browsing multiple CSV files:

```bash
pip install flask
python server.py

# Then open: http://localhost:8000
```

See [README_SERVER.md](README_SERVER.md) for full server documentation.

### Option 3: Node.js HTTP Server

```bash
npx http-server -p 8000

# Then open: http://localhost:8000
```

### Using the App

1. Open the web server URL in your browser
2. Drag & drop your CSV file or click "Choose CSV File"
3. View your ride data!

**All processing happens in your browser - no data is sent anywhere.**

## 📊 Supported CSV Formats

### EUC World

### WheelLog

### DarknessBot

## 🛠️ Dependencies

All dependencies are **bundled locally** for offline use (no npm or internet required):

- **Papa Parse** (5.4.1) - CSV parsing (`vendor/js/papaparse.min.js`)
- **Leaflet** (1.9.4) - GPS maps (`vendor/leaflet/`)
- **Bootstrap** (5.3.2) - UI components (`vendor/css/` & `vendor/js/`)

## 🔐 Privacy

- **100% client-side** - No data sent to any server (CSV processing happens entirely in your browser)
- **Local processing** - All CSV parsing and calculations done by JavaScript in your browser
- **Secure** - No external API calls (after initial page load)
- **Offline capable** - Works without internet (web server can be local)
- **Server role** - Only serves static HTML/JS/CSS files, never touches your CSV data

**Important:** Even though a web server is required, it only serves the application files (HTML, JavaScript, CSS). Your CSV data never leaves your browser.

## ❓ FAQ

### Why can't I just open `index.html` directly in my browser?

Modern browsers block ES6 modules (`import`/`export` statements) when using the `file://` protocol for security reasons (CORS policy). You'll see errors like:

```
Access to script at 'file:///.../map-core.mjs' has been blocked by CORS policy
```

**Solution:** Use any web server (Python, Node.js, etc.) to serve the files over `http://localhost`. The web server only serves files - it doesn't process your data.

### Is my data safe? Does it get uploaded anywhere?

**Yes, your data is 100% safe.** All CSV processing happens in your browser using JavaScript. The web server only delivers the HTML/JS/CSS files - it never sees or processes your CSV data. You can verify this by:
- Disconnecting from the internet after loading the page
- Checking your browser's Network tab (no CSV upload requests)
- Running a local server with no internet connection# EUC Ride Data Viewer - Client Side
