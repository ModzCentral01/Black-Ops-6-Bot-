const { contextBridge, ipcRenderer } = require('electron');

// Exposer les API sécurisées au processus renderer
contextBridge.exposeInMainWorld('licenseAPI', {
  // Validation de licence
  validateLicense: (licenseKey) => ipcRenderer.invoke('validate-license', licenseKey),
  
  // Obtenir le statut de licence enregistré
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  
  // Obtenir la clé de licence enregistrée
  getSavedLicense: () => ipcRenderer.invoke('get-saved-license'),
  
  // Obtenir l'ID matériel
  getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),
  
  // Obtenir la date d'activation
  getActivationDate: () => ipcRenderer.invoke('get-activation-date'),
  
  // Effacer les informations de licence
  clearLicense: () => ipcRenderer.invoke('clear-license'),
  
  // Signaler que l'utilisateur a validé la licence et souhaite continuer
  signalLicenseValidated: () => ipcRenderer.send('license-validated'),
  
  // Écouteurs d'événements
  onLicenseResult: (callback) => {
    ipcRenderer.on('license-result', (_, result) => callback(result));
    return () => ipcRenderer.removeListener('license-result', callback);
  },
  
  onLicenseChecking: (callback) => {
    ipcRenderer.on('license-checking', callback);
    return () => ipcRenderer.removeListener('license-checking', callback);
  },
  
  onLicenseError: (callback) => {
    ipcRenderer.on('license-error', (_, error) => callback(error));
    return () => ipcRenderer.removeListener('license-error', callback);
  }
}); 