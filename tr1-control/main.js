const { app, BrowserWindow } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');

let mainWindow;
let serverProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: "TR1 — Control de Sala & Servidor",
    autoHideMenuBar: true,
    backgroundColor: '#0B0C10',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Carga tu plataforma web (Vercel o entorno local configurable)
  const startUrl = process.env.ELECTRON_START_URL || 'https://flujo-ps5-y-xbox-tiempo.vercel.app/';
  mainWindow.loadURL(startUrl);

  // 1. Ejecutar la conexión inicial de ADB a la IP fija
  conectarAdFija();

  // 2. Iniciar el servidor backend local (server/index.js) y PM2
  iniciarBackendYPM2();

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
  });
}

// Función para conectar ADB automáticamente
function conectarAdFija() {
  const targetIp = "192.168.1.43";
  console.log(`[ADB] Conectando automáticamente a ${targetIp}:5555...`);

  exec(`adb connect ${targetIp}:5555`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[ADB ERROR] No se pudo conectar a ${targetIp}:`, stderr || error.message);
    } else {
      console.log(`[ADB SUCCESS] ${stdout.trim()}`);
    }
  });
}

// Función para arrancar el servidor y registrarlo en PM2
function iniciarBackendYPM2() {
  const serverPath = path.join(__dirname, '..', 'server', 'index.js');
  const serverDir = path.join(__dirname, '..', 'server');

  console.log(`[SERVER] Iniciando servidor y PM2 desde: ${serverPath}`);

  // Comando para iniciar PM2 programáticamente con el index.js del server
  const pm2Command = `pm2 start "${serverPath}" --name "tr1-server" && pm2 save`;

  exec(pm2Command, { cwd: serverDir }, (error, stdout, stderr) => {
    if (error) {
      console.warn(`[PM2 WARNING] PM2 global no encontrado o falló el registro, ejecutando con Node directo...`, stderr || error.message);
      
      // Fallback: Si PM2 no está instalado globalmente en la PC, arranca con Node directo
      serverProcess = spawn('node', [serverPath], { cwd: serverDir, shell: true });
      
      serverProcess.stdout.on('data', (data) => console.log(`[SERVER LOG]: ${data}`));
      serverProcess.stderr.on('data', (data) => console.error(`[SERVER ERROR]: ${data}`));
    } else {
      console.log(`[PM2 SUCCESS] Proceso registrado y corriendo en PM2:\n${stdout}`);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});