const { contextBridge, ipcRenderer } = require('electron');

// Exposer les API sécurisées au renderer
contextBridge.exposeInMainWorld('electronAPI', {
  toggleFullscreen: () => {
    // Récupérer l'id de la vue depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get('viewId');
    
    if (viewId !== null) {
      // Envoyer l'événement au processus principal avec l'ID de la vue
      ipcRenderer.send('toggle-view-fullscreen', parseInt(viewId));
    }
  },
  
  openDevTools: (viewId) => {
    if (viewId !== null) {
      // Envoyer l'événement au processus principal avec l'ID de la vue
      ipcRenderer.send('open-view-devtools', parseInt(viewId));
    }
  },
  
  reloadView: (viewId) => {
    if (viewId !== null) {
      // Envoyer l'événement au processus principal avec l'ID de la vue
      ipcRenderer.send('reload-view', parseInt(viewId));
    }
  }
}); 