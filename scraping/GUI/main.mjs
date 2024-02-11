//import { app, BrowserWindow } from 'electron';
import electron from 'electron';
const { app, BrowserWindow, ipcMain } = electron;

// Listes A et B
const listeA = ['Option 1A', 'Option 2A', 'Option 3A'];
const listeB = ['Option 1B', 'Option 2B', 'Option 3B'];

// Création de la fenêtre
function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // Charger le fichier HTML
  fenetre.loadFile('index.html');
}

app.whenReady().then(creerFenetre);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    creerFenetre();
  }
});

// Renvoyer les listes A et B aux rendus HTML
//import { ipcMain } from 'electron';
ipcMain.on('get-listes', (event) => {
  event.reply('listes', { listeA, listeB });
});
