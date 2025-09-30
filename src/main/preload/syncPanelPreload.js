const { contextBridge, ipcRenderer } = require('electron');

// Exposer des API sécurisées pour interagir avec le processus principal
contextBridge.exposeInMainWorld('syncAPI', {
  // Récupérer l'état actuel des vues
  requestViewsState: () => {
    ipcRenderer.send('request-views-state');
  },
  
  // Écouter les mises à jour de l'état des vues
  onViewsUpdate: (callback) => {
    ipcRenderer.on('views-update', (_, data) => {
      callback(data);
    });
  },
  
  // Synchroniser les vues sélectionnées
  synchronizeViews: (selectedIndices) => {
    ipcRenderer.send('synchronize-views', selectedIndices);
  },
  
  // Envoyer un événement clavier au processus principal
  sendKeyboardEvent: (keyEvent) => {
    // Envoyer l'événement au processus principal tel quel, sans transformation
    ipcRenderer.send('keyboard-event', keyEvent);
  }
}); 