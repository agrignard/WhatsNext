const webSources = '../webSources';
const imports = '../../import/';

const fs = require('fs');
const {app, Menu, ipcRenderer} = require('electron');
const {loadVenuesJSONFile, getStyleList, makeID, isAlias} = require(imports+'jsonUtilities.js');
const {simplify, removeBlanks} = require(imports+'stringUtilities.js');

const midnightHourOptions = ['none','sameday','previousday'];

let venues = loadVenuesJSONFile();
const styleList = [''].concat(getStyleList().filter(el => el !=='')).concat(['Other']);
//let currentMode = 'show';



const venueInfo = document.getElementById('venue-info');
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
    currentVenues.sort((a,b) => a.name.localeCompare(b.name)).forEach(venue => {
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
    venueInfo.innerHTML = '';
    if (venue){
        if (mode === 'show'){
            // name
            const divName = document.createElement('div');
            divName.id = 'venueName';
            divName.textContent = isAlias(venue)?venue.name+' (used as alias)':venue.name;
            if (isAlias(venue)){
                processButton.disabled = true;
                divName.classList.add('greyFont');
                divName.textContent = venue.name+' (used as alias)';
            }else{
                processButton.disabled = false;
                divName.textContent = venue.name;
            }
            venueInfo.appendChild(divName);
             // aliases
             if (venue.hasOwnProperty('aliases')){
                const divAlias = document.createElement('div');
                divAlias.id = 'venueAliases';
                divAlias.textContent =  "Aliases: "+venue.aliases.join(', ');
                venueInfo.appendChild(divAlias);  
            } 
            // url
            const divURL = document.createElement('div');
            divURL.id = 'venueURL';
            divURL.textContent =  venue.hasOwnProperty('scrapURL')?venue.scrapURL:'';
            venueInfo.appendChild(divURL);  
            if (isMultipages(venue)){
                const divMultipages = document.createElement('div');
                    divMultipages.id = 'divMultipages';
                    divMultipages.textContent =  'Multiple pages: will scrap '+venue.multiPages.nbPages+' pages.';
                    if (venue.multiPages.hasOwnProperty('pattern')){
                        divMultipages.textContent = divMultipages.textContent+' Pattern: \''+venue.multiPages.pattern+'\'';
                    }else if (venue.multiPages.hasOwnProperty('pageList')){
                        divMultipages.textContent = divMultipages.textContent+'\nList of pages to scrap: '
                                + venue.multiPages.pageList;

                    }else{
                        divMultipages.textContent = divMultipages.textContent+' Start index: '+venue.multiPages.startPage;
                    }
                venueInfo.appendChild(divMultipages); 
            }
            // style
            if (venue.hasOwnProperty('defaultStyle')){
                const divStyle = document.createElement('div');
                divStyle.id = 'venueStyle';
                divStyle.textContent =  'Style: '+venue.defaultStyle;
                venueInfo.appendChild(divStyle);  
            } 
            // linked page
            if (venue.hasOwnProperty('linkedPage')){
                const divLinkedPage = document.createElement('div');
                divLinkedPage.id = 'venueLinkedPage';
                divLinkedPage.textContent =  '(Contains linked pages)';
                venueInfo.appendChild(divLinkedPage);  
            } 
            // midnight hour
            if (venue.hasOwnProperty('midnightHour')){
                const divmidnightHour = document.createElement('div');
                divmidnightHour.id = 'venueMidnightHour';
                divmidnightHour.textContent =  '(Processes events at midnight)';
                venueInfo.appendChild(divmidnightHour);  
            } 
            // comment
            if (venue.hasOwnProperty('comments')){
                const divComments = document.createElement('div');
                divComments.id = 'venueComment';
                divComments.textContent =  venue.comments;
                venueInfo.appendChild(divComments);  
            } 

            // add modify button
            const button = document.createElement('button');
            button.id = 'modifyVenue';
            button.textContent = 'Modify';
            button.classList.add('modifyButton');
            button.addEventListener('click', function() {
                updateVenueInfo('edit');
            });
            venueInfo.appendChild(button);
        //*************************/
        /*        edit mode       */
        //*************************/
        }else if (mode === 'edit' || mode === 'newVenue'){// if in edit mode
            //const venuesFromSameCity = venues.filter(el => el.city === currentCity && el.country === currentCountry);
            toggleMenuesAction('off'); // prevent any action before changes have been saved or cancelled

            // name
            const divName = document.createElement('div');
                divName.id = 'venueName';
                if (mode === 'edit'){
                    divName.textContent = venue.name; 
                }else{
                    divName.textContent = 'Venue name:'; 
                    const inputName = document.createElement('input');
                        inputName.id = 'inputName';
                    divName.appendChild(inputName);
                    const divAlert = document.createElement('div');
                        divAlert.id = 'divAlert';
                        divAlert.textContent = 'A venue with the same name already exists';
                        divAlert.style.display = 'none';
                        // listener for divName is defined after save and cancel buttons
                    divName.appendChild(divAlert);
                }     
            venueInfo.appendChild(divName);
            // aliases
            let div = document.createElement('div');
                div.id = "divTextAlias";
                div.textContent = "Aliases:";
                const textAlias = document.createElement('textarea');
                    textAlias.id = 'textAliases';
                    textAlias.textContent =  venue.hasOwnProperty('aliases')?venue.aliases.join('\n'):'';
                    textAlias.setAttribute('rows', venue.hasOwnProperty('aliases')?venue.aliases.length+1:1);
                    textAlias.setAttribute('cols', '30');
                div.appendChild(textAlias);  
            venueInfo.appendChild(div);
            // url
            div = document.createElement('div');
                div.id = "divTextURL";
                div.textContent = "URL of agenda:";
                var textURL = document.createElement('textarea');
                    textURL.id = 'textURL';
                    textURL.contenteditable="true";
                    textURL.textContent =  venue.hasOwnProperty('scrapURL')?venue.scrapURL:'';
                    function updateTextarea() {
                        let content = textURL.textContent;
                        const cursorPosition = getCaretPosition(textURL);
                        console.log(content);
                        content = content.replace(/\{index\}/g, 
                            '<span class="blue-text">{index}<span class="black-text">');
                        console.log(content);
                        textURL.innerHTML = content;
                        let indexSpans = textURL.querySelectorAll('.blue-text');
                        indexSpans.forEach(function(span) {
                          span.style.color = 'blue';
                         // span.style.fontWeight = 'bold';
                        });    
                        indexSpans = textURL.querySelectorAll('.black-text');
                        indexSpans.forEach(function(span) {
                          span.style.color = 'black';
                        //span.style.fontWeight = 'normal';
                        });
                        // Restore cursor position
                        setCaretPosition(textURL, cursorPosition);
                      }
                    
                      // Événement de changement du contenu du div
                      textURL.addEventListener("input", updateTextarea);
                    
                      // Mettre à jour le div lors du chargement initial
                      updateTextarea();
                    // textURL.setAttribute('rows', '2');
                    // textURL.setAttribute('cols', '60');
                div.appendChild(textURL); 
            venueInfo.appendChild(div);
            // multipages
            const divMP = document.createElement('div');
                let hasMP = isMultipages(venue);
                divMP.id = "divMP";
                const MPButton = document.createElement('button');
                    MPButton.id = 'MPButton';
                    MPButton.textContent = hasMP?'Disable multiple pages':'Enable multiple pages';
                    MPButton.classList.add('niceButton');
                const MPFields = document.createElement('div');
                    MPFields.id = "MPfields";
                    MPFields.textContent = 'Indexation type:';
                    MPFields.style.display = hasMP?'block':'none';
                    const selectMPFields = document.createElement('select');
                        selectMPFields.id = "selectMPFields";
                        ['index','pattern','pageList'].forEach(type => {
                            const option = document.createElement('option');
                            option.text = type;  
                            selectMPFields.appendChild(option);
                        });
                        if (hasMP){
                            if (venue.multiPages.hasOwnProperty('pattern')){
                                selectMPFields.selectedIndex = 1;
                            }else if(venue.multiPages.hasOwnProperty('pageList')){
                                selectMPFields.selectedIndex = 2;
                            }
                        }else{
                            selectMPFields.selectedIndex = 0;
                        }
                    const divMPIndex = document.createElement('div');
                        divMPIndex.id ='divMPIndex';
                        divMPIndex.textContent = 'Start index:';
                        const MPIndexInput = document.createElement('input');
                            MPIndexInput.id = 'MPIndex';
                            MPIndexInput.value = '1';
                            MPIndexInput.addEventListener('input',  filterInteger); 
                        divMPIndex.appendChild(MPIndexInput);
                    const divMPPattern = document.createElement('div');
                        divMPPattern.id ='divMPPattern';
                        divMPPattern.textContent = 'Pattern:';
                        const MPPatternInput = document.createElement('input');
                            MPPatternInput.id = 'MPPattern';
                            MPPatternInput.value = 'yyyy-MM';
                            divMPPattern.appendChild(MPPatternInput);
                    const divMPPageList = document.createElement('div');
                        divMPPageList.id ='divMPPageList';
                        divMPPageList.textContent = 'Page list:';
                        const MPPageListInput = document.createElement('textarea');
                            MPPageListInput.id = 'divMPPageList';
                            MPPageListInput.value = (venue.hasOwnProperty('multiPages') && venue.multiPages.hasOwnProperty('pageList'))?
                                venue.multiPages.pageList.join('\n'):'';
                        divMPPageList.appendChild(MPPageListInput);
                    const divMPInfo = document.createElement('div');
                        divMPInfo.id ='divMPInfo';
                        divMPInfo.textContent = 'Agenda URL does not contain {index}. Page index will be append at the end of the URL.';
                        divMPInfo.style.display = /{index}/.test(textURL.value) ? 'none':'inline';
                    const MPElements = [divMPIndex, divMPPattern, divMPPageList];
                    setVisibility(MPElements,selectMPFields.selectedIndex);
                    selectMPFields.addEventListener('change', function(event) {
                        setVisibility(MPElements,selectMPFields.selectedIndex);
                    });
                    MPFields.appendChild(selectMPFields);
                    MPFields.appendChild(divMPIndex);
                    MPFields.appendChild(divMPPattern);
                    MPFields.appendChild(divMPPageList);
                    MPFields.appendChild(divMPInfo);
                MPButton.addEventListener('click', function() {
                    hasMP = !hasMP;
                    MPFields.style.display = hasMP?'block':'none';
                });
                divMP.appendChild(MPButton);
                divMP.appendChild(MPFields);
                textURL.addEventListener('input', function() {
                    divMPInfo.style.display = /{index}/.test(textURL.value) ? 'none':'inline';
                });
            venueInfo.appendChild(divMP); 
            // style
            div = document.createElement('div');
                div.id = "divTextStyle";
                div.textContent = "Default Style:";
                const selectStyle = document.createElement('select');
                    selectStyle.id = "selectStyle";
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
                const inputStyle = document.createElement('input');
                    inputStyle.id = 'inputStyle';
                    inputStyle.style.display = 'none';
                    if (selectStyle.selectedIndex === styleList.length - 1){// odd style
                        inputStyle.value = venue.defaultStyle;
                        inputStyle.style.display = 'inline';
                    }
                    selectStyle.addEventListener('change', (event) => {
                        inputStyle.style.display = (selectStyle.selectedIndex === styleList.length - 1)?'inline':'none';
                    });
                div.appendChild(selectStyle); 
                div.appendChild(inputStyle); 
            venueInfo.appendChild(div);
            div = document.createElement('div');
                div.id = "divLinkedPageCheck";
                div.textContent = "Download linked page:";
                const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox'; 
                    checkbox.id = 'linkedPageCheckbox'; 
                    checkbox.name = 'linkedPageCheckbox'; 
                    checkbox.checked = venue.hasOwnProperty('linkedPage')?true:false;    
                    div.appendChild(checkbox);     
            venueInfo.appendChild(div);
            // midnight hour
            div = document.createElement('div');
                div.id = "divSelectMidnightHour";
                div.textContent = "Midnight hour action:";
                const selectMH = document.createElement('select');
                    selectMH.id = "selectMidnightHout";
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
                div.appendChild(selectMH);
            venueInfo.appendChild(div);
            // comments
            div = document.createElement('div');
                div.id = "divTextComments";
                div.textContent = "Comments:";
                const textComments = document.createElement('textarea');
                textComments.id = 'textComments';
                textComments.textContent =  venue.hasOwnProperty('comments')?venue.comments:'';
                div.appendChild(textComments);  
            venueInfo.appendChild(div);
            //*************************/
            // save and cancel buttons
            //*************************/
            const divButtons = document.createElement('div');
                divName.id = 'divButtons';
                // add save button
                const saveButton = document.createElement('button');
                    saveButton.id = 'saveVenue';
                    saveButton.textContent = 'Save';
                    saveButton.classList.add('saveButton');
                    saveButton.addEventListener('click', function() {
                        // name
                        if (mode === 'newVenue'){
                            venue.name = inputName.value;               
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
                            venue.scrapURL = textURL.value;
                        }else{
                            delete venue.scrapURL;
                        }
                        // multipages
                        if (hasMP){
                            venue.multiPages = {};
                            if (venue.multiPages.hasOwnProperty('pattern')){delete venue.multiPages.pattern;}
                            if (venue.multiPages.hasOwnProperty('startIndex')){delete venue.multiPages.startIndex;}
                            if (selectMPFields.selectedIndex === 0){             
                                venue.multiPages.startIndex = MPIndexInput.value;
                            }else if (selectMPFields.selectedIndex === 1){                          
                                venue.multiPages.pattern = MPPatternInput.value;
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
                        sessionStorage.setItem('currentVenue', getCurrentVenue().ID);
                        toggleMenuesAction('on');
                        updateVenueInfo('show');
                        //console.log(venue);
                    });
                    // add cancel button
                const cancelButton = document.createElement('button');
                    cancelButton.id = 'cancelVenue';
                    cancelButton.textContent = 'Cancel';
                    cancelButton.classList.add('cancelButton');
                    cancelButton.addEventListener('click', function() {
                        toggleMenuesAction('on');
                        updateVenueInfo('show');
                    });
                divButtons.appendChild(saveButton);
                divButtons.appendChild(cancelButton);
            venueInfo.appendChild(divButtons);
            divName.addEventListener('input', (event) => {
                if (currentVenues.some(el => simplify(el.name) === simplify(inputName.value))){
                    divAlert.style.display = 'inline';
                    saveButton.disabled = true;
                }else{
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
        addVenueButton.disabled = true;
        processButton.disabled = true;
        ipcRenderer.send('execute-fonction', 'changeMenu', false);    
    }else{
        countriesDropdown.removeEventListener('mousedown', lockMenu);
        citiesDropdown.removeEventListener('mousedown', lockMenu);
        venuesDropdown.removeEventListener('mousedown', lockMenu);
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


function filterInteger(event) {
    let value = event.target.value;
  
    // Remplacer les caractères non numériques par une chaîne vide
    value = value.replace(/\D/g, '');
  
    // Mettre à jour la valeur du champ de texte avec les caractères filtrés
    event.target.value = value;
}

function setVisibility(list, selectedIndex){
    list.forEach((el,index)=>{
        el.style.display = selectedIndex === index ? 'block':'none';
    });
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
  
  