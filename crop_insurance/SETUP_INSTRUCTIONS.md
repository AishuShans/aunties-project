# Setup Instructions for Crop Insurance System

Follow these steps to run the complete Satellite-Based Crop Insurance Verification System.

## Prerequisites
Before you start, make sure the laptop has the following installed:
1. **Python 3.10+** (Checking the box "Add Python to PATH" during installation is required)
2. **Node.js** (LTS version, comes with npm)
3. **VS Code** (Optional, but recommended)

---

## Quick Start (Single Command)

### On Windows:
1. Open a terminal in the `crop_insurance` folder.
2. Double-click `start.bat` or run:
   ```cmd
   start.bat
   ```
   This will:
   - Install frontend dependencies
   - Build the React frontend
   - Copy the build into the backend
   - Start the unified server

3. Open your browser and go to: **[http://localhost:8000](http://localhost:8000)**

That's it! Everything runs from a **single terminal** and a **single URL**.

---

## Manual Setup (Step by Step)

### Step 1: Build the Frontend
```cmd
cd frontend
npm install
npm run build
```

### Step 2: Copy Frontend Build to Backend
```cmd
# Windows:
xcopy /E /I /Q frontend\dist backend\frontend_dist

# Mac/Linux:
cp -r frontend/dist backend/frontend_dist
```

### Step 3: Start the Server
```cmd
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

### Step 4: Use the Application
- **App**: [http://localhost:8000](http://localhost:8000)
- **Admin Portal**: [http://localhost:8000/admin](http://localhost:8000/admin)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Deployment (Render)

This project deploys as a **single web service** on Render:

1. Push to GitHub
2. Create a new **Web Service** on Render
3. Connect your repo
4. Set:
   - **Root Directory**: `crop_insurance/backend`
   - **Build Command**: `pip install -r requirements.txt && cd ../frontend && npm install && npm run build && cp -r dist ../backend/frontend_dist`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Or simply use the included `render.yaml` for automatic configuration.

> **Note:** The SQLite database `claims.db` is already included in the `backend/` folder so any data you submitted will carry over!
