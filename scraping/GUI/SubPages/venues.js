const webSources = '../webSources';
const imports = '../../import/';

const fs = require('fs');
const { ipcRenderer } = require('electron');
const {loadVenuesJSONFile} = require(imports+'jsonUtilities.js');

let venues = loadVenuesJSONFile();


const venueInfo = document.getElementById('venue-info');
const messageContainer = document.getElementById('message-container');

// Créez un élément de paragraphe pour le message
const messageParagraph = document.createElement('p');
messageParagraph.textContent = 'Essai !!!!';

// Ajoutez le paragraphe à l'élément conteneur
messageContainer.appendChild(messageParagraph);



let countriesDropdown = document.getElementById('countriesDropdown');
let citiesDropdown = document.getElementById('citiesDropdown');
let venuesDropdown = document.getElementById('venuesDropdown');


// load countries dropdown menu
addToMenu(webSources,countriesDropdown);
countriesDropdown.selectedIndex = 0;
let country = countriesDropdown.value;
addToMenu(webSources+ '/' + countriesDropdown.value,citiesDropdown);
citiesDropdown.selectedIndex = 0;
let city = citiesDropdown.value;
let currentVenues = getCurrentVenues(country, city);
populateVenuesMenu(currentVenues);
let name = venuesDropdown.value;
let venue = getCurrentVenue();
console.log(venue);
updateVenueInfo(venue);

// load cities menu when country changed
countriesDropdown.addEventListener('change', (event) => {
    country = event.target.value;
    addToMenu(webSources+ '/' + country,citiesDropdown);
    citiesDropdown.dispatchEvent(new Event('change'));
});


citiesDropdown.addEventListener('change', (event) => {
    city = event.target.value;
    console.log(city, country);
    currentVenues = getCurrentVenues(country, city);
    populateVenuesMenu(currentVenues);
});


let venueName;

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
        menu.innerHTML = '';
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

function populateVenuesMenu(venuesList){
    venuesDropdown.innerHTML = '';
    venuesList.forEach(venue => {
        const option = document.createElement('option');
        option.text = venue.name;
        venuesDropdown.add(option);
    });
    venuesDropdown.selectedIndex = 0;
}

function getCurrentVenues(country, city){
    return res = venues.filter(v => v.country === country && v.city === city);
}

function getCurrentVenue(){
    return res = venues.find(v => v.country === country && v.city === city && v.name === name);
}

function updateVenueInfo(){
    venue = getCurrentVenue();
    venueInfo.textContent = venue.name+"\n"+venue.city+"\n"+venue.country;
}