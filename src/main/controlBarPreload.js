const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('macroAPI', {
  // Fonction pour exécuter une macro
  executeMacro: (macroId, gameMode) => {
    ipcRenderer.send('execute-macro', { macroId, gameMode });
  },
  
  // Fonction pour recevoir des mises à jour de statut de macro
  onMacroStatus: (callback) => {
    ipcRenderer.on('macro-status', (event, data) => {
      callback(data);
    });
  },
  
  // Méthode pour ouvrir le panneau de synchronisation
  openSyncPanel: () => {
    ipcRenderer.send('open-sync-panel');
  },
  
  // Méthode pour ouvrir le panneau de macros
  openMacroPanel: (gameMode) => {
    ipcRenderer.send('open-macro-panel', gameMode);
  },
  
  // Méthode pour ouvrir la page des paramètres
  openSettings: () => {
    ipcRenderer.send('open-settings');
  }
});

// Notifier que le preload a été chargé
console.log('Control Bar Preload chargé'); 