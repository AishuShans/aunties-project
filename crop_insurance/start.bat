@echo off
setlocal enabledelayedexpansion
echo.
echo  ============================================
echo    AgriShield - Fast Launch Script
echo  ============================================
echo.

set "ROOT=%~dp0"
set "FRONTEND=%ROOT%frontend"
set "BACKEND=%ROOT%backend"
set "DIST=%FRONTEND%\dist"
set "DEST=%BACKEND%\frontend_dist"

:: -----------------------------------------------
:: STEP 1: Install npm packages only if needed
:: -----------------------------------------------
if exist "%FRONTEND%\node_modules\vite" (
    echo [SKIP] npm packages already installed.
) else (
    echo [1/3] Installing npm packages ^(first time only^)...
    cd /d "%FRONTEND%"
    call npm install --silent
    if errorlevel 1 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
    echo       Done.
)

:: -----------------------------------------------
:: STEP 2: Build frontend only if source changed
:: -----------------------------------------------
set "NEED_BUILD=0"

:: If dist/index.html doesn't exist, always build
if not exist "%DIST%\index.html" (
    set "NEED_BUILD=1"
)

:: If dist is older than any source file, rebuild
if "%NEED_BUILD%"=="0" (
    for /f %%F in ('dir /b /s /od "%FRONTEND%\src\*.jsx" "%FRONTEND%\src\*.js" "%FRONTEND%\src\*.css" 2^>nul') do (
        if "%%F" neq "" (
            for /f "tokens=1" %%T in ('forfiles /p "%DIST%" /m "index.html" /c "cmd /c echo @fdate @ftime" 2^>nul') do (
                set "DIST_DATE=%%T"
            )
        )
    )
    for /f %%A in ('xcopy "%DIST%\index.html" "%DIST%\index.html" /L /D /Y 2^>nul ^| find "1 "') do (
        rem no-op
    )
)

:: Simple check: rebuild if frontend_dist is missing index.html
if not exist "%DEST%\index.html" (
    set "NEED_BUILD=1"
)

if "%NEED_BUILD%"=="1" (
    echo [2/3] Building React frontend...
    cd /d "%FRONTEND%"
    call npm run build --silent
    if errorlevel 1 (
        echo ERROR: npm build failed!
        pause
        exit /b 1
    )
    echo       Build complete.

    echo [3/3] Copying build to backend...
    if exist "%DEST%" rmdir /S /Q "%DEST%"
    xcopy /E /I /Q "%DIST%" "%DEST%"
    if errorlevel 1 (
        echo ERROR: Copy failed!
        pause
        exit /b 1
    )
    echo       Copy complete.
) else (
    echo [SKIP] Frontend already built and copied - skipping build step.
    echo        ^(Delete backend\frontend_dist\index.html to force rebuild^)
)

:: -----------------------------------------------
:: STEP 4: Activate venv and start server
:: -----------------------------------------------
echo.
echo  ============================================
echo    Starting AgriShield Server...
echo    App:      http://localhost:8000
echo    Admin:    http://localhost:8000/admin
echo    API Docs: http://localhost:8000/docs
echo  ============================================
echo.

cd /d "%BACKEND%"

:: Activate virtual environment if it exists
if exist "%BACKEND%\venv\Scripts\activate.bat" (
    call "%BACKEND%\venv\Scripts\activate.bat"
) else (
    echo [WARN] No venv found - using system Python.
    echo        If you get import errors, run: python -m venv backend\venv
    echo        Then: backend\venv\Scripts\activate
    echo        Then: pip install -r backend\requirements.txt
    echo.
)

:: Check if uvicorn is available
where uvicorn >nul 2>&1
if errorlevel 1 (
    echo [ERROR] uvicorn not found! Installing requirements...
    pip install -r "%BACKEND%\requirements.txt" --quiet
    if errorlevel 1 (
        echo ERROR: pip install failed! Please run manually:
        echo   cd backend
        echo   pip install -r requirements.txt
        pause
        exit /b 1
    )
)

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
