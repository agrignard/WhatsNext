/**************************************/
/*       utilities for the GUI        */
/**************************************/

const { app, BrowserWindow, Menu } = require('electron');

const path = require('path');
const rootPath = path.resolve('.').match(/.*scraping/)[0]+'/';


module.exports = {makeMenu, loadPage, rootPath, reinitializeMenu};

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


// function to reinitialize a dropdown menu with a given list of values. The first value of the list will be selected by default.
function reinitializeMenu(list, menu){
    menu.innerHTML = '';
    list.forEach(el => {
        const option = document.createElement('option');
        option.text = el;
        menu.add(option);
    });
}
