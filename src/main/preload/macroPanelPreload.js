const { contextBridge, ipcRenderer } = require('electron');

// Exposer des API sécurisées pour interagir avec le processus principal
contextBridge.exposeInMainWorld('macroAPI', {
  // Récupérer les macros disponibles pour un mode de jeu spécifique
  requestMacros: (gameMode) => {
    ipcRenderer.send('request-macros', gameMode);
  },
  
  // Écouter les mises à jour des macros disponibles
  onMacrosLoaded: (callback) => {
    ipcRenderer.on('macros-loaded', (_, data) => {
      callback(data);
    });
  },
  
  // Exécuter une macro
  executeMacro: (macroId, gameMode) => {
    ipcRenderer.send('execute-macro', { macroId, gameMode });
  },
  
  // Écouter les mises à jour de statut de macro
  onMacroStatus: (callback) => {
    ipcRenderer.on('macro-status', (_, data) => {
      callback(data);
    });
  }
}); 