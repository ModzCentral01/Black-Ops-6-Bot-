const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const axios = require("axios");
const Store = require("electron-store");
const si = require("systeminformation");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

class LicenseManager {
  constructor(options = {}) {
    this.mainWindow = null;
    this.options = {
      licenseServerUrl: "XXXXXXXX",
      activationServerUrl: "XXXXXXXX",
      encryptionKey: "XXXXXXXXXX",
      ...options,
    };

    // Configuration pour stockage persistant
    this.store = new Store({
      encryptionKey: this.options.encryptionKey,
      schema: {
        licenseKey: {
          type: "string",
        },
        hardwareId: {
          type: "string",
        },
        licenseStatus: {
          type: "object",
        },
      },
    });

    // Initialiser les écouteurs IPC
    this.initIPCListeners();
  }

  // Initialiser la fenêtre de licence
  async showLicenseWindow() {
    // Si une fenêtre existe déjà, la fermer
    if (this.mainWindow) {
      this.mainWindow.close();
      this.mainWindow = null;
    }

    // Créer la fenêtre
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 800,
      show: false, // Ne pas afficher immédiatement
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "licensePreload.js"),
      },
      icon: path.join(__dirname, "../../assets/icon.ico"),
    });

    // Charger le fichier HTML
    await this.mainWindow.loadFile(path.join(__dirname, "licenseView.html"));

    // Afficher la fenêtre une fois chargée
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow.show();
    });

    // Désactiver le menu pour la production
    // this.mainWindow.setMenu(null);

    // Ouvrir DevTools en développement
    if (process.env.NODE_ENV === "development") {
      this.mainWindow.webContents.openDevTools();
    }

    return new Promise((resolve) => {
      // Écouter l'événement de licence validée
      ipcMain.once("license-validated", () => {
        console.log("Licence validée, fermeture de la fenêtre de vérification");
        const licenseStatus = this.store.get("licenseStatus");

        if (this.mainWindow) {
          this.mainWindow.close();
          this.mainWindow = null;
        }

        resolve(licenseStatus);
      });

      // S'assurer que la résolution est appelée même si la fenêtre est fermée manuellement
      this.mainWindow.on("closed", () => {
        // Nettoyer la référence
        if (this.mainWindow) {
          this.mainWindow = null;
        }

        // Si l'événement license-validated n'a pas été déclenché, on résout quand même
        // Cela permettra à l'application de continuer même si l'utilisateur ferme la fenêtre
        const licenseStatus = this.store.get("licenseStatus");
        resolve(licenseStatus);
      });
    });
  }

  // Initialiser les écouteurs IPC
  initIPCListeners() {
    ipcMain.handle("validate-license", async (event, licenseKey) => {
      const hardwareId =
        this.store.get("hardwareId") || (await this.generateHardwareId());
      this.store.set("licenseKey", licenseKey);

      // Vérifier si c'est la première utilisation
      const existingLicenseStatus = this.store.get("licenseStatus");

      if (!existingLicenseStatus || !existingLicenseStatus.valid) {
        // Première utilisation - activer la licence
        return this.activateLicense(licenseKey, hardwareId);
      } else {
        // Utilisation ultérieure - vérifier la licence
        return this.validateLicense(licenseKey, hardwareId);
      }
    });

    ipcMain.handle("get-license-status", () => {
      return this.store.get("licenseStatus");
    });

    ipcMain.handle("get-saved-license", () => {
      return this.store.get("licenseKey");
    });

    ipcMain.handle("get-hardware-id", async () => {
      return this.store.get("hardwareId") || (await this.generateHardwareId());
    });

    ipcMain.handle("get-activation-date", () => {
      const licenseStatus = this.store.get("licenseStatus");
      return licenseStatus ? licenseStatus.activationDate : null;
    });

    ipcMain.handle("clear-license", () => {
      this.store.delete("licenseKey");
      this.store.delete("licenseStatus");
      return true;
    });
  }

  // Générer un ID matériel unique
  async generateHardwareId() {
    try {
      // Récupérer des informations matérielles
      const [cpu, system, uuid, disk] = await Promise.all([
        si.cpu(),
        si.system(),
        si.uuid(),
        si.diskLayout(),
      ]);

      // Créer une empreinte unique basée sur le matériel
      const hardwareInfo = JSON.stringify({
        cpuId:
          cpu.manufacturer + cpu.brand + cpu.family + cpu.model + cpu.stepping,
        systemId: system.manufacturer + system.model + system.serial,
        diskId: disk.length > 0 ? disk[0].serialNum : "",
        uuid: uuid.os,
      });

      // Créer un hash de ces informations
      const hardwareId = crypto
        .createHash("sha256")
        .update(hardwareInfo)
        .digest("hex");

      // Sauvegarder l'ID matériel
      this.store.set("hardwareId", hardwareId);
      return hardwareId;
    } catch (error) {
      console.error("Erreur lors de la génération de l'ID matériel:", error);
      // En cas d'échec, générer un UUID aléatoire
      const fallbackId = uuidv4();
      this.store.set("hardwareId", fallbackId);
      return fallbackId;
    }
  }

  // Activer la licence (première utilisation)
  async activateLicense(licenseKey, hardwareId) {
    try {
      if (this.mainWindow) {
        this.mainWindow.webContents.send("license-checking");
      }

      // Vérifier si la clé a déjà été activée localement
      const existingLicenseStatus = this.store.get("licenseStatus");
      if (existingLicenseStatus && existingLicenseStatus.valid) {
        console.log(
          "La licence a déjà été activée, utilisation de la validation standard"
        );
        // Si déjà activée, on se contente de vérifier
        return this.validateLicense(licenseKey, hardwareId);
      }

      // Première activation - appel au serveur
      const response = await axios.post(
        this.options.activationServerUrl,
        {
          licenseKey,
          hardwareId,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
          httpsAgent: new (require("https").Agent)({
            rejectUnauthorized: false,
          }),
        }
      );

      const result = response.data;

      if (result.valid) {
        // Stocker les informations de licence avec la date d'activation fournie par le serveur
        this.store.set("licenseStatus", {
          valid: result.valid,
          expiration: result.expiration,
          clientId: result.clientId,
          clientName: result.clientName,
          activationDate: result.activationDate,
          timestamp: new Date().toISOString(),
        });

        // Envoyer le résultat à l'interface
        if (this.mainWindow) {
          this.mainWindow.webContents.send("license-result", result);
        }

        return result.valid;
      } else {
        // Envoyer l'erreur à l'interface
        if (this.mainWindow) {
          this.mainWindow.webContents.send(
            "license-error",
            result.message || "Impossible d'activer la licence"
          );
        }
        return false;
      }
    } catch (error) {
      console.error("Erreur d'activation de licence:", error);

      const errorMessage = error.response
        ? error.response.data.message || "Erreur d'activation"
        : "Impossible de contacter le serveur de licence";

      // Envoyer l'erreur à l'interface
      if (this.mainWindow) {
        this.mainWindow.webContents.send("license-error", errorMessage);
      }

      return false;
    }
  }

  // Valider la licence avec le serveur
  async validateLicense(licenseKey, hardwareId) {
    try {
      if (this.mainWindow) {
        this.mainWindow.webContents.send("license-checking");
      }

      const response = await axios.post(
        this.options.licenseServerUrl,
        {
          licenseKey,
          hardwareId,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
          httpsAgent: new (require("https").Agent)({
            rejectUnauthorized: false,
          }),
        }
      );

      const result = response.data;

      // Stocker les informations de licence qui viennent du serveur, y compris la date d'activation
      this.store.set("licenseStatus", {
        valid: result.valid,
        expiration: result.expiration,
        clientId: result.clientId,
        clientName: result.clientName,
        activationDate: result.activationDate,
        timestamp: new Date().toISOString(),
      });

      // Envoyer le résultat à l'interface
      if (this.mainWindow) {
        this.mainWindow.webContents.send("license-result", result);
      }

      return result.valid;
    } catch (error) {
      console.error("Erreur de validation de licence:", error);

      const errorMessage = error.response
        ? error.response.data.message || "Erreur de validation"
        : "Impossible de contacter le serveur de licence";

      // Envoyer l'erreur à l'interface
      if (this.mainWindow) {
        this.mainWindow.webContents.send("license-error", errorMessage);
      }

      return false;
    }
  }

  // Vérifier si une licence valide existe
  checkExistingLicense() {
    const licenseStatus = this.store.get("licenseStatus");
    const licenseKey = this.store.get("licenseKey");

    if (!licenseStatus || !licenseKey || !licenseStatus.valid) {
      return null;
    }

    // Vérifier si la licence n'est pas expirée
    const now = new Date();
    const expiration = new Date(licenseStatus.expiration);

    if (now > expiration) {
      return null;
    }

    return licenseStatus;
  }
}

module.exports = LicenseManager;
