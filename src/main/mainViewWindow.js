const { BrowserWindow, BrowserView, ipcMain, app, globalShortcut, Menu } = require('electron');
const path = require('path');
const { FullScreenSpooferScript } = require('./fullscreenSpoofer');
const fs = require('fs');
const url = require('url');
const MacroManager = require('./macro');

// Script to simulate that window is always active
const AlwaysActiveWindowScript = `
  // Replace document.hasFocus() to always return true
  const originalHasFocus = document.hasFocus;
  document.hasFocus = function() { return true; };
  
  // Define document.visibilityState as always "visible"
  Object.defineProperty(document, 'visibilityState', {
    get: function() { return 'visible'; }
  });
  
  // Define document.hidden as always false
  Object.defineProperty(document, 'hidden', {
    get: function() { return false; }
  });
  
  // Handle document visibility events
  const fireVisibilityChange = (type) => {
    const evt = new Event('visibilitychange');
    document.dispatchEvent(evt);
  };
  
  // Intercept blur events and simulate focus
  window.addEventListener('blur', function(e) {
    setTimeout(() => {
      const focusEvent = new FocusEvent('focus');
      window.dispatchEvent(focusEvent);
      document.dispatchEvent(focusEvent);
      if (document.activeElement && document.activeElement.blur) {
        const focusedElement = document.activeElement;
        focusedElement.dispatchEvent(focusEvent);
      }
    }, 0);
  }, true);
  
  // Function to ensure videos continue playing
  const keepVideosPlaying = () => {
    document.querySelectorAll('video, audio').forEach(media => {
      if (media.paused && !media.ended && media.autoplay !== false) {
        media.play().catch(e => {});
      }
    });
  };
  
  // Periodically check media that might have been paused
  setInterval(keepVideosPlaying, 1000);
  
  // CSS styles to maintain active appearance
  const styleElement = document.createElement('style');
  styleElement.textContent = \`
    /* Prevent elements from changing appearance when window is inactive */
    :root, body, * {
      opacity: 1 !important;
      filter: none !important;
      animation-play-state: running !important;
      transition-property: none important;
    }
    
    /* Ensure videos and animations keep full visibility */
    video, audio, canvas, iframe {
      opacity: 1 !important;
    }
    
    /* Remove specific filters that might be applied in inactive mode */
    *:not(:focus-within) {
      filter: none !important;
    }
  \`;
  document.head.appendChild(styleElement);
  
  console.log('[AlwaysActiveWindow] Module enabled');
`;

class MainViewWindow {
  constructor(config) {
    // Define icon path
    const iconPath = path.join(__dirname, '../../build/icon.ico');

    this.config = config;
    this.views = [];
    this.scrollPosition = { x: 0, y: 0 };
    this.lastScrollUpdateTime = 0;
    this.isScrolling = false;
    this.scrollTimeout = null;
    this.viewsVisibility = new Map(); // To keep track of visible views
    this.fullscreenView = null; // To track fullscreen view
    
    // Define control bar heights from initialization
    this.controlBarHeight = 40;
    this.gameControlBarHeight = 30;
    this.totalControlBarHeight = this.controlBarHeight + this.gameControlBarHeight;
    
    // Initialize number of views per row based on mode
    this.viewsPerRow = config.mode === 'multiplayer' ? 5 : 4;
    
    // Initialize synchronization configuration
    this.syncConfig = {
      groups: [],
      lastActive: null
    };
    
    // Initialize macro manager
    this.macroManager = new MacroManager(this);
    
    // Add property to track random movement macro state
    this.randomMovementActive = false;
    
    // Add properties to manage random movement timeouts
    this.randomMovementTimeouts = [];
    this.randomMovementIntervalId = null;
    
    // Add properties for synchronized movements
    this.centralMovementController = {
      isRunning: false,
      currentSequence: [],
      currentIndex: 0,
      lastDirection: null,
      recentMoves: [],
      timeoutIds: []
    };
    
    // Create main window
    this.window = new BrowserWindow({
      width: 1600,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Multi-View Browser',
      show: false,
      backgroundColor: '#000000',
      icon: iconPath
    });

    // Load base page
    this.window.loadFile(path.join(__dirname, '../renderer/main.html'));
    
    // Create game mode specific control bar
    this.gameControlBar = null;
    
    this.window.once('ready-to-show', () => {
      this.window.show();
      this.setupBrowserViews();
      this.createGameControlBar();
      this.setupScrollListeners();
      // Initialize default synchronization group
      this.initDefaultSyncGroup();
    });

    // Handle window resizing
    this.window.on('resize', () => {
      this.resizeViews();
      this.updateViewsVisibility();
      if (this.gameControlBar) {
        this.positionGameControlBar();
      }
    });
    
    // Configure IPC handlers
    this.setupIpcHandlers();

    // Add new property for synchronization window
    this.syncWindow = null;
    
    // Load server settings from localStorage
    this.loadServerSettings();
  }
  
  // Method to load server settings from localStorage
  loadServerSettings() {
    console.log('Loading server settings');
    
    // Default settings
    global.serverConfig = {
      region: 'default',
      bypassRestriction: 'off',
      hostBitrate: 5000000,
      playerBitrate: 500000,
      resolution: '720p'
    };
    
    // Ask render process to retrieve settings from localStorage
    this.window.webContents.once('did-finish-load', () => {
      this.window.webContents.executeJavaScript(`
        (function() {
          try {
            const betterXcloudSettings = localStorage.getItem('BetterXcloud');
            if (betterXcloudSettings) {
              console.log('BetterXcloud settings found:', betterXcloudSettings);
              return betterXcloudSettings;
            }
            return null;
          } catch(err) {
            console.error('Error retrieving settings:', err);
            return null;
          }
        })()
      `).then(result => {
        if (result) {
          try {
            const settings = JSON.parse(result);
            console.log('Settings loaded:', settings);
            
            // Update server configuration
            if (settings["server.region"]) {
              global.serverConfig.region = settings["server.region"];
            }
            
            if (settings["server.bypassRestriction"]) {
              global.serverConfig.bypassRestriction = settings["server.bypassRestriction"];
            }
            
            // Get video resolution
            if (settings["stream.video.resolution"]) {
              global.serverConfig.resolution = settings["stream.video.resolution"];
            }
            
            // Get bitrate values
            if (settings["host.bitrate"]) {
              global.serverConfig.hostBitrate = settings["host.bitrate"];
            }
            
            if (settings["player.bitrate"]) {
              global.serverConfig.playerBitrate = settings["player.bitrate"];
            }
            
            console.log('Server configuration updated:', global.serverConfig);
          } catch (error) {
            console.error('Error parsing settings:', error);
          }
        } else {
          console.log('No BetterXcloud settings found, using default values');
        }
      }).catch(err => {
        console.error('Error executing settings retrieval script:', err);
      });
    });
  }
  
  // Initialize default synchronization group
  initDefaultSyncGroup() {
    console.log('Initializing default synchronization group');
    
    // Create default group with all views
    const allViewIndices = this.views.map(view => view.viewIndex);
    
    if (allViewIndices.length > 0) {
      // Create new default group
      const defaultGroup = {
        id: 'default',
        name: 'Default Group',
        views: allViewIndices,
        active: true
      };
      
      // Add group to configuration
      this.syncConfig.groups = [defaultGroup];
      this.syncConfig.lastActive = 'default';
      
      // Mark all views as synchronized
      this.views.forEach(view => {
        view.isSynchronized = true;
      });
      
      console.log(`Default group created with ${allViewIndices.length} views`);
    } else {
      console.warn('No views available to create default group');
    }
  }
  
  // Create game mode specific control bar
  createGameControlBar() {
    const { mode } = this.config;
    
    // Determine which HTML file to use based on mode
    let controlBarPath;
    
    if (mode === 'warzone') {
      controlBarPath = path.join(__dirname, '../renderer/controlbarWarzone.html');
    } else {
      // For multiplayer and cdl, use same bar but with different parameter
      controlBarPath = path.join(__dirname, '../renderer/controlbarMultiplayer.html');
    }
    
    // Create BrowserView for control bar
    this.gameControlBar = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'controlBarPreload.js')
      }
    });
    
    this.window.addBrowserView(this.gameControlBar);
    
    // Load appropriate HTML file with mode as parameter
    this.gameControlBar.webContents.loadFile(controlBarPath, { 
      search: `mode=${this.config.mode}` 
    });
    
    // Position control bar
    this.positionGameControlBar();
  }
  
  // Position game control bar
  positionGameControlBar() {
    if (!this.gameControlBar) return;
    
    const { width } = this.window.getContentBounds();
    
    this.gameControlBar.setBounds({
      x: 0,
      y: this.controlBarHeight,
      width: width,
      height: this.gameControlBarHeight
    });
  }
  
  // Configure IPC handlers for renderer communication
  setupIpcHandlers() {
    console.log('Configuring IPC handlers for scrolling');
    
    ipcMain.on('container-scrolled', (event, position) => {
      console.log('container-scrolled event received:', position);
      this.throttledUpdateViewPositions(position);
    });
    
    ipcMain.on('wheel-scrolled', (event, delta) => {
      console.log('wheel-scrolled event received:', delta);
      this.handleWheelScroll(delta);
    });
    
    ipcMain.on('keyboard-scroll', (event, data) => {
      console.log('keyboard-scroll event received:', data);
      this.handleKeyboardScroll(data);
    });
    
    // Handler for 'execute-macro' event
    ipcMain.on('execute-macro', (event, data) => {
      console.log('Macro execution request:', data);
      
      // Use macro manager
      this.macroManager.executeMacro(data.macroId, data.gameMode);
    });
    
    // Handler for 'open-sync-panel' event
    ipcMain.on('open-sync-panel', () => {
      this.openSyncPanel();
    });
    
    // Handler for 'open-macro-panel' event
    ipcMain.on('open-macro-panel', (event, gameMode) => {
      // If game mode is specified, temporarily update configuration
      if (gameMode) {
        const savedMode = this.config.mode;
        this.config.mode = gameMode;
        this.openMacroPanel();
        this.config.mode = savedMode;
      } else {
        this.openMacroPanel();
      }
    });
    
    // Handler for 'open-settings' event
    ipcMain.on('open-settings', () => {
      this.openSettings();
    });
    
    // Handler for 'reload-view' event
    ipcMain.on('reload-view', (event, viewId) => {
      console.log(`View reload request for view ${viewId}`);
      
      // Check if view ID is valid
      if (viewId >= 0 && viewId < this.views.length) {
        const view = this.views[viewId];
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          console.log(`Reloading view ${viewId} (${view.viewType} ${view.viewNumber})`);
          view.webContents.reload();
        } else {
          console.log(`View ${viewId} is not valid or is destroyed`);
        }
      } else {
        console.log(`Invalid view ID: ${viewId}`);
      }
    });
    
    // Handler for 'toggle-view-fullscreen' event
    ipcMain.on('toggle-view-fullscreen', (event, viewId) => {
      console.log(`Toggling fullscreen mode for view ${viewId}`);
      
      // Check if view ID is valid
      if (viewId >= 0 && viewId < this.views.length) {
        const view = this.views[viewId];
        this.toggleViewFullscreen(view);
      }
    });
    
    // Handler for 'open-view-devtools' event
    ipcMain.on('open-view-devtools', (event, viewId) => {
      console.log(`Opening DevTools for view ${viewId}`);
      
      // Check if view ID is valid
      if (viewId >= 0 && viewId < this.views.length) {
        const view = this.views[viewId];
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });
    
    // Handler for 'close-current-window' event
    ipcMain.on('close-current-window', () => {
      console.log('Window close request received');
      // Close settings window if it exists
      if (this.settingsWindow) {
        console.log('Closing settings window');
        this.settingsWindow.close();
        this.settingsWindow = null;
        
        // Reload settings and update existing views
        this.reloadSettingsAndUpdateViews();
      }
    });
    
    // Handler for 'request-views-state'
    ipcMain.on('request-views-state', (event) => {
      this.updateSyncPanel();
    });
    
    // Handler for 'request-macros'
    ipcMain.on('request-macros', (event, gameMode) => {
      // In a future version, we could dynamically load macros from configuration
      // For now, we do nothing as macros are defined client-side
      console.log(`Request to load macros for mode: ${gameMode}`);
    });
    
    // Gestionnaire pour synchroniser les vues
    ipcMain.on('synchronize-views', (event, selectedIndices) => {
      this.synchronizeViews(selectedIndices);
    });
    
    // Gestionnaire d'événements clavier
    ipcMain.on('keyboard-event', (event, keyEvent) => {
      // Propager l'événement clavier aux vues synchronisées
      this.handleKeyboardEvent(keyEvent);
    });
  }

  // Add this method to check if a view is visible
  isViewVisible(view) {
    // Check if view exists in our collection
    const index = this.views.indexOf(view);
    if (index === -1) return false;
    
    // Use visibility Map to determine if view is visible
    return this.viewsVisibility.get(index) === true;
  }

  // Améliorer la méthode stopRandomMovements pour arrêter tous les mouvements
  stopRandomMovements() {
    console.log('Arrêt des mouvements aléatoires');
    
    // Désactiver le flag de la macro
    this.randomMovementActive = false;
    
    // Arrêter tous les mouvements synchronisés
    this.stopAllSynchronizedMovements();
    
    console.log('Tous les mouvements aléatoires ont été arrêtés avec succès');
  }

  // Enhanced method to synchronize views with movement state management
  synchronizeViews(selectedIndices) {
    // Save currently synchronized views for comparison
    const previouslySynchronized = this.views.filter(v => v.isSynchronized).map(v => v.viewIndex);
    
    // Reset synchronization state
    this.views.forEach(view => {
      view.isSynchronized = false;
    });

    // Mark selected views as synchronized
    selectedIndices.forEach(index => {
      const view = this.views.find(v => v.viewIndex === index);
      if (view) {
        view.isSynchronized = true;
      }
    });

    // Update synchronization configuration
    if (selectedIndices.length > 0) {
      const existingDefaultGroup = this.syncConfig.groups.find(g => g.id === 'default');
      
      if (existingDefaultGroup) {
        // Update existing group
        existingDefaultGroup.views = selectedIndices;
        existingDefaultGroup.active = true;
      } else {
        // Create new group
        const newGroup = {
          id: 'default',
          name: 'Default Group',
          views: selectedIndices,
          active: true
        };
        
        // Reset groups and add new one
        this.syncConfig.groups = [newGroup];
        this.syncConfig.lastActive = 'default';
      }
    }
    
    // Si la macro de mouvements est active
    if (this.randomMovementActive) {
      // Trouver les vues qui ont été désynchronisées
      const desynchronizedViews = previouslySynchronized.filter(index => !selectedIndices.includes(index));
      
      // Arrêter les mouvements dans ces vues spécifiquement
      desynchronizedViews.forEach(index => {
        const view = this.views.find(v => v.viewIndex === index);
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          console.log(`Arrêt des mouvements pour la vue désynchronisée ${view.viewNumber}`);
          view.webContents.executeJavaScript(`
            if (typeof window.clearRandomMovements === 'function') {
              window.clearRandomMovements();
              console.log('Mouvements arrêtés suite à la désynchronisation');
            }
          `).catch(err => {
            console.log(`Erreur lors de l'arrêt des mouvements dans la vue ${view.viewNumber}:`, err.message);
          });
        }
      });
      
      // Si de nouvelles vues ont été synchronisées
      const newlySynchronized = selectedIndices.filter(index => !previouslySynchronized.includes(index));
      
      if (newlySynchronized.length > 0) {
        console.log(`${newlySynchronized.length} nouvelles vues synchronisées, injection de l'état actuel de mouvements`);
        
        // Injecter l'état de mouvement actuel dans les nouvelles vues
        newlySynchronized.forEach(index => {
          const view = this.views.find(v => v.viewIndex === index);
          if (view) {
            this.injectCurrentMovementState(view);
          }
        });
      }
    }

    this.updateSyncPanel();
  }
  
  // Méthode pour arrêter tous les mouvements dans toutes les vues
  stopAllSynchronizedMovements() {
    console.log('Arrêt de tous les mouvements synchronisés');
    
    // Arrêter le contrôleur central
    this.centralMovementController.isRunning = false;
    
    // Nettoyer tous les timeouts centraux
    if (this.centralMovementController.timeoutIds.length > 0) {
      this.centralMovementController.timeoutIds.forEach(id => clearTimeout(id));
      this.centralMovementController.timeoutIds = [];
    }
    
    // Nettoyer les autres timeouts et intervalles
    if (this.randomMovementTimeouts && this.randomMovementTimeouts.length > 0) {
      this.randomMovementTimeouts.forEach(id => clearTimeout(id));
      this.randomMovementTimeouts = [];
    }
    
    if (this.randomMovementIntervalId) {
      clearInterval(this.randomMovementIntervalId);
      this.randomMovementIntervalId = null;
    }
    
    // Réinitialiser l'état du contrôleur
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.currentSequence = [];
    
    // Arrêter les mouvements dans chaque vue
    const synchronizedViews = this.getAllSynchronizedViews();
    synchronizedViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.executeJavaScript(`
          if (typeof window.clearRandomMovements === 'function') {
            window.clearRandomMovements();
          }
        `).catch(() => {});
      }
    });
    
    // Relâcher toutes les touches dans chaque vue
    this.views.forEach(view => this.releaseAllKeysInView(view));
  }
  
  // Méthode pour relâcher toutes les touches dans une vue
  releaseAllKeysInView(view) {
    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      return;
    }
    
    try {
      const releaseScript = `
        (function() {
          try {
            console.log('Relâchement de toutes les touches');
            
            // Liste de toutes les touches à relâcher (en QWERTY)
            const keysToRelease = ['w', 'a', 's', 'd', ' '];
            
            // Créer et dispatcher les événements keyup pour chaque touche
            keysToRelease.forEach(key => {
              try {
                if (window.releaseKey) {
                  window.releaseKey(key);
                } else {
                  const code = key === ' ' ? 'Space' : 'Key' + key.toUpperCase();
                  const keyCode = key === ' ' ? 32 : key.toUpperCase().charCodeAt(0);
                  
                  const keyEvent = new KeyboardEvent('keyup', {
                    key: key,
                    code: code,
                    keyCode: keyCode,
                    which: keyCode,
                    bubbles: true,
                    cancelable: true
                  });
                  
                  document.dispatchEvent(keyEvent);
                }
              } catch (keyErr) {
                console.error('Erreur lors du relâchement de ' + key + ':', keyErr);
              }
            });
            
            if (window._gameKeyHandlers && typeof window._gameKeyHandlers.clearAllKeys === 'function') {
              window._gameKeyHandlers.clearAllKeys();
            }
            
            return "Toutes les touches relâchées";
          } catch (e) {
            console.error('Erreur générale lors du relâchement des touches:', e);
            return "Erreur: " + e.message;
          }
        })();
      `;
      
      view.webContents.executeJavaScript(releaseScript).catch(() => {});
    } catch (e) {
      console.error(`Erreur générale pour la vue ${view.viewNumber}:`, e);
    }
  }
  
  // Méthode pour injecter l'état actuel de mouvement dans une vue nouvellement synchronisée
  injectCurrentMovementState(view) {
    if (!view || !view.webContents || view.webContents.isDestroyed() || !view.isSynchronized || !this.randomMovementActive) {
      return;
    }
    
    console.log(`Injection de l'état de mouvement actuel dans la vue ${view.viewNumber}`);
    
    // Si le contrôleur central est déjà en cours d'exécution, injecter le script avec l'état actuel
    if (this.centralMovementController.isRunning) {
      const currentState = JSON.stringify({
        lastDirection: this.centralMovementController.lastDirection,
        recentMoves: this.centralMovementController.recentMoves,
        currentIndex: this.centralMovementController.currentIndex
      });
      
      const initScript = `
        window.SYNC_STATE = ${currentState};
        console.log('État de synchronisation reçu:', window.SYNC_STATE);
      `;
      
      view.webContents.executeJavaScript(initScript)
        .then(() => {
          // Une fois l'état injecté, démarrer le script de mouvements
          this.executeDirectMovementScript(view, true);
        })
        .catch(err => {
          console.error(`Erreur lors de l'injection de l'état dans la vue ${view.viewNumber}:`, err);
          // En cas d'erreur, essayer quand même de démarrer le script sans état
          this.executeDirectMovementScript(view, false);
        });
    } else {
      // Si le contrôleur n'est pas en cours d'exécution, simplement démarrer le script
      this.executeDirectMovementScript(view, false);
    }
  }
  
  // Méthode améliorée pour exécuter un script de mouvements direct avec synchronisation
  executeDirectMovementScript(view, joinExisting = false) {
    if (!view || !view.webContents || view.webContents.isDestroyed() || !view.isSynchronized || !this.randomMovementActive) {
      return;
    }
    
    console.log(`Exécution d'un script de mouvement pour la vue ${view.viewNumber}${joinExisting ? ' (rejoignant une séquence existante)' : ''}`);
    
    // Script complet de mouvements aléatoires à injecter dans la vue, modifié pour utiliser les mouvements synchronisés
    const scriptContents = `
      (function() {
        console.log("Démarrage du script de mouvements synchronisés");
        
        // Constantes et variables - en QWERTY (WASD)
        const KEYS = {
          FORWARD: 'w',    // Avancer (W en QWERTY)
          LEFT: 'a',       // Gauche (A en QWERTY)
          BACKWARD: 's',   // Reculer (S en QWERTY)
          RIGHT: 'd',      // Droite (D en QWERTY)
          JUMP: ' '        // Saut (Espace)
        };
        
        // Directions possibles
        const DIRECTIONS = [
          [KEYS.FORWARD],     // Avant
          [KEYS.LEFT],        // Gauche
          [KEYS.BACKWARD],    // Arrière
          [KEYS.RIGHT],       // Droite
          [KEYS.FORWARD, KEYS.LEFT],  // Diagonale avant-gauche
          [KEYS.FORWARD, KEYS.RIGHT], // Diagonale avant-droite
          [KEYS.BACKWARD, KEYS.LEFT], // Diagonale arrière-gauche
          [KEYS.BACKWARD, KEYS.RIGHT] // Diagonale arrière-droite
        ];
        
        // Variables d'état local
        let isRunning = true;
        const timeoutIds = [];
        
        // Récupérer l'état synchronisé s'il existe
        const syncState = window.SYNC_STATE || { 
          lastDirection: null,
          recentMoves: [],
          currentIndex: 0
        };
        
        console.log("État initial:", syncState);
        
        // Fonction pour envoyer l'état au processus principal
        function sendStateToMain(state) {
          if (window.electronAPI && window.electronAPI.updateMovementState) {
            window.electronAPI.updateMovementState(state);
          }
        }
        
        // Fonction pour recevoir l'état du processus principal
        function listenForStateUpdates() {
          if (window.electronAPI && window.electronAPI.onMovementStateUpdate) {
            window.electronAPI.onMovementStateUpdate((state) => {
              Object.assign(syncState, state);
              console.log("État mis à jour depuis le processus principal:", syncState);
            });
          }
        }
        
        // Fonction pour appuyer sur une touche
        function pressKey(key) {
          if (!isRunning) return false;
          try {
            console.log('Appui sur ' + key);
            
            if (window.pressKey) {
              return window.pressKey(key);
            } else {
              const event = new KeyboardEvent('keydown', {
                key: key,
                code: key === ' ' ? 'Space' : 'Key' + key.toUpperCase(),
                keyCode: key === ' ' ? 32 : key.toUpperCase().charCodeAt(0),
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(event);
              if (document.activeElement) {
                document.activeElement.dispatchEvent(event);
              }
              window.dispatchEvent(event);
              return true;
            }
          } catch(e) {
            console.error('Erreur lors de l\\'appui sur ' + key, e);
            return false;
          }
        }
        
        // Fonction pour relâcher une touche
        function releaseKey(key) {
          try {
            console.log('Relâchement de ' + key);
            
            if (window.releaseKey) {
              return window.releaseKey(key);
            } else {
              const event = new KeyboardEvent('keyup', {
                key: key,
                code: key === ' ' ? 'Space' : 'Key' + key.toUpperCase(),
                keyCode: key === ' ' ? 32 : key.toUpperCase().charCodeAt(0),
                bubbles: true,
                cancelable: true
              });
              document.dispatchEvent(event);
              if (document.activeElement) {
                document.activeElement.dispatchEvent(event);
              }
              window.dispatchEvent(event);
              return true;
            }
          } catch(e) {
            console.error('Erreur lors du relâchement de ' + key, e);
            return false;
          }
        }
        
        // Fonction pour recevoir et exécuter une action de mouvement
        window.executeMovementAction = function(action) {
          // Envelopper dans une promesse qui se résout immédiatement
          return new Promise((resolve, reject) => {
            try {
              if (!isRunning) {
                console.log('Impossible d\\'exécuter l\\'action: script arrêté');
                resolve(false);
                return;
              }
              
              console.log('Exécution de l\\'action:', action);
              
              // Si c'est un saut
              if (action.type === 'jump') {
                const success = pressKey(KEYS.JUMP);
                
                if (success) {
                  const jumpReleaseId = setTimeout(() => {
                    releaseKey(KEYS.JUMP);
                  }, action.duration || 200);
                  
                  timeoutIds.push(jumpReleaseId);
                  resolve(true);
                } else {
                  console.error('Échec de l\\'appui sur espace');
                  resolve(false);
                }
                return;
              }
              
              // Si c'est un mouvement directionnel
              if (action.type === 'move') {
                // Appliquer toutes les touches de direction
                const allPressed = action.keys.every(key => pressKey(key));
                
                if (allPressed) {
                  // Planifier le relâchement
                  const releaseId = setTimeout(() => {
                    // Relâcher toutes les touches
                    action.keys.forEach(key => releaseKey(key));
                    
                    // Si correction nécessaire
                    if (action.correction) {
                      setTimeout(() => {
                        const correctionPressed = pressKey(action.correction);
                        
                        if (correctionPressed) {
                          const correctionReleaseId = setTimeout(() => {
                            releaseKey(action.correction);
                          }, action.correctionDuration || 300);
                          
                          timeoutIds.push(correctionReleaseId);
                        }
                      }, 30);
                    }
                  }, action.duration || 200);
                  
                  timeoutIds.push(releaseId);
                  resolve(true);
                } else {
                  console.error('Échec de l\\'appui sur certaines touches');
                  resolve(false);
                }
                return;
              }
              
              console.error('Type d\\'action non reconnue:', action.type);
              resolve(false);
            } catch (error) {
              console.error('Erreur lors de l\\'exécution de l\\'action:', error);
              reject(error);
            }
          });
        };
        
        // Fonction pour arrêter tous les mouvements
        window.clearRandomMovements = function() {
          isRunning = false;
          
          // Nettoyer tous les timeouts
          timeoutIds.forEach(id => clearTimeout(id));
          timeoutIds.length = 0;
          
          // Relâcher toutes les touches possibles
          Object.values(KEYS).forEach(key => {
            releaseKey(key);
          });
          
          console.log('Mouvements aléatoires arrêtés');
        };
        
        // Initialiser l'écoute des mises à jour d'état
        listenForStateUpdates();
        
        // Si on rejoint une séquence existante, on n'a pas besoin de démarrer les sauts
        if (${joinExisting}) {
          console.log("Rejoindre la séquence existante sans initialiser de nouveaux mouvements");
        }
        
        return "Script de mouvements synchronisés démarré";
      })();
    `;
    
    // Exécuter le script dans la vue
    view.webContents.executeJavaScript(scriptContents)
      .then(result => {
        console.log(`Résultat du script pour vue ${view.viewNumber}:`, result);
        
        // Si c'est une nouvelle séquence (pas de joinExisting), démarrer la séquence centrale si ce n'est pas déjà fait
        if (!joinExisting && this.centralMovementController.isRunning && this.centralMovementController.currentIndex === 0) {
          this.startCentralMovementSequence();
        }
      })
      .catch(err => {
        console.error(`Erreur lors de l'exécution du script pour vue ${view.viewNumber}:`, err);
      });
  }
  
  // Méthode pour exécuter la séquence de sauts initiale
  executeJumpSequence(jumpIndex) {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log(`Exécution du saut ${jumpIndex+1}/3`);
    
    // Envoyer la commande de saut à toutes les vues synchronisées
    const jumpAction = {
      type: 'jump',
      duration: 200
    };
    
    this.executeActionOnAllSynchronizedViews(jumpAction);
    
    // Continuer avec le prochain saut ou passer aux mouvements
    if (jumpIndex < 2) {
      const nextJumpId = setTimeout(() => {
        this.executeJumpSequence(jumpIndex + 1);
      }, 500);
      
      this.centralMovementController.timeoutIds.push(nextJumpId);
    } else {
      // Passer aux mouvements aléatoires après les 3 sauts
      const startMovementsId = setTimeout(() => {
        this.executeRandomMovement();
      }, 800);
      
      this.centralMovementController.timeoutIds.push(startMovementsId);
    }
  }
  
  // Méthode pour exécuter un mouvement aléatoire
  executeRandomMovement() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    // Directions possibles (comme dans le script injecté) - en QWERTY (WASD)
    const directions = [
      ['w'],     // Avant (W en QWERTY)
      ['a'],     // Gauche (A en QWERTY)
      ['s'],     // Arrière (S en QWERTY)
      ['d'],     // Droite (D en QWERTY)
      ['w', 'a'], // Diagonale avant-gauche
      ['w', 'd'], // Diagonale avant-droite
      ['s', 'a'], // Diagonale arrière-gauche
      ['s', 'd']  // Diagonale arrière-droite
    ];
    
    const maxRecentMoves = 5;
    
    try {
      // 1. Choisir une direction, en évitant la dernière utilisée
      const availableDirections = directions.filter(dir => 
        !this.centralMovementController.lastDirection || 
        JSON.stringify(dir) !== JSON.stringify(this.centralMovementController.lastDirection)
      );
      
      // Éviter aussi les mouvements récents
      const nonRecentDirections = availableDirections.filter(dir => 
        !this.centralMovementController.recentMoves.some(recent => JSON.stringify(dir) === JSON.stringify(recent)))
      
      // Utiliser les directions non récentes si possible, sinon toutes les directions disponibles
      const directionPool = nonRecentDirections.length > 0 ? nonRecentDirections : availableDirections;
      
      let directionKeys = directionPool[Math.floor(Math.random() * directionPool.length)];
      
      // 2. Déterminer la durée du mouvement (entre 50ms et 1500ms)
      let duration = Math.floor(Math.random() * 1450 + 50);
      
      // 3. Si le mouvement avant ('w') est choisi, 50% de chance de le remplacer par arrière ('s')
      let correctionKey = null;
      let correctionDuration = 0;
      
      if (directionKeys.includes('w') && Math.random() < 0.5) {
        // Passer à 's' et augmenter légèrement la durée
        directionKeys = ['s'];
        duration += Math.floor(Math.random() * 300 + 200); // +200-500ms
        
        // Ajouter une correction 'w'
        correctionKey = 'w';
        correctionDuration = duration + 100; // +0.1s
      }
      
      // 4. Créer l'action
      const moveAction = {
        type: 'move',
        keys: directionKeys,
        duration: duration,
        correction: correctionKey,
        correctionDuration: correctionDuration
      };
      
      // 5. Exécuter l'action sur toutes les vues
      this.executeActionOnAllSynchronizedViews(moveAction);
      
      // 6. Mettre à jour l'historique des mouvements
      this.centralMovementController.recentMoves.push(directionKeys);
      if (this.centralMovementController.recentMoves.length > maxRecentMoves) {
        this.centralMovementController.recentMoves.shift();
      }
      this.centralMovementController.lastDirection = directionKeys;
      
      // 7. Planifier le prochain mouvement avec un délai aléatoire (500-1000ms)
      const totalDuration = duration + (correctionKey ? 30 + correctionDuration : 0);
      const nextDelay = totalDuration + Math.floor(Math.random() * 500 + 500);
      
      const timerId = setTimeout(() => {
        this.executeRandomMovement();
      }, nextDelay);
      
      this.centralMovementController.timeoutIds.push(timerId);
      
    } catch (error) {
      console.error('Erreur dans le mouvement aléatoire central:', error);
      
      // En cas d'erreur, essayer de continuer après un délai
      const errorRecoveryId = setTimeout(() => {
        this.executeRandomMovement();
      }, 2000);
      
      this.centralMovementController.timeoutIds.push(errorRecoveryId);
    }
  }
  
  // Méthode pour démarrer et contrôler la séquence de mouvements centrale
  startCentralMovementSequence() {
    if (!this.randomMovementActive || !this.centralMovementController.isRunning) {
      return;
    }
    
    console.log('Démarrage de la séquence de mouvements centrale');
    
    // Réinitialiser l'état du contrôleur
    this.centralMovementController.currentIndex = 0;
    this.centralMovementController.lastDirection = null;
    this.centralMovementController.recentMoves = [];
    
    // Commencer par 3 sauts
    this.executeJumpSequence(0);
  }

  // Exécuter une action sur toutes les vues synchronisées
  executeActionOnAllSynchronizedViews(action) {
    const synchronizedViews = this.getAllSynchronizedViews();
    
    synchronizedViews.forEach(view => {
      if (view.webContents && !view.webContents.isDestroyed()) {
        try {
          // Convertir l'action en JSON et échapper les caractères spéciaux
          const actionJSON = JSON.stringify(action).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          
          // Script sécurisé qui garantit que executeMovementAction est disponible
          const safeScript = `
            (function() {
              try {
                if (typeof window.executeMovementAction === 'function') {
                  return window.executeMovementAction(${actionJSON});
                } else {
                  console.error('executeMovementAction n\\'est pas disponible dans cette vue');
                  return false;
                }
              } catch (err) {
                console.error('Erreur lors de l\\'exécution de l\\'action:', err);
                return false;
              }
            })();
          `;
          
          // Exécuter le script de manière sécurisée
          view.webContents.executeJavaScript(safeScript)
            .then(result => {
              if (!result) {
                console.log(`Action non exécutée dans la vue ${view.viewNumber}, fonction non disponible`);
              }
            })
            .catch(err => {
              console.error(`Erreur lors de l'exécution de l'action dans la vue ${view.viewNumber}:`, err);
            });
        } catch (e) {
          console.error(`Erreur lors de la préparation de l'action pour la vue ${view.viewNumber}:`, e);
        }
      }
    });
  }

  // Ajouter une méthode pour ouvrir le panneau de synchronisation
  openSyncPanel() {
    if (this.syncWindow) {
      this.syncWindow.focus();
      return;
    }

    // Obtenir les dimensions de l'écran principal
    const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    
    // Calculer la largeur en fonction de la résolution
    // 350px pour 1920px de large (1080p)
    const panelWidth = Math.round((350 * screenWidth) / 1920);
    
    // Hauteur fixe pour le panneau
    const panelHeight = 800;

    this.syncWindow = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      title: 'Panneau de Synchronisation',
      icon: path.join(__dirname, '../renderer/assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'syncPanelPreload.js')
      }
    });

    this.syncWindow.loadFile(path.join(__dirname, '../renderer/syncPanel.html'));

    this.syncWindow.on('closed', () => {
      this.syncWindow = null;
    });

    // Mettre à jour le panneau quand l'état change
    this.updateSyncPanel();
  }

  // Ajouter une méthode pour ouvrir le panneau de macros
  openMacroPanel() {
    if (this.macroWindow) {
      this.macroWindow.focus();
      return;
    }

    // Obtenir les dimensions de l'écran principal
    const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    
    // Calculer la largeur en fonction de la résolution
    const panelWidth = Math.round((400 * screenWidth) / 1920);
    
    // Hauteur fixe pour le panneau
    const panelHeight = 600;

    this.macroWindow = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      title: 'Panneau de Macros',
      icon: path.join(__dirname, '../renderer/assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'macroPanelPreload.js')
      }
    });

    // Passer le mode de jeu actuel dans les paramètres d'URL
    this.macroWindow.loadFile(path.join(__dirname, '../renderer/macroPanel.html'), {
      query: { mode: this.config.mode }
    });

    this.macroWindow.on('closed', () => {
      this.macroWindow = null;
    });
  }

  // Ajouter une méthode pour ouvrir la page des paramètres
  openSettings() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return;
    }

    // Obtenir les dimensions de l'écran principal
    const { width: screenWidth } = require('electron').screen.getPrimaryDisplay().workAreaSize;
    
    // Calculer la largeur en fonction de la résolution
    const panelWidth = Math.round((500 * screenWidth) / 1920);
    
    // Hauteur fixe pour le panneau
    const panelHeight = 400;

    this.settingsWindow = new BrowserWindow({
      width: panelWidth,
      height: panelHeight,
      title: 'Paramètres du Serveur',
      icon: path.join(__dirname, '../renderer/assets/icons/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    this.settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });
  }

  // Mettre à jour les données du panneau de synchronisation
  updateSyncPanel() {
    if (!this.syncWindow) return;

    const viewsData = {
      viewsPerRow: this.viewsPerRow,
      views: this.views.map((view, index) => ({
        index: view.viewIndex,
        type: view.viewType,
        number: view.viewNumber,
        isSynchronized: view.isSynchronized
      }))
    };

    this.syncWindow.webContents.send('views-update', viewsData);
  }

  // Ajouter la méthode manquante pour mettre à jour le statut visuel de la macro
  updateControlBarMacroStatus(macroNumber, isActive) {
    // Vérifier si la barre de contrôle existe
    if (!this.gameControlBar || !this.gameControlBar.webContents) {
      console.log('Barre de contrôle non disponible pour mise à jour');
      return;
    }
    
    // Envoyer l'état de la macro à la barre de contrôle du jeu
    this.gameControlBar.webContents.send('macro-status', {
      macroId: `macro${macroNumber}`,
      running: isActive,
      timestamp: Date.now()
    });
    
    console.log(`Macro ${macroNumber} status updated: ${isActive ? 'active' : 'inactive'}`);
  }

  /**
   * Get all synchronized views that are valid
   */
  getAllSynchronizedViews() {
    try {
      // First check that synchronization configuration exists
      if (!this.syncConfig || !this.syncConfig.groups) {
        console.warn('No synchronization configuration');
        return [];
      }
      
      // Find active group (selected)
      const activeGroup = this.syncConfig.groups.find(g => g.active === true);
      if (!activeGroup || !activeGroup.views || activeGroup.views.length === 0) {
        console.warn('No active group or group without views');
        return [];
      }
      
      // Get view indices in active group
      const viewIndices = activeGroup.views;
      
      // Get corresponding view objects that are valid
      const synchronizedViews = viewIndices
        .map(index => this.views[index])
        .filter(view => {
          // Check if view exists
          if (!view) return false;
          
          // BrowserView doesn't have isDestroyed method, but webContents does
          // So we check if webContents exists and is not destroyed
          return view.webContents && !view.webContents.isDestroyed();
        });
      
      console.log(`Found ${synchronizedViews.length} valid synchronized views`);
      return synchronizedViews;
    } catch (error) {
      console.error('Error retrieving synchronized views:', error);
      return [];
    }
  }

  // Function to limit position update frequency during scrolling
  throttledUpdateViewPositions(position) {
    const now = Date.now();
    
    // If scrolling is very fast (less than 16ms between events), limit frequency
    if (now - this.lastScrollUpdateTime < 16) {
      return;
    }
    
    this.lastScrollUpdateTime = now;
    this.scrollPosition = position;
    this.updateViewPositions();
    
    // Indicate we are scrolling
    this.isScrolling = true;
    
    // Reset scroll timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    // After 150ms without scrolling, consider scrolling finished
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
      this.updateViewsVisibility(); // Update view visibility once scrolling is finished
    }, 150);
  }
  
  // Handle mouse wheel scrolling
  handleWheelScroll(delta) {
    // Calculate new scroll position
    const newY = Math.max(0, this.scrollPosition.y + delta.y);
    const maxScroll = this.calculateMaxScrollOffset();
    
    // Limit scroll position to maximum
    this.scrollPosition.y = Math.min(newY, maxScroll);
    
    // Update view positions
    this.throttledUpdateViewPositions(this.scrollPosition);
  }
  
  // Handle keyboard scrolling
  handleKeyboardScroll(data) {
    const { key, amount } = data;
    const step = amount || 50; // Default step
    
    if (key === 'ArrowDown' || key === 'PageDown') {
      const newY = Math.min(this.scrollPosition.y + step, this.calculateMaxScrollOffset());
      this.scrollPosition.y = newY;
    } else if (key === 'ArrowUp' || key === 'PageUp') {
      const newY = Math.max(0, this.scrollPosition.y - step);
      this.scrollPosition.y = newY;
    } else if (key === 'Home') {
      this.scrollPosition.y = 0;
    } else if (key === 'End') {
      this.scrollPosition.y = this.calculateMaxScrollOffset();
    }
    
    this.throttledUpdateViewPositions(this.scrollPosition);
  }

  // Configure direct scroll listeners from main window
  setupScrollListeners() {
    console.log('Configuring scroll listeners on main window');
    
    // Listen for mouse wheel events on main window
    this.window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'mouseWheel') {
        console.log('Direct mouseWheel event:', input.deltaY);
        const scrollAmount = input.deltaY * 3; // Multiplier to make scrolling faster
        
        // Send scroll event via throttling system
        this.handleWheelScroll({ 
          x: 0, 
          y: scrollAmount 
        });
        
        event.preventDefault();
      } else if (input.type === 'keyDown') {
        // Handle navigation keys
        if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(input.key)) {
          console.log('KeyDown event for navigation:', input.key);
          let amount = 50; // Standard step
          
          if (input.key === 'PageDown' || input.key === 'PageUp') {
            amount = 200; // Larger step for Page Up/Down
          }
          
          this.handleKeyboardScroll({
            key: input.key,
            amount: amount
          });
          
          event.preventDefault();
        }
      }
    });
    
    // Communicate container size to renderer
    this.window.webContents.on('did-finish-load', () => {
      console.log('Window loaded, updating container size');
      this.updateContainerSize();
    });
  }

  // Calculate and communicate container size
  updateContainerSize() {
    const numViews = this.views.length;
    const totalHeight = this.calculateTotalContentHeight();
    
    console.log(`Container size update: ${totalHeight}px for ${numViews} views`);
    
    // Send size to renderer to configure scroll area
    this.window.webContents.send('set-container-size', {
      width: this.window.getContentBounds().width,
      height: totalHeight
    });
  }

  // Calculate total content height
  calculateTotalContentHeight() {
    const numRows = Math.ceil(this.views.length / this.viewsPerRow);
    return numRows * (this.viewHeight + this.viewMargin) + this.totalControlBarHeight;
  }

  // Method to update view positions
  updateViewPositions() {
    this.views.forEach((view, index) => {
      this.positionView(view, index);
    });
    
    // Update view visibility if we are not scrolling
    if (!this.isScrolling) {
      this.updateViewsVisibility();
    }
  }
  
  // Determine which views are visible and optimize their display
  updateViewsVisibility() {
    const { height } = this.window.getContentBounds();
    const visibleTop = this.scrollPosition.y;
    const visibleBottom = visibleTop + height;
    
    // Preload buffer (200px before and after visible area)
    const bufferSize = 200;
    const expandedTop = Math.max(0, visibleTop - bufferSize);
    const expandedBottom = visibleBottom + bufferSize;
    
    this.views.forEach((view, index) => {
      const row = Math.floor(index / this.viewsPerRow);
      const viewTop = this.totalControlBarHeight + (row * (this.viewHeight + this.viewMargin));
      const viewBottom = viewTop + this.viewHeight;
      
      // Check if view is in expanded visible area
      const isVisible = (viewBottom >= expandedTop && viewTop <= expandedBottom);
      
      // If visibility state has changed
      if (this.viewsVisibility.get(index) !== isVisible) {
        if (isVisible) {
          // View became visible
          this.positionView(view, index);
        } else {
          // View is no longer visible, move it off screen
          view.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: this.viewHeight });
          
          // Also move control bar off screen
          if (view.controlBar) {
            view.controlBar.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: 20 });
          }
        }
        
        // Update visibility state
        this.viewsVisibility.set(index, isVisible);
      }
    });
  }

  // Calculate maximum scroll offset
  calculateMaxScrollOffset() {
    const { height } = this.window.getContentBounds();
    const totalHeight = this.calculateTotalContentHeight();
    return Math.max(0, totalHeight - height);
  }

  setupBrowserViews() {
    const { mode, viewCount } = this.config;
    const viewsPerRow = mode === 'multiplayer' ? 5 : 4;
    
    // Calculate BrowserView dimensions
    this.calculateViewDimensions(viewsPerRow, viewCount);
    
    // Create BrowserViews
    for (let i = 0; i < viewCount; i++) {
      this.createBrowserView(i);
      // Initialize all views as not visible
      this.viewsVisibility.set(i, false);
    }
    
    // Initial visibility update
    this.updateViewsVisibility();
    
    // Update container size
    this.updateContainerSize();
    
    // Create context menu
    this.setupContextMenu();
    
    // Handle mouse clicks to activate BrowserViews
    this.window.on('click', (event) => {
      // Loop through all visible views
      for (let i = 0; i < this.views.length; i++) {
        if (this.viewsVisibility.get(i) === true) {
          const view = this.views[i];
          const bounds = view.getBounds();
          
          // Check if click is within this view's bounds
          if (event.x >= bounds.x && event.x <= bounds.x + bounds.width &&
              event.y >= bounds.y && event.y <= bounds.y + bounds.height) {
            
            // Focus this view
            this.window.setTopBrowserView(view);
            view.webContents.focus();
            
            // Send click event to view
            view.webContents.sendInputEvent({
              type: 'mouseDown',
              x: event.x - bounds.x,
              y: event.y - bounds.y,
              button: 'left',
              clickCount: 1
            });
            
            view.webContents.sendInputEvent({
              type: 'mouseUp',
              x: event.x - bounds.x,
              y: event.y - bounds.y,
              button: 'left',
              clickCount: 1
            });
            
            // Stop propagation if we found a matching view
            return;
          }
        }
      }
    });
  }

  calculateViewDimensions(viewsPerRow, viewCount) {
    const { width, height } = this.window.getContentBounds();
    // Control bar heights are already defined in constructor
    
    // Define margins
    this.horizontalMargin = Math.floor(width * 0.05); // 5% margin on each side
    this.viewMargin = 10; // 10px margin between views
    
    // Determine number of rows needed
    const rows = Math.ceil(viewCount / viewsPerRow);
    
    // Calculate available space after side margins
    const availableWidth = width - (this.horizontalMargin * 2);
    // Calculate width of each view accounting for margins between views
    const totalViewMargins = (viewsPerRow - 1) * this.viewMargin;
    this.viewWidth = Math.floor((availableWidth - totalViewMargins) / viewsPerRow);
    
    // Calculate height to maintain 16:9 ratio (width / 16 * 9)
    this.viewHeight = Math.floor(this.viewWidth / 16 * 9);
    
    // Always maintain 16:9 ratio, even if views exceed window
    this.rows = rows;
    this.viewsPerRow = viewsPerRow;
  }

  createBrowserView(index) {
    // Define partition according to mode
    const partition = this.config.mode === 'cdl' 
      ? `persist:cdl-profile-${index}` 
      : `persist:view-${index}`;
      
    // Determine view type (host/player) and synchronization state
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    const isHost = col === 0; // First view in each row is a host
    const viewType = isHost ? 'host' : 'player';
    const viewNumber = isHost ? row + 1 : (row * (this.viewsPerRow - 1)) + col;
      
    // Create new BrowserView
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'betterxcloudpreload.js'),
        partition: partition // Independent sessions with CDL-specific profile
      }
    });
    
    // Disable auto-resize to avoid focus and mouse issues
    view.setAutoResize({ width: false, height: false });
    
    // Define type and synchronization properties
    view.viewType = viewType;      // 'host' or 'player'
    view.viewNumber = viewNumber;  // View number (1-N)
    view.isSynchronized = false;   // By default, views are not synchronized
    view.viewIndex = index;        // Keep index for reference
    
    this.window.addBrowserView(view);
    this.views.push(view);
    
    // Position the view
    this.positionView(view, index);
    
    // Create control bar for this view
    this.createViewControlBar(view, index);
    
    // Before loading URL, configure bitrate settings according to view type
    view.webContents.on('did-finish-load', () => {
      // Check if server settings have been defined
      const serverConfig = global.serverConfig || {
        region: 'default',
        bypassRestriction: 'off',
        hostBitrate: 5000000,
        playerBitrate: 500000,
        resolution: '720p'
      };
      
      // Determine correct bitrate according to view type
      const bitrate = viewType === 'host' ? serverConfig.hostBitrate : serverConfig.playerBitrate;
      
      // Send configuration to view
      view.webContents.send('server-config', {
        region: serverConfig.region,
        bitrate: bitrate,
        bypassRestriction: serverConfig.bypassRestriction,
        resolution: serverConfig.resolution
      });
      
      console.log(`View ${viewNumber} (${viewType}) - Configuration: bitrate=${bitrate}, region=${serverConfig.region}, bypassRestriction=${serverConfig.bypassRestriction}, resolution=${serverConfig.resolution}`);
      
      // Directly inject script to configure Better X Cloud settings
      const script = `
        (function() {
          try {
            console.log("Direct settings configuration for ${viewType} view");
            
            // Retrieve current settings or create new object
            let settings = {};
            try {
              const existingSettings = localStorage.getItem("BetterXcloud");
              if (existingSettings) {
                settings = JSON.parse(existingSettings);
              }
            } catch (e) {
              console.error("Error retrieving settings:", e);
            }
            
            // Inject pressKey and releaseKey functions for macros
            window.pressKey = function(key) {
              console.log("PressKey called for:", key);
              try {
                const element = document.documentElement;
                const keyCode = key === 'Escape' ? 27 : 
                               key === ' ' ? 32 : 
                               key === 'Enter' ? 13 :
                               key === 'Tab' ? 9 :
                               key === 'F11' ? 122 :
                               key.charCodeAt(0);
                               
                const code = key === ' ' ? 'Space' : 
                           key === 'Escape' ? 'Escape' :
                           key === 'Enter' ? 'Enter' :
                           key === 'Tab' ? 'Tab' :
                           key === 'F11' ? 'F11' :
                           'Key' + key.toUpperCase();
                           
                const event = new KeyboardEvent('keydown', {
                  key: key,
                  code: code,
                  keyCode: keyCode,
                  which: keyCode,
                  bubbles: true,
                  cancelable: true
                });
                
                element.dispatchEvent(event);
                document.dispatchEvent(event);
                window.dispatchEvent(event);
                
                if (document.activeElement) {
                  document.activeElement.dispatchEvent(event);
                }
                
                return true;
              } catch(e) {
                console.error("Error pressKey:", e);
                return false;
              }
            };
            
            window.releaseKey = function(key) {
              console.log("ReleaseKey called for:", key);
              try {
                const element = document.documentElement;
                const keyCode = key === 'Escape' ? 27 : 
                               key === ' ' ? 32 : 
                               key === 'Enter' ? 13 :
                               key === 'Tab' ? 9 :
                               key === 'F11' ? 122 :
                               key.charCodeAt(0);
                               
                const code = key === ' ' ? 'Space' : 
                           key === 'Escape' ? 'Escape' :
                           key === 'Enter' ? 'Enter' :
                           key === 'Tab' ? 'Tab' :
                           key === 'F11' ? 'F11' :
                           'Key' + key.toUpperCase();
                           
                const event = new KeyboardEvent('keyup', {
                  key: key,
                  code: code,
                  keyCode: keyCode,
                  which: keyCode,
                  bubbles: true,
                  cancelable: true
                });
                
                element.dispatchEvent(event);
                document.dispatchEvent(event);
                window.dispatchEvent(event);
                
                if (document.activeElement) {
                  document.activeElement.dispatchEvent(event);
                }
                
                return true;
              } catch(e) {
                console.error("Error releaseKey:", e);
                return false;
              }
            };
            
            // Apply settings
            settings["server.region"] = "${serverConfig.region}";
            settings["server.bypassRestriction"] = "${serverConfig.bypassRestriction}";
            settings["stream.video.maxBitrate"] = ${bitrate};
            settings["stream.video.resolution"] = "${serverConfig.resolution}";
            
            // Store reference values
            settings["host.bitrate"] = ${serverConfig.hostBitrate};
            settings["player.bitrate"] = ${serverConfig.playerBitrate};
            
            // Save settings
            localStorage.setItem("BetterXcloud", JSON.stringify(settings));
            
            console.log("${viewType} view - Settings configured:", {
              type: "${viewType}",
              bitrate: ${bitrate},
              region: "${serverConfig.region}",
              resolution: "${serverConfig.resolution}"
            });
            
            return true;
          } catch (error) {
            console.error("Error configuring settings:", error);
            return false;
          }
        })();
      `;
      
      view.webContents.executeJavaScript(script)
        .then(result => {
          console.log(`BetterXcloud settings configuration for view ${viewNumber} (${viewType}): ${result ? 'success' : 'failed'}`);
        })
        .catch(error => {
          console.error(`Error configuring settings for view ${viewNumber}:`, error);
        });
      
      // Inject fullscreen spoofing script
      view.webContents.executeJavaScript(FullScreenSpooferScript)
        .then(() => {
          console.log(`FullScreen Spoofer injected into view ${index}`);
        })
        .catch(err => {
          console.error(`Error injecting FullScreen Spoofer into view ${index}:`, err);
        });
        
      // Inject AlwaysActiveWindow script
      this.injectAlwaysActiveWindow(view, index);
    });
    
    // Load xbox.com/en-US/play
    view.webContents.loadURL('https://www.xbox.com/en-US/play/launch/call-of-duty-black-ops-6---pack-cross-gen/9PF528M6CRHQ');
    
    // Open DevTools in detached mode for each view
    //view.webContents.openDevTools({ mode: 'detach' });
  }

  // Create HTML control bar for each BrowserView
  createViewControlBar(view, index) {
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    
    // Determine label type (Host for first view in each row, Bot for others)
    const isFirstInRow = col === 0;
    
    // Calculate host or bot number
    const hostNumber = row + 1; // Host number is based on row (starts at 1)
    
    // For bots, maintain global numbering from 1 to N
    let botNumber = 1;
    if (!isFirstInRow) {
      // Calculate global bot number
      // For each row, we have (viewsPerRow - 1) bots
      // Example: if viewsPerRow = 5, then row 0 = bots 1-4, row 1 = bots 5-8, etc.
      botNumber = (row * (this.viewsPerRow - 1)) + col;
    }
    
    const label = isFirstInRow ? `Host ${hostNumber}` : `Bot ${botNumber}`;
    
    // Create BrowserView for control bar with preload
    const controlBar = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'viewControlBarPreload.js')
      }
    });
    
    this.window.addBrowserView(controlBar);
    
    // Load control bar HTML file with label and view ID as parameters
    controlBar.webContents.loadFile(
      path.join(__dirname, '../renderer/viewControlBar.html'),
      { search: `label=${encodeURIComponent(label)}&viewId=${view.viewIndex}` }
    );
    
    // Store reference to this control bar with parent view
    view.controlBar = controlBar;
    
    // Position the control bar
    this.positionViewControlBar(view, index);
  }
  
  // Position view control bar
  positionViewControlBar(view, index) {
    if (!view.controlBar) return;
    
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    
    // Calculate x position accounting for margins
    const x = this.horizontalMargin + (col * (this.viewWidth + this.viewMargin));
    
    // Calculate y position accounting for view margins and scrolling
    const y = this.totalControlBarHeight + (row * (this.viewHeight + this.viewMargin)) - this.scrollPosition.y;
    
    // Control bar height
    const controlBarHeight = 20;
    
    // Position control bar above view
    view.controlBar.setBounds({ 
      x, 
      y: Math.max(this.totalControlBarHeight, y), 
      width: this.viewWidth, 
      height: controlBarHeight 
    });
  }

  positionView(view, index) {
    const row = Math.floor(index / this.viewsPerRow);
    const col = index % this.viewsPerRow;
    
    // Calculate x position accounting for margins
    const x = this.horizontalMargin + (col * (this.viewWidth + this.viewMargin));
    
    // Calculate y position accounting for view margins and scrolling
    let y = this.totalControlBarHeight + (row * (this.viewHeight + this.viewMargin)) - this.scrollPosition.y;
    
    // View control bar height
    const viewControlBarHeight = 20;
    
    // Ensure views don't overlap control bars
    // If y is negative, it means view goes above control bars
    if (y < this.totalControlBarHeight) {
      // Cut off the part that overlaps into control bars
      const visibleHeight = this.viewHeight - (this.totalControlBarHeight - y);
      
      // Only show the visible part of view below control bars
      if (visibleHeight > 0) {
        view.setBounds({ 
          x, 
          y: this.totalControlBarHeight + viewControlBarHeight, 
          width: this.viewWidth, 
          height: visibleHeight - viewControlBarHeight 
        });
      } else {
        // If view is completely hidden, place it off screen
        view.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: this.viewHeight });
      }
    } else {
      // Normal position if view is completely below control bars
      view.setBounds({ 
        x, 
        y: y + viewControlBarHeight, 
        width: this.viewWidth, 
        height: this.viewHeight - viewControlBarHeight 
      });
    }
    
    // Also position view control bar
    this.positionViewControlBar(view, index);
  }

  resizeViews() {
    // Recalculate dimensions
    this.calculateViewDimensions(this.viewsPerRow, this.views.length);
    
    // Update container size
    this.updateContainerSize();
    
    // Adjust current scroll if necessary
    const maxScroll = this.calculateMaxScrollOffset();
    if (this.scrollPosition.y > maxScroll) {
      this.scrollPosition.y = maxScroll;
    }
    
    // Reposition all views
    this.updateViewPositions();
  }

  // Function to inject "Always Active Window" functionality
  injectAlwaysActiveWindow(view, index) {
    view.webContents.executeJavaScript(AlwaysActiveWindowScript)
      .then(() => {
        console.log(`AlwaysActiveWindow injected into view ${index}`);
      })
      .catch(err => {
        console.error(`Error injecting AlwaysActiveWindow into view ${index}:`, err);
      });
  }

  // Add setupContextMenu method
  setupContextMenu() {
    const { Menu } = require('electron');
    
    // Define context menu template
    this.contextMenuTemplate = [
      {
        label: 'Reload All Views',
        click: () => {
          this.views.forEach(view => {
            if (view.webContents) {
              view.webContents.reload();
            }
          });
        }
      },
      {
        label: 'Refresh Layout',
        click: () => {
          this.resizeViews();
        }
      },
      { type: 'separator' },
      {
        label: 'Synchronization Panel',
        click: () => {
          this.openSyncPanel();
        }
      },
      {
        label: 'Macro Panel',
        click: () => {
          this.openMacroPanel();
        }
      }
    ];
    
    // Create context menu
    const contextMenu = Menu.buildFromTemplate(this.contextMenuTemplate);
    
    // Attach context menu to main window
    this.window.webContents.on('context-menu', (_, params) => {
      contextMenu.popup({ window: this.window });
    });
  }

  // Method to propagate movement state to other views
  propagateMovementState(state, excludeView) {
    const synchronizedViews = this.getAllSynchronizedViews();
    
    synchronizedViews.forEach(view => {
      // Don't send state to the view that generated it
      if (view !== excludeView && view.webContents && !view.webContents.isDestroyed()) {
        try {
          view.webContents.send('movement-state-update', state);
        } catch (e) {
          console.error(`Error propagating state to view ${view.viewNumber}:`, e);
        }
      }
    });
  }

  // Keyboard event handler
  handleKeyboardEvent(keyEvent) {
    // Get all synchronized views
    const synchronizedViews = this.getAllSynchronizedViews();
    
    if (synchronizedViews.length === 0) {
      console.log('No synchronized views to transmit keyboard events');
      return;
    }
    
    console.log(`Transmitting keyboard event ${keyEvent.type} (key: ${keyEvent.key})`);
    
    // Function to get correct code for a key
    const getKeyCode = (key) => {
      if (key === ' ') return 'Space';
      if (key === 'Escape') return 'Escape';
      if (key === 'Shift') return 'ShiftLeft';
      if (key === 'Control') return 'ControlLeft';
      if (key === 'Alt') return 'AltLeft';
      if (key === 'Tab') return 'Tab';
      if (key === 'Enter') return 'Enter';
      if (key === 'Backspace') return 'Backspace';
      return 'Key' + key.toUpperCase();
    };
    
    // Direct approach - simulate macro execution
    if (keyEvent.type === 'keydown') {
      // For all keys, use executeJavaScript approach
      const script = `
        (function() {
          try {
            // Try to use pressKey function already injected by macros
            if (typeof window.pressKey === 'function') {
              window.pressKey('${keyEvent.key}');
              return "Key pressed via window.pressKey: ${keyEvent.key}";
            } else {
              // Fallback if function doesn't exist
              const element = document.documentElement;
              const event = new KeyboardEvent('keydown', {
                key: '${keyEvent.key}',
                code: '${getKeyCode(keyEvent.key)}',
                keyCode: ${keyEvent.key === 'Escape' ? 27 : (keyEvent.key === ' ' ? 32 : keyEvent.key.charCodeAt(0))},
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
              document.dispatchEvent(event);
              window.dispatchEvent(event);
              return "Key pressed via KeyboardEvent: ${keyEvent.key}";
            }
          } catch(e) {
            return "Error: " + e.message;
          }
        })();
      `;
      
      // Execute script in all synchronized views
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(script)
            .then(result => console.log(`View ${view.viewNumber} keydown:`, result))
            .catch(err => console.error(`Error view ${view.viewNumber}:`, err));
        }
      });
    } else if (keyEvent.type === 'keyup') {
      // For keyup events
      const script = `
        (function() {
          try {
            // Ensure all released keys are properly handled
            // Try to use releaseKey function already injected by macros
            if (typeof window.releaseKey === 'function') {
              window.releaseKey('${keyEvent.key}');
              return "Key released via window.releaseKey: ${keyEvent.key}";
            } else {
              // Fallback if function doesn't exist
              const element = document.documentElement;
              const event = new KeyboardEvent('keyup', {
                key: '${keyEvent.key}',
                code: '${getKeyCode(keyEvent.key)}',
                keyCode: ${keyEvent.key === 'Escape' ? 27 : (keyEvent.key === ' ' ? 32 : keyEvent.key.charCodeAt(0))},
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
              document.dispatchEvent(event);
              window.dispatchEvent(event);
              return "Key released via KeyboardEvent: ${keyEvent.key}";
            }
          } catch(e) {
            return "Error: " + e.message;
          }
        })();
      `;
      
      // Execute script in all synchronized views
      synchronizedViews.forEach(view => {
        if (view.webContents && !view.webContents.isDestroyed()) {
          view.webContents.executeJavaScript(script)
            .then(result => console.log(`View ${view.viewNumber} keyup:`, result))
            .catch(err => console.error(`Error view ${view.viewNumber}:`, err));
        }
      });
    }
  }

  // Add method to handle fullscreen
  toggleViewFullscreen(view) {
    if (!view) return;
    
    console.log(`Toggling fullscreen for view ${view.viewIndex}`);

    if (this.fullscreenView === view) {
      // If view is already fullscreen, return to normal view
      console.log(`View ${view.viewIndex} exits fullscreen`);
      this.exitFullscreen();
    } else {
      // If another view is fullscreen, exit it first
      if (this.fullscreenView) {
        console.log(`Exiting fullscreen for previous view ${this.fullscreenView.viewIndex}`);
        this.exitFullscreen();
      }
      // Put new view in fullscreen
      console.log(`View ${view.viewIndex} enters fullscreen`);
      this.enterFullscreen(view);
    }
  }

  // Method to enter fullscreen
  enterFullscreen(view) {
    const { width, height } = this.window.getContentBounds();
    
    // Save fullscreen view
    this.fullscreenView = view;
    
    // Hide all other views
    this.views.forEach(v => {
      if (v !== view) {
        v.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: this.viewHeight });
        if (v.controlBar) {
          v.controlBar.setBounds({ x: -10000, y: -10000, width: this.viewWidth, height: 20 });
        }
      }
    });
    
    // Position view control bar above other elements
    const controlBarHeight = 20;
    
    // Get game control bar and make it visible above other elements
    if (this.gameControlBar) {
      this.window.setTopBrowserView(this.gameControlBar); // Put game bar on top
    }
    
    // Position view control bar in foreground
    if (view.controlBar) {
      this.window.setTopBrowserView(view.controlBar); // Ensure control bar is on top
      view.controlBar.setBounds({
        x: 0,
        y: 0, // Position at very top of window, above everything
        width: width,
        height: controlBarHeight
      });
    }
    
    // Put selected view in fullscreen
    view.setBounds({
      x: 0,
      y: this.totalControlBarHeight, // Use total height of control bars
      width: width,
      height: height - this.totalControlBarHeight // Adjust height to not overflow
    });
    
    // Place view under control bar but above other elements
    this.window.setTopBrowserView(view); 
    
    // Ensure view bar stays on top of everything
    if (view.controlBar) {
      this.window.setTopBrowserView(view.controlBar);
      
      // Update fullscreen button icon
      view.controlBar.webContents.executeJavaScript(`
        document.getElementById('fullscreen-btn').innerHTML = '<span>⮌</span>';
      `);
    }
  }

  // Method to exit fullscreen
  exitFullscreen() {
    if (!this.fullscreenView) return;
    
    // Reset fullscreen view
    const view = this.fullscreenView;
    this.fullscreenView = null;
    
    // Reposition all views
    this.updateViewPositions();
    
    // Update fullscreen button icon
    if (view.controlBar) {
      view.controlBar.webContents.executeJavaScript(`
        document.getElementById('fullscreen-btn').innerHTML = '<span>⛶</span>';
      `);
    }
  }

  // Method to reload settings and update views
  reloadSettingsAndUpdateViews() {
    console.log('Reloading settings and updating views');
    // Execute script in main window to retrieve settings
    this.window.webContents.executeJavaScript(`
      (function() {
        try {
          const betterXcloudSettings = localStorage.getItem('BetterXcloud');
          if (betterXcloudSettings) {
            console.log('BetterXcloud settings reloaded:', betterXcloudSettings);
            return betterXcloudSettings;
          }
          return null;
        } catch(err) {
          console.error('Error retrieving settings:', err);
          return null;
        }
      })()
    `).then(result => {
      if (result) {
        try {
          const settings = JSON.parse(result);
          console.log('Settings loaded:', settings);
          
          // Update server configuration
          if (settings["server.region"]) {
            global.serverConfig.region = settings["server.region"];
          }
          
          if (settings["server.bypassRestriction"]) {
            global.serverConfig.bypassRestriction = settings["server.bypassRestriction"];
          }
          
          // Get video resolution
          if (settings["stream.video.resolution"]) {
            global.serverConfig.resolution = settings["stream.video.resolution"];
          }
          
          // Get bitrate values
          if (settings["host.bitrate"]) {
            global.serverConfig.hostBitrate = settings["host.bitrate"];
          }
          
          if (settings["player.bitrate"]) {
            global.serverConfig.playerBitrate = settings["player.bitrate"];
          }
          
          console.log('Server configuration updated:', global.serverConfig);
          
          // Update all views with new configuration
          this.updateServerConfigInViews();
        } catch (error) {
          console.error('Error parsing settings:', error);
        }
      }
    }).catch(err => {
      console.error('Error executing settings retrieval script:', err);
    });
  }
  
  // Update server configuration in all views
  updateServerConfigInViews() {
    console.log('Updating server configuration in all views');
    
    // Get current configuration
    const serverConfig = global.serverConfig || {
      region: 'default',
      bypassRestriction: 'off',
      hostBitrate: 5000000,
      playerBitrate: 500000
    };
    
    // Update all existing views
    this.views.forEach(view => {
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        try {
          // Determine bitrate based on view type
          const bitrate = view.viewType === 'host' ? serverConfig.hostBitrate : serverConfig.playerBitrate;
          
          // Send configuration to view via IPC
          view.webContents.send('server-config', {
            region: serverConfig.region,
            bitrate: bitrate,
            bypassRestriction: serverConfig.bypassRestriction,
            resolution: serverConfig.resolution
          });
          
          // Directly inject script that applies settings in localStorage
          const injectionScript = `
            (function() {
              try {
                console.log("Direct server settings injection");
                
                // Get current settings
                let settings = {};
                try {
                  const existingSettings = localStorage.getItem("BetterXcloud");
                  if (existingSettings) {
                    settings = JSON.parse(existingSettings);
                  }
                } catch (e) {
                  console.error("Error retrieving existing settings:", e);
                }
                
                // Update settings with new configuration
                settings["server.region"] = "${serverConfig.region}";
                settings["server.bypassRestriction"] = "${serverConfig.bypassRestriction}";
                
                // Apply bitrate based on view type
                settings["stream.video.maxBitrate"] = ${bitrate};
                console.log("Bitrate injected for ${view.viewType} view:", ${bitrate});
                
                // Store reference values for settings
                settings["host.bitrate"] = ${serverConfig.hostBitrate};
                settings["player.bitrate"] = ${serverConfig.playerBitrate};
                
                // Apply resolution from server configuration
                settings["stream.video.resolution"] = "${serverConfig.resolution}";
                console.log("Resolution applied:", "${serverConfig.resolution}");
                
                // Save updated settings
                localStorage.setItem("BetterXcloud", JSON.stringify(settings));
                
                console.log("Server settings updated in localStorage:", 
                  { 
                    region: "${serverConfig.region}", 
                    bypassRestriction: "${serverConfig.bypassRestriction}", 
                    bitrate: ${bitrate},
                    resolution: settings["stream.video.resolution"]
                  });
                
                return true;
              } catch (error) {
                console.error("Error during direct server settings injection:", error);
                return false;
              }
            })();
          `;
          
          // Execute script in view
          view.webContents.executeJavaScript(injectionScript)
            .then(result => {
              console.log(`View ${view.viewNumber} (${view.viewType}) - Direct settings injection: ${result ? 'success' : 'failed'}`);
              
              // Reload page to apply new settings
              view.webContents.reload();
            })
            .catch(error => {
              console.error(`Error executing injection script in view ${view.viewNumber}:`, error);
            });
          
          console.log(`View ${view.viewNumber} (${view.viewType}) - Configuration updated: region=${serverConfig.region}, bypassRestriction=${serverConfig.bypassRestriction}, bitrate=${bitrate}`);
        } catch (error) {
          console.error(`Error updating view ${view.viewNumber}:`, error);
        }
      }
    });
  }
}

// Function to create new MainViewWindow instance
function createMainViewWindow(config) {
  return new MainViewWindow(config);
}

// Export class and function
module.exports = {
  MainViewWindow,
  createMainViewWindow
};


