const { app, BrowserWindow, Menu } = require('electron');

const subFolder = './SubPages/';
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Désactive l'isolation de contexte pour l'utilisation de require dans le rendu (si nécessaire)
            devTools: true  
        }
    });
    mainWindow.loadFile('index.html');
}

    
const template = [
    {
        label: 'File',
        submenu: [
            { role: 'quit' }
        ]
    },
    {
       label: 'Edit',
       submenu: [
          {
             role: 'undo'
          },
          {
             role: 'redo'
          },
          {
             type: 'separator'
          },
          {
             role: 'cut'
          },
          {
             role: 'copy'
          },
          {
             role: 'paste'
          }
       ]
    },
    
    {
       label: 'View',
       submenu: [
          {
             role: 'reload'
          },
          {
             role: 'toggledevtools'
          },
          {
             type: 'separator'
          },
          {
             role: 'resetzoom'
          },
          {
             role: 'zoomin'
          },
          {
             role: 'zoomout'
          },
          {
             type: 'separator'
          },
          {
             role: 'togglefullscreen'
          }
       ]
    },
    
    {
       role: 'window',
       submenu: [
          {
             role: 'minimize'
          },
          {
             role: 'close'
          }
       ]
    },
    {
        label: 'Places and languages',
        submenu: [
            { label: 'Cities and countries', click: () => { loadPage('citiesAndCountries.html'); } },
            { label: 'Languages', click: () => { loadPage('languages.html'); } }
        ]
    },
    {
       role: 'help',
       submenu: [
          {
             label: 'Learn More'
          }
       ]
    }
 ]
 
 const menu = Menu.buildFromTemplate(template);
 Menu.setApplicationMenu(menu);


app.whenReady().then(createWindow);



function loadPage(page) {
    mainWindow.loadFile(subFolder+page);
}