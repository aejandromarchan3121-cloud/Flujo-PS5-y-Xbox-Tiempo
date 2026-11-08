const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');

let mainWindow;
let serverProcess = null;

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

  // Carga tu interfaz desplegada en Vercel (o localhost:3000 si estás en pruebas)
  mainWindow.loadURL('https://flujo-ps5-y-xbox-tiempo.vercel.app/');

  // Iniciar el backend del servidor al abrir la app
  startServerBackend();

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Detener el proceso del servidor si se cierra la app
    if (serverProcess) {
      serverProcess.kill();
    }
  });
}

// --- FUNCIÓN PARA EJECUTAR INDEX.JS Y ENVIAR LOGS ---
function startServerBackend() {
  // Ruta relativa hacia la carpeta server/index.js
  const serverPath = path.join(__dirname, '..', 'server', 'index.js');

  console.log(`[ELECTRON] Iniciando servidor desde: ${serverPath}`);

  // Inicia el proceso de Node.js para server/index.js
  serverProcess = spawn('node', [serverPath], {
    cwd: path.join(__dirname, '..', 'server'),
    shell: true
  });

  // Capturar salida estándar (console.log del index.js)
  serverProcess.stdout.on('data', (data) => {
    const logMsg = data.toString();
    console.log(`[SERVER LOG]: ${logMsg}`);
    
    // Enviar el log a la ventana del frontend si está lista
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('server-log', logMsg);
    }
  });

  // Capturar errores (console.error del index.js)
  serverProcess.stderr.on('data', (data) => {
    const errorMsg = data.toString();
    console.error(`[SERVER ERROR]: ${errorMsg}`);
    
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('server-log-error', errorMsg);
    }
  });

  serverProcess.on('close', (code) => {
    console.log(`[SERVER] El proceso del servidor finalizó con código: ${code}`);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
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