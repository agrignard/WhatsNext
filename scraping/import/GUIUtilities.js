/**************************************/
/*       utilities for the GUI        */
/**************************************/

const { app, BrowserWindow, Menu } = require('electron');


module.exports = {makeMenu, loadPage};

// load a page
function loadPage(page, window) {
    window.loadFile(page);
}

// Make application menu
function makeMenu(folder, window, enabled){
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
            label: 'Manage',
            submenu: [
             { label: 'Venues', enabled: enabled, click: () => { loadPage(folder+'venues.html', window); } },
             { label: 'Cities and countries', enabled: enabled, click: () => { loadPage(folder+'citiesAndCountries.html', window); } },
             { label: 'Languages', enabled: enabled, click: () => { loadPage(folder+'languages.html', window); } }
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
}
