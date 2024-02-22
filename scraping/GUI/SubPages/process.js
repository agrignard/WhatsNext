const webSources = '../webSources/';
const imports = '../../import/';

const fs = require('fs');
const cheerio = require('cheerio');
const {parseDocument} = require('htmlparser2');
const {app, Menu, ipcRenderer} = require('electron');
const {loadVenuesJSONFile, loadVenueJSON, loadScrapInfoFile, initializeVenue} = require(imports+'jsonUtilities.js');
const {simplify, removeBlanks, extractBody, convertToLowerCase} = require(imports+'stringUtilities.js');
const {getFilesContent, getModificationDate, loadLinkedPages} = require(imports+'fileUtilities.js');
const {downloadVenue, erasePreviousHtmlFiles, getHrefListFrom} = require(imports+'aspiratorexUtilities.js');
const {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings,
  splitAndLowerCase, addJSONBlock} = require(imports+'analexUtilities.js');

let intervalId, linkedFileContent;
let stopCounter = false;
var localPage, cheerioTest, mainTag;

//const midnightHourOptions = ['none','sameday','previousday'];

// get venue JSON
const venues = loadVenuesJSONFile();
const venueID = sessionStorage.getItem('currentVenue');
const venue = loadVenueJSON(venueID,venues);
// initialize new venue
initializeVenue(venue,webSources);
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
const venueInfo = document.getElementById('infos');
const rightPanel = document.getElementById('rightPanel');
const leftPanel = document.getElementById('letPanel');

// modify left panel
venueInfo.textContent = venue.name+' ('+venue.city+', '+venue.country+')';
const lastScrapped = document.getElementById('lastScrapped');
lastScrapped.textContent = lastModified?showDate(lastModified):"Page not downloaded yet.";
const downloadButton = document.getElementById('downloadButton');
downloadButton.addEventListener('click', function() {
  downloadButton.disabled = true;
  stopCounter = false;
  cycleText();
  erasePreviousHtmlFiles(sourcePath)
  .then(() => {
    downloadVenue(venue,sourcePath)
    .then(() =>{
      lastModified = getModificationDate(sourcePath);
      lastScrapped.textContent = lastModified?showDate(lastModified):"Page not downloaded yet.";
      stopCounter = true;
      loadPage();
      downloadButton.disabled = false;
    })
  })
});


var delimiterTagField = document.getElementById('delimiterTag');
delimiterTagField.value = venue.hasOwnProperty('eventsDelimiterTag')?venue.eventsDelimiterTag:'';
delimiterTagField.addEventListener('input'||'change',event =>{
  venue.eventsDelimiterTag = delimiterTagField.value;
  validateDelimiterTags(delimiterTagField);
  applyTags();
});

// event name
const eventNameStrings = document.getElementById('eventNameStrings');
if (venueScrapInfo.mainPage.hasOwnProperty('eventNameStrings')){
  eventNameStrings.value = getValue(venueScrapInfo.mainPage.eventNameStrings);
}
const eventNameTags = document.getElementById('eventNameTags');
// if (venue.scrap.hasOwnProperty('eventNameTags')){
//   eventNameTags.value = getValue(venue.scrap.eventNameTags);
// }
// event date
const eventDateStrings = document.getElementById('eventDateStrings');
if (venueScrapInfo.mainPage.hasOwnProperty('eventDateStrings')){
  eventDateStrings.value = getValue(venueScrapInfo.mainPage.eventDateStrings);
}
const eventDateTags = document.getElementById('eventDateTags');
// if (venue.scrap.hasOwnProperty('eventDateTags')){
//   eventDateTags.value = getValue(venue.scrap.eventDateTags);
// }
// event style
const eventStyleStrings = document.getElementById('eventStyleStrings');
if (venueScrapInfo.mainPage.hasOwnProperty('eventStyleStrings')){
  eventStyleStrings.value = getValue(venueScrapInfo.mainPage.eventStyleStrings);
}
const eventStyleTags = document.getElementById('eventStyleTags');
// if (venue.scrap.hasOwnProperty('eventStyleTags')){
//   eventStyleTags.value = getValue(venue.scrap.eventStyleTags);
// }

const scrapTextBoxes = document.getElementsByClassName('scrapTextBox');
initScrapTextTags();

const eventURLPanelMessage = document.getElementById('eventURLPanelMessage');
const eventURLSelect = document.getElementById('eventURLSelect');

// initialize scraptextboxes
for(let i = 0; i < scrapTextBoxes.length; i++){
  const textBox = scrapTextBoxes[i];
  setRows(textBox);
  textBox.addEventListener('input', event =>{
    setRows(textBox);
    if (textBox.id.endsWith('Tags')){
      venue.scrap[textBox.id] = getArray(textBox.value);
      applyTags();
    }else{
     // console.log(venueScrapInfo);
      venueScrapInfo.mainPage[textBox.id] = getArray(textBox.value);
      getDelimiterTag();
      applyTags();
    }
   // console.log(venue);
  });
}
// button analyze
const analyzeButton = document.getElementById('analyzeButton');
analyzeButton.addEventListener('click',event=>{
  getDelimiterTag();
  applyTags();
});

// log text
const logText = document.getElementById('logText');

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

// right panel
loadPage();
renderEventURLPanel();

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
    $(delimiterTag).html($eventBlock.html());
  });
  
  rightPanel.innerHTML = $.html();

  rightPanel.querySelectorAll('a'||'select').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault(); 
    });
  });

  const focusedElement = document.getElementsByClassName("mainTag")[0];
  if (focusedElement){
    focusedElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
}

function loadPage(){
  localPage = getFilesContent(sourcePath);
  cheerioTest = cheerio.load(parseDocument(convertToLowerCase(localPage)));
  applyTags();
  // find missing links
  linkedFileContent = fs.existsSync(sourcePath+'linkedPages.json')?loadLinkedPages(sourcePath):[];
  const hrefList = getHrefListFrom([localPage],venue);
  const existingLinks = hrefList.filter(el => Object.keys(linkedFileContent).includes(el));
  const linksToDownload = hrefList.filter(el => !Object.keys(linkedFileContent).includes(el));
  const missingLinks = document.getElementById('missingLinks');
  if (venue.hasOwnProperty('linkedPage')){
    if (hrefList.length === 0){
      missingLinks.textContent = 'Cannot download linked pages, scrap info not defined yet.';
    }else{
      missingLinks.textContent = 'Links downloaded: '+existingLinks.length+'/'+hrefList.length;
      if (linksToDownload.length === 0){
        missingLinks.classList.remove('.redFont');
      }else{
        console.log(missingLinks.length);
        missingLinks.classList.add('redFont');
        missingLinks.textContent += '. Run again to download '+linksToDownload.length+' missing links.';
      }
    }
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




function cycleText(){
  const textList = ['Downloading','Downloading.','Downloading..','Downloading...'];
  let i = 0;
  downloadButton.textContent = textList[0];
  {
    intervalId = setInterval(() => {
      downloadButton.textContent = textList[i];
      i++;
      if (i === textList.length){
        i = 0;
      }
      if (stopCounter) {
        downloadButton.textContent = "Download Page";
        clearInterval(intervalId);
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
function toggleDiv(target,minSize,maxSize) {
  const div = document.getElementById(target);
  if (div.style.height === minSize) {
    div.style.height = maxSize; // Rétablir la hauteur initiale
  } else {
    div.style.height = minSize; // Réduire la hauteur
  }
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

function getDelimiterTag(){
  const $ = cheerio.load(parseDocument(convertToLowerCase(localPage)));
  const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo).mainPage));
  const tagsContainingStrings =  getTagContainingAllStrings($,stringsToFind);
  mainTag = tagsContainingStrings.last();
  // let $eventBlock = cheerio.load($(mainTag).html());
  const delimiterTag = getTagLocalization(mainTag,$,true,stringsToFind);
  delimiterTagField.value = delimiterTag;
  venue.eventsDelimiterTag = delimiterTag;
  if (validateDelimiterTags()){
    let $eventBlock = cheerio.load($(mainTag).html());
    venue.scrap = addJSONBlock(venueScrapInfo.mainPage,$eventBlock);
    renderEventURLPanel();
    initScrapTextTags();
  }
}

//function renderEventURLPanel(urlList){
function renderEventURLPanel(){
  const tag = cheerioTest(venue.eventsDelimiterTag);
  const urlList = findURLs(cheerioTest(tag));
  console.log(urlList);
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