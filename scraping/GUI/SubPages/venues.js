const webSources = '../webSources';
const imports = '../../import/';

const fs = require('fs');
const {app, Menu, ipcRenderer} = require('electron');
const {loadVenuesJSONFile, getStyleList, makeID, isAlias, saveToVenuesJSON} = require(imports+'jsonUtilities.js');
const {simplify, removeBlanks} = require(imports+'stringUtilities.js');

const midnightHourOptions = ['none','sameday','previousday'];
const lineHeightPx = document.getElementById('textURL').offsetHeight;

let hideAliases = true;

let venues = loadVenuesJSONFile();
const styleList = [''].concat(getStyleList().filter(el => el !=='')).concat(['Other']);
//let currentMode = 'show';



//const venueInfo = document.getElementById('venue-info');
const messageContainer = document.getElementById('message-container');

// // Créez un élément de paragraphe pour le message
// const messageParagraph = document.createElement('p');
// messageParagraph.textContent = 'Essai !!!!';

// // Ajoutez le paragraphe à l'élément conteneur
// messageContainer.appendChild(messageParagraph);

// button to add venue
const addVenueButton = document.getElementById('addVenueBtn');
addVenueButton.addEventListener('click', () => {
    updateVenueInfo('newVenue');
});

// hide or show aliases venues in the list
const hideAliasesCheckbox = document.getElementById('hideAliasesCheckbox');
if (hideAliases){
    hideAliasesCheckbox.checked = true;
}
hideAliasesCheckbox.addEventListener('change', () => {
    hideAliases = !hideAliases;
    populateVenuesMenu();
});

// button to process
const processButton = document.getElementById('processBtn');
processButton.addEventListener('click', () => {
    ipcRenderer.send('openProcessPage');
});


let countriesDropdown = document.getElementById('countriesDropdown');
let citiesDropdown = document.getElementById('citiesDropdown');
let venuesDropdown = document.getElementById('venuesDropdown');


// load countries dropdown menu
addToMenu(webSources,countriesDropdown);
countriesDropdown.selectedIndex = getKeyFromStorage('country',countriesDropdown);
let currentCountry = countriesDropdown.value;
addToMenu(webSources+ '/' + countriesDropdown.value,citiesDropdown);
citiesDropdown.selectedIndex = getKeyFromStorage('city',citiesDropdown);
let currentCity = citiesDropdown.value;
let currentVenues = getCurrentVenues();
populateVenuesMenu();
let currentName = venuesDropdown.value;
//let venue = getCurrentVenue();
updateVenueInfo('show');

// load cities menu when country changed
countriesDropdown.addEventListener('change', (event) => {
    currentCountry = event.target.value;
    sessionStorage.setItem('country', currentCountry);
    addToMenu(webSources+ '/' + currentCountry,citiesDropdown);
    citiesDropdown.dispatchEvent(new Event('change'));
});


citiesDropdown.addEventListener('change', (event) => {
    currentCity = event.target.value;
    sessionStorage.setItem('city', currentCountry);
    currentVenues = getCurrentVenues();
    populateVenuesMenu();
    venuesDropdown.dispatchEvent(new Event('change'));
});

venuesDropdown.addEventListener('change', (event) => {
    //const venueName = event.target.value;
    currentName = event.target.value;
    sessionStorage.setItem('venue|'+currentCity+'|'+currentCountry,currentName);
   // sessionStorage.setItem('currentVenue', JSON.stringify(getCurrentVenue()));
    sessionStorage.setItem('currentVenue', getCurrentVenue().ID);
    updateVenueInfo('show');
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

function populateVenuesMenu(){
    currentVenues = getCurrentVenues();
    venuesDropdown.innerHTML = '';
    const venueMenuWidth = Math.max(...(currentVenues.map(el => el.name.length)));
    venuesDropdown.style.width = venueMenuWidth+'ch';
    currentVenues.sort((a,b) => a.name.localeCompare(b.name))
    .filter(el => !hideAliases || !isAlias(el))
    .forEach(venue => {
        const option = document.createElement('option');
        option.text = venue.name;
        if (isAlias(venue)){
            option.classList.add('greyFont');
        }
        venuesDropdown.add(option);
    });
    venuesDropdown.selectedIndex = getKeyFromStorage('venue|'+currentCity+'|'+currentCountry,venuesDropdown);;
}

function getCurrentVenues(){
    return res = venues.filter(v => v.country === currentCountry && v.city === currentCity);
}

function getCurrentVenue(){
    return res = venues.find(v => v.country === currentCountry && v.city === currentCity && v.name === currentName);
}

function updateVenueInfo(mode){
    let venue;
    if (mode === 'newVenue'){
        venue = {'name': '',
        'city': currentCity,
        'country': currentCountry};
    }else{
        venue = getCurrentVenue();
    }
    const venueShowPanel = document.getElementById('venueShowPanel');
    venueShowPanel.style.display = 'none';
    const venueEditPanel = document.getElementById('venueEditPanel');;
    venueEditPanel.style.display = 'none';
 
    if (venue){
        if (mode === 'show'){
            //console.log(venue);
            venueShowPanel.style.display = 'block';
            // name      
            const divName = document.getElementById('venueName');
            divName.textContent = isAlias(venue)?venue.name+' (used as alias)':venue.name;
            if (isAlias(venue)){
                processButton.disabled = true;
                divName.classList.add('greyFont');
            }else{
                processButton.disabled = false;
                divName.classList.remove('greyFont');
            }
            const divAlias = document.getElementById('venueAliases');
            if (venue.hasOwnProperty('aliases')){
                divAlias.style.display = 'block';
                divAlias.textContent =  "Aliases: "+venue.aliases.join(', ');
            }else{
                divAlias.textContent =  '';
                divAlias.style.display = 'none';
            }
            
            // url
            const divURL = document.getElementById('venueURL');
            if (venue.hasOwnProperty('url')){
                divURL.textContent =  venue.url;
            }else{
                divURL.textContent = '';
            }
            
            const divMultipages = document.getElementById('divMultipages');
            if (isMultipages(venue)){
                divMultipages.style.display = 'block';
                if (venue.multiPages.hasOwnProperty('scroll')){
                    divMultipages.textContent = 'Page will be scrolled by puppeteer.';
                }else{
                    divMultipages.textContent =  'Multiple pages: will scrap '+venue.multiPages.nbPages+' pages.';
                    if (venue.multiPages.hasOwnProperty('pattern')){
                        divMultipages.textContent = divMultipages.textContent+' Pattern: \''+venue.multiPages.pattern+'\'';
                    }else if (venue.multiPages.hasOwnProperty('pageList')){
                        divMultipages.textContent = divMultipages.textContent+'\nList of pages to scrap: '
                                + venue.multiPages.pageList;
    
                    }else{
                        divMultipages.textContent = divMultipages.textContent+' Start index: '+venue.multiPages.startPage;
                    }
                }
 
            }else{
                divMultipages.textContent = '';
                divMultipages.style.display = 'none';             
            }
            // style
            const divStyle = document.getElementById('venueStyle');
            if (venue.hasOwnProperty('defaultStyle')){
                divStyle.style.display = 'block';        
                divStyle.textContent =  'Style: '+venue.defaultStyle; 
            } else{
                divStyle.style.display = 'none';        
                divStyle.textContent =  ''; 
            }
            // linked page
            const divLinkedPage = document.getElementById('venueLinkedPage');
            divLinkedPage.style.display = (venue.hasOwnProperty('linkedPage'))?'block':'none';
            // midnight hour
            const divmidnightHour = document.getElementById('midnightHour');
            if (venue.hasOwnProperty('midnightHour')){
                divmidnightHour.style.display = 'block';
                divmidnightHour.textContent =  venue.midnightHour === 'sameDay'?'Events at midnight are kept the same day.':'Events at midnight are moved to previous day';  
            } else{
                divmidnightHour.style.display = 'none';
                divmidnightHour.textContent = '';
            }
            // comment
            const divComments = document.getElementById('venueComments');
            if (venue.hasOwnProperty('comments')){
                divComments.style.display = 'block';
                divComments.textContent =  venue.comments;
            } else{
                divComments.style.display = 'none';
                divComments.textContent =  '';
            }

            // add modify button
            const button = document.getElementById('modifyVenue');
            button.addEventListener('click', function() {
                updateVenueInfo('edit');
            });
        //*************************/
        /*        edit mode       */
        //*************************/
        }else if (mode === 'edit' || mode === 'newVenue'){// if in edit mode
            venueEditPanel.style.display = 'block';
            toggleMenuesAction('off'); // prevent any action before changes have been saved or cancelled

            // name
            const nameText = document.getElementById('editVenueNameText');
            const inputNameField = document.getElementById('inputNameField');
            inputNameField.style.display = (mode === "edit")?'none':'inline';
            const divAlert = document.getElementById('nameAlert');
            divAlert.style.display = 'none';
            nameText.textContent = (mode === 'edit')?venue.name:'Venue name: ';
            nameText.style.display = (mode === 'edit')?'inline':'none';
            const aliasCheckbox = document.getElementById('aliasCheckbox');
            aliasCheckbox.checked = isAlias(venue);
            // aliases
            const textAlias = document.getElementById('textAlias');
            textAlias.value =  venue.hasOwnProperty('aliases')?venue.aliases.join('\n'):'';
            textAlias.setAttribute('rows', venue.hasOwnProperty('aliases')?venue.aliases.length:1);
            textAlias.addEventListener('input', function(event) {
                const nbLines = textAlias.value.split('\n').length;
                textAlias.setAttribute('rows', nbLines);
            }); 
            // url
            textURL.textContent =  venue.hasOwnProperty('url')?venue.url:'';
            function updateTextarea() {
                let content = textURL.textContent;
                const cursorPosition = getCaretPosition(textURL);
                const occurrences = content.match(/\{index\}/g);
                let nbOccurrences = occurrences ? occurrences.length : 0;
                const replacement = nbOccurrences > 1?'<span class="red-text">{index}<span class="black-text">':'<span class="blue-text">{index}<span class="black-text">';
                content = content.replace(/\{index\}/g, replacement);
                textURL.innerHTML = content;
                let indexSpans = textURL.querySelectorAll('.blue-text');
                indexSpans.forEach(function(span) {
                    span.style.color = 'blue';
                    // span.style.fontWeight = 'bold';
                });
                indexSpans = textURL.querySelectorAll('.red-text');
                indexSpans.forEach(function(span) {
                    span.style.color = 'red';
                //span.style.fontWeight = 'normal';
                });    
                indexSpans = textURL.querySelectorAll('.black-text');
                indexSpans.forEach(function(span) {
                    span.style.color = 'black';
                //span.style.fontWeight = 'normal';
                });
                // Restore cursor position
                setCaretPosition(textURL, cursorPosition);
            }
            textURL.addEventListener("input", updateTextarea);
            updateTextarea();
            // download
            const downloadPanel = document.getElementById('downloadPanel');
            // multipages
            let hasMP = isMultipages(venue);
            const MPButton = document.getElementById('MPButton');
            MPButton.textContent = hasMP?'Disable multiple pages':'Enable multiple pages';
            const MPFields = document.getElementById('MPfields');
            MPFields.style.display = hasMP?'block':'none';
            const nbPagesToScrap = document.getElementById('nbPagesToScrap');
            function changeMPPanel(hasMP){
                if (hasMP){
                    downloadPanel.classList.add('downLoadPanelOn');
                    downloadPanel.classList.remove('downLoadPanelOff');
                }else{
                    downloadPanel.classList.add('downLoadPanelOff');
                    downloadPanel.classList.add('downLoadPanelOn');
                }
            }
            changeMPPanel(hasMP);
            if (hasMP){
                if (venue.multiPages.hasOwnProperty('nbPages')){
                    nbPagesToScrap.value = String(venue.multiPages.nbPages);
                }
            }
            const selectMPFields = document.getElementById('selectMPFields');
            if (hasMP){
                if (venue.multiPages.hasOwnProperty('pattern')){
                    selectMPFields.selectedIndex = 1;
                }else if(venue.multiPages.hasOwnProperty('scroll')){
                    selectMPFields.selectedIndex = 2;
                }else if(venue.multiPages.hasOwnProperty('pageList')){
                    selectMPFields.selectedIndex = 3;
                }
            }else{
                selectMPFields.selectedIndex = 0;
            }
            const MPIndexInput = document.getElementById('MPIndex');
            if (hasMP && venue.multiPages.hasOwnProperty('startPage')){
                MPIndexInput.value = venue.multiPages.startPage;
            }
            const MPIncrementInput = document.getElementById('MPIncrement');
            if (hasMP && venue.multiPages.hasOwnProperty('increment')){
                MPIncrementInput.value = venue.multiPages.increment;
            }
            const MPPatternInput = document.getElementById('MPPattern');
            if (hasMP && venue.multiPages.hasOwnProperty('pattern')){
                MPPatternInput.value = venue.multiPages.pattern;
            }
            const MPPageListInput = document.getElementById('MPPageListInput');
            MPPageListInput.value = (venue.hasOwnProperty('multiPages') && venue.multiPages.hasOwnProperty('pageList'))?
                venue.multiPages.pageList.join('\n'):'';
            const divMPInfo = document.getElementById('divMPInfo');
            checkIndexWarning();
            const MPElements = document.querySelectorAll(".divMPIndex, .divMPPattern, .divMPPageList");
            setVisibility(MPElements,selectMPFields.value);
            selectMPFields.addEventListener('change', function(event) {
                setVisibility(MPElements,selectMPFields.value);
                checkIndexWarning();
            });
            MPButton.addEventListener('click', function() {
                hasMP = !hasMP;
                MPButton.textContent = hasMP?'Disable multiple pages':'Enable multiple pages';
                MPFields.style.display = hasMP?'block':'none';
                changeMPPanel(hasMP);
            });
            function checkIndexWarning(){
                divMPInfo.style.display =   selectMPFields.value === 'Scroll' ||
                                            selectMPFields.value === 'PageList' ||
                                            /\{index\}/.test(textURL.textContent) ? 'none':'inline';
            }
            textURL.addEventListener('input', function() {
                checkIndexWarning();
            }); 
            // style
            const selectStyle = document.getElementById('selectStyle');
            styleList.forEach(style => {
                const option = document.createElement('option');
                option.text = style;  
                selectStyle.appendChild(option);
            });
            selectStyle.selectedIndex = 0;
            if (venue.hasOwnProperty('defaultStyle')){
                const styleIndex = styleList.map(el => simplify(el)).indexOf(simplify(venue.defaultStyle));
                if (styleIndex === -1){
                    selectStyle.selectedIndex = styleList.length - 1;
                }else{
                    selectStyle.selectedIndex = styleIndex;
                }
            }   
            const inputStyle = document.getElementById('inputStyle');
            if (selectStyle.selectedIndex === styleList.length - 1){// odd style
                inputStyle.value = venue.defaultStyle;
                inputStyle.style.display = 'inline';
            }
            selectStyle.addEventListener('change', (event) => {
                inputStyle.style.display = (selectStyle.selectedIndex === styleList.length - 1)?'inline':'none';
            });
            // get linked page
            const linkedPageCheckbox = document.getElementById('linkedPageCheckbox');
            linkedPageCheckbox.checked = venue.hasOwnProperty('linkedPage')?true:false;    
            // midnight hour
            const selectMH = document.getElementById('selectMidnightHour');
            midnightHourOptions.forEach(action => {
                const option = document.createElement('option');
                option.text = action;  
                selectMH.appendChild(option);
            });
            selectMH.selectedIndex = 0;
            if (venue.hasOwnProperty('midnightHour')){
                const mhIndex = midnightHourOptions.map(el => simplify(el)).indexOf(simplify(venue.midnightHour));
                selectMH.selectedIndex = mhIndex === -1?0:mhIndex;
            }
            // comments
            const textComments = document.getElementById('textComments');
            textComments.textContent =  venue.hasOwnProperty('comments')?venue.comments:'';
            function aliasRender(){
                if (aliasCheckbox.checked){
                    downloadPanel.style.display = 'none';
                }else{
                    downloadPanel.style.display = 'block';
                }
            }
            aliasCheckbox.addEventListener("change", aliasRender);
            aliasRender();
             
            //*************************/
            // save and cancel buttons
            //*************************/
            const divButtons =  document.getElementById('divButtons');
            // add save button
            const saveButton = document.getElementById('saveVenue');
            saveButton.addEventListener('click', function() {
                // name
                if (mode === 'newVenue'){
                    venue.name = inputNameField.value;               
                }
                // is alias
                if (aliasCheckbox.checked === true){
                    delete venue.mainPage;
                }else{
                    if (!venue.hasOwnProperty('mainPage')){
                        venue.mainPage = {};
                    }
                }
                // aliases
                const aliases = splitArray(textAlias.value);
                if (aliases.length > 0){
                    venue.aliases = aliases;
                }else{
                    delete venue.aliases;
                }
                // url
                if (isNotBlank(textURL.value)){
                    venue.url = textURL.textContent;
                }else{
                    delete venue.url;
                }
                // multipages
                if (hasMP){
                    venue.multiPages = {};
                    venue.multiPages.nbPages = nbPagesToScrap.value;
                    // if (venue.multiPages.hasOwnProperty('pattern')){delete venue.multiPages.pattern;}
                    // if (venue.multiPages.hasOwnProperty('scroll')){delete venue.multiPages.scroll;}
                    // if (venue.multiPages.hasOwnProperty('startIndex')){delete venue.multiPages.startIndex;}
                    if (selectMPFields.selectedIndex === 0){             
                        venue.multiPages.startPage = MPIndexInput.value;
                        venue.multiPages.increment = MPIncrementInput.value;
                    }else if (selectMPFields.selectedIndex === 1){                          
                        venue.multiPages.pattern = MPPatternInput.value;
                    }else if (selectMPFields.selectedIndex === 2){                          
                        venue.multiPages.scroll = true;
                    }else{
                        venue.multiPages.pageList = splitArray(MPPageListInput.value);
                    }        
                }else{
                    delete venue.multiPages;
                }
                // style
                if (selectStyle.selectedIndex === 0){
                    delete venue.defaultStyle; 
                }else if (selectStyle.selectedIndex === styleList.length - 1){
                    venue.defaultStyle = inputStyle.value;
                }else{
                    venue.defaultStyle =  selectStyle.value;
                }// linked page
                    if (linkedPageCheckbox.checked){
                        if (!venue.hasOwnProperty('linkedPage')){
                            venue.linkedPage = {};
                        }
                    }else{
                        delete venue.linkedPage;
                    }
                // midnight hour
                if (selectMH.selectedIndex === 0){
                    delete venue.selectMH; 
                }else{
                    venue.midnightHour =  selectMH.value;
                }
                // comments
                if (isNotBlank(textComments.value)){
                    venue.comments = textComments.value;
                }else{
                    delete venue.comments;
                }
                // finalize save
                makeID(venue);
                if (mode === 'newVenue'){
                    venues.push(venue);
                    populateVenuesMenu();
                    for (let i = 0; i < venuesDropdown.options.length; i++) {
                        if (venuesDropdown.options[i].textContent === venue.name){
                            venuesDropdown.selectedIndex = i;
                            break;
                        }
                    }
                    currentName = venue.name;
                    sessionStorage.setItem('venue|'+currentCity+'|'+currentCountry,currentName);
                }
                saveToVenuesJSON(venues);
                sessionStorage.setItem('currentVenue', getCurrentVenue().ID);
                toggleMenuesAction('on');
                updateVenueInfo('show');
                //console.log(venue);
            });
            // add cancel button
            const cancelButton = document.getElementById('cancelVenue');
            cancelButton.addEventListener('click', function() {
                toggleMenuesAction('on');
                updateVenueInfo('show');
            });
            if (mode === 'newVenue'){
                saveButton.disabled = true;
            }
            inputNameField.addEventListener('input', (event) => {
                if (currentVenues.some(el => simplify(el.name) === simplify(inputNameField.value))){
                    divAlert.textContent = 'A venue with the same name already exists';
                    divAlert.style.display = 'inline';
                    saveButton.disabled = true;
                }else if (simplify(inputNameField.value) === ''){
                    divAlert.textContent = 'Empty name';
                    divAlert.style.display = 'inline';
                    saveButton.disabled = true;
                }else{
                    divAlert.textContent = '';
                    divAlert.style.display = 'none';
                    saveButton.disabled = false;
                }
            });
        }else{
            console.log('Unknown mode %s for modify venue button',mode);
        }
    }
}


function toggleMenuesAction(mode){
    if (mode === 'off'){
        countriesDropdown.addEventListener('mousedown', lockMenu);
        citiesDropdown.addEventListener('mousedown', lockMenu);
        venuesDropdown.addEventListener('mousedown', lockMenu);
        countriesDropdown.classList.add('inactive');
        citiesDropdown.classList.add('inactive');
        venuesDropdown.classList.add('inactive');
        addVenueButton.disabled = true;
        processButton.disabled = true;
        ipcRenderer.send('execute-fonction', 'changeMenu', false);    
    }else{
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

function getVenueFromName(string){
    return currentVenues.find(el => simplify(el.name) === simplify(string));
}

// test if there is multipage for a venue
function isMultipages(venue){
    return (venue.hasOwnProperty('multiPages'));
}


// function filterInteger(event) {
//     let value = event.target.value;
  
//     // Remplacer les caractères non numériques par une chaîne vide
//     value = value.replace(/\D/g, '');
  
//     // Mettre à jour la valeur du champ de texte avec les caractères filtrés
//     event.target.value = value;
// }

function setVisibility(list, value){
    const currentClass = "divMP"+value;
    list.forEach((el,index)=>{
        el.style.display = el.classList.contains(currentClass) ? 'block':'none';
    });
    const nbPagesPanel = document.getElementsByClassName('divMPnbPages');
    for(let i = 0; i < nbPagesPanel.length;i++){
        if (value === 'Scroll' || value === 'PageList'){
            nbPagesPanel[i].style.display = 'none';
        }else{
            nbPagesPanel[i].style.display = 'block';
        }
    }
    
}

function isNotBlank(string){
    return string !== '' && /[^\s\t\n]/.test(string);
}

function splitArray(list){
    return list.split('\n').map(el => removeBlanks(el)).filter(el => el !== '');
}

function getKeyFromStorage(key, dropDown){
    const value = sessionStorage.getItem(key);
    if (value === null){return 0;}
    const list = [];
    for(i=0;i<dropDown.length;i++){
        list.push(dropDown.options[i].textContent);
    }
    const index = list.indexOf(value);
    if (index === -1){
        return 0;
    }else{
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
  
