# Bo6 Bot Lobby Tool — Source Distribution (English)

[![Node.js](https://img.shields.io/badge/Node.js-LTS-green.svg)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/Electron-latest-blue.svg)](https://www.electronjs.org)
[![Platform](https://img.shields.io/badge/Windows-10%2F11-0078D6)](https://www.microsoft.com/windows)
[![GitHub stars](https://img.shields.io/github/stars/your-repo?style=social)](../../stargazers)
[![GitHub forks](https://img.shields.io/github/forks/your-repo?style=social)](../../network/members)
[![License](https://img.shields.io/github/license/your-repo)](./LICENSE)

> ⚡ Ultra-minimal source distribution (under **2 MB**) — run with your own Node.js & Electron install.

---

## 📖 Overview
This repository contains the **source-only** edition of the *Bo6 Bot Lobby Tool*, fully translated into English.  
It does **not** include Electron binaries, which keeps the download tiny and ensures you always run the latest version locally.

---

## 📸 Preview
![App Preview](https://via.placeholder.com/800x400?text=Bo6+Bot+Lobby+Tool+Preview)

---

## 🚀 Quick Start

### Method 1 — Automated (Recommended)
```bash
# Step 1: Install dependencies
SETUP.bat

# Step 2: Launch the app
START.bat
```

### Method 2 — Manual
```bash
# 1. Install Node.js (LTS recommended): https://nodejs.org
# 2. Open Command Prompt in this repo folder
npm install electron --save
npm start
```

---

## ✨ Features
- ✅ 100% translated into English (UI + console)  
- ✅ Multi-view browser management  
- ✅ Advanced macro automation  
- ✅ View synchronization panels  
- ✅ Settings management  
- ✅ Tiny source package (≈2 MB)  
- ✅ No pre-bundled bloat  

---

## 🖥️ Requirements
- Windows **10/11 (64-bit)**  
- [Node.js](https://nodejs.org) (LTS recommended)  
- Internet connection (for npm install + Xbox Cloud Gaming)  
- At least **4 GB RAM**  

---

## 📂 File Structure
```
Bo6-Source-Only/
├── src/                # Application source code (JS/HTML/CSS)
├── package.json        # Dependencies and run scripts
├── SETUP.bat           # Automated setup script (npm install)
├── START.bat           # Launcher (npm start)
└── README.md           # This file
```

---

## ⚙️ What’s Optimised
- ❌ Removed: 250MB+ Electron binaries  
- ❌ Removed: Development dependencies  
- ❌ Removed: Build tools & obfuscators  
- ❌ Removed: Unused license system  
- ✅ Kept: Core source & scripts  
- ✅ Added: Automated setup batch files  

---

## 📊 Comparison

| Edition            | Download size | After setup | Ready to run |
|--------------------|--------------:|------------:|--------------|
| Full distribution  | ~84 MB        | ~260 MB     | ✅ Yes |
| **Source (this)**  | **~2 MB**     | **~260 MB** | ⚠️ Setup required |

---

## 🛠 Troubleshooting

### ❌ `Node.js not found`
1. Download and install Node.js LTS → [nodejs.org](https://nodejs.org)  
2. Restart Windows  
3. Run `SETUP.bat` again  

### ❌ `npm install failed`
- Check internet connection  
- Run Command Prompt as **Administrator**  
- Run manually:  
```bash
npm install electron --save
```

### ❌ App won’t start
- Confirm `SETUP.bat` completed successfully  
- Try `START.bat` as Administrator  
- Ensure antivirus/Defender isn’t blocking Electron  

---

## 👨‍💻 Developer Notes
- All French text/UI replaced with **English**  
- Simplified fake licence system for compatibility  
- Ideal for developers who prefer **source-first builds**  
- If redistributing, bundle a specific Electron version  

---

## 🤝 Contributing
Contributions are welcome!  
- Report bugs via [Issues](../../issues)  
- Submit features or translations via Pull Requests  

---

## 📜 Licence
This is a translated **source distribution**.  
Refer to the original project for licensing details.

---

## 📬 Contact
When asking for support, include:  
- Windows version (Settings → About)  
- Node.js version (`node -v`)  
- Full terminal logs from `npm install`  

---

> 💡 This edition is designed for **developers & maintainers** who want a lightweight, transparent setup with no bundled binaries.
