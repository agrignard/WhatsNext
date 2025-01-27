const imports = '../import/';
const subFolder = './SubPages/';

const {app, BrowserWindow, ipcMain} = require('electron');
const {makeMenu} = require(imports+'GUIUtilities.js');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Désactive l'isolation de contexte pour l'utilisation de require dans le rendu (si nécessaire)
            devTools: true  
        },
    });
   mainWindow.loadFile('index.html');
   makeMenu(subFolder, mainWindow, true);
}


ipcMain.on('execute-fonction', (event, functionName, mode) => {
   switch (functionName) {
       case 'changeMenu':
           makeMenu(subFolder, mainWindow, mode);
           break;
   }
});

ipcMain.on('openProcessPage', (event) => {
   mainWindow.loadFile('SubPages/process.html');
});

app.whenReady().then(createWindow);



