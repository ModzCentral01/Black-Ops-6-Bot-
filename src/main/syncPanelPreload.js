const { contextBridge, ipcRenderer } = require('electron');

// Exposer l'API de synchronisation au panneau
contextBridge.exposeInMainWorld('syncAPI', {
  // Demander l'état initial des vues
  requestViewsState: () => {
    ipcRenderer.send('request-views-state');
  },

  // Synchroniser les vues sélectionnées
  synchronizeViews: (selectedIndices) => {
    ipcRenderer.send('synchronize-views', selectedIndices);
  },

  // Écouter les mises à jour de l'état des vues
  onViewsUpdate: (callback) => {
    ipcRenderer.on('views-state-update', (event, viewsData) => {
      callback(viewsData);
    });
  },

  // Envoyer un événement clavier au processus principal
  sendKeyboardEvent: (keyEvent) => {
    // Envoyer l'événement au processus principal tel quel, sans transformation
    ipcRenderer.send('keyboard-event', keyEvent);
  }
}); 