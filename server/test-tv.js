import adb from 'adbkit';
const client = adb.createClient();

async function conectarYEnviarComando() {
  try {
    // 1. Conectar a la IP del Android TV en el puerto por defecto de ADB (5555)
    await client.connect('192.168.1.43', 5555);
    console.log("Conectado exitosamente al Android TV por ADB.");

    // 2. Enviar un comando de ejemplo (por ejemplo, simular la tecla HOME)
    await client.shell('192.168.1.43', 'input keyevent 3');
    console.log("Comando enviado: KEYCODE_HOME");
  } catch (error) {
    console.error("Error al conectar por ADB:", error);
  }
}

conectarYEnviarComando();