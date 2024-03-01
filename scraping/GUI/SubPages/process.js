const webSources = '../webSources/';
const imports = '../../import/';

const fs = require('fs');
const cheerio = require('cheerio');
const {parseDocument} = require('htmlparser2');
const {app, Menu, ipcRenderer} = require('electron');
const {loadVenuesJSONFile, loadVenueJSON, loadScrapInfoFile, initializeVenue, saveToVenuesJSON, saveToScrapInfoJSON,
        fromLanguages, getLanguages} = require(imports+'jsonUtilities.js');
const {simplify, removeBlanks, extractBody, convertToLowerCase} = require(imports+'stringUtilities.js');
const {getFilesContent, getModificationDate, loadLinkedPages} = require(imports+'fileUtilities.js');
const {downloadVenue, erasePreviousHtmlFiles, getHrefListFrom, downloadLinkedPages} = require(imports+'aspiratorexUtilities.js');
const {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings,
  splitAndLowerCase, addJSONBlock, reduceTag, getAllDates, getBestDateFormat} = require(imports+'analexUtilities.js');
const {getDateConversionPatterns} =require(imports+'dateUtilities.js');

let intervalId, linkedFileContent;
let stopCounter = false;
var localPage, cheerioTest, mainTag;
let freezeDelimiter = false;
let pageManagerReduced = false;
let log ='';


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
var delimiterTagField = document.getElementById('delimiterTag');
delimiterTagField.value = venue.hasOwnProperty('eventsDelimiterTag')?venue.eventsDelimiterTag:'';
delimiterTagField.addEventListener('input'||'change',event =>{
  venue.eventsDelimiterTag = delimiterTagField.value;
  validateDelimiterTags(delimiterTagField);
  applyTags();
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
    console.log(textBox.id);
    computeTags(textBox.id.replace('Strings','Tags'));
    applyTags();
  }
 // console.log(venue);
}

// button analyze
// const analyzeButton = document.getElementById('analyzeButton');
// analyzeButton.addEventListener('click',event=>{
//   computeTags();
//   applyTags();
// });

// log text
const logText = document.getElementById('logText');
function toLog(string){
  log += string + '\n';
  logText.textContent = log;
}


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
  const lowerCaseEventStrings = splitAndLowerCase(venueScrapInfo);
  const stringsToFind = [].concat(...Object.values(lowerCaseEventStrings.mainPage));
  $(venue.eventsDelimiterTag).each((index, delimiterTag) => {
    $(delimiterTag).addClass('encadre');
     if (tagContainsAllStrings($(delimiterTag),stringsToFind)){
      $(delimiterTag).addClass('mainTag');
     }
    const eve = $(delimiterTag).html();
    const $eventBlock = cheerio.load(eve);
    venue.scrap.eventNameTags.forEach(tag =>{
      $eventBlock(tag).addClass('highlightName');  
    });
    if (venue.scrap.hasOwnProperty('eventDateTags')){
      venue.scrap.eventDateTags.forEach(tag =>{
        $eventBlock(tag).addClass('highlightDate');  
      });
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
    $(delimiterTag).html($eventBlock.html());
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
  localPage = getFilesContent(sourcePath);
  cheerioTest = cheerio.load(parseDocument(convertToLowerCase(localPage)));
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

function computeTags(id){
  const $ = cheerio.load(parseDocument(convertToLowerCase(localPage)));
  if (!freezeDelimiter){
    const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo).mainPage));
    const tagsContainingStrings =  getTagContainingAllStrings($,stringsToFind);
    mainTag = tagsContainingStrings.last();
    const delimiterTag = reduceTag(getTagLocalization(mainTag,$,true,stringsToFind),$);
    delimiterTagField.value = delimiterTag;
    venue.eventsDelimiterTag = delimiterTag;
  }
  if (validateDelimiterTags()){
    let $eventBlock = cheerio.load($(mainTag).html());
    // if (id){
    //   const tmpScrap = addJSONBlock(venueScrapInfo.mainPage,$eventBlock);
    //   venue.scrap[id] = tmpScrap[id];
    // }else{
    venue.scrap = addJSONBlock(venueScrapInfo.mainPage,$eventBlock);
    // }
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
  console.log(venue.dateFormat);
  let formatString = "Date format founds: "+venue.dateFormat;
  if (bestScore !== 0){
    formatString += " ("+(dates.length-bestScore)+"/"+dates.length+" valid dates)";
  }
  dateFormatText.textContent = formatString;
}

function renderEventURLPanel(){
  const tag = cheerioTest(venue.eventsDelimiterTag);
  const urlList = findURLs(cheerioTest(tag));
  //console.log(urlList);
  const index = urlList.findIndex(function(element) {
    return typeof element !== 'undefined';
  });
  venue.scrap.eventURLIndex = index;
  const definedURLs = urlList.filter(el => el !== undefined);
  if (definedURLs.length === 0){
    eventURLPanelMessage.textContent = 'No URL found.';
    eventURLSelect.style.display = 'none';
  } else if (definedURLs.length === 1){
    eventURLPanelMessage.textContent = 'URL found: '+urlList[index];
    eventURLSelect.style.display = 'none';
  } else {
    eventURLSelect.innerHTML='';
    definedURLs.forEach(url => {
      const option = document.createElement('option');
      option.text = url;  
      eventURLSelect.appendChild(option);
    });
    eventURLSelect.style.display = 'none';
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
  let links = ctag.prop('tagName')=='A'?[ctag.attr('href')]:[undefined];
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