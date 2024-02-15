const fs = require('fs');
const { ipcRenderer } = require('electron');



const webSources = '../webSources';

const messageContainer = document.getElementById('message-container');

// Créez un élément de paragraphe pour le message
const messageParagraph = document.createElement('p');
messageParagraph.textContent = 'Welcome to visualisatorex';

// Ajoutez le paragraphe à l'élément conteneur
messageContainer.appendChild(messageParagraph);



