const webSources = '../webSources';
const imports = '../../import/';

const fs = require('fs');
const { shell } = require('electron');

const { app, Menu, ipcRenderer } = require('electron');
const { loadVenuesJSONFile, getStyleList, makeID, isActive, saveToVenuesJSON } = require(imports + 'jsonUtilities.js');
const { simplify, removeBlanks, normalizeUrl } = require(imports + 'stringUtilities.js');
const { to2digits } = require(imports + 'dateUtilities.js');

const midnightHourOptions = ['none', 'sameday', 'previousday'];

let hideAliases = true;

let urlToFollow;

let venues = loadVenuesJSONFile();
const styleList = [''].concat(getStyleList().filter(el => el !== '')).concat(['Other']);

////////////////////////////
// venue list management  //
////////////////////////////

// button to add venue
const addVenueButton = document.getElementById('addVenueBtn');
addVenueButton.addEventListener('click', () => {
    updateVenueInfo('newVenue');
});

// hide or show aliases venues in the list
const hideAliasesCheckbox = document.getElementById('hideAliasesCheckbox');
if (hideAliases) {
    hideAliasesCheckbox.checked = true;
}
hideAliasesCheckbox.addEventListener('change', () => {
    hideAliases = !hideAliases;
    populateVenuesMenu();
    venuesDropdown.selectedIndex = getKeyFromStorage('venue name', venuesDropdown);
});

// button to process
const processButton = document.getElementById('processBtn');
processButton.addEventListener('click', () => {
    localStorage.setItem('currentVenueId', getCurrentVenue().ID);
    ipcRenderer.send('openProcessPage');
});

let countriesDropdown = document.getElementById('countriesDropdown');
let citiesDropdown = document.getElementById('citiesDropdown');
let venuesDropdown = document.getElementById('venuesDropdown');

// load countries dropdown menu
addToMenu(webSources, countriesDropdown);
countriesDropdown.selectedIndex = getKeyFromStorage('country', countriesDropdown);
let currentCountry = countriesDropdown.value;
addToMenu(webSources + '/' + countriesDropdown.value, citiesDropdown);
citiesDropdown.selectedIndex = getKeyFromStorage('city', citiesDropdown);
let currentCity = citiesDropdown.value;
let currentVenues = getVenuesFromSameCity();
populateVenuesMenu();
venuesDropdown.selectedIndex = getKeyFromStorage('venue name', venuesDropdown);
let currentName = venuesDropdown.value;
saveToLocalStorage();

// load cities menu when country changed
countriesDropdown.addEventListener('change', (event) => {
    currentCountry = event.target.value;
    addToMenu(webSources + '/' + currentCountry, citiesDropdown);
    citiesDropdown.dispatchEvent(new CustomEvent('change', { detail: { history: 'history|' + currentCountry } }));
});

citiesDropdown.addEventListener('change', (event) => {
    currentCity = event.target.value;
    if (event.detail !== undefined && event.detail.history !== undefined) {
        citiesDropdown.selectedIndex = getKeyFromStorage(event.detail.history, citiesDropdown);
        currentCity = citiesDropdown.value;
    }
    populateVenuesMenu();
    venuesDropdown.dispatchEvent(new CustomEvent('change', { detail: { history: 'history|' + currentCountry + '|' + currentCity } }));
});

venuesDropdown.addEventListener('change', (event) => {
    currentName = event.target.value;
    if (event.detail !== undefined && event.detail.history !== undefined) {
        venuesDropdown.selectedIndex = getKeyFromStorage(event.detail.history, venuesDropdown);
        currentName = venuesDropdown.value;
    }
    saveToLocalStorage();
    updateVenueInfo('show');
});

/* auxiliary functions for dropdown menus and venues management */

function addToMenu(directory, menu) {
    try {
        menu.innerHTML = '';
        const files = fs.readdirSync(directory);
        files.forEach(file => {
            if (fs.statSync(directory + '/' + file).isDirectory()) {
                const option = document.createElement('option');
                option.text = file;
                menu.add(option);
            }
        });
        menu.selectedIndex = 0;
    } catch (err) {
        console.log("Cannot read directory ", directory);
        throw err;
    }
}

function populateVenuesMenu() {
    currentVenues = getVenuesFromSameCity();
    venuesDropdown.innerHTML = '';
    const venueMenuWidth = Math.max(...(currentVenues.map(el => el.name.length)));
    venuesDropdown.style.width = venueMenuWidth + 'ch';
    currentVenues.sort((a, b) => a.name.localeCompare(b.name))
        .filter(el => !hideAliases || isActive(el))
        .forEach(venue => {
            const option = document.createElement('option');
            option.text = venue.name;
            if (!isActive(venue)) {
                option.classList.add('greyFont');
            }
            venuesDropdown.add(option);
        });
    // venuesDropdown.selectedIndex = getKeyFromStorage('venue name',venuesDropdown);
}

function getVenuesFromSameCity() {
    return res = venues.filter(v => v.country === currentCountry && v.city === currentCity);
}

function aliasAlreadyExists(name) {
    return venues.filter(v => v.country === currentCountry && v.city === currentCity)
        .map(el => el.aliases)
        .filter(el => el !== undefined)
        .flat()
        .some(el => simplify(el) === simplify(name));
}

function getCurrentVenue() {
    return venues.find(v => v.country === currentCountry && v.city === currentCity && v.name === currentName) || undefined;
}





////////////////////////////////////
// venue info and edit interface  //
////////////////////////////////////


// save button, edit panel fields listeners

const saveButton = document.getElementById('saveVenue');
let saveListener = null;

const venueEditPanel = document.getElementById('venueEditPanel');
const editableFields = venueEditPanel.querySelectorAll('input, textarea, select, .editable');
editableFields.forEach(field => {
    field.addEventListener('change', () => {
        saveButton.disabled = false;
    });
    field.addEventListener('input', () => {
        saveButton.disabled = false;
    });
});

// modify button
const button = document.getElementById('modifyVenue');
button.addEventListener('click', function () {
    updateVenueInfo('edit');
});

// name
const nameText = document.getElementById('editVenueNameText');
const inputNameField = document.getElementById('inputNameField');
const divAlert = document.getElementById('nameAlert');

inputNameField.addEventListener('input', (event) => {
    if (currentVenues.some(el => simplify(el.name) === simplify(inputNameField.value))) {
        divAlert.textContent = 'A venue with the same name already exists';
        divAlert.style.display = 'inline';
        saveButton.disabled = true;
    } else if (aliasAlreadyExists(inputNameField.value)) {
        divAlert.textContent = 'A venue with the same alias already exists';
        divAlert.style.display = 'inline';
        saveButton.disabled = true;
    } else if (simplify(inputNameField.value) === '') {
        divAlert.textContent = 'Empty name';
        divAlert.style.display = 'inline';
        saveButton.disabled = true;
    } else {
        divAlert.textContent = '';
        divAlert.style.display = 'none';
        if (divAliasAlert.style.display === 'none') {
            saveButton.disabled = false;
        }
    }
});

// alias or active

let aliasCheckboxText = document.getElementById('aliasCheckboxText');
const aliasCheckbox = document.getElementById('aliasCheckbox');
aliasCheckbox.addEventListener('change', (event) => {
    aliasCheckboxText.textContent = aliasCheckbox.checked ? 'Active' : 'Alias';
});

// url

textURL.addEventListener('input', function () {
    checkIndexWarning();
});

const urlButton = document.getElementById('venueURL');
urlButton.addEventListener('click', function () {
    shell.openExternal(urlToFollow);
});

const urlButton2 = document.getElementById('followURLButton2');

urlButton2.addEventListener('click', function () {
    textURL.textContent = normalizeUrl(textURL.textContent);
    const url = textURL.textContent;
    shell.openExternal(url);
});



function updateTextarea() {
    let content = textURL.textContent;
    const cursorPosition = getCaretPosition(textURL);
    const occurrences = content.match(/\{index\}/g);
    let nbOccurrences = occurrences ? occurrences.length : 0;
    const replacement = nbOccurrences > 1 ? '<span class="red-text">{index}<span class="black-text">' : '<span class="blue-text">{index}<span class="black-text">';
    content = content.replace(/\{index\}/g, replacement);
    textURL.innerHTML = content;
    let indexSpans = textURL.querySelectorAll('.blue-text');
    indexSpans.forEach(function (span) {
        span.style.color = 'blue';
        // span.style.fontWeight = 'bold';
    });
    indexSpans = textURL.querySelectorAll('.red-text');
    indexSpans.forEach(function (span) {
        span.style.color = 'red';
        //span.style.fontWeight = 'normal';
    });
    indexSpans = textURL.querySelectorAll('.black-text');
    indexSpans.forEach(function (span) {
        span.style.color = 'black';
        //span.style.fontWeight = 'normal';
    });
    // Restore cursor position
    setCaretPosition(textURL, cursorPosition);
}
textURL.addEventListener("input", updateTextarea);

// aliases

const textAlias = document.getElementById('textAlias');
textAlias.addEventListener('input', function (event) {
    const aliasList = textAlias.value.split('\n');
    const nbLines = aliasList.length;
    textAlias.setAttribute('rows', nbLines);
    if (aliasList.some(al => currentVenues.some(el => simplify(el.name) === simplify(al)))) {
        divAliasAlert.textContent = 'A venue with the same name already exists';
        divAliasAlert.style.display = 'inline';
        saveButton.disabled = true;
    } else if (aliasList.some(el => aliasAlreadyExists(el))) {
        divAliasAlert.textContent = 'An alias is already in use for another venue';
        divAliasAlert.style.display = 'inline';
        saveButton.disabled = true;
    } else {
        divAliasAlert.textContent = '';
        divAliasAlert.style.display = 'none';
        if (simplify(inputNameField.value) !== '' && divAlert.style.display === 'none') {
            saveButton.disabled = false;
        }
    }
});
const divAliasAlert = document.getElementById('aliasAlert');


const activeSiteMenu = document.getElementById('activeSiteMenu');

// multipages

const multiPagePanelHeaderText = document.getElementById('multiPagePanelHeaderText');
const multipageCheckbox = document.getElementById('multipageCheckbox');
let multipageCheckboxText = document.getElementById('multipageCheckboxText');

const MPFields = document.getElementById('MPfields');
const dynamicPagePanel = document.getElementById('dynamicPagePanel');
const pageListPanel = document.getElementById('pageListPanel');

const scrollCheckbox = document.getElementById('scrollCheckbox');
const nextButtonCheckbox = document.getElementById('nextButtonCheckbox');
const nextButtonTextField = document.getElementById('nextButtonTextField');
const nextButtonTextPanel = document.getElementById('nextButtonTextPanel');
const dynamicPageLimitField = document.getElementById('dynamicPageLimitField');

let hasMP;

function setMultipage(hasMPValue) {
    hasMP = hasMPValue;
    multipageCheckbox.checked = hasMPValue;
    multipageCheckboxText.textContent = hasMP ? 'On' : 'Off';
    MPFields.style.display = hasMP ? 'block' : 'none';
    if (hasMP) {
        multiPagePanelHeaderText.classList.remove('inactive');
    } else {
        multiPagePanelHeaderText.classList.add('inactive');
    }
}

multipageCheckbox.addEventListener('change', (event) => {
    setMultipage(event.target.checked);
});

nextButtonCheckbox.addEventListener('change', (event) => {
    nextButtonTextPanel.style.display = nextButtonCheckbox.checked ? 'flex' : 'none';
});

document.querySelectorAll('input[name="choice"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const selected = document.querySelector('input[name="choice"]:checked');
        if (selected.value === 'pageList') {
            pageListPanel.style.display = 'block';
            dynamicPagePanel.style.display = 'none';
        } else {
            pageListPanel.style.display = 'none';
            dynamicPagePanel.style.display = 'block';
        }
    });
});

const MPElements = document.querySelectorAll(".divMPIndex, .divMPPattern, .divMPPageList");
const multiplePagesMethodSelection = document.getElementById('multiplePagesMethodSelection');
multiplePagesMethodSelection.addEventListener('change', function (event) {
    setVisibility(MPElements, multiplePagesMethodSelection.value);
    checkIndexWarning();
});

// iframes management
const iframesCheckbox = document.getElementById('iframesCheckbox');



// page list

const MPIndexInput = document.getElementById('MPIndex');
const MPIncrementInput = document.getElementById('MPIncrement');
const MPPatternInput = document.getElementById('MPPattern');
const MPPageListInput = document.getElementById('MPPageListInput');
const divMPInfo = document.getElementById('divMPInfo');

// style

const selectStyle = document.getElementById('selectStyle');
styleList.forEach(style => {
    const option = document.createElement('option');
    option.text = style;
    selectStyle.appendChild(option);
});
const inputStyle = document.getElementById('inputStyle');
if (selectStyle.selectedIndex === styleList.length - 1) {// odd style
    inputStyle.value = venue.defaultStyle;
    inputStyle.style.display = 'inline';
}
selectStyle.addEventListener('change', (event) => {
    inputStyle.style.display = (selectStyle.selectedIndex === styleList.length - 1) ? 'inline' : 'none';
});

// linked page panel
const linkedPageCheckbox = document.getElementById('linkedPageCheckbox');
const linkedPageDownloadMethodCheckbox = document.getElementById('linkedPageDownloadMethodCheckbox');
const linkedPageCheckboxText = document.getElementById('linkedPageCheckboxText');

// cancel button
const cancelButton = document.getElementById('cancelVenue');
cancelButton.addEventListener('click', function () {
    toggleMenuesAction('on');
    updateVenueInfo('show');
});

// start interface

updateVenueInfo('show');

//////////////////////////////////////////////////
// function to display venue info and edit them //
//////////////////////////////////////////////////



function updateVenueInfo(mode) {
    let venue;
    if (mode === 'newVenue') {
        venue = {
            'name': '',
            'city': currentCity,
            'country': currentCountry
        };
    } else {
        venue = getCurrentVenue();
        saveButton.disabled = true;
    }
    const venueShowPanel = document.getElementById('venueShowPanel');
    venueShowPanel.style.display = 'none';
    venueEditPanel.style.display = 'none';


    if (venue) {
        if (mode === 'show') {
            venueShowPanel.style.display = 'block';
            // name      
            const divName = document.getElementById('venueName');
            divName.textContent = !isActive(venue) ? venue.name + ' (used as alias)' : venue.name;
            if (!isActive(venue)) {
                processButton.disabled = true;
                divName.classList.add('greyFont');
            } else {
                processButton.disabled = false;
                divName.classList.remove('greyFont');
            }
            const divAlias = document.getElementById('venueAliases');
            if (venue.hasOwnProperty('aliases')) {
                divAlias.style.display = 'block';
                divAlias.textContent = "Aliases: " + venue.aliases.join(', ');
            } else {
                divAlias.textContent = '';
                divAlias.style.display = 'none';
            }

            // url
            const divURL = document.getElementById('venueURL');
            if (venue.hasOwnProperty('url')) {
                divURL.textContent = venue.url;
                urlToFollow = venue.url;
                if (venue.hasOwnProperty('multiPages')) {
                    if (venue.multiPages.hasOwnProperty('pattern')) {
                        const date = new Date();
                        const year = date.getFullYear();
                        const month = date.getMonth() + 1;
                        const day = date.getDate();
                        const pattern = venue.multiPages.pattern.replace(/MM|mm/, to2digits(String(month)))
                            .replace(/M|mm/, month).replace(/yyyy/, year)
                            .replace(/yy/, year - Math.round(year / 100) * 100)
                            .replace('dd', day);
                        if ((/\{index\}/.test(urlToFollow))) {
                            urlToFollow = urlToFollow.replace('\{index\}', pattern);
                        } else {
                            urlToFollow = urlToFollow + pattern;
                        }

                    }
                    if (venue.multiPages.hasOwnProperty('startPage')) {
                        if ((/\{index\}/.test(urlToFollow))) {
                            urlToFollow = urlToFollow.replace('\{index\}', venue.multiPages.startPage);
                        } else {
                            urlToFollow = urlToFollow + venue.multiPages.startPage;
                        }

                    }
                    // console.log(urlToFollow);
                }
            } else {
                divURL.textContent = '';
                urlToFollow = undefined;
            }

            const divMultipages = document.getElementById('divMultipages');
            if (isMultipages(venue)) {
                divMultipages.style.display = 'block';
                if (venue.multiPages.hasOwnProperty('scroll')) {
                    divMultipages.textContent = 'Page will be scrolled to get all events.';
                } else if (venue.multiPages.hasOwnProperty('nextButton')) {
                    divMultipages.textContent = 'Puppeteer will click on button \'' + venue.multiPages.nextButton + '\' to load the entire page.';
                } else {
                    divMultipages.textContent = 'Multiple pages: will scrap ' + venue.multiPages.nbPages + ' pages.';
                    if (venue.multiPages.hasOwnProperty('pattern')) {
                        divMultipages.textContent = divMultipages.textContent + ' Pattern: \'' + venue.multiPages.pattern + '\'';
                    } else if (venue.multiPages.hasOwnProperty('pageList')) {
                        divMultipages.textContent = divMultipages.textContent + '\nList of pages to scrap: '
                            + venue.multiPages.pageList;

                    } else {
                        divMultipages.textContent = divMultipages.textContent + ' Start index: ' + venue.multiPages.startPage;
                    }
                }

            } else {
                divMultipages.textContent = '';
                divMultipages.style.display = 'none';
            }
            // style
            const divStyle = document.getElementById('venueStyle');
            if (venue.hasOwnProperty('defaultStyle')) {
                divStyle.style.display = 'block';
                divStyle.textContent = 'Style: ' + venue.defaultStyle;
            } else {
                divStyle.style.display = 'none';
                divStyle.textContent = '';
            }
            // linked page
            const divLinkedPage = document.getElementById('venueLinkedPage');
            divLinkedPage.style.display = (venue.hasOwnProperty('linkedPage')) ? 'block' : 'none';
            // midnight hour
            const divmidnightHour = document.getElementById('midnightHour');
            if (venue.hasOwnProperty('midnightHour')) {
                divmidnightHour.style.display = 'block';
                divmidnightHour.textContent = venue.midnightHour === 'sameDay' ? 'Events at midnight are kept the same day.' : 'Events at midnight are moved to previous day';
            } else {
                divmidnightHour.style.display = 'none';
                divmidnightHour.textContent = '';
            }
            // comment
            const divComments = document.getElementById('venueComments');
            if (venue.hasOwnProperty('comments')) {
                divComments.style.display = 'block';
                divComments.textContent = venue.comments;
            } else {
                divComments.style.display = 'none';
                divComments.textContent = '';
            }


            //*************************/
            /*        edit mode       */
            //*************************/
        } else if (mode === 'edit' || mode === 'newVenue') {// if in edit mode
            venueEditPanel.style.display = 'block';
            toggleMenuesAction('off'); // prevent any action before changes have been saved or cancelled
            // name
            inputNameField.style.display = (mode === "edit") ? 'none' : 'inline';
            divAlert.style.display = 'none';
            nameText.textContent = (mode === 'edit') ? venue.name : 'Venue name: ';
            nameText.style.display = (mode === 'edit') ? 'inline' : 'none';

            // set alias or active
            aliasCheckbox.checked = isActive(venue);
            aliasCheckboxText.textContent = aliasCheckbox.checked ? 'Active' : 'Alias';
            aliasRender();

            // aliases
            textAlias.setAttribute('rows', venue.hasOwnProperty('aliases') ? venue.aliases.length : 1);
            textAlias.value = venue.hasOwnProperty('aliases') ? venue.aliases.join('\n') : '';
            divAliasAlert.style.display = 'none';

            // url
            textURL.textContent = venue.hasOwnProperty('url') ? venue.url : '';
            updateTextarea();

            // multipages header
            hasMP = isMultipages(venue);
            setMultipage(hasMP);

            // multipage type selection

            const selectedOption = hasMP && venue.multiPages.hasOwnProperty('type') ? venue.multiPages.type : "dynamicPage";
            document.getElementById(selectedOption).click();
            MPFields.style.display = hasMP ? 'block' : 'none';

            const nbPagesToScrap = document.getElementById('nbPagesToScrap');

            if (hasMP) {// fills fields for multipages and dynamic pages. Note that fields that are present in the venue 
                // may not be in used (but kept for records)

                // dynamic pages fields (scroll checkbox checked by default)
                scrollCheckbox.checked = venue.multiPages.hasOwnProperty('scroll') || venue.multiPages.type === 'pageList'; 
                nextButtonCheckbox.checked = venue.multiPages.hasOwnProperty('nextButton');
                nextButtonTextPanel.style.display = nextButtonCheckbox.checked ? 'flex' : 'none';
                if (venue.multiPages.hasOwnProperty('nextButton')) {
                    nextButtonTextField.value = venue.multiPages.nextButton;
                }
                if (venue.multiPages.hasOwnProperty('dynamicPageLimit')) {
                    dynamicPageLimitField.value = venue.multiPages.dynamicPageLimit;
                }
                iframesCheckbox.checked = venue.multiPages.hasOwnProperty('useIframes');

                // page list fields
                if (venue.multiPages.hasOwnProperty('nbPages')) {
                    nbPagesToScrap.value = String(venue.multiPages.nbPages);
                }
                multiplePagesMethodSelection.selectedIndex = 0;
                if (venue.multiPages.hasOwnProperty('pattern')) {
                    multiplePagesMethodSelection.selectedIndex = 1;
                } else if (venue.multiPages.hasOwnProperty('pageList')) {
                    multiplePagesMethodSelection.selectedIndex = 2;
                }
                if (venue.multiPages.hasOwnProperty('startPage')) {
                    MPIndexInput.value = venue.multiPages.startPage;
                }
                if (venue.multiPages.hasOwnProperty('increment')) {
                    MPIncrementInput.value = venue.multiPages.increment;
                }
                if (venue.multiPages.hasOwnProperty('pattern')) {
                    MPPatternInput.value = venue.multiPages.pattern;
                }
                MPPageListInput.value = (venue.multiPages.hasOwnProperty('pageList')) ?
                    venue.multiPages.pageList.join('\n') : '';
                checkIndexWarning();
            } else {// default options, predefined in case the user switches to MP
                multiplePagesMethodSelection.selectedIndex = 0;
                scrollCheckbox.checked = true;
            }
            // common actions. Some actions related to multipage have to be performed even if MP is not selected
            // in order to prepare the page display if switch to MP
            setVisibility(MPElements, multiplePagesMethodSelection.value);

            // style
            selectStyle.selectedIndex = 0;
            if (venue.hasOwnProperty('defaultStyle')) {
                const styleIndex = styleList.map(el => simplify(el)).indexOf(simplify(venue.defaultStyle));
                if (styleIndex === -1) {
                    selectStyle.selectedIndex = styleList.length - 1;
                } else {
                    selectStyle.selectedIndex = styleIndex;
                }
            }
            if (selectStyle.selectedIndex === styleList.length - 1) {// odd style
                inputStyle.value = venue.defaultStyle;
                inputStyle.style.display = 'inline';
            }

            // get linked page
            linkedPageCheckbox.checked = venue.hasOwnProperty('linkedPage') ? true : false;
            linkedPageCheckboxText.textContent = linkedPageCheckbox.checked ? 'On':'Off';
            linkedPageDownloadMethodCheckbox.checked = venue.hasOwnProperty('linkedPageDownloadMethod') ? true : false;
            linkedPageDownloadMethodDiv = document.getElementById('linkedPageDownloadMethodDiv');
            linkedPageDownloadMethodDiv.style.display = linkedPageCheckbox.checked ? 'inline' : 'none';
            linkedPageCheckbox.addEventListener('change', (event) => {
                linkedPageDownloadMethodDiv.style.display = linkedPageCheckbox.checked ? 'inline' : 'none';
                linkedPageCheckboxText.textContent = linkedPageCheckbox.checked ? 'On' : 'Off';
                if (linkedPageCheckbox.checked) {
                    linkedPageText.classList.remove('inactive');
                } else {
                    linkedPageText.classList.add('inactive');
                }
            });

            // midnight hour
            const selectMH = document.getElementById('selectMidnightHour');
            midnightHourOptions.forEach(action => {
                const option = document.createElement('option');
                option.text = action;
                selectMH.appendChild(option);
            });
            selectMH.selectedIndex = 0;
            if (venue.hasOwnProperty('midnightHour')) {
                const mhIndex = midnightHourOptions.map(el => simplify(el)).indexOf(simplify(venue.midnightHour));
                selectMH.selectedIndex = mhIndex === -1 ? 0 : mhIndex;
            }
            // comments
            const textComments = document.getElementById('textComments');
            textComments.textContent = venue.hasOwnProperty('comments') ? venue.comments : '';
            aliasCheckbox.addEventListener("change", aliasRender);
            aliasRender();

            /////////////////////////////
            // save and cancel buttons //
            /////////////////////////////

            // remove existing listeners
            if (saveListener){
                saveButton.removeEventListener('click', saveListener);
            }

            // add save button listener

            saveListener = function(event) {
                // name
                if (mode === 'newVenue') {
                    venue.name = inputNameField.value;
                }
                // is alias
                if (aliasCheckbox.checked === false) {
                    delete venue.mainPage;
                } else {
                    if (!venue.hasOwnProperty('mainPage')) {
                        venue.mainPage = {};
                    }
                }
                // aliases
                const aliases = splitArray(textAlias.value);
                if (aliases.length > 0) {
                    venue.aliases = aliases;
                } else {
                    delete venue.aliases;
                }
                // url
                if (isNotBlank(textURL.value)) {
                    venue.url = normalizeUrl(textURL.textContent);
                } else {
                    delete venue.url;
                }
                // multipages
                if (hasMP) {
                    venue.multiPages = {};

                    const MPType = document.querySelector('input[name="choice"]:checked').value;
                    venue.multiPages.type = MPType;

                    if (MPType === 'dynamicPage') {
                        if (scrollCheckbox.checked) {
                            venue.multiPages.scroll = true;
                        }
                        if (nextButtonCheckbox.checked) {
                            venue.multiPages.nextButton = nextButtonTextField.value;
                        }
                        if (dynamicPageLimitField.value) {
                            venue.multiPages.dynamicPageLimit = dynamicPageLimitField.value;
                        }
                        if (iframesCheckbox.checked) {
                            venue.multiPages.useIframes = true;
                        }
                    } else {
                        // save for page list behaviour
                        if (multiplePagesMethodSelection.selectedIndex < 2) {
                            venue.multiPages.nbPages = nbPagesToScrap.value;
                        }
                        if (multiplePagesMethodSelection.selectedIndex === 0) {
                            venue.multiPages.startPage = MPIndexInput.value;
                            venue.multiPages.increment = MPIncrementInput.value;
                        } else if (multiplePagesMethodSelection.selectedIndex === 1) {
                            venue.multiPages.pattern = MPPatternInput.value;
                        } else {
                            venue.multiPages.pageList = splitArray(MPPageListInput.value);
                        }
                    }
                } else {
                    delete venue.multiPages;
                }

                // style
                if (selectStyle.selectedIndex === 0) {
                    delete venue.defaultStyle;
                } else if (selectStyle.selectedIndex === styleList.length - 1) {
                    venue.defaultStyle = inputStyle.value;
                } else {
                    venue.defaultStyle = selectStyle.value;
                }// linked page
                if (linkedPageCheckbox.checked) {
                    if (!venue.hasOwnProperty('linkedPage')) {
                        venue.linkedPage = {};
                    }
                } else {
                    delete venue.linkedPage;
                }
                if (linkedPageDownloadMethodCheckbox.checked) {
                    if (!venue.hasOwnProperty('linkedPageDownloadMethod')) {
                        venue.linkedPageDownloadMethod = 'Puppeteer';
                    }
                } else {
                    delete venue.linkedPageDownloadMethod;
                }
                // midnight hour
                if (selectMH.selectedIndex === 0) {
                    delete venue.selectMH;
                } else {
                    venue.midnightHour = selectMH.value;
                }
                // comments
                if (isNotBlank(textComments.value)) {
                    venue.comments = textComments.value;
                } else {
                    delete venue.comments;
                }
                // finalize save
                makeID(venue);
                if (mode === 'newVenue') {
                    venues.push(venue);
                    populateVenuesMenu();
                    for (let i = 0; i < venuesDropdown.options.length; i++) {
                        if (venuesDropdown.options[i].textContent === venue.name) {
                            venuesDropdown.selectedIndex = i;
                            break;
                        }
                    }
                    currentName = venue.name;
                    saveToLocalStorage();
                    venuesDropdown.selectedIndex = getKeyFromStorage('venue name', venuesDropdown);
                }
                saveToVenuesJSON(venues);
                toggleMenuesAction('on');
                updateVenueInfo('show');
            }

            saveButton.addEventListener('click', saveListener);

            // swith save button status
            if (mode === 'newVenue') {
                saveButton.disabled = true;
            }
        } else {
            console.log('Unknown mode %s for modify venue button', mode);
        }
    }
}


function toggleMenuesAction(mode) {
    if (mode === 'off') {
        countriesDropdown.addEventListener('mousedown', lockMenu);
        citiesDropdown.addEventListener('mousedown', lockMenu);
        venuesDropdown.addEventListener('mousedown', lockMenu);
        countriesDropdown.classList.add('inactive');
        citiesDropdown.classList.add('inactive');
        venuesDropdown.classList.add('inactive');
        addVenueButton.disabled = true;
        processButton.disabled = true;
        ipcRenderer.send('execute-fonction', 'changeMenu', false);
    } else {
        countriesDropdown.removeEventListener('mousedown', lockMenu);
        citiesDropdown.removeEventListener('mousedown', lockMenu);
        venuesDropdown.removeEventListener('mousedown', lockMenu);
        countriesDropdown.classList.remove('inactive');
        citiesDropdown.classList.remove('inactive');
        venuesDropdown.classList.remove('inactive');
        addVenueButton.disabled = false;
        processButton.disabled = false;
        ipcRenderer.send('execute-fonction', 'changeMenu', true);
    }
}

function lockMenu(event) {
    event.preventDefault(); // Empêcher l'action par défaut (l'ouverture du menu déroulant)
}

function getVenueFromName(string) {
    return currentVenues.find(el => simplify(el.name) === simplify(string));
}

// test if there is multipage for a venue
function isMultipages(venue) {
    return (venue.hasOwnProperty('multiPages'));
}


// function filterInteger(event) {
//     let value = event.target.value;

//     // Remplacer les caractères non numériques par une chaîne vide
//     value = value.replace(/\D/g, '');

//     // Mettre à jour la valeur du champ de texte avec les caractères filtrés
//     event.target.value = value;
// }

function setVisibility(list, value) {
    const currentClass = "divMP" + value;
    list.forEach((el, index) => {
        el.style.display = el.classList.contains(currentClass) ? 'block' : 'none';
    });
    const nbPagesPanel = document.getElementsByClassName('divMPnbPages');
    for (let i = 0; i < nbPagesPanel.length; i++) {
        if (value === 'Scroll' || value === 'PageList') {
            nbPagesPanel[i].style.display = 'none';
        } else {
            nbPagesPanel[i].style.display = 'block';
        }
    }
}

function isNotBlank(string) {
    return string !== '' && /[^\s\t\n]/.test(string);
}

function splitArray(list) {
    return list.split('\n').map(el => removeBlanks(el)).filter(el => el !== '');
}

function getKeyFromStorage(key, dropDown) {
    let value = localStorage.getItem(key) || 0;
    const list = [];
    for (i = 0; i < dropDown.length; i++) {
        list.push(dropDown.options[i].textContent);
    }
    const index = list.indexOf(value);
    if (index === -1) {
        return 0;
    } else {
        return index;
    }
}


function getCaretPosition(element) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.setStart(element, 0);
        return range.toString().length;
    } else {
        return 0;
    }
}



// Fonction pour restaurer la position du curseur
function setCaretPosition(element, position) {
    const nodes = element.childNodes;
    let found = false;
    let offset = 0;

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
            var length = node.textContent.length;
            if (position <= length + offset) {
                var range = document.createRange();
                range.setStart(node, position - offset);
                range.collapse(true);
                var selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                found = true;
                break;
            } else {
                offset += length;
            }
        } else {
            offset += node.outerHTML.length;
        }
    }

    if (!found) {
        // Si la position n'a pas été trouvée, placer le curseur à la fin
        const range = document.createRange();
        range.setStart(element, element.childNodes.length);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

function saveToLocalStorage() {
    localStorage.setItem('country', currentCountry);
    localStorage.setItem('city', currentCity);
    localStorage.setItem('venue name', currentName);
    localStorage.setItem('history|' + currentCountry, currentCity);
    localStorage.setItem('history|' + currentCountry + '|' + currentCity, currentName);
}


function aliasRender() {
    if (aliasCheckbox.checked) {
        activeSiteMenu.style.display = 'block';
        isAliasInfo.style.display = 'none';
    } else {
        activeSiteMenu.style.display = 'none';
        isAliasInfo.style.display = 'inline';
    }
}

function checkIndexWarning() {
    divMPInfo.style.display = multiplePagesMethodSelection.value === 'PageList' ||
        /\{index\}/.test(textURL.textContent) ? 'none' : 'inline';
}
