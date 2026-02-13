# Start Options for EUC CSV Map

There are three ways to start the EUC CSV Map application:

## 🚀 Quick Start Options

### Option 1: Directory Browser (Recommended) 📁

**Best for:** Regular use with multiple CSV files

```bash
./start_directory.sh
```

**Features:**
- ✅ Automatic file browser showing all CSV files
- ✅ Browse files in `./csv` directory and subdirectories
- ✅ Click any file to load it instantly
- ✅ Drag & drop still works
- ✅ Upload button still works
- ✅ Organized view with folder grouping

**Requirements:**
- Python 3.8+
- Flask and flask-cors (auto-installed on first run)
- Creates virtual environment automatically

**What it does:**
1. Creates Python virtual environment if needed
2. Installs Flask dependencies
3. Starts Flask server on http://127.0.0.1:8000
4. Shows file browser with all CSV files

**First Time Setup:**
The script will:
- Check Python version
- Create `venv/` directory
- Install Flask and dependencies
- Create `csv/` directory if missing
- Start the server

**Subsequent runs:**
- Reuses existing venv
- No reinstall needed (unless requirements change)
- Fast startup

---

### Option 2: Basic Mode 🌐

**Best for:** Quick testing, no dependencies, one-off use

```bash
./start_basic.sh
```

**Features:**
- ✅ Drag & drop CSV files
- ✅ Upload button
- ✅ No dependencies required
- ✅ Fast startup
- ❌ No file browser
- ❌ Can't browse server files

**Requirements:**
- Python 3 only (built-in http.server)

**What it does:**
1. Starts Python's built-in HTTP server
2. Serves files on http://localhost:8000
3. No file browser - manual file selection only

---

### Option 3: Launcher (Info Only) ℹ️

**Shows available options**

```bash
./start.sh
```

**What it does:**
- Detects installed dependencies
- Recommends best option for your system
- Doesn't start anything - just shows info

---

## 📁 Directory Structure for File Browser

When using `./start_directory.sh`, organize your CSV files like this:

```
csv/
├── my_ride.csv                    # Root level
├── 2024/
│   ├── january/
│   │   ├── ride1.csv
│   │   └── ride2.csv
│   └── february/
│       └── ride3.csv
└── archive/
    └── old_ride.csv
```

**File browser will show:**
```
📂 Root
  my_ride.csv

📂 2024/january
  ride1.csv
  ride2.csv

📂 2024/february
  ride3.csv

📂 archive
  old_ride.csv
```

---

## 🔄 Comparison Table

| Feature | Directory Browser | Basic Mode |
|---------|------------------|------------|
| File browser | ✅ Yes | ❌ No |
| Drag & drop | ✅ Yes | ✅ Yes |
| Upload button | ✅ Yes | ✅ Yes |
| Subdirectories | ✅ Yes | ❌ N/A |
| Dependencies | Flask (auto-installed) | None |
| Setup time | ~30 sec (first run) | Instant |
| Startup time | ~2 sec | Instant |
| Port | 8000 | 8000 |

---

## ⚙️ Advanced Usage

### Manual venv activation

If you need to run commands manually:

```bash
# Activate virtual environment
source venv/bin/activate

# Start Flask server
python server.py

# Or start basic server
python -m http.server 8000

# Deactivate when done
deactivate
```

### Reinstall dependencies

If something breaks:

```bash
# Remove virtual environment
rm -rf venv

# Run directory start (will recreate)
./start_directory.sh
```

### Custom port

Edit `server.py` or `start_basic.sh` to change port 8000 to something else.

---

## 🐛 Troubleshooting

**"Flask not found"**
- Run `./start_directory.sh` (it will install Flask)
- Or manually: `pip install -r requirements.txt`

**"Port 8000 already in use"**
- Stop other server using that port
- Or edit scripts to use different port

**"Python not found"**
- Install Python 3: `sudo apt install python3`

**Virtual environment fails**
- Install venv: `sudo apt install python3-venv`

---

## 🎯 Recommendation

**First time users:** Run `./start_directory.sh`
- It handles everything automatically
- Best experience with file browser
- Only takes 30 seconds to set up

**Quick tests:** Use `./start_basic.sh`
- No setup needed
- Works immediately
- Good for demos
