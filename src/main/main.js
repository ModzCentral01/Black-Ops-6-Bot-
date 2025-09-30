const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const SelectionWindow = require('./selectionWindow');
const MainViewWindow = require('./mainViewWindow');
const { createMainViewWindow } = require('./mainViewWindow');
const LicenseManager = require('../license/simpleLicenseManager');

// Define application icon path
const iconPath = path.join(__dirname, '../../build/icon.ico');

let selectionWindow = null;
let mainViewWindow = null;
let macroActive = false;
let macroInterval = null;
let licenseManager = null;

// Function to create application menu
function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'toggleDevTools', label: 'Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Normal Zoom' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Fullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Synchronization Panel',
          click: () => {
            if (mainViewWindow) {
              mainViewWindow.openSyncPanel();
            }
          }
        },
        {
          label: 'License Management',
          click: () => {
            if (licenseManager) {
              //licenseManager.showLicenseWindow();
            }
          }
        },
        {
          label: 'Reset License',
          click: () => {
            if (licenseManager) {
              // Clear license data
              licenseManager.store.delete('licenseKey');
              licenseManager.store.delete('licenseStatus');
              // Show confirmation message
              const resetWindow = new BrowserWindow({
                width: 300,
                height: 150,
                autoHideMenuBar: true,
                resizable: false,
                modal: true
              });
              resetWindow.loadURL(`data:text/html;charset=utf-8,
                <html>
                  <head>
                    <style>
                      body { font-family: sans-serif; padding: 20px; text-align: center; }
                      button { margin-top: 15px; padding: 8px 15px; }
                    </style>
                  </head>
                  <body>
                    <h3>License Reset</h3>
                    <p>Restart the application to apply changes.</p>
                    <button onclick="window.close()">OK</button>
                  </body>
                </html>
              `);
            }
          }
        }
      ]
    },
    {
      role: 'help',
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            // Show window with application information
            const aboutWindow = new BrowserWindow({
              width: 300,
              height: 200,
              title: 'About',
              autoHideMenuBar: true,
              resizable: false,
              webPreferences: {
                nodeIntegration: true
              }
            });
            aboutWindow.loadFile(path.join(__dirname, '../renderer/about.html'));
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createSelectionWindow() {
  selectionWindow = new SelectionWindow();
  selectionWindow.window.on('closed', () => {
    selectionWindow = null;
  });
}

// Check license before launching application
async function checkLicense() {
  // Initialize license manager if it doesn't already exist
  if (!licenseManager) {
    licenseManager = new LicenseManager();

    // 🎭 Spoof internal license status manually
    licenseManager.checkExistingLicense = () => ({
      valid: true,
      licenseKey: 'SPOOFED-KEY',
      activationDate: new Date().toISOString(),
      hardwareId: 'FAKE-HWID'
    });

    // 🧨 Optional: patch the activation function in case it's called elsewhere
    licenseManager.activateLicense = async () => ({
      valid: true,
      licenseKey: 'SPOOFED-KEY',
      activationDate: new Date().toISOString(),
      hardwareId: 'FAKE-HWID'
    });

    // Optional: patch showLicenseWindow() to avoid UI popup
    licenseManager.showLicenseWindow = async () => ({
      valid: true,
      licenseKey: 'SPOOFED-KEY',
      activationDate: new Date().toISOString(),
      hardwareId: 'FAKE-HWID'
    });
  }

  // ✅ Continue as if license is valid
  console.log('[FAKE LICENSE] Valid license simulated, starting application...');
  createSelectionWindow();
  createApplicationMenu();
  setupIPCHandlers();
}


app.whenReady().then(() => {
  // Set icon for entire application
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.getName());
  }
  
  // Check license before launching application
  checkLicense();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Check license again if no window is open
      checkLicense();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Add IPC event listeners
function setupIPCHandlers() {
  // Event to start a session
  ipcMain.on('start-session', (event, config) => {
    createMainViewWindow(config);
    selectionWindow.window.close();
  });
  
  // Event to open synchronization panel
  ipcMain.on('open-sync-panel', () => {
    if (mainViewWindow) {
      mainViewWindow.openSyncPanel();
    }
  });
  
  // Event to execute a macro
  ipcMain.on('execute-macro', (event, data) => {
    const { macroId, gameMode } = data;
    
    if (mainViewWindow) {
      // Use macroManager to execute the macro
      mainViewWindow.executeMacro(macroId, gameMode);
    }
  });
  
  // Event to receive bitrate settings
  ipcMain.on('update-bitrate-settings', (event, settings) => {
    console.log('Bitrate settings received:', settings);
    
    // Store settings in global variable for future views
    global.serverConfig = {
      region: settings.region,
      hostBitrate: settings.hostBitrate,
      playerBitrate: settings.playerBitrate
    };
    
    // Update existing views if they exist
    if (mainViewWindow && mainViewWindow.views) {
      mainViewWindow.views.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          // Determine bitrate according to view type
          const bitrate = view.viewType === 'host' ? settings.hostBitrate : settings.playerBitrate;
          
          // Send new configuration to view
          view.webContents.send('server-config', {
            region: settings.region,
            bitrate: bitrate,
            bypassRestriction: 'off'
          });
          
          console.log(`Configuration sent to view ${view.viewNumber} (${view.viewType}): bitrate=${bitrate}, region=${settings.region}`);
        }
      });
    }
  });
  
  // Event to request views state
  ipcMain.on('request-views-state', (event) => {
    if (mainViewWindow) {
      mainViewWindow.updateSyncPanel();
    }
  });
  
  // Event to synchronize views
  ipcMain.on('synchronize-views', (event, selectedIndices) => {
    if (mainViewWindow) {
      mainViewWindow.synchronizeViews(selectedIndices);
    }
  });
  
  // Events for synchronized keyboard keys
  ipcMain.on('keyboard-event', (event, keyEvent) => {
    if (mainViewWindow) {
      mainViewWindow.handleSynchronizedKeyboard(keyEvent);
    }
  });
  
  // Handle main container scrolling
  ipcMain.on('container-scrolled', (event, position) => {
    if (mainViewWindow) {
      mainViewWindow.handleContainerScroll(position);
    }
  });
  
  // Handle wheel events
  ipcMain.on('wheel-scrolled', (event, delta) => {
    if (mainViewWindow) {
      mainViewWindow.handleWheelScroll(delta);
    }
  });
  
  // Handle keyboard events for scrolling
  ipcMain.on('keyboard-scroll', (event, data) => {
    if (mainViewWindow) {
      mainViewWindow.handleKeyboardScroll(data);
    }
  });
}

ipcMain.on('sync-scroll', (event, scrollPos) => {
  if (mainViewWindow) {
    mainViewWindow.syncScroll(scrollPos);
  }
});

// Handler for key simulation macro
ipcMain.on('toggle-macro', (event, enabled) => {
  if (enabled) {
    startMacro();
  } else {
    stopMacro();
  }
});

// Function to start macro
function startMacro() {
  if (macroActive || !mainViewWindow) return;
  
  macroActive = true;
  
  // Notify interface that macro is active
  if (mainViewWindow && mainViewWindow.window) {
    mainViewWindow.window.webContents.send('macro-status-change', { enabled: true });
  }
  
  // Array of keys to simulate in rotation
  const mainKeys = ['a', 's', 'd', 'w'];
  const randomKeys = ['a', 's', 'd', 'w', 'q', 'e', 'z', 'x', 'c', 'space', 'shift', 'control'];
  let currentKeyIndex = 0;
  
  // Function to simulate main key for 500ms
  const simulateMainKey = () => {
    if (!macroActive || !mainViewWindow) return;
    
    const key = mainKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % mainKeys.length;
    
    // Simulate key press
    mainViewWindow.views.forEach(view => {
      if (!view.webContents.isDestroyed()) {
        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key });
        
        // Release key after 500ms
        setTimeout(() => {
          if (!view.webContents.isDestroyed()) {
            view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key });
          }
        }, 500);
      }
    });
  };
  
  // Function to simulate random key
  const simulateRandomKey = () => {
    if (!macroActive || !mainViewWindow) return;
    
    const key = randomKeys[Math.floor(Math.random() * randomKeys.length)];
    
    mainViewWindow.views.forEach(view => {
      if (!view.webContents.isDestroyed()) {
        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key });
        
        // Release key after 100ms
        setTimeout(() => {
          if (!view.webContents.isDestroyed()) {
            view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key });
          }
        }, 100);
      }
    });
  };
  
  // Start interval to simulate main keys
  const mainKeyInterval = setInterval(simulateMainKey, 2000); // every 2 seconds
  
  // Start interval to simulate random keys
  const randomKeyInterval = setInterval(simulateRandomKey, 1000); // every 1 second
  
  macroInterval = {
    mainKeyInterval,
    randomKeyInterval
  };
}

// Function to stop macro
function stopMacro() {
  if (!macroActive) return;
  
  macroActive = false;
  
  // Notify interface that macro is inactive
  if (mainViewWindow && mainViewWindow.window) {
    mainViewWindow.window.webContents.send('macro-status-change', { enabled: false });
  }
  
  // Stop intervals
  if (macroInterval) {
    if (macroInterval.mainKeyInterval) clearInterval(macroInterval.mainKeyInterval);
    if (macroInterval.randomKeyInterval) clearInterval(macroInterval.randomKeyInterval);
    macroInterval = null;
  }
} 