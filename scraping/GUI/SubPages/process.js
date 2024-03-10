const webSources = '../webSources/';
const imports = '../../import/';

const fs = require('fs');
const cheerio = require('cheerio');
const {parseDocument} = require('htmlparser2');
const {app, Menu, ipcRenderer} = require('electron');
const {loadVenuesJSONFile, loadVenueJSON, loadScrapInfoFile, initializeVenue, saveToVenuesJSON, saveToScrapInfoJSON,
        fromLanguages, getLanguages, isValidEvent} = require(imports+'jsonUtilities.js');
const {simplify, removeBlanks, extractBody, convertToLowerCase, removeDoubles,
      makeURL} = require(imports+'stringUtilities.js');
const {getFilesContent, getModificationDate, loadLinkedPages, getFilesNumber} = require(imports+'fileUtilities.js');
const {downloadVenue, erasePreviousHtmlFiles, getHrefListFrom, downloadLinkedPages} = require(imports+'aspiratorexUtilities.js');
const {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings,
  splitAndLowerCase, addJSONBlock, reduceTag, getAllDates, getBestDateFormat,
  adjustMainTag, countNonEmptyEvents} = require(imports+'analexUtilities.js');
const {getDateConversionPatterns} =require(imports+'dateUtilities.js');

let intervalId, linkedFileContent, linkedPage, eventURL;
let stopCounter = false;
var localPage, cheerioTest, mainTag;
let freezeDelimiter = false;
let pageManagerReduced = false;
let log ='';
let mustIncludeURL  = true;
let mainTagAbsolutePath;
let nbPagesToShow = 5;
let nbPages = 0;

let currentPage = 'mainPage';

const useXmlMode = false;

/*****************************/
/*         initialize        */
/*****************************/

// get venue JSON
const venues = loadVenuesJSONFile();
const venueID = sessionStorage.getItem('currentVenue');
const venue = loadVenueJSON(venueID,venues);
if (!venue.hasOwnProperty('mainPage')){
  venue.mainPage = {};
}

if (venue.hasOwnProperty('eventURLIndex') && venue.eventURLIndex === -1){
  mustIncludeURL = false;
}

// initialize new venue
initializeVenue(venue,webSources);

// get languages, dates and format info
const languages = getLanguages();
const dateConversionPatterns = fromLanguages(getDateConversionPatterns(),languages[venue.country]);

// get scrap info
const scrapInfo = loadScrapInfoFile();
const venueScrapInfo = scrapInfo.hasOwnProperty(venueID)?{...scrapInfo[venueID]}:{};
if (!venueScrapInfo.hasOwnProperty('mainPage')){
  venueScrapInfo.mainPage = {};
}
if (venue.hasOwnProperty('linkedPage') && !venueScrapInfo.hasOwnProperty('linkedPage')){
  venueScrapInfo.linkedPage = {};
}

// get file if it exists
const sourcePath = webSources+'/'+venue.country+'/'+venue.city+'/'+venue.name+'/'
const multiPageManager = document.getElementById('multiPageManager');
const selectNbPages = document.getElementById('selectNbPages');
let lastModified = getModificationDate(sourcePath);
if (lastModified){
  nbPages = getFilesNumber(sourcePath);
  renderMultiPageManager(nbPages);
}

/*****************************/
/*      interface layout     */
/*****************************/


const rightPanel = document.getElementById('scrapEnDirexRightPanel');
//const leftPanel = document.getElementById('letPanel');
const analyzePanel = document.getElementById('analyzePanel');

// modify left panel

// download page panel
venueInfo.textContent = venue.name+' ('+venue.city+', '+venue.country+')';
const lastScrapped = document.getElementById('lastScrapped');
lastScrapped.textContent = lastModified?showDate(lastModified):"Page not downloaded yet.";
const downloadButton = document.getElementById('downloadButton');
const saveButton = document.getElementById('saveButton');
const missingLinksButton = document.getElementById('missingLinksButton');
const pageManager = document.getElementById('pageManager');
const pageManagerButton = document.getElementById('pageManagerButton');


// listeners

// compact view button
pageManagerButton.addEventListener('click',function(){
  pageManagerReduced = !pageManagerReduced;
  const pageManagerDetailsPanel = document.getElementById('pageManagerDetailsPanel');
  if (pageManagerReduced === true) {
    pageManagerDetailsPanel.style.display = 'none';
  } else {
    pageManagerDetailsPanel.style.display = 'block';
  }
});

// save Button
saveButton.addEventListener('click',function(){
  toLog("saved to JSON files:");
  removeEmptyFields(venue);
  toLog(JSON.stringify(venue));
  saveToVenuesJSON(venues);
  removeEmptyFields(venueScrapInfo);
  scrapInfo[venueID] = venueScrapInfo;
  toLog(JSON.stringify(venueScrapInfo));
  saveToScrapInfoJSON(scrapInfo);
  console.log(venueScrapInfo);
});


// download button
downloadButton.addEventListener('click', function() {
  downloadButton.disabled = true;
  missingLinksButton.disabled = true;
  stopCounter = false;
  cycleText(downloadButton);
  erasePreviousHtmlFiles(sourcePath)
  .then(() => {
    downloadVenue(venue,sourcePath)
    .then(() =>{
      lastModified = getModificationDate(sourcePath);
      if (lastModified){
        nbPages = getFilesNumber(sourcePath);
        renderMultiPageManager(nbPages);
      }
      lastScrapped.textContent = lastModified?showDate(lastModified):"Page not downloaded yet.";
      stopCounter = true;
      loadPage();
      downloadButton.disabled = false;
      missingLinksButton.disabled = false;
    })
  })
});

missingLinksButton.addEventListener('click', function(){
  downloadButton.disabled = true;
  missingLinksButton.disabled = true;
  stopCounter = false;
  cycleText(missingLinksButton);
  downloadLinkedPages(venue,sourcePath,[localPage])
  .then(_ =>
    {
      computeMissingLinks();
      stopCounter = true;
      downloadButton.disabled = false;
      missingLinksButton.disabled = false;
    })
});

// delimiter panel

const delimiterPanel = document.getElementById('delimiterPanel');
const DelimiterTitle = document.getElementById('DelimiterTitle');
const eventURLPanel = document.getElementById('eventURLPanel');
var delimiterTagField = document.getElementById('delimiterTagField');
delimiterTagField.value = venue.hasOwnProperty('eventsDelimiterTag')?venue.eventsDelimiterTag:'';
delimiterTagField.addEventListener('input'||'change',event =>{
  venue.eventsDelimiterTag = delimiterTagField.value;
  mainTag = cheerioTest(venue.eventsDelimiterTag);
  const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo)[currentPage]));
  mainTagAbsolutePath = getTagLocalization(mainTag,cheerioTest,false,stringsToFind);
  freezeDelimiter = true;
  freezeDelimiterButton.textContent = "Unfreeze";
  delimiterTagField.classList.add('inactive');
  computeTags();
  computeEventsNumber();
});

const freezeDelimiterButton = document.getElementById('freezeDelimiterButton');
freezeDelimiterButton.addEventListener('click', function() {
  freezeDelimiter = !freezeDelimiter;
  if (freezeDelimiter){
    freezeDelimiterButton.textContent = "Unfreeze";
    delimiterTagField.classList.add('inactive');
  }else{
    delimiterTagField.classList.remove('inactive');
    freezeDelimiterButton.textContent = "Freeze";
  }
});
const eventURLPanelWarning = document.getElementById('eventURLPanelWarning');
// adjust tag check box
const autoAdjustCheckbox = document.getElementById('autoAdjustCheckbox');
autoAdjustCheckbox.checked = true;
autoAdjustCheckbox.addEventListener('change',()=>{
  computeTags();
});
// adjust url check box
const adjustURLCheckbox = document.getElementById('adjustURLCheckbox');
adjustURLCheckbox.checked = mustIncludeURL;
adjustURLCheckbox.addEventListener('change',()=>{
  mustIncludeURL = adjustURLCheckbox.checked;
  computeTags();
});

// scrap panels

const eventNameStrings = document.getElementById('eventNameStrings');
const eventDateStrings = document.getElementById('eventDateStrings');
const eventStyleStrings = document.getElementById('eventStyleStrings');
const eventPlaceStrings = document.getElementById('eventPlaceStrings');
const eventURLStrings = document.getElementById('eventURLStrings');
const dateFormatText = document.getElementById('dateFormatText');
const eventURLTags = document.getElementById('eventPlaceTags');
const eventDummyStrings = document.getElementById('eventDummyStrings');
const eventDummyPanel = document.getElementById('eventDummy');
const scrapTextBoxes = document.getElementsByClassName('scrapTextBox');

eventURLStrings.addEventListener("keydown", function(event) {// prevents field URL tag to have more than one line
  if (event.key === "Enter") {
      event.preventDefault();
  }
});
eventURLTags.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
      event.preventDefault();
  }
});

const copyButtons = document.getElementsByClassName('copyButton');
for(let i = 0; i < copyButtons.length; i++){
  const button = copyButtons[i];
  const targetID = button.id.replace('CopyButton','');
  const target = document.getElementById(targetID);
  button.addEventListener("click", event =>{
    copyToTextBox(target);
  });
}

function copyToTextBox(target){
  const selection = window.getSelection();
  const textCopy = selection.toString();
  if (textCopy) {
    target.value = (target.value.replace(/(\n\s*)*$/,'').replace(/\n\s*\n/g,'\n')+'\n'+textCopy).replace(/^(\s*\n)*/,'');// remove blank lines
    if (target.classList.contains("eventURLgroup")){// prevents field URL tag to have more than one line
      target.value = target.value.replace(/\n/g,'');
    }
    textBoxUpdate(target);
  }
}

const eventURLPanelMessage = document.getElementById('eventURLPanelMessage');
const eventURLSelect = document.getElementById('eventURLSelect');

// initialize scraptextboxes
for(let i = 0; i < scrapTextBoxes.length; i++){
  const textBox = scrapTextBoxes[i];
  setRows(textBox);
  textBox.addEventListener('input', event =>{
    textBoxUpdate(textBox);
  });
}

function textBoxUpdate(textBox){
  setRows(textBox);
  if (textBox.id.endsWith('Tags')){
    venue[currentPage][textBox.id] = getArray(textBox.value);
    applyTags(false);
  }else{
    venueScrapInfo[currentPage][textBox.id] = getArray(textBox.value);
    computeTags(textBox.id);
  }
}



// log text
const logText = document.getElementById('logText');
function toLog(string){
  log += string + '\n';
  logText.textContent = log;
}
let logCompact = true;
const logButton = document.getElementById('logButton');
logButton.addEventListener('click', ()=>{
  logCompact = !logCompact;
  if (logCompact){
    logTextPanel.style.display = 'none';
  }else{
    logTextPanel.style.display = "block";
  }
})

// switch button

switchPageButton = document.getElementById('switchPageButton');
if (!venue.hasOwnProperty('linkedPage')){
  switchPageButton.style.display = 'none';
}
switchPageButton.addEventListener('click',() =>{
  scrapInfo[venueID] = venueScrapInfo;
  if (currentPage === 'mainPage'){
    currentPage = 'linkedPage';
    switchPageButton.textContent = '< Switch to main page';
    delimiterPanel.style.display = 'none';
    eventDummyPanel.style.display = 'none';
  }else{
    currentPage = 'mainPage';
    switchPageButton.textContent = 'Switch to linked page >';
    delimiterPanel.style.display = 'block';
    eventDummyPanel.style.display = 'block';
  }
  initializeInterface();
});

/*****************************/
/* intialize and right panel */
/*****************************/



initializeInterface();

function initializeInterface(){
  initScrapTextTags();
  if (currentPage === 'mainPage'){
    if (lastModified){// if the file exists
      loadPage();
    }else{
      rightPanel.textContent = 'Content not downloaded yet';
      analyzePanel.style.display = 'none';
      missingLinksPanel.style.display = 'none';
    }
  }else{
    if (true){// replace true by a condition to verify that the link exists
      loadLinkedPage();
    }
  }
  
  
}


function loadLinkedPage(){
  analyzePanel.style.display = 'block';
  const linkURL = makeURL(venue.baseURL,eventURL);
  linkedPage = linkedFileContent[linkURL];
  if (linkedPage){
    const parsedLinkedPage = parseDocument(convertToLowerCase('<html><head></head>'+linkedPage+'</html>'));
    cheerioTest = cheerio.load(parsedLinkedPage, { xmlMode: useXmlMode});
  }else{
    console.log('***** Error with linked page *****');
  }
  applyTags(false);
  // find missing links
  // if (validateDelimiterTags()){
  //   computeDateFormat();
  // }
}


/*****************************/
/*    auxiliary functions    */
/*****************************/


function applyTags(renderURL){
  function fillTags($eventBlock){
    const event = {};
    if (venue[currentPage].hasOwnProperty('eventNameTags')){
      let string = "";
      venue[currentPage].eventNameTags.forEach(tag =>{
        string += tag ===''?$eventBlock.text():$eventBlock(tag).text();
        $eventBlock(tag).addClass('highlightName');  
      });
      event.eventName = string;
    }
    if (venue[currentPage].hasOwnProperty('eventDateTags')){
      let string = "";
      venue[currentPage].eventDateTags.forEach(tag =>{
        string += tag ===''?$eventBlock.text():$eventBlock(tag).text();
        $eventBlock(tag).addClass('highlightDate');  
      });
      event.eventDate = string;
    }
    if (venue[currentPage].hasOwnProperty('eventStyleTags')){
      venue[currentPage].eventStyleTags.forEach(tag =>{
        $eventBlock(tag).addClass('highlightStyle');  
      });
    }
    if (venue[currentPage].hasOwnProperty('eventPlaceTags')){
      venue[currentPage].eventPlaceTags.forEach(tag =>{
        $eventBlock(tag).addClass('highlightPlace');  
      });
    }
    if (venue[currentPage].hasOwnProperty('eventURLTags')){
      venue[currentPage].eventURLTags.forEach(tag =>{
        $eventBlock(tag).addClass('highlightURL');  
      });
    }
    if (venue[currentPage].hasOwnProperty('eventDummyTags')){
      venue[currentPage].eventDummyTags.forEach(tag =>{
        $eventBlock(tag).addClass('highlightDummy');  
      });
    }
    return event;
  }

  if (currentPage === 'mainPage'){
    const $ = cheerio.load( parseDocument(convertToLowerCase(localPage)),{ xmlMode: useXmlMode});
    $(mainTagAbsolutePath).addClass('mainTag');
    $(venue.eventsDelimiterTag).each((index, delimiterTag) => {
      const eve = $(delimiterTag).html();
      const $eventBlock = cheerio.load(eve,{ xmlMode: useXmlMode});
      const event = fillTags($eventBlock);
      
      if (isValidEvent(event, venue)){
        $(delimiterTag).addClass('encadre');
      }else{
        $(delimiterTag).addClass('encadreInvalid');
      }
      $(delimiterTag).html($eventBlock.html());//modify the html to be displayed
    });
    rightPanel.innerHTML = $.html();
    rightPanel.querySelectorAll('a'||'select').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault(); 
      });
    });
  
    if (localPage){
      if (renderURL === true){
        renderEventURLPanel();
      }
    }else{
      analyzePanel.style.display = 'none';
    }
  
    const focusedElement = document.getElementsByClassName("mainTag")[0];
    if (focusedElement){
      focusedElement.scrollIntoView({ behavior: 'auto', block: 'start' });
     // rightPanel.scrollBy({top: -100, behavior: 'auto'});
     // rightPanel.scrollBy({top: -rightPanel.offsetHeight/2+focusedElement.offsetHeight/2, behavior: 'auto'});
    }
  }else{
    const $ = cheerio.load(parseDocument(convertToLowerCase('<html><head></head>'+linkedPage+'</html>')),{ xmlMode: useXmlMode});
    fillTags($);
    rightPanel.innerHTML = $.html();
    rightPanel.querySelectorAll('a'||'select').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault(); 
      });
    });
  }
}



function loadPage(){
  analyzePanel.style.display = 'block';
  localPage = reduceImgSize(getFilesContent(sourcePath, nbPagesToShow));
  cheerioTest = cheerio.load(parseDocument(convertToLowerCase(localPage)),{ xmlMode: useXmlMode});
  if (venue.hasOwnProperty('eventsDelimiterTag')){
    const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo)[currentPage]));
    const tagsContainingStrings =  getTagContainingAllStrings(cheerioTest,stringsToFind);
    mainTag = tagsContainingStrings.last();
    mainTagAbsolutePath = getTagLocalization(mainTag,cheerioTest,false,stringsToFind);
  }
  computeEventsNumber();
  applyTags(true);
  // find missing links
  computeMissingLinks();
  if (validateDelimiterTags()){
    computeDateFormat();
  }
}

function computeMissingLinks(){
  linkedFileContent = fs.existsSync(sourcePath+'linkedPages.json')?loadLinkedPages(sourcePath):[];
  const hrefList = getHrefListFrom([localPage],venue);
  const existingLinks = hrefList.filter(el => Object.keys(linkedFileContent).includes(el));
  const linksToDownload = hrefList.filter(el => !Object.keys(linkedFileContent).includes(el));
  const missingLinksPanel = document.getElementById('missingLinksPanel');
  missingLinksPanel.style.display = 'block';
  const missingLinksText = document.getElementById('missingLinksText');
  if (venue.hasOwnProperty('linkedPage') && lastModified){
    if (hrefList.length === 0){
      missingLinksText.textContent = 'No linked page references. ';
    }else{
      missingLinksText.textContent = 'Links downloaded: '+existingLinks.length+'/'+hrefList.length;
      if (linksToDownload.length === 0){
        missingLinksText.classList.remove('redFont');
        missingLinksButton.style.display = 'none';
      }else{
        missingLinksText.classList.add('redFont');
        missingLinksButton.style.display = 'inline';
      }
    }
  }else{
    missingLinksPanel.style.display = 'none';
  }
}


//getPageFromUrl();


//console.log(venue);

// function getPageFromUrl(){
//     console.log(venue.url);
//     fetch(venue.url)
//   .then(response => response.text())
//   .then(html => {
//     // Insérer le contenu chargé dans la balise <div>
//     rightPanel.innerHTML = html;

//     // Désactiver les liens hypertextes à l'intérieur de la balise
//     rightPanel.querySelectorAll('a').forEach(link => {
//       link.addEventListener('click', e => {
//         e.preventDefault(); // Empêcher le comportement par défaut du lien
//       });
//     });
//   })
//   .catch(error => console.error('Erreur de chargement de la page :', error));

// //     const response = await fetch(venue.url);
// //   //  console.log(response);
// //     rightPanel.innerHTML = response.text();
// }




function cycleText(target){
  const endMessage = target.textContent;
  const textList = ['Downloading','Downloading.','Downloading..','Downloading...'];
  let i = 0;
  target.textContent = textList[0];
  {
    intervalId = setInterval(() => {
      target.textContent = textList[i];
      i++;
      if (i === textList.length){
        i = 0;
      }
      if (stopCounter) {
        clearInterval(intervalId);
        target.textContent = endMessage;
      }
    }, 1000); 
  }
}

function showDate(date){
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); 
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const string = day+'/'+month+'/'+year+' at '+hour+':'+minutes+':'+seconds;
  return string;
}

function getValue(object){
  if (typeof(object)==="string"){
    return object;
  }else{
    return object.join('\n');
  }
}

function getArray(string){
  return string.split('\n');
}

function containsURL(tag){
  if (tag.is('a[href]')){//}.prop('tagName') == A){
    return true;
  }
  const $eventBlock = cheerio.load(cheerioTest(tag).html(),{ xmlMode: useXmlMode});
  const hrefs = $eventBlock('a[href]');
  if (hrefs.length > 0){
    return true;
  }else{
    return false;
  }
}

function computeTags(id){
  // compute main tag
  let delimiterHasChanged = false;
  if (!freezeDelimiter && currentPage === 'mainPage'){
    const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo)[currentPage]));
    const tagsContainingStrings =  getTagContainingAllStrings(cheerioTest,stringsToFind);
    mainTag = tagsContainingStrings.last();
    if (mustIncludeURL){// extend delimiter tag to include at least one url
      while(!containsURL(mainTag)){
        mainTag = mainTag.parent();
      }
    }
    mainTagAbsolutePath = getTagLocalization(mainTag,cheerioTest,false,stringsToFind);
    let delimiterTag = reduceTag(getTagLocalization(mainTag,cheerioTest,true,stringsToFind),cheerioTest);
    if (autoAdjustCheckbox.checked === true){
      delimiterTag = adjustMainTag(delimiterTag,cheerioTest,venue);
    }
    delimiterTag = delimiterTag.replace(/\s*$/,'');
    delimiterHasChanged = (delimiterTag !== venue.eventsDelimiterTag);
    if (delimiterHasChanged){
      delimiterTagField.value = delimiterTag;
      venue.eventsDelimiterTag = delimiterTag;
      computeEventsNumber();
    }
  }
  if (currentPage === 'mainPage'){
    if (validateDelimiterTags()){
      let $eventBlock = cheerio.load(cheerioTest(mainTag).html(),{ xmlMode: useXmlMode});
       venue[currentPage] = addJSONBlock(venueScrapInfo[currentPage],$eventBlock);
       computeDateFormat();
       applyTags(delimiterHasChanged || id === 'eventURLStrings');
       initScrapTextTags();
     }
  }else{
    let $eventBlock = cheerio.load(cheerioTest(mainTag).html(),{ xmlMode: useXmlMode});
    venue[currentPage] = addJSONBlock(venueScrapInfo[currentPage],cheerioTest);
    computeDateFormat();
    applyTags(false);
    initScrapTextTags();
  }
}

function computeDateFormat(){
  let dates = getAllDates(venue.eventsDelimiterTag,venue[currentPage]['eventDateTags'],cheerioTest);
  [venue.dateFormat, bestScore] = getBestDateFormat(dates,venue, dateConversionPatterns);
  let formatString = "Date format found: "+venue.dateFormat;
  if (bestScore !== 0){
    formatString += " ("+(dates.length-bestScore)+"/"+dates.length+" valid dates)";
  }
  dateFormatText.textContent = formatString;
}

function renderEventURLPanel(){
  if (venue.eventsDelimiterTag === undefined || venue.eventsDelimiterTag === ''){
    eventURLPanel.style.display = 'none';
    return;
  }
  let tag;
  eventURLPanel.style.display = 'block';
  if (mainTagAbsolutePath === ''){
    eventURLPanelWarning.style.display = 'block';
    tag = cheerioTest(venue.eventsDelimiterTag).first();
  }else{
    eventURLPanelWarning.style.display = 'none';
    tag = mainTag;
  }

  if (venue.mainPage.hasOwnProperty('eventURLTags')){
    eventURL = $eventBlock(venue.mainPage.eventURLTags[0]).text();
    $eventBlock = cheerio.load(cheerioTest(tag).html(),{ xmlMode: useXmlMode});
    eventURLPanelMessage.textContent = 'URL from tag: '+ eventURL;
    return;
  }
  const urlList = findURLs(cheerioTest(tag));
  // console.log(cheerioTest(tag).html());
  const index = urlList.findIndex(function(element) {
    return typeof element !== 'undefined';
  });
  venue.eventURLIndex = index;
  const definedURLs = urlList.filter(el => el !== undefined);
  const nbURLs = removeDoubles(definedURLs).length;
  if (definedURLs.length === 0){
    eventURLPanelMessage.textContent = 'No URL found.';
    eventURLSelect.style.display = 'none';
  } else if (nbURLs === 1){
    eventURL = urlList[index];
    eventURLPanelMessage.textContent = 'URL found: '+ eventURL;
    eventURLSelect.style.display = 'none';
  } else {
    eventURLPanelMessage.textContent = 'Choose URL to keep: ';
    eventURLSelect.innerHTML='';
    definedURLs.forEach(url => {
      const option = document.createElement('option');
      option.text = url;  
      eventURLSelect.appendChild(option);
    });
    eventURLSelect.style.display = 'inline';
    eventURLSelect.addEventListener('change', event =>{
      venue.mainPage.eventURLIndex = eventURLSelect - index;
      eventURL = eventURLSelect.value;
      console.log('eventURL',eventURL);
    });
  }
}



//aux functions

function setRows(textBox) {
  const nbLines = textBox.value.split('\n').length;
  textBox.setAttribute('rows', nbLines);
} 

function isValidTag(tag){
  try{
    const nbTags = cheerioTest(tag).length;
    return (!nbTags || nbTags===0)?false:true;
  }catch(err){
    return false;
  }
}


function validateDelimiterTags(){
  if (isValidTag(delimiterTagField.value)){
    delimiterTagField.classList.remove('invalid');
    return true;
  }else{
    delimiterTagField.classList.add('invalid');
    return false;
  }
}

function initScrapTextTags(){
  for(let i = 0; i < scrapTextBoxes.length; i++){
    const textBox = scrapTextBoxes[i];
    if (textBox.id.endsWith('Tags')){
      if (venue[currentPage].hasOwnProperty(textBox.id)){
        textBox.value = getValue(venue[currentPage][textBox.id]);
        setRows(textBox);
      }else{
        textBox.value = '';
      }
    }else{
      if (venueScrapInfo[currentPage].hasOwnProperty(textBox.id)){
        textBox.value = getValue(venueScrapInfo[currentPage][textBox.id]);
        setRows(textBox);
      }else{
        textBox.value = '';
      }
    }
  }
}


function findURLs(ctag){
  const $eventBlock = cheerio.load(ctag.html(),{ xmlMode: useXmlMode});
  let links;
  try{
    links = ctag.prop('tagName')=='A'?[ctag.attr('href')]:[undefined];
  }catch{
    links = [];
  }
  const hrefs = $eventBlock('a[href]');
  hrefs.each((index, element) => {
    const href = $eventBlock(element).attr('href');
    links.push(href);
  });   
  return links;
}




// console.log = function() {
//   const logText = document.getElementById('logText');
//   let message = arguments[0];
//   for(let i=1;i<arguments.length;i++){
//     const arg = arguments[i];
//     if (message.includes('%s')){
//       message = message.replace(/%s/,arg.toString());
//     }else{
//       if (Array.isArray(arg)) {
//         message += arg.join('\n');
//       }else{
//         message += ' '+arg;
//       }  
//     }
//   }
//   logText.value += message + '\n';
//   logText.scrollTop = logText.scrollHeight; // Faire défiler automatiquement vers le bas
// };

function reduceImgSize(html){
  const regexWidth = /(\<(?:img|svg)[^\<]*width\s*=\s*\")([^\"]*)\"/g;
  const regexHeight = /(\<(?:img|svg)[^\<]*height\s*=\s*\")([^\"]*)\"/g;

  function replace(p1,p2,p3){
    if (p3 > 100){
      return p2+'50'+'\"';
    }
    return p1;
  }
  return html.replace(regexWidth,replace).replace(regexHeight,replace);
}

function computeEventsNumber(){
  if (venue.hasOwnProperty('eventsDelimiterTag')){
    const nbEvents = countNonEmptyEvents(venue.eventsDelimiterTag,cheerioTest,venue);
    DelimiterTitle.textContent = "Delimiter tag (found "+nbEvents+" events)";
  }
}

function renderMultiPageManager(nbPages){
  if (nbPages <= 1){
    multiPageManager.style.display = 'none';
    return;
  }
  multiPageManager.style.display = 'block';
  selectNbPages.innerHTML='';
  for(i=1;i<=nbPages;i++){
    const option = document.createElement('option');
    option.text = i;
    option.value = i;  
    selectNbPages.appendChild(option);
  };
  nbPagesToShow = Math.min(nbPages,nbPagesToShow);
  selectNbPages.selectedIndex = nbPagesToShow-1;
}


function removeEmptyFields(object){
  fieldsToCheck = ['linkedPage','mainPage'];
  fieldsToCheck.forEach(field => {
    if (object.hasOwnProperty(field)){
      Object.keys(object[field]).forEach(key =>{
        object[field][key] = object[field][key].filter(el =>  /\S/.test(el));
        if (object[field][key].length === 0){
          delete object[field][key];
        }
      })
    }
  });
}