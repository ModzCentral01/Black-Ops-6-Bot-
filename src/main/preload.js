const { contextBridge, ipcRenderer } = require('electron');

// Exposer les API protégées pour toutes les fonctionnalités de l'application
contextBridge.exposeInMainWorld('electronAPI', {
  // API pour la fenêtre de sélection
  startSession: (config) => ipcRenderer.send('start-session', config),
  
  // API pour la fenêtre principale et les vues
  onUpdateViewCount: (callback) => ipcRenderer.on('update-view-count', callback),
  notifyScroll: (scrollPos) => ipcRenderer.send('sync-scroll', scrollPos),
  
  // API pour la macro de simulation de touches
  toggleMacro: (enabled) => ipcRenderer.send('toggle-macro', enabled),
  onMacroStatusChange: (callback) => ipcRenderer.on('macro-status-change', callback),
  
  // API pour le système de défilement
  sendScrollPosition: (position) => ipcRenderer.send('container-scrolled', position),
  sendWheelScroll: (delta) => ipcRenderer.send('wheel-scrolled', delta),
  sendKeyboardScroll: (data) => ipcRenderer.send('keyboard-scroll', data),
  onSetContainerSize: (callback) => ipcRenderer.on('set-container-size', (event, data) => callback(data)),
  
  // API pour ouvrir le panneau de synchronisation
  openSyncPanel: () => ipcRenderer.send('open-sync-panel'),
  
  // API pour envoyer les paramètres de bitrate
  sendBitrateSettings: (settings) => ipcRenderer.send('update-bitrate-settings', settings),
  
  // API pour recharger toutes les vues
  reloadAllViews: () => ipcRenderer.send('reload-all-views'),
  
  // API pour récupérer les paramètres actuels
  getCurrentSettings: (callback) => {
    ipcRenderer.once('current-settings', (event, settings) => callback(settings));
    ipcRenderer.send('get-current-settings');
  },
  
  // API pour fermer la fenêtre courante
  closeWindow: () => ipcRenderer.send('close-current-window')
}); 