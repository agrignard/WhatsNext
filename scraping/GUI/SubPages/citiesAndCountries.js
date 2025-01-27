const webSources = '../webSources';
const imports = '../../import/';

const fs = require('fs');
const { ipcRenderer } = require('electron');
const { populate } = require('dotenv');
const {getLanguages, getAvailableLanguages, loadVenuesJSONFile, saveToVenuesJSON} = require(imports+'jsonUtilities.js');

const languagesJSON = getLanguages();
const availableLanguages = getAvailableLanguages();

let currentLanguages = [];

let venues = loadVenuesJSONFile();

// const messageContainer = document.getElementById('message-container');

// Créez un élément de paragraphe pour le message
const messageParagraph = document.createElement('p');
messageParagraph.textContent = 'Essai !!';

// Ajoutez le paragraphe à l'élément conteneur
// messageContainer.appendChild(messageParagraph);


let countriesDropdown = document.getElementById('countriesDropdown');
const citiesDropdown = document.getElementById('citiesDropdown');


// Sélectionner le conteneur des boutons
const languagesContainer = document.getElementById('languagesContainer');

// load countries dropdown menu
addToMenu(webSources,countriesDropdown);
countriesDropdown.selectedIndex = 0;
currentLanguages = languagesIn(countriesDropdown.options[0].textContent);
updateContainer(languagesContainer, currentLanguages);
checkLanguageAvailability();

addToMenu(webSources+ '/' + countriesDropdown.value,citiesDropdown);

// load cities menu
countriesDropdown.addEventListener('change', (event) => {
    const selectedCountry = event.target.value;
    // Erase old values
    citiesDropdown.innerHTML = '';
    addToMenu(webSources+ '/' + selectedCountry, citiesDropdown);
    currentLanguages = languagesIn(selectedCountry);
    updateContainer(languagesContainer, currentLanguages);
    checkLanguageAvailability();
    populateVenuesMenu();
});

// button to add country and city

["country","city"].forEach(el =>{
    document.getElementById('add'+el+'Btn').addEventListener('click', () => {
        // Afficher la boîte de dialogue pour saisir le nom du nouveau pays
        if (document.getElementById(el+'Dialog').style.display === 'none'){
            document.getElementById('add'+el+'Btn').textContent = "Cancel";
            document.getElementById(el+'Dialog').style.display = 'block';
        }else{
            document.getElementById('add'+el+'Btn').textContent = "Add "+el;
            document.getElementById(el+'Dialog').style.display = 'none';
        }
    });
});


// event listener for confirm button for country
document.getElementById('countryConfirmBtn').addEventListener('click', () => {
    // Récupérer le nom du nouveau pays depuis la zone de texte
    const newCountryName = document.getElementById('newCountryNameInput').value;
    if (newCountryName) {
        // Créer le répertoire correspondant au nouveau pays
        const newCountryDirectory = webSources + '/' + newCountryName;
        fs.mkdir(newCountryDirectory, (err) => {
            if (err) {
                console.error('Cannot create directory :', err);
                messageContainer.textContent = "Cannot create directory";
                return;
            }
            console.log('Directory successfully created :', newCountryDirectory);

            // Mettre à jour le menu déroulant des pays avec le nouveau pays
            const option = document.createElement('option');
            option.value = newCountryName;
            option.textContent = newCountryName;
            countriesDropdown.add(option);
            for (let i = 0; i < countriesDropdown.options.length; i++) {
                if (countriesDropdown.options[i].textContent === newCountryName) {
                    countriesDropdown.selectedIndex = i;
                    break;
                }
            }
            // Cacher la boîte de dialogue une fois terminée
            document.getElementById('addcountryBtn').textContent = "Add country";
            document.getElementById('countryDialog').style.display = 'none';
        });
    }
});


// event listener for confirm button for city
document.getElementById('cityConfirmBtn').addEventListener('click', () => {
    // Récupérer le nom du nouveau pays depuis la zone de texte
    const newCityName = document.getElementById('newCityNameInput').value;
    if (newCityName) {
        // Créer le répertoire correspondant au nouveau pays
        const newCityDirectory = webSources + '/' + countriesDropdown.value + '/' + newCityName;
        fs.mkdir(newCityName, (err) => {
            if (err) {
                console.error('Cannot create directory :', err);
                return;
            }
            console.log('Directory successfully created :', newCityName);

            // Mettre à jour le menu déroulant des pays avec le nouveau pays
            const option = document.createElement('option');
            option.value = newCityName;
            option.textContent = newCityName;
            citiesDropdown.add(option);

            // Cacher la boîte de dialogue une fois terminée
            document.getElementById('addcityBtn').textContent = "Add city";
            document.getElementById('cityDialog').style.display = 'none';
        });
    }
});


// venues removal form

const venuesList = document.getElementById('venuesList');
populateVenuesMenu();
let removeMode = false;

const removeVenuesModeButton = document.getElementById('removeVenuesModeButton');
const removeVenuesButton = document.getElementById('removeVenuesButton');

removeVenuesModeButton.addEventListener('click', (event) => {
    removeMode = !removeMode;
    removeVenuesModeButton.textContent = removeMode ? "Close remove mode":"Activate remove mode";
    removeVenuesButton.style.display = removeMode ? 'inline':'none';
    venuesList.style.display = removeMode ? 'block':'none';
    venuesList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    removeVenuesButton.disabled = true;
});



function populateVenuesMenu(){
    const currentCountry = countriesDropdown.value;
    const currentCity = citiesDropdown.value;
    const venuesFromSameCity = venues.filter(v => v.country === currentCountry && v.city === currentCity)
                                    .map(el => el.name);
    venuesList.innerHTML = '';
    const innerHtml = venuesFromSameCity.sort((a,b) => a.localeCompare(b))
                .map(el => '<li>'+el+'</li>').join('');
    venuesList.innerHTML = innerHtml;
}

citiesDropdown.addEventListener('change', (event) => {
    populateVenuesMenu();
});


venuesList.addEventListener('click', (event) => {
    const target = event.target;

    // Vérifier si l'utilisateur a cliqué sur un élément de la liste
    if (target.tagName === 'LI') {
        if (event.ctrlKey || event.metaKey) {
            // Ctrl+clic (ou Cmd+clic sur Mac) : Ajouter ou retirer l'élément de la sélection
            target.classList.toggle('selected');
        } else {
            // Clic simple : Désélectionner tous les autres et sélectionner uniquement l'élément cliqué
            const alreadySelected = target.classList.contains('selected');
            venuesList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            if (!alreadySelected){
                target.classList.add('selected');
            }
        }
        if (venuesList.querySelectorAll('.selected').length > 0){
            removeVenuesButton.disabled = false;
        }else{
            removeVenuesButton.disabled = true;
        }
    }
});

// get selected items from the list
const getSelectedItems = () => {
    const selectedElements = venuesList.querySelectorAll('.selected');
    const selectedTexts = Array.from(selectedElements).map(el => el.textContent.trim());
    return selectedTexts;
};

// Gestionnaire du bouton pour afficher les éléments sélectionnés

removeVenuesButton.addEventListener('click', () => {
    const selectedItems = getSelectedItems();
    if (confirm("Deleting the following venues :\n\n- "+selectedItems.join('\n- ')+'\n\nProceed ?')) {
        removeItems(selectedItems);
      }
    // alert('Éléments sélectionnés : ' + selectedItems.join(', '));
});

function removeItems(list){
    list.forEach(element => {
        const venue = venues.find(v => element===v.name);
        const path = webSources+'/'+venue.country+'/'+venue.city+'/'+venue.name;
        if (fs.existsSync(path)) {
            fs.rm(path, { recursive: true, force: true }, (err) => {
                if (err) {
                  console.error("Error while removing files from path:"+path+". ", err);
                }
            });
        } 
        venues = venues.filter(el => !(el.name === venue.name && el.city === venue.city && el.country === venue.country))
        saveToVenuesJSON(venues);
    });
    populateVenuesMenu();
}

//countriesDropdown.dispatchEvent(new Event('change', {target:{value:'France'}}));


/***************** */


// Créer et ajouter des boutons pour chaque élément de la liste de données
function updateContainer(container, dataList){
    container.innerHTML = '';
    dataList.forEach(item => {
        const button = document.createElement('button');
        button.textContent = item;
        button.classList.add('niceButton');
        button.dataset.value = item; // Vous pouvez stocker des données supplémentaires dans l'attribut data-* si nécessaire
        
        // Ajouter un gestionnaire d'événements pour chaque bouton
        button.addEventListener('click', function() {
            // Retirer la classe 'selected' de tous les boutons
            container.querySelectorAll('.optionButton').forEach(btn => {
                btn.classList.remove('selected');
            });
            // Ajouter la classe 'selected' au bouton cliqué
            this.classList.add('selected');
        });
    
        // Ajouter le bouton au conteneur des boutons
        container.appendChild(button);
    });
}

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


function languagesIn(country){
    if (languagesJSON.hasOwnProperty(country)){
        return languagesJSON[country];
    }else{
        return [];
    }
}

function checkLanguageAvailability(){
    const buttons = document.querySelectorAll('#languagesContainer button');
    buttons.forEach(button => {     
        if(!availableLanguages.includes(button.textContent)){
            button.classList.add('unavailable'); 
        }   
    });
}