const webSources = '../webSources';
const imports = '../../import/';

const fs = require('fs');
const { ipcRenderer } = require('electron');
// const { populate } = require('dotenv');
const {loadVenuesJSONFile, saveToVenuesJSON, getCountriesInfo, saveCountriesInfo} = require(imports+'jsonUtilities.js');
const {getLanguages, getAvailableLanguages} = require(imports+'languagesUtilities.js');
const {reinitializeMenu} = require(imports+'GUIUtilities.js');

const availableLanguages = getAvailableLanguages();

let countries = getCountriesInfo();

let currentCountry;
let currentCity;
let currentLanguages = [];
let currentAvailableLanguages = []; // languages that can be added for the current country
let languagesToAdd = [];

let venues = loadVenuesJSONFile();

// Left panel

// load menues and html containers
const countriesDropdown = document.getElementById('countriesDropdown');
const citiesDropdown = document.getElementById('citiesDropdown');
const addLanguageDropdown = document.getElementById('addLanguageDropdown');
const venuesList = document.getElementById('venuesList');
const languagesContainer = document.getElementById('languagesContainer');

/*****************************/
/*      Initialize page      */
/*****************************/

reinitializeMenu(Object.keys(countries),countriesDropdown);
updateCountriesMenu();

/*****************************/
/*        left panel         */
/*****************************/

// functions and listeners
// update countries dropdown menu
function updateCountriesMenu(countryToSelect = null){
    currentCountry = countryToSelect || countriesDropdown.value;
    // Reinit values for cities menu
    reinitializeMenu(countries[currentCountry].cities, citiesDropdown); 
    // update languages for the current country
    currentLanguages = countries[currentCountry].languages;
    currentAvailableLanguages = availableLanguages.filter(el => !currentLanguages.includes(el));
    languagesToAdd = availableLanguages.filter(el => !currentLanguages.includes(el));
    renderLanguages();
    // update venues menu
    updateCitiesAndVenuesMenu();
}

// function to update venues menu to only show venues from the selected city and country. If no city is selected, show venues from the whole country.
function updateCitiesAndVenuesMenu(){
    currentCity = citiesDropdown.value;
    const venuesFromSameCity = venues.filter(v => v.country === currentCountry && v.city === currentCity)
                                    .map(el => el.name);
    venuesList.innerHTML = '';
    const innerHtml = venuesFromSameCity.sort((a,b) => a.localeCompare(b))
                .map(el => '<li>'+el+'</li>').join('');
    venuesList.innerHTML = innerHtml;
    // update delete country button
    const deleteCountryBtn = document.getElementById('deleteCountryBtn');
    deleteCountryBtn.disabled = countries[currentCountry].cities.length !== 0;
    deleteCountryBtn.title = deleteCountryBtn.disabled ? "Delete country: delete cities associated to it first": "Delete country: delete all its cities and venues";

    // update delete city button
    const deleteCityBtn = document.getElementById('deleteCityBtn');
    deleteCityBtn.disabled = venuesFromSameCity.length !== 0 || countries[currentCountry].cities.length === 0;
    deleteCityBtn.title = deleteCityBtn.disabled ? "Delete city: delete venues associated to it first": "Delete city";
}

// country dropdown menu event listener : when country is changed, update cities menu and languages menu with the info of the new country. Also update the venues menu to only show venues from the selected country and city. When city is changed, update venues menu to only show venues from the selected city and country.
countriesDropdown.addEventListener('change', (event) => {
    updateCountriesMenu();
});

// city dropdown menu event listener : when city is changed, update venues menu to only show venues from the selected city and country.
citiesDropdown.addEventListener('change', (event) => {
    updateCitiesAndVenuesMenu();
});


function freezeElements(source, all = false){
    const elements = document.querySelectorAll('.freezable');
    elements.forEach(element => {
        if (all){
            element.disabled = false;
        }else if (element.id !== source){ 
            element.disabled = !element.disabled;
        }
    });
}

// button to add country and city
["country","city"].forEach(el =>{
    document.getElementById('add'+el+'Btn').addEventListener('click', () => {
        // Display dialog box to add new country/city
        if (document.getElementById(el+'Dialog').style.display === 'none'){
            freezeElements('add'+el+'Btn');
            document.getElementById('add'+el+'Btn').textContent = "Cancel";
            document.getElementById(el+'Dialog').style.display = 'block';
        }else{
            freezeElements('add'+el+'Btn');
            document.getElementById('add'+el+'Btn').textContent = "Add "+el;
            document.getElementById(el+'Dialog').style.display = 'none';
        }
    });
});


// event listener for new country
document.getElementById('countryConfirmBtn').addEventListener('click', () => {
    const newCountryName = document.getElementById('newCountryNameInput').value;
    if (newCountryName && Object.keys(countries).map(el => el.toLowerCase()).includes(newCountryName.toLowerCase())) {
        alert('This country already exists. Please choose another name.');
        return; 
    }
    if (newCountryName) {
        // create new country in countries info and save it
        countries[newCountryName] = {cities: [], languages: []};
        saveCountriesInfo(countries);
        // update countries dropdown menu with the new country and select it
        reinitializeMenu(Object.keys(countries), countriesDropdown);
        updateCountriesMenu(newCountryName);
        countriesDropdown.selectedIndex = Object.keys(countries).findIndex(el => el === currentCountry);
        // hide dialog box and reset input
        document.getElementById('addcountryBtn').textContent = "Add country";
        document.getElementById('countryDialog').style.display = 'none';
        document.getElementById('newCountryNameInput').value = '';
        freezeElements('countryConfirmBtn', true);
    }
});


// event listener for new city
document.getElementById('cityConfirmBtn').addEventListener('click', () => {
    // get new city name and check if it already exists for the current country. If it does, display an alert and do not add the city. If it doesn't, add the city to the current country in countries info and save it. Then update cities dropdown menu with the new city and select it. Finally, hide dialog box.
    const newCityName = document.getElementById('newCityNameInput').value;
    if (newCityName && countries[currentCountry].cities.map(el => el.toLowerCase()).includes(newCityName.toLowerCase())) {
        alert('This city already exists for the current country. Please choose another name.');
        return; 
    }
    if (newCityName) {
        // Add new city to the current country in countries info and save it
        countries[currentCountry].cities.push(newCityName); 
        saveCountriesInfo(countries); 
        // Update cities dropdown menu with the new city and select it
        reinitializeMenu(countries[currentCountry].cities, citiesDropdown);
        citiesDropdown.selectedIndex = countries[currentCountry].cities.findIndex(el => el === newCityName);
        updateCitiesAndVenuesMenu();
        // hide dialog box and reset input
        document.getElementById('addcityBtn').textContent = "Add city";
        document.getElementById('cityDialog').style.display = 'none';
        document.getElementById('newCityNameInput').value = '';
        freezeElements('cityConfirmBtn', true);
    }
});





/*****************************/
/*    language management    */
/*****************************/



// function to update the container of languages for the current country. Each language is a button that can be clicked to remove the language from the country. If the language is not available, the button should be disabled and have a different style.
function renderLanguages() {

    const container = document.getElementById("languagesContainer");
    container.innerHTML = "";
    currentLanguages.forEach(lang => {
        const row = document.createElement("div");
        row.className = "languageRow";

        const label = document.createElement("span");
        label.textContent = lang;
        label.className = "languageLabel";

        const deleteBtn = document.createElement("span");
        deleteBtn.textContent = "✖";
        deleteBtn.className = "languageDelete";
        deleteBtn.classList.add("freezable");

        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            removeLanguage(lang);
        };

        row.appendChild(label);
        row.appendChild(deleteBtn);

        container.appendChild(row);
    });
    checkLanguageAvailability();
}

// function to remove a language from the current country. Update countries info and save it, then update languages container to reflect the change and add the removed language to the add language dropdown menu.
function removeLanguage(lang) {
    const ok = confirm(`Remove language "${lang}" ?`);
    if (!ok) return;

    currentLanguages = currentLanguages.filter(l => l !== lang);
    currentAvailableLanguages = availableLanguages.filter(el => !currentLanguages.includes(el));
    countries[currentCountry].languages = currentLanguages;
    saveCountriesInfo(countries);
    renderLanguages();
}

// function to add a language to the current country. Update countries info and save it, then update languages container to reflect the change and remove the added language from the add language dropdown menu.
const languageInput = document.getElementById("languageInput");
const suggestions = document.getElementById("languageSuggestions");
let langMatches = [];

languageInput.addEventListener("input", () => {
    const value = languageInput.value.toLowerCase();
    suggestions.innerHTML = "";

    if (!value) {
        suggestions.style.display = "none";
        return;
    }
    langMatches = currentAvailableLanguages.filter(lang =>
        lang.toLowerCase().includes(value) &&
        !currentLanguages.includes(lang)
    );
    langMatches.forEach(lang => {
        const item = document.createElement("div");
        item.className = "suggestionItem";
        item.textContent = lang;

        item.onclick = () => {
            addLanguage(lang);
        };

        suggestions.appendChild(item);
    });
    suggestions.style.display = langMatches.length ? "block" : "none";
});

// function to add a language to the current country. Update countries info and save it, then update languages container to reflect the change and remove the added language from the add language dropdown menu.
function addLanguage(lang) {
    currentLanguages.push(lang);
    renderLanguages();
    countries[currentCountry].languages = currentLanguages;
    saveCountriesInfo(countries);

    languageInput.value = "";
    suggestions.style.display = "none";
}

// validate language input on enter key : if the input value is a valid language, add it to the current country. Otherwise, display an alert to inform the user that the language is not valid. A valid language is a language that is in the list of available languages and is not already in the list of current languages for the country.
languageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        if (langMatches.length === 0)  {return;}
        value = langMatches[0];
        addLanguage(value);
        e.preventDefault();
    }
});





/*****************************/
/*        right panel        */
/*****************************/


// venues removal form


let removeMode = false;

const removeVenuesModeButton = document.getElementById('removeVenuesModeButton');
const selectAllButton = document.getElementById('selectAllButton');
const removeVenuesButton = document.getElementById('removeVenuesButton');

// event listener for remove venues mode button : toggle remove mode. When remove mode is enabled, the user can select venues from the list and click on the remove venues button to remove them. When remove mode is disabled, the user cannot select venues from the list and the remove venues button is hidden.
removeVenuesModeButton.addEventListener('click', (event) => {
    removeMode = !removeMode;
    removeVenuesModeButton.textContent = removeMode ? "Prevent venues removal":"Enable venues removal";
    selectAllButton.style.display = removeMode ? 'inline':'none';
    removeVenuesButton.style.display = removeMode ? 'inline':'none';
    venuesList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    removeVenuesButton.disabled = true;
});

selectAllButton.addEventListener('click', (event) => {
    const items = venuesList.querySelectorAll('li');
    if (items.length === 0) return; 
    items.forEach(item => {
        item.classList.add('selected');
    });
    removeVenuesButton.disabled = false;
});

// event listener for venues list : when an item is clicked, toggle its selection. If ctrl key is pressed, allow multiple selection, otherwise only allow one selection. When at least one item is selected, enable the remove venues button, otherwise disable it.
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


// remove selected venues from the current city and country. Update venues JSON file and update venues menu to reflect the change. Display a confirmation dialog before removing the venues, with the list of venues to remove and a confirmation button.
removeVenuesButton.addEventListener('click', () => {
    const selectedItems = getSelectedItems();
    if (confirm("Deleting the following venues :\n\n- "+selectedItems.join('\n- ')+'\n\nProceed ?')) {
        removeItems(selectedItems);
      }
});

// function to remove venues from the venues list and from the JSON file. The function takes as input a list of venue names to remove. For each venue name, the function finds the corresponding venue object in the venues list, removes it from the list, and deletes the corresponding folder in webSources. Finally, the function saves the updated venues list to the JSON file and updates the venues menu to reflect the change.
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
    updateCitiesAndVenuesMenu();
}




/*****************************************************/
/*        delete cities and countries buttons        */
/*****************************************************/

// delete country button : delete the current country if it has no city, and update the menu and the venues list accordingly
document.getElementById("deleteCountryBtn").onclick = () => {
    const dropdown = document.getElementById("countriesDropdown");
    if (dropdown.selectedIndex >= 0) {
        const ok = confirm(`Remove country "${currentCountry}" ?`);
        if (!ok) return;
        countries = Object.fromEntries(Object.entries(countries).filter(([key, value]) => key !== currentCountry));
        saveCountriesInfo(countries);
        dropdown.remove(dropdown.selectedIndex);
        updateCountriesMenu();
    }
};

// delete city button : delete the current city from the current country if it has no venue, and update the menu and the venues list accordingly
document.getElementById("deleteCityBtn").onclick = () => {
    const dropdown = document.getElementById("citiesDropdown");
    if (dropdown.selectedIndex >= 0) {
        const ok = confirm(`Remove city "${currentCity}" ?`);
        if (!ok) return;
        countries[currentCountry].cities = countries[currentCountry].cities.filter(el => el !== currentCity);
        saveCountriesInfo(countries);
        dropdown.remove(dropdown.selectedIndex);
        updateCitiesAndVenuesMenu();
    }
};



/*******************************/
/*      general functions      */
/*******************************/

// general functions

function checkLanguageAvailability(){
    const languagesLabels = document.querySelectorAll('.languageLabel');
    languagesLabels.forEach(label => {     
        if(!availableLanguages.includes(label.textContent)){
            label.classList.add('unavailableLanguage'); 
            label.title = "This language is not available. Please add the corresponding date formats and styles to the dictionary file to enable it.";
        }   
    });
}