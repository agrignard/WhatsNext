const webSources = '../webSources/';
const imports = '../../import/';

const fs = require('fs');
const cheerio = require('cheerio');
const {parseDocument} = require('htmlparser2');
const {app, Menu, ipcRenderer} = require('electron');
const { isValidEvent } = require('../../import/jsonUtilities');
const {loadVenuesJSONFile, loadVenueJSON, loadScrapInfoFile, initializeVenue, saveToVenuesJSON, saveToScrapInfoJSON,
        fromLanguages, getLanguages} = require(imports+'jsonUtilities.js');
const {simplify, removeBlanks, extractBody, convertToLowerCase, removeDoubles} = require(imports+'stringUtilities.js');
const {getFilesContent, getModificationDate, loadLinkedPages} = require(imports+'fileUtilities.js');
const {downloadVenue, erasePreviousHtmlFiles, getHrefListFrom, downloadLinkedPages} = require(imports+'aspiratorexUtilities.js');
const {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings,
  splitAndLowerCase, addJSONBlock, reduceTag, getAllDates, getBestDateFormat,
  adjustMainTag, countNonEmptyEvents} = require(imports+'analexUtilities.js');
const {getDateConversionPatterns} =require(imports+'dateUtilities.js');

let intervalId, linkedFileContent;
let stopCounter = false;
var localPage, cheerioTest, mainTag;
let freezeDelimiter = false;
let pageManagerReduced = false;
let log ='';
let mustIncludeURL  = true;
let mainTagAbsolutePath;


//const midnightHourOptions = ['none','sameday','previousday'];

// get venue JSON
const venues = loadVenuesJSONFile();
const venueID = sessionStorage.getItem('currentVenue');
const venue = loadVenueJSON(venueID,venues);
if (!venue.hasOwnProperty('scrap')){
  venue.scrap = {};
}
if (!venue.scrap.hasOwnProperty('eventNameTags')){
  venue.scrap.eventNameTags = [];
}
if (!venue.scrap.hasOwnProperty('eventDateTags')){
  venue.scrap.eventDateTags = [];
}
if (!venue.scrap.hasOwnProperty('eventStyleTags')){
  venue.scrap.eventStyleTags = [];
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


// get file if it exists
const sourcePath = webSources+'/'+venue.country+'/'+venue.city+'/'+venue.name+'/'
let lastModified = getModificationDate(sourcePath);

// modify html
// const venueInfo = document.getElementById('venueInfo');
// const venueInfoHeight = venueInfo.clientHeight;
// const processContainer = document.getElementById('processContainer');
// processContainer.style.height = `calc(100vh - ${venueInfoHeight}px)`;
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
  toLog("saved to JSON files.");
  console.log(venue);
  saveToVenuesJSON(venues);
  if (!scrapInfo.hasOwnProperty(venueID)){
    scrapInfo[venueID] = venueScrapInfo;
  }
  saveToScrapInfoJSON(scrapInfo);
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
const DelimiterTitle = document.getElementById('DelimiterTitle');
const eventURLPanel = document.getElementById('eventURLPanel');
var delimiterTagField = document.getElementById('delimiterTagField');
delimiterTagField.value = venue.hasOwnProperty('eventsDelimiterTag')?venue.eventsDelimiterTag:'';
delimiterTagField.addEventListener('input'||'change',event =>{
  venue.eventsDelimiterTag = delimiterTagField.value;
  if (validateDelimiterTags()){
    applyTags();
  }
  computeEventsNumber(cheerioTest);
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
// adjust tag check box
const autoAdjustCheckbox = document.getElementById('autoAdjustCheckbox');
autoAdjustCheckbox.checked = true;
// adjust url check box
const adjustURLCheckbox = document.getElementById('adjustURLCheckbox');
adjustURLCheckbox.checked = mustIncludeURL;
adjustURLCheckbox.addEventListener('change',()=>{
  mustIncludeURL = adjustURLCheckbox.checked;
  computeTags();
  applyTags();
  renderEventURLPanel();
})

// event name
const eventNameStrings = document.getElementById('eventNameStrings');
if (venueScrapInfo.mainPage.hasOwnProperty('eventNameStrings')){
  eventNameStrings.value = getValue(venueScrapInfo.mainPage.eventNameStrings);
}
const eventNameTags = document.getElementById('eventNameTags');
// event date
const eventDateStrings = document.getElementById('eventDateStrings');
if (venueScrapInfo.mainPage.hasOwnProperty('eventDateStrings')){
  eventDateStrings.value = getValue(venueScrapInfo.mainPage.eventDateStrings);
}
const eventDateTags = document.getElementById('eventDateTags');
const dateFormatText = document.getElementById('dateFormatText');
// event style
const eventStyleStrings = document.getElementById('eventStyleStrings');
if (venueScrapInfo.mainPage.hasOwnProperty('eventStyleStrings')){
  eventStyleStrings.value = getValue(venueScrapInfo.mainPage.eventStyleStrings);
}
const eventStyleTags = document.getElementById('eventStyleTags');
// event place
const eventPlaceStrings = document.getElementById('eventPlaceStrings');
if (venueScrapInfo.mainPage.hasOwnProperty('eventPlaceStrings')){
  eventPlaceStrings.value = getValue(venueScrapInfo.mainPage.eventPlaceStrings);
}
const eventPlaceTags = document.getElementById('eventPlaceTags');
// event dummy
const eventDummyStrings = document.getElementById('eventDummyStrings');
if (venueScrapInfo.mainPage.hasOwnProperty('eventDummyStrings')){
  eventDummyStrings.value = getValue(venueScrapInfo.mainPage.eventDummyStrings);
}
const eventDummyTags = document.getElementById('eventDummyTags');

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
  if (selection.toString().length > 0) {
    const textCopy = selection.toString();
    target.value = (target.value.replace(/(\n\s*)*$/,'').replace(/\n\s*\n/g,'\n')+'\n'+textCopy).replace(/^(\s*\n)*/,'');// remove blank lines
    textBoxUpdate(target);
    // computeTags(target.id.replace('Strings','Tags'));
    // applyTags();
  }
}


const scrapTextBoxes = document.getElementsByClassName('scrapTextBox');
initScrapTextTags();

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
    venue.scrap[textBox.id] = getArray(textBox.value);
    applyTags();
  }else{
   // console.log(venueScrapInfo);
    venueScrapInfo.mainPage[textBox.id] = getArray(textBox.value);
    //console.log(textBox.id);
    computeTags(textBox.id.replace('Strings','Tags'));
    applyTags();
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

// right panel
if (lastModified){// if the file exists
  loadPage();
}else{
  rightPanel.textContent = '';
  analyzePanel.style.display = 'none';
  missingLinksPanel.style.display = 'none';
}




function applyTags(){
  const $ = cheerio.load( parseDocument(convertToLowerCase(localPage)));
  $(mainTagAbsolutePath).addClass('mainTag');
  // const lowerCaseEventStrings = splitAndLowerCase(venueScrapInfo);
  // const stringsToFind = [].concat(...Object.values(lowerCaseEventStrings.mainPage));
  $(venue.eventsDelimiterTag).each((index, delimiterTag) => {
    const eve = $(delimiterTag).html();
    const event = {};
    const $eventBlock = cheerio.load(eve);
    if (venue.scrap.hasOwnProperty('eventNameTags')){
      let string = "";
      venue.scrap.eventNameTags.forEach(tag =>{
        string += tag ===''?$eventBlock.text():$eventBlock(tag).text();
        $eventBlock(tag).addClass('highlightName');  
      });
      event.eventName = string;
    }
    if (venue.scrap.hasOwnProperty('eventDateTags')){
      let string = "";
      venue.scrap.eventDateTags.forEach(tag =>{
        string += tag ===''?$eventBlock.text():$eventBlock(tag).text();
        $eventBlock(tag).addClass('highlightDate');  
      });
      event.eventDate = string;
    }
    if (venue.scrap.hasOwnProperty('eventStyleTags')){
      venue.scrap.eventStyleTags.forEach(tag =>{
        $eventBlock(tag).addClass('highlightStyle');  
      });
    }
    if (venue.scrap.hasOwnProperty('eventDummyTags')){
      venue.scrap.eventDummyTags.forEach(tag =>{
        $eventBlock(tag).addClass('highlightDummy');  
      });
    }
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
    renderEventURLPanel();
  }else{
    analyzePanel.style.display = 'none';
  }

  const focusedElement = document.getElementsByClassName("mainTag")[0];
  if (focusedElement){
    focusedElement.scrollIntoView({ behavior: 'auto', block: 'start' });
   // rightPanel.scrollBy({top: -100, behavior: 'auto'});
   // rightPanel.scrollBy({top: -rightPanel.offsetHeight/2+focusedElement.offsetHeight/2, behavior: 'auto'});
  }
}



function loadPage(){
  analyzePanel.style.display = 'block';
  localPage = reduceImgSize(getFilesContent(sourcePath));
  cheerioTest = cheerio.load(parseDocument(convertToLowerCase(localPage)));
  if (venue.hasOwnProperty('eventsDelimiterTag')){
    const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo).mainPage));
    const tagsContainingStrings =  getTagContainingAllStrings(cheerioTest,stringsToFind);
    mainTag = tagsContainingStrings.last();
    mainTagAbsolutePath = getTagLocalization(mainTag,cheerioTest,false,stringsToFind);
  }
  computeEventsNumber(cheerioTest);
  applyTags();
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
      missingLinksText.textContent = 'Cannot download linked pages, scrap info not defined yet.';
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

// prevent href links to be clicked


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

// minimize/maximize for the page manager
// function toggleDiv(target,minSize,maxSize) {
//   const div = document.getElementById(target);
//   if (div.style.height === minSize) {
//     div.style.height = maxSize; // Rétablir la hauteur initiale
//   } else {
//     div.style.height = minSize; // Réduire la hauteur
//   }
// }




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

function containURL(tag,$){
  if (tag.is('a[href]')){//}.prop('tagName') == A){
    console.log("balise A");
    return true;
  }
  console.log('tour');
  const $eventBlock = cheerio.load($(tag).html());
  const hrefs = $eventBlock('a[href]');
  if (hrefs.length > 0){
    return true;
  }else{
    return false;
  }
}


// function findURLs(ctag){
//   const $eventBlock = cheerio.load(ctag.html());
//   let links;
//   try{
//     links = ctag.prop('tagName')=='A'?[ctag.attr('href')]:[];
//   }catch{
//     links = [];
//   }
//   const hrefs = $eventBlock('a[href]');
//   hrefs.each((index, element) => {
//     const href = $eventBlock(element).attr('href');
//     links.push(href);
//   });   
//   return links;
// }

function computeTags(id){
  const $ = cheerio.load(parseDocument(convertToLowerCase(localPage)));
  // compute main tag
  if (!freezeDelimiter){
    const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo).mainPage));
    const tagsContainingStrings =  getTagContainingAllStrings($,stringsToFind);
    mainTag = tagsContainingStrings.last();
    if (mustIncludeURL){// extend delimiter tag to include at least one url
      while(!containURL(mainTag,$)){
        mainTag = mainTag.parent();
      }
    }
    mainTagAbsolutePath = getTagLocalization(mainTag,$,false,stringsToFind);
    let delimiterTag = reduceTag(getTagLocalization(mainTag,$,true,stringsToFind),$);
    if (autoAdjustCheckbox.checked === true){
      delimiterTag = adjustMainTag(delimiterTag,$,venue);
    }
    delimiterTagField.value = delimiterTag;
    venue.eventsDelimiterTag = delimiterTag;
    computeEventsNumber($);
  }
  if (validateDelimiterTags()){
   let $eventBlock = cheerio.load($(mainTag).html());
    venue.scrap = addJSONBlock(venueScrapInfo.mainPage,$eventBlock);
    console.log(venue.scrap);
    computeDateFormat();
    renderEventURLPanel();
    initScrapTextTags();
  }
}

function computeDateFormat(){
  const $ = cheerio.load(parseDocument(convertToLowerCase(localPage)));
  let dates = getAllDates(venue.eventsDelimiterTag,venue.scrap['eventDateTags'],$);
  let score;
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
  eventURLPanel.style.display = 'block';
  const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo).mainPage));
  const tag = cheerioTest(venue.eventsDelimiterTag);
  // find the index of the tag of the strings currently looked for
  let i;
  for (i=0;i<tag.length;i++){
    if (tagContainsAllStrings(cheerioTest(tag[i]), stringsToFind)){
      break;
    }
  }
  if (i===tag.length){
    i=0;
  }
  const urlList = findURLs(cheerioTest(tag[i]));
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
    eventURLPanelMessage.textContent = 'URL found: '+urlList[index];
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
      venue.scrap.eventURLIndex = eventURLSelect - index;
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
    if (venue.scrap.hasOwnProperty(textBox.id)){
      textBox.value = getValue(venue.scrap[textBox.id]);
      setRows(textBox);
    }

  }
}

function findURLs(ctag){
  const $eventBlock = cheerio.load(ctag.html());
  let links;
  try{
    links = ctag.prop('tagName')=='A'?[ctag.attr('href')]:[];
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


// function containURL(tagText){
//   let urlList;
//   if (tagText === ''){
//     urlList = findURLs(cheerioTest);
//   }else{
//     const tag = cheerioTest(tagText);
//     urlList = findURLs(cheerioTest(tag));
//   }
//   return urlList.some(el => el !== undefined);
// }


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

function computeEventsNumber(source){
  if (venue.hasOwnProperty('eventsDelimiterTag')){
    //nbEvents = source(venue.eventsDelimiterTag).length;
    const nbEvents = countNonEmptyEvents(venue.eventsDelimiterTag,source,venue);
    DelimiterTitle.textContent = "Delimiter tag (found "+nbEvents+" events)";
  }
}