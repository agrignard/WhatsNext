const fs = require('fs');
const { ipcRenderer } = require('electron');

//import { ipcRenderer } from 'electron';

// import fs from 'fs';
// import pkg from 'electron';
// const { ipcRenderer } = pkg;

const webSources = '../webSources';

const messageContainer = document.getElementById('message-container');

// Créez un élément de paragraphe pour le message
const messageParagraph = document.createElement('p');
messageParagraph.textContent = 'Essai !!!!';

// Ajoutez le paragraphe à l'élément conteneur
messageContainer.appendChild(messageParagraph);



let countriesDropdown = document.getElementById('countriesDropdown');
const citiesDropdown = document.getElementById('citiesDropdown');

// load countries dropdown menu
addToMenu(webSources,countriesDropdown);
countriesDropdown.selectedIndex = 0;

addToMenu(webSources+ '/' + countriesDropdown.value,citiesDropdown);

// load cities menu
countriesDropdown.addEventListener('change', (event) => {
    const selectedCountry = event.target.value;
    console.log(webSources+ '/' + selectedCountry);
    // Erase old values
    citiesDropdown.innerHTML = '';
    addToMenu(webSources+ '/' + selectedCountry,citiesDropdown);
});

// button to add country

document.getElementById('addCountryBtn').addEventListener('click', () => {
    // Afficher la boîte de dialogue pour saisir le nom du nouveau pays
    document.getElementById('dialog').style.display = 'block';
});


   // Gestionnaire d'événements pour le bouton "Confirmer" dans la boîte de dialogue
   document.getElementById('confirmBtn').addEventListener('click', () => {
    // Récupérer le nom du nouveau pays depuis la zone de texte
    const newCountryName = document.getElementById('newCountryNameInput').value;
    if (newCountryName) {
        // Créer le répertoire correspondant au nouveau pays
        const newCountryDirectory = webSources + '/' + newCountryName;
        fs.mkdir(newCountryDirectory, (err) => {
            if (err) {
                console.error('Erreur lors de la création du répertoire :', err);
                return;
            }
            console.log('Répertoire créé avec succès :', newCountryDirectory);

            // Mettre à jour le menu déroulant des pays avec le nouveau pays
            const option = document.createElement('option');
            option.value = newCountryName;
            option.textContent = newCountryName;
            countriesDropdown.add(option);

            // Cacher la boîte de dialogue une fois terminée
            document.getElementById('dialog').style.display = 'none';
        });
    }
});





//countriesDropdown.dispatchEvent(new Event('change', {target:{value:'France'}}));


/***************** */

function addToMenu(directory, menu){
    try{
        const files = fs.readdirSync(directory);
        files.forEach(file => {
            if (fs.statSync(directory+'/'+file).isDirectory()) {
                const option = document.createElement('option');
                option.text = file;
                menu.add(option);
            }
        });
        menu.selectedIndex = 0;
    }catch(err){
        console.log("Cannot read directory ",directory);
        throw err;
    }
}
