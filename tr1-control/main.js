const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const pm2 = require('pm2');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "TR1 — Control de Sala",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Carga tu interfaz desplegada en Vercel
  mainWindow.loadURL('https://flujo-ps5-y-xbox-tiempo.vercel.app/');

  // Iniciar el backend del servidor usando PM2 al abrir la app
  startServerWithPM2();

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Nota: PM2 se queda corriendo en segundo plano para mantener el servicio activo, 
    // pero si prefieres apagarlo al cerrar la app, puedes descomentar pm2.disconnect() o pm2.stop().
  });
}

// --- FUNCIÓN PARA INICIAR EL SERVIDOR MEDIANTE PM2 ---
function startServerWithPM2() {
  const serverScriptPath = path.join(__dirname, '..', 'server', 'index.js');
  const serverCwd = path.join(__dirname, '..', 'server');

  console.log(`[PM2] Conectando y levantando servidor desde: ${serverScriptPath}`);

  pm2.connect((err) => {
    if (err) {
      console.error('[PM2 ERROR] No se pudo conectar a PM2:', err);
      return;
    }

    pm2.start({
      script: serverScriptPath,
      name: 'tr1-backend-server',
      cwd: serverCwd,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }, (startErr, apps) => {
      if (startErr) {
        console.error('[PM2 ERROR] Error al iniciar la aplicación con PM2:', startErr);
      } else {
        console.log('[PM2 SUCCESS] Servidor iniciado correctamente bajo PM2:', apps);
      }
    });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Opcional: Desconectar PM2 (el proceso de Node seguirá corriendo en background por PM2)
  pm2.disconnect();
  if (process.platform !== 'darwin') app.quit();
});

// --- COMANDOS IPC DIRECTOS PARA ADB Y PM2 ---
ipcMain.handle('connect-adb', async (event, ipAddress) => {
  return new Promise((resolve, reject) => {
    exec(`adb connect ${ipAddress}:5555`, (error, stdout, stderr) => {
      if (error) return reject(`Error ADB: ${stderr || error.message}`);
      resolve(stdout);
    });
  });
});

ipcMain.handle('setup-pm2', async (event, appPath, appName) => {
  return new Promise((resolve, reject) => {
    const command = `pm2 start "${appPath}" --name "${appName}" && pm2 save`;
    exec(command, (error, stdout, stderr) => {
      if (error) return reject(`Error PM2: ${stderr || error.message}`);
      resolve(stdout);
    });
  });
});