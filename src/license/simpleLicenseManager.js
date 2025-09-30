const { ipcMain } = require("electron");

class SimpleLicenseManager {
  constructor() {
    this.initIPCListeners();
  }

  // Initialize IPC listeners with fake implementations
  initIPCListeners() {
    ipcMain.handle("validate-license", async (event, licenseKey) => {
      return {
        valid: true,
        message: "License validated successfully",
        licenseKey: licenseKey || "FAKE-LICENSE-KEY",
        activationDate: new Date().toISOString(),
        hardwareId: "FAKE-HARDWARE-ID"
      };
    });

    ipcMain.handle("get-license-status", () => {
      return {
        valid: true,
        licenseKey: "FAKE-LICENSE-KEY",
        activationDate: new Date().toISOString(),
        hardwareId: "FAKE-HARDWARE-ID"
      };
    });

    ipcMain.handle("get-saved-license", () => {
      return "FAKE-LICENSE-KEY";
    });

    ipcMain.handle("get-hardware-id", async () => {
      return "FAKE-HARDWARE-ID";
    });

    ipcMain.handle("get-activation-date", () => {
      return new Date().toISOString();
    });

    ipcMain.handle("clear-license", () => {
      return true;
    });
  }

  // Fake methods for compatibility
  async showLicenseWindow() {
    return {
      valid: true,
      licenseKey: "FAKE-LICENSE-KEY",
      activationDate: new Date().toISOString(),
      hardwareId: "FAKE-HARDWARE-ID"
    };
  }

  checkExistingLicense() {
    return {
      valid: true,
      licenseKey: "FAKE-LICENSE-KEY",
      activationDate: new Date().toISOString(),
      hardwareId: "FAKE-HARDWARE-ID"
    };
  }

  async activateLicense() {
    return {
      valid: true,
      licenseKey: "FAKE-LICENSE-KEY",
      activationDate: new Date().toISOString(),
      hardwareId: "FAKE-HARDWARE-ID"
    };
  }
}

module.exports = SimpleLicenseManager;
