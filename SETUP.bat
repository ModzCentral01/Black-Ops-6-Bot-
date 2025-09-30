@echo off
echo Bo6 Bot Lobby Tool - Setup Script
echo ================================
echo.

echo This script will install Node.js and Electron if needed...
echo.

REM Check if node is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Please install Node.js first:
    echo 1. Go to https://nodejs.org
    echo 2. Download and install the LTS version
    echo 3. Restart this script
    echo.
    pause
    exit /b 1
)

echo Node.js found: 
node --version

echo.
echo Installing Electron...
npm install electron --save

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install Electron.
    echo Make sure you have internet connection and try again.
    pause
    exit /b 1
)

echo.
echo Setup complete! You can now run the application with:
echo npm start
echo.
echo Or use the Start.bat file
echo.
pause
