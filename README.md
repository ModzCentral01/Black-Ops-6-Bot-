# Bo6 Bot Lobby Tool - English Version (Source Distribution)

## Ultra-Minimal Distribution (Under 2MB!)

This is the ultra-minimal source distribution of the Bo6 Bot Lobby Tool, fully translated to English. This version requires you to install Node.js and Electron but results in a much smaller download.

## Quick Start

### Method 1: Automated Setup (Recommended)
1. Double-click `SETUP.bat` to automatically install dependencies
2. Double-click `START.bat` to run the application

### Method 2: Manual Setup
1. Install [Node.js](https://nodejs.org) (LTS version recommended)
2. Open Command Prompt in this folder
3. Run: `npm install electron --save`
4. Run: `npm start`

## Features
- ✅ **Fully translated to English**
- ✅ Multiple browser view management
- ✅ Advanced macro system for automation
- ✅ View synchronization panels
- ✅ Settings management
- ✅ **Ultra-small download size (under 2MB)**
- ✅ No pre-bundled bloat

## System Requirements
- Windows 10/11 (64-bit)
- Node.js (automatically downloads if using SETUP.bat)
- Internet connection for initial setup
- At least 4GB RAM

## Why This Version?
This source distribution is perfect if you:
- Want the smallest possible download
- Already have Node.js installed
- Don't mind a one-time setup process
- Prefer having the latest Electron version

## File Structure
```
Bo6-Source-Only/
├── src/                    # Application source code
├── package.json           # Dependencies and configuration
├── SETUP.bat             # Automated setup script
├── START.bat             # Application launcher
└── README.md             # This file
```

## What's Been Optimized
- ❌ Removed 250MB+ Electron binaries
- ❌ Removed development dependencies
- ❌ Removed unused license system
- ❌ Removed build tools and obfuscators
- ✅ Kept only essential source code
- ✅ Added automated setup scripts

## Comparison
| Version | Download Size | After Setup | Notes |
|---------|---------------|-------------|--------|
| Full Version | ~84MB | ~260MB | Ready to run |
| **Source Version** | **~2MB** | **~260MB** | Requires setup |

## Troubleshooting

### "Node.js not found" Error
1. Download Node.js from https://nodejs.org
2. Install the LTS version
3. Restart your computer
4. Run SETUP.bat again

### "npm install failed" Error
1. Check your internet connection
2. Try running Command Prompt as Administrator
3. Navigate to this folder and run: `npm install electron --save`

### Application Won't Start
1. Make sure SETUP.bat completed successfully
2. Try running START.bat as Administrator
3. Check that Windows Defender isn't blocking files

### Still Having Issues?
The application requires:
- Internet connection (for Xbox Cloud Gaming)
- Windows 10/11 (64-bit)
- At least 4GB RAM
- No antivirus blocking Electron

## Developer Info
This is a translated and optimized version of the original Bo6 Bot Lobby Tool:
- All French text converted to English
- All console messages in English
- All UI elements in English
- Simplified fake license system for maximum compatibility
