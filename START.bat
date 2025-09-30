@echo off
echo Starting Bo6 Bot Lobby Tool...
echo.

REM Change to the directory containing this script
cd /d "%~dp0"

REM Check if node_modules exists
if not exist "node_modules" (
    echo ERROR: Dependencies not installed.
    echo Please run SETUP.bat first to install required dependencies.
    echo.
    pause
    exit /b 1
)

REM Start the application
npm start

REM If npm start fails, show error message
if errorlevel 1 (
    echo.
    echo ERROR: Failed to start the application.
    echo Try running SETUP.bat again or check for error messages above.
    echo.
    pause
)
