const { BrowserWindow } = require('electron');
const path = require('path');

class SelectionWindow {
  constructor() {
    // Définir le chemin de l'icône
    const iconPath = path.join(__dirname, '../../build/icon.ico');

    this.window = new BrowserWindow({
      width: 800,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Configuration de la session',
      show: false,
      backgroundColor: '#1e1e2e',
      icon: iconPath
    });

    this.window.loadFile(path.join(__dirname, '../renderer/selection.html'));
    
    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    // Décommenter pour ouvrir les DevTools
    // this.window.webContents.openDevTools();
  }
}

module.exports = SelectionWindow; 