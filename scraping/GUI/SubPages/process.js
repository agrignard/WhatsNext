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
  adjustMainTag, countNonEmptyEvents, regroupTags} = require(imports+'analexUtilities.js');
const {getDateConversionPatterns} =require(imports+'dateUtilities.js');
const {getText} =require(imports+'scrapexUtilities.js');


let intervalId, linkedFileContent, linkedPage, eventURL;
let stopCounter = false;
var localPage, $page, mainTag;
let freezeDelimiter = false;
let pageManagerReduced = false;
let log ='';
let mustIncludeURL  = true;
let mainTagAbsolutePath;
let nbPagesToShow = 5;
let nbPages = 0;
let easyPanelInfo = {
  stringList:[],
  indexList:[],
}
const defaultIndex = 5;
let currentPage = 'mainPage';
let detailedScrapView = true;
let scrapInfoTooOld; // if scrap info is from a too old event, the linked page does not correspond to the tag

var colorClassList = ['highlightName','highlightDate','highlightStyle','highlightPlace','highlightURL','highlightDummy'];
const easyButtonClassList = ['easyButtonName','easyButtonDate','easyButtonStyle','easyButtonPlace','easyButtonURL','easyButtonDummy'];
const easyConvert = {'eventNameStrings':0,'eventDateStrings':1,'eventStyleStrings':2,'eventPlaceStrings':3,'eventURLStrings':4,'eventDummyStrings':5};


/*****************************/
/*         initialize        */
/*****************************/

// document.addEventListener('click', function(event) {
//   var element = event.target;
//   var tagName = element.tagName;
//   var tagText = element.textContent;
//   console.log("Balise de l'élément cliqué : " + tagName);
//   console.log(getPathTo(element));
// });

function getPathTo(element) {
  var path = '';
  while (element) {
      var nodeName = element.nodeName.toLowerCase();
      var id = element.id ? '#' + element.id : '';
      var className = element.className ? '.' + element.className.replace(/\s+/g, '.') : '';
      path = nodeName + id + className + (path ? '>' + path : '');
      element = element.parentNode;
  }
  return path;
}


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
  if (venue.hasOwnProperty('regexp')){
    if (Object.keys(venue.regexp).length === 0){
      delete venue.regexp;
    }
  }
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
      setSwitchStatus();
    })
});
// tabs panel
const scrapElementPanels = document.getElementsByClassName('scrapPanelToHideWhenRegex');
const regexpPanels = document.getElementsByClassName('regexpPanel');
const regexSelectorPanel = document.getElementById('regexSelectorPanel');
regexSelectorPanel.style.display = 'none';
tabList = document.getElementsByClassName('tab');

for(let i=0;i < regexpPanels.length; i++){
  regexpPanels[i].style.display = 'none';
}

for (let iTab = 0; iTab<tabList.length; iTab++){
  tabList[iTab].addEventListener('click',function(){
    currentTab = this.id;
    for (let i = 0; i < tabList.length; i++){
      tabList[i].classList.remove('selectedTab');
    }
    this.classList.add('selectedTab');
    if (currentTab === 'regexpTag'){
      regexSelectorPanel.style.display = 'block';
      applyRegexp();
      for(let i = 0; i < scrapElementPanels.length; i++){scrapElementPanels[i].style.display = 'none';};
      for(let i = 0; i < regexpPanels.length; i++){regexpPanels[i].style.display = 'block';};
    }else{
      regexSelectorPanel.style.display = 'none';
      for(let i = 0; i < scrapElementPanels.length; i++){scrapElementPanels[i].style.display = 'block';};
      for(let i = 0; i < regexpPanels.length; i++){regexpPanels[i].style.display = 'none';};
    }
  });
}
let currentTab = tabList[0].id;
tabList[0].classList.add('selectedTab');


// delimiter panel

const delimiterPanel = document.getElementById('delimiterPanel');
const DelimiterTitle = document.getElementById('DelimiterTitle');
const eventURLPanel = document.getElementById('eventURLPanel');
var delimiterTagField = document.getElementById('delimiterTagField');
delimiterTagField.value = venue.hasOwnProperty('eventsDelimiterTag')?venue.eventsDelimiterTag:'';
delimiterTagField.addEventListener('input'||'change',event =>{
  venue.eventsDelimiterTag = delimiterTagField.value;
  // mainTag = $page(venue.eventsDelimiterTag);
  // console.log('ln',mainTag.length);
  const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo)[currentPage]));
  console.log(stringsToFind.map(el=>':contains('+el+')').join(''));
  const mainTagCandidates = $page(venue.eventsDelimiterTag+stringsToFind.map(el=>':contains('+el+')').join(''));
  mainTag = mainTagCandidates[0];
  console.log('tag',venue.eventsDelimiterTag);
  console.log('ln',mainTagCandidates.length);
  mainTagAbsolutePath = getTagLocalization(mainTag,$page,false,stringsToFind);
  console.log('path',mainTagAbsolutePath);
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
  computeDelimiterTag();
  computeTags();
});
// adjust url check box
const adjustURLCheckbox = document.getElementById('adjustURLCheckbox');
adjustURLCheckbox.checked = mustIncludeURL;
adjustURLCheckbox.addEventListener('change',()=>{
  mustIncludeURL = adjustURLCheckbox.checked;
  computeDelimiterTag();
  computeTags();
});


/*****************************/
/*          Fields           */
/*****************************/

// group tags check box
const regroupTagsCheckbox = document.getElementById('regroupTagsCheckbox');
regroupTagsCheckbox.checked = true;
regroupTagsCheckbox.addEventListener('change',()=>{
  // mustIncludeURL = regroupTagsCheckbox.checked;
  computeTags();
});

const inputRows = document.getElementsByClassName('input-row');
const detailedScrapViewCheckbox = document.getElementById('detailedScrapViewCheckbox');
detailedScrapViewCheckbox.checked = detailedScrapView;
detailedScrapViewCheckbox.addEventListener('change',()=>{
  detailedScrapView = !detailedScrapView;
  renderDetailedView();
});

function renderDetailedView(){
  if (detailedScrapView === true){
    easyPanel.style.display = 'none';
    for (i=0;i<inputRows.length;i++){
      inputRows[i].style.display = 'block';
    };
  }else{
    populateEasyPanel();
    easyPanel.style.display = 'block';
    for (i=0;i<inputRows.length;i++){
      inputRows[i].style.display = 'none';
    };
  }
}

/*****************************/
/*        easy panel         */
/*****************************/

const easyPanelFields = document.getElementById('easyPanelFields');
const easyPanelAddButton = document.getElementById('easyPanelAddButton');
easyPanelAddButton.addEventListener('click', function (){
  newEasyLine('');
});
const easyPanelCopyButton = document.getElementById('easyPanelCopyButton');
easyPanelCopyButton.addEventListener('click',function(){
  const selection = window.getSelection();
  let textCopy = selection.toString();
  if (textCopy) {
    textCopy = textCopy.replace(/(\n\s*)*$/,'').replace(/\n(\s*\n)*/g,'\n').replace(/^(\s*\n)*/,'');// remove blank lines
    const stringsToAdd = textCopy.split('\n');
    stringsToAdd.forEach(el => {
      newEasyLine(el);
    });
    getStringsFromEasyField();
    if (!freezeDelimiter && currentPage ==='mainPage'){
      computeDelimiterTag();
    }
    computeTags();
  }
});


// populateEasyPanel();
// renderDetailedView();


function populateEasyPanel(){
  easyPanelInfo = {
    stringList:[],
    indexList:[],
  }
  easyPanelFields.innerHTML = '';
  Object.keys(venueScrapInfo[currentPage]).forEach(key => {
    const typeIndex = easyConvert[key];
    venueScrapInfo[currentPage][key].forEach(el =>{
      newEasyLine(el,typeIndex);
    });
  });
}

function getStringsFromEasyField(){
  Object.keys(easyConvert).forEach(key => {
    const catIndex = easyConvert[key];
    const newStrings = easyPanelInfo.stringList.filter((el,i)=> easyPanelInfo.indexList[i]===catIndex);
    stringTextBoxes[catIndex].value = newStrings.join('\n');
    console.log(stringTextBoxes[catIndex].id);
    venueScrapInfo[currentPage][stringTextBoxes[catIndex].id] = newStrings;
  });
}

function newEasyLine(text, typeIndex){
  const index = easyPanelInfo.stringList.length;
  easyPanelInfo.stringList.push(text);
  if (typeIndex === undefined){
    easyPanelInfo.indexList.push(defaultIndex);// by default, select dummyString
  }else{
    easyPanelInfo.indexList.push(typeIndex);
  }
  // easyPanelInfo.oldValuesList.push(text);
  let newDiv = document.createElement('div');
  newDiv.classList.add('easyPanelLine');
  newDiv.id = 'easyPanelLine'+index;
  let inputElement = document.createElement('input');
  inputElement.id = 'easyInput'+index;
  inputElement.classList.add('easyField');
  inputElement.setAttribute('type', 'text');
  inputElement.value = text;
  validateString(inputElement);
  inputElement.addEventListener('input',function(){
    // console.log('changement ',this.id);
    const lineIndex = parseInt(this.id.match(/\d+$/));
    easyPanelInfo.stringList[lineIndex] = this.value;
    validateString(this);
    getStringsFromEasyField();
    if (!freezeDelimiter && currentPage ==='mainPage'){
      computeDelimiterTag();
    }
    computeTags();
  })
  newDiv.appendChild(inputElement);
  for(i=0;i<5;i++){
    let newButton = document.createElement('button');
    newButton.classList.add('easyButton');
    newButton.classList.add('easyField'+index);
    newButton.classList.add(easyButtonClassList[i]);
    newButton.id="easyButton"+index+"-"+i;
    if (i === typeIndex){
      newButton.classList.add(colorClassList[typeIndex]);
    }
    newButton.addEventListener('click',function() {
      const buttonList = document.getElementsByClassName('easyField'+index);
      for(j=0;j<buttonList.length;j++){
        buttonList[j].classList.remove(colorClassList[j]);
      }
      const lineIndex =  parseInt(this.id.match(/\d+-/));
      const typeIndex = parseInt(this.id.charAt(this.id.length - 1));
      if (typeIndex === easyPanelInfo.indexList[lineIndex]){// set to default value (dummy)
        easyPanelInfo.indexList[lineIndex] = defaultIndex;
      }else{
        easyPanelInfo.indexList[lineIndex] = typeIndex;
        newButton.classList.add(colorClassList[typeIndex]);
      }
      getStringsFromEasyField();
      computeTags();
      console.log(easyPanelInfo);
    });
    newDiv.appendChild(newButton);
  }
  const newButton = document.createElement('button');
  newButton.id = 'removeButton'+index;
  newButton.classList.add('easyButton');
  newButton.classList.add('easyRemoveButton');
  newButton.textContent = '✖';
  newButton.addEventListener('click', function(){
    console.log('remove');
    const lineIndex = parseInt(this.id.match(/\d+$/));
    let lineToRemove = document.getElementById('easyPanelLine'+lineIndex);
    easyPanelInfo.stringList[lineIndex] = undefined;
    easyPanelInfo.indexList[lineIndex] = undefined;
    lineToRemove.remove();
    getStringsFromEasyField();
    if (!freezeDelimiter && currentPage ==='mainPage'){
      computeDelimiterTag();
    }
    computeTags();
    console.log(easyPanelInfo);
  });
  newDiv.appendChild(newButton);
  easyPanelFields.appendChild(newDiv);
}


// scrap panels
const eventNameStrings = document.getElementById('eventNameStrings');
const eventDateStrings = document.getElementById('eventDateStrings');
const eventStyleStrings = document.getElementById('eventStyleStrings');
const eventPlaceStrings = document.getElementById('eventPlaceStrings');
const eventURLStrings = document.getElementById('eventURLStrings');
const eventDummyStrings = document.getElementById('eventDummyStrings');
const stringTextBoxes = [eventNameStrings, eventDateStrings, eventStyleStrings, eventPlaceStrings, eventURLStrings,eventDummyStrings];
const dateFormatText = document.getElementById('dateFormatText');
const eventURLTags = document.getElementById('eventURLTags');
const eventDummyPanel = document.getElementById('eventDummy');
const scrapTextBoxes = document.getElementsByClassName('scrapTextBox');
const scrapTextBoxStrings = document.getElementsByClassName('scrapTextBoxStrings');
const eventTagsBoxes = document.getElementsByClassName('eventTags');
const eventStringsBoxes = document.getElementsByClassName('eventStrings');



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
  const myNode = getParentElement(selection.anchorNode);
  console.log(myNode);
  console.log(getPathTo(myNode));
  if (textCopy) {
    target.value = (target.value.replace(/(\n\s*)*$/,'').replace(/\n\s*\n/g,'\n')+'\n'+textCopy).replace(/^(\s*\n)*/,'');// remove blank lines
    if (target.classList.contains("eventURLgroup")){// prevents field URL tag to have more than one line
      target.value = target.value.replace(/\n/g,'');
    }
    textBoxUpdate(target);
  }
}

function getParentElement(node) {
  while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
          return node;
      }
      node = node.parentNode;
  }
  return null;
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
    clearTags();
    applyTags(false);
  }else{
    venueScrapInfo[currentPage][textBox.id] = getArray(textBox.value);
    if (!freezeDelimiter && currentPage ==='mainPage'){
      computeDelimiterTag();
    }
    computeTags(textBox.id);
  }
}

// initialize regexp panels

const regexpTextBeforeList = document.getElementsByClassName('regexpTextBefore');
const regexpTextAfterList = document.getElementsByClassName('regexpTextAfter');
const regexpMatchList = document.getElementsByClassName('regexpMatch');
const regexpButtonList = document.getElementsByClassName('regexpButton');
const regexpReplaceList = document.getElementsByClassName('regexpReplace');
const regexpResultPanels = document.getElementsByClassName('regexpResult');
let regexButtonShow = Array(regexpButtonList.length).fill(false);

const regexSelectorMainTag = document.getElementById('regexSelectorMainTag');
const regexSelectorIndex = document.getElementById('regexSelectorIndex');
const regexSelectorPrevious = document.getElementById('regexSelectorPrevious');
const regexSelectorNext = document.getElementById('regexSelectorNext');

regexSelectorPrevious.addEventListener('click', function(){
  if (regexSelectorIndex.value===''){
    regexSelectorIndex.value = getMainTagIndex();
  }
  regexSelectorIndex.value = parseInt(regexSelectorIndex.value) - 1;
  selectorIndexChange();
});

regexSelectorNext.addEventListener('click', function(){
  if (regexSelectorIndex.value===''){
    regexSelectorIndex.value = getMainTagIndex();
  }
  regexSelectorIndex.value = parseInt(regexSelectorIndex.value) + 1;
  selectorIndexChange();
});

regexSelectorIndex.addEventListener('change', function(){
 selectorIndexChange();
});

function selectorIndexChange(){
  if (regexSelectorIndex.value > $page(venue.eventsDelimiterTag).length){
    regexSelectorIndex.value = 1;
  }
  if (regexSelectorIndex.value < 1){
    regexSelectorIndex.value = $page(venue.eventsDelimiterTag).length;
  }
  const tag = $page(venue.eventsDelimiterTag)[parseInt(regexSelectorIndex.value)];
  $page('.focusedOn').each(function(index, element) {
    $page(element).removeClass('focusedOn');
  });
  $page(tag).addClass('focusedOn');
  rightPanel.innerHTML = $page.html();
  focusTo(document.getElementsByClassName('focusedOn')[0]);
  applyRegexp();
}


// regexSelectorIndex.addEventListener('keydown', function(event) {
//   if (event.key === 'ArrowDown' && this.value === '0') {
//       this.value = '10';
//   }
// });

regexSelectorMainTag.addEventListener('click', function(){
  regexSelectorIndex.value = '';
  console.log('reset');
  $page('.focusedOn').each(function(index, element) {
    console.log('t',index);
    $page(element).removeClass('focusedOn');
  });
  rightPanel.innerHTML = $page.html();
  focusTo(document.getElementsByClassName('mainTag')[0]);
  applyRegexp();
});

const regexpKeyList = [];
for (let i = 0; i < regexpMatchList.length; i++) {
  regexpKeyList.push(regexpMatchList[i].id.replace('RegexpInput',''));
  regexpMatchList[i].addEventListener('input', function(){
    applyChangeRegexField(i);
  });
  regexpReplaceList[i].addEventListener('input', function(){
    applyChangeRegexField(i);
  });
}

function applyChangeRegexField(i){
  const txt = regexpMatchList[i].value;
  if (txt === ''){
    delete venue.regexp[regexpKeyList[i]];
  }else{
    if (!venue.hasOwnProperty('regexp')){
      venue.regexp = {};
    }
    if (regexButtonShow[i] === true){
      venue.regexp[regexpKeyList[i]] = [txt,regexpReplaceList[i].value];
    }else{
      venue.regexp[regexpKeyList[i]] = txt;
    }
  }
  applyRegexp();
}


if (venue.hasOwnProperty('regexp')){
  Object.keys(venue.regexp).forEach(key => {
    const fieldMatch = document.getElementById(key+'RegexpInput');
    if (typeof venue.regexp.key === 'string'){
      fieldMatch.value = venue.regexp[key];
    }else{
      fieldMatch.value = venue.regexp[key][0];
      const fieldReplace = document.getElementById(key+'RegexpReplace');
      fieldReplace.value = venue.regexp[key][1];
      const index = regexpKeyList.indexOf(key);
      regexButtonShow[index] = true;
    }
  });
}

for (let i = 0; i < regexpButtonList.length; i++){
  if (regexButtonShow[i] === false){
    regexpReplaceList[i].style.display = 'none';
  }
  regexpButtonList[i].addEventListener('click', function (){
    regexButtonShow[i] = ! regexButtonShow[i];
    // const key = this.id.match(/event(.*?)Regexp/)[1];
    if (regexButtonShow[i]){
      regexpReplaceList[i].style.display = 'inline';
    }else{
      regexpReplaceList[i].style.display = 'none';
    }
    applyChangeRegexField(i);
    // applyRegexp();
  });
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
  tabList[0].dispatchEvent(new Event('click'));
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
      applyRegexp();
    }else{
      rightPanel.textContent = 'Content not downloaded yet';
      analyzePanel.style.display = 'none';
      missingLinksPanel.style.display = 'none';
    }
  }else{
    loadLinkedPageContent();
  }
  populateEasyPanel();
  renderDetailedView();
}


function loadLinkedPageContent(){
  analyzePanel.style.display = 'block';
  if (linkedPage){
    // const parsedLinkedPage = parseDocument(convertToLowerCase('<html><head></head>'+linkedPage+'</html>'));
    const parsedLinkedPage = parseDocument('<html><head></head>'+linkedPage+'</html>');
    $page = cheerio.load(parsedLinkedPage);
  }else{
    console.log('***** Error with linked page *****');
  }
  applyTags(false);
  // find missing links
  computeDateFormat();
}


/*****************************/
/*        context menu       */
/*****************************/

// const rightClickMenuEasy = Menu.buildFromTemplate([
//   { label: 'Add to strings field', click() { console.log('Item 1 cliqué'); } },
// ]);


// rightPanel.addEventListener('contextmenu', (e) => {
//   e.preventDefault();
//   rightClickMenuEasy.popup({ window: remote.getCurrentWindow() });
// }, false);


// const rightClickMenu = Menu.buildFromTemplate([
//   { label: 'Add to strings field', click() { console.log('Item 1 cliqué'); } },
//   { label: 'Item 2', click() { console.log('Item 2 cliqué'); } }
// ]);

/*****************************/
/*    auxiliary functions    */
/*****************************/

function clearTags(){
  classes = ['highlightName', 'highlightDummy','highlightDate','highlightStyle','highlightPlace',
  'highlightURL','mainTag','encadre','encadreInvalid'];
  classes.forEach(el => {
    const tags = $page('.'+el);
    tags.each(function(index, element) {
      $page(this).removeClass(el);
      // Appliquer une fonction à chaque élément
      // console.log($page(this).text()); // Affiche le texte de l'élément
    });
  });
}

function gotoTag(ctag,tagString){
  let currentTag = [ctag];
  tagString.split(' ').forEach(el =>{
    currentTag = currentTag.map(ct => $page(ct.find(el))).flat();
  });
  return currentTag;
}

function applyTags(renderURL){
  function fillTags(dtag){
    const event = {};
    if (venue[currentPage].hasOwnProperty('eventNameTags')){
      let string = "";
      // console.log(venue[currentPage].eventNameTags);
      venue[currentPage].eventNameTags.forEach(tag =>{
        const ntag = gotoTag($page(dtag),tag);
        ntag.forEach(el => {
          string += $page(el).text();
          $page(el).addClass('highlightName');
        });
      });
      event.eventName = string;
    }
    if (venue[currentPage].hasOwnProperty('eventDummyTags')){
      venue[currentPage].eventDummyTags.forEach(tag =>{
        const ntag = gotoTag($page(dtag),tag);
        ntag.forEach(el => {$page(el).addClass('highlightDummy');});
      });
    }
    if (venue[currentPage].hasOwnProperty('eventDateTags')){
      let string = "";
      venue[currentPage].eventDateTags.forEach(tag =>{
        const ntag = gotoTag($page(dtag),tag);
        ntag.forEach(el => {
          string += $page(el).text();
          $page(el).addClass('highlightDate');
        }); 
      });
      event.eventDate = string;
    }
    if (venue[currentPage].hasOwnProperty('eventStyleTags')){
      venue[currentPage].eventStyleTags.forEach(tag =>{
        const ntag = gotoTag($page(dtag),tag);
        ntag.forEach(el => {$page(el).addClass('highlightStyle');});
      });
    }
    if (venue[currentPage].hasOwnProperty('eventPlaceTags')){
      venue[currentPage].eventPlaceTags.forEach(tag =>{
        const ntag = gotoTag($page(dtag),tag);
        ntag.forEach(el => {$page(el).addClass('highlightPlace');});
      });
    }
    if (venue[currentPage].hasOwnProperty('eventURLTags')){
      venue[currentPage].eventURLTags.forEach(tag =>{
        const ntag = gotoTag($page(dtag),tag);
        ntag.forEach(el => {$page(el).addClass('highlightURL');});  
      });
    }
    return event;
  }

  if (currentPage === 'mainPage'){
    $page(mainTagAbsolutePath).addClass('mainTag');
    $page(venue.eventsDelimiterTag).each((index, delimiterTag) => {
      const event = fillTags(delimiterTag);
      if (isValidEvent(event, venue)){
        $page(delimiterTag).addClass('encadre');
      }else{
        $page(delimiterTag).addClass('encadreInvalid');
      }
    });
    rightPanel.innerHTML = $page.html();
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
    focusTo(focusedElement);
  }else{
    fillTags($page('BODY'));
    rightPanel.innerHTML = $page.html();
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
  $page = cheerio.load(parseDocument(localPage));
  
  // find the tag from eventsDelimiterTag, with the text in the strings. If not found, get the first tag
  // that matches eventsDelimiterTag
  if (venue.hasOwnProperty('eventsDelimiterTag')){
    const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo)[currentPage]));
    const mainTagCandidates = $page(venue.eventsDelimiterTag);
    let i;
    for(i=mainTagCandidates.length-1;i>=0;i--){
      const text = $page(mainTagCandidates[i]).text();
      const containStrings = !stringsToFind.some(str => !text.includes(str));
      if (containStrings){
        break;
      }
    }
    if (i===-1){
      i=0;
      scrapInfoTooOld = true;
    }else{
      scrapInfoTooOld = false;
    }
    mainTag = mainTagCandidates[i];
    mainTagAbsolutePath = getTagLocalization(mainTag,$page,false,stringsToFind);
  }
  computeEventsNumber();
  computeMissingLinks();
  checkStringsNotFound();
  applyTags(true);
  // find missing links
  // computeMissingLinks();
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

function getValue(source, key){
  if (source.hasOwnProperty(key)){
    const object = source[key];
    if (typeof(object)==="string"){
      return object;
    }else{
      return object.join('\n');
    }
  }else{
    return '';
  }
}

function getArray(string){
  return string.split('\n');//.filter(el => el !== '');
}

function containsURL(tag){
  if (tag.is('a[href]')){//}.prop('tagName') == A){
    return true;
  }
  const $eventBlock = cheerio.load($page(tag).html());
  const hrefs = $eventBlock('a[href]');
  if (hrefs.length > 0){
    return true;
  }else{
    return false;
  }
}

function computeDelimiterTag(){// returns true if the delimiter has changed
  clearTags();
  const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo)[currentPage])).filter(el => el !== '');
  const tagsCandidates =  getTagContainingAllStrings($page,stringsToFind);
  if (tagsCandidates.length !== 0){
    mainTag = tagsCandidates.last();
    scrapInfoTooOld = false;
    if (mustIncludeURL){// extend delimiter tag to include at least one url
      while(!containsURL(mainTag)){
        mainTag = mainTag.parent();
      }
    }
    mainTagAbsolutePath = getTagLocalization(mainTag,$page,false,stringsToFind);
    let delimiterTag = reduceTag(getTagLocalization(mainTag,$page,true,stringsToFind),$page);
    if (autoAdjustCheckbox.checked === true){
      delimiterTag = adjustMainTag(delimiterTag,$page,venue);
    }
    delimiterTag = delimiterTag.replace(/\s*$/,'');
    delimiterHasChanged = (delimiterTag !== venue.eventsDelimiterTag);
    if (delimiterHasChanged){
      delimiterTagField.value = delimiterTag;
      venue.eventsDelimiterTag = delimiterTag;
      return true;
    }
    return false;
  }else{
    return false;
  }
}

function computeTags(id){
  clearTags();
  // compute main tag
  let delimiterHasChanged = true;
  checkStringsNotFound();
  if (currentPage === 'mainPage'){
    if (validateDelimiterTags()){
      let $eventBlock = cheerio.load($page(mainTag).html());
      venue[currentPage] = addJSONBlock(venueScrapInfo[currentPage],$eventBlock);
      if (regroupTagsCheckbox.checked){
        Object.keys(venue[currentPage]).forEach(key =>{
          console.log(key, venue[currentPage][key]);
          venue[currentPage][key] = regroupTags(venue[currentPage][key]); 
        });
      }
      
      // if (delimiterHasChanged){
      computeEventsNumber();
      //}
      computeDateFormat();
      applyTags(delimiterHasChanged || id === 'eventURLStrings');
      initScrapTextTags();
    }else{
    }
      // if (id){
      //   const tagId = id.replace(/Strings/,'Tags');
      //   delete venue[currentPage][tagId];
      // }

  }else{
    venue[currentPage] = addJSONBlock(venueScrapInfo[currentPage],$page);
    computeDateFormat();
    clearTags();
    applyTags(false);
    initScrapTextTags();
  }
}

function computeDateFormat(){
  let dates;
  if (currentPage === 'mainPage'){
    dates = getAllDates(venue.eventsDelimiterTag,venue[currentPage]['eventDateTags'],$page);
  }else{
    dates = getAllDates("BODY",venue[currentPage]['eventDateTags'],$page);
  }
  if (dates.length > 0){
    let formatRes;
    [formatRes, bestScore] = getBestDateFormat(dates,venue, dateConversionPatterns);
    if (currentPage === 'mainPage'){
      venue.dateFormat = formatRes;
    }else{
      venue.linkedPageDateFormat = formatRes;
    }
    let formatString = "Date format found: "+formatRes;
    if (bestScore !== 0){
      formatString += " ("+(dates.length-bestScore)+"/"+dates.length+" valid dates)";
    }
    dateFormatText.textContent = formatString;
    dateFormatPanel.style.display = 'block';
  }else{
    dateFormatPanel.style.display = 'none';
  }
}

function renderEventURLPanel(){
  if (venue.eventsDelimiterTag === undefined || venue.eventsDelimiterTag === ''){
    eventURLPanel.style.display = 'none';
    return;
  }
  if (!validateDelimiterTags()){
    eventURLSelect.style.display = 'none';
    eventURLPanelWarning.style.display = 'none';
    eventURLPanelMessage.textContent = 'Invalid tag, cannot find URL.';
    return;
  }
  let tag;
  eventURLPanel.style.display = 'block';
  if (scrapInfoTooOld === true){
    eventURLPanelWarning.style.display = 'block';
    tag = $page(venue.eventsDelimiterTag).first();
  }else{
    eventURLPanelWarning.style.display = 'none';
    tag = mainTag;
  }

  if (venue.mainPage.hasOwnProperty('eventURLTags')){
    const $eventBlock = cheerio.load($page(tag).html());
    eventURL = $eventBlock(venue.mainPage.eventURLTags[0]).attr('href');
    eventURLPanelMessage.textContent = 'URL from tag: '+ eventURL;
    eventURLSelect.style.display = 'none';
  }else{
    const urlList = findURLs($page(tag));
    // console.log($page(tag).html());
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
      });
    }
  }
  setSwitchStatus();
}


//aux functions

function setSwitchStatus(){
  const linkURL = makeURL(venue.baseURL,eventURL);
  console.log(linkURL);
  if (!linkedFileContent){
    switchPageButton.classList.add('inactive');
    switchPageButton.disabled = true;
    return;
  }
  linkedPage = linkedFileContent[linkURL];
  if (linkedPage){
    switchPageButton.classList.remove('inactive');
    switchPageButton.disabled = false;
  }else{
    switchPageButton.classList.add('inactive');
    switchPageButton.disabled = true;
  }
}

function setRows(textBox) {
  const nbLines = textBox.value.split('\n').length;
  textBox.setAttribute('rows', nbLines);
} 

function isValidTag(tag){
  try{
    const nbTags = $page(tag).length;
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
  for(let i = 0; i < scrapTextBoxStrings.length; i++){
    const textBox = scrapTextBoxStrings[i];
    console.log(textBox.id.replace('List',''));
    populateField(textBox, getValue(venueScrapInfo[currentPage],textBox.id.replace('List','')));
  }
  for(let i = 0; i < scrapTextBoxes.length; i++){
    const textBox = scrapTextBoxes[i];
    if (textBox.id.endsWith('Tags')){
        textBox.value = getValue(venue[currentPage],textBox.id);
        setRows(textBox);
    }else{
        textBox.value = getValue(venueScrapInfo[currentPage],textBox.id);
        setRows(textBox);
    }
  }
}

function populateField(textBox, strings){
  textBox.innerHTML ='';
  strings.split('\n').forEach(el =>{
    console.log('str',el);
    let inputElement = document.createElement('div');
    inputElement.classList.add(textBox.id+'Field');
    inputElement.setAttribute('type', 'text');
    inputElement.textContent = el;
    // validateString(inputElement);
    // inputElement.addEventListener("keydown", function(event) {// prevents field URL tag to have more than one line
    //   if (event.key === "Enter") {
    //     // const cursorPosition = monInput.selectionStart;
    //   }
    // });
    // inputElement.addEventListener('input',function(){
    //   console.log('input change');
    //   // const fields = document.getElementsByClassName(textBox.id+'Field');
    //   // let newStrings = "";
    //   // for (let i =0;i<fields.length;i++){
    //   //   newStrings = newStrings+'\n'+fields[i].value;
    //   // } 
    //   // console.log(newStrings);
    //   // // console.log('changement ',this.id);
    //   // populateField(textBox, newStrings);
    //   // // validateString(this);
    //   // if (!freezeDelimiter && currentPage ==='mainPage'){
    //   //   computeDelimiterTag();
    //   // }
    //   // computeTags();
    // })
    textBox.appendChild(inputElement);
  });
  textBox.addEventListener('input',function(){
    console.log('avant',this.innerHTML);
    if (!this.innerHTML.includes('<div') && this.innerHTML !== ''){
      this.innerHTML = '<div type="text">'+this.innerHTML+'</div>';
      const nouvelleSelection = window.getSelection();

      // Créez une plage de texte pour la position souhaitée
      const range = document.createRange();
      range.setStart(this.childNodes[0], 1); // 5 est l'indice du caractère où vous voulez placer le curseur
      
      // Effacez la sélection précédente et ajoutez la nouvelle plage de texte
      nouvelleSelection.removeAllRanges();
      nouvelleSelection.addRange(range);
      

    }
    
    // console.log('avant',this.innerHTML);
    // this.innerHTML = this.innerHTML.replace(/^([^\<]*)\</,(match, p1) => {
    //   if (p1.length > 0) {
    //       return `X${p1}X\<`;
    //   } else {
    //       return match; 
    //   }
    // });
    console.log('change',this.textContent);
    const divsChildren = textBox.querySelectorAll('div');
    divsChildren.forEach(myDiv =>{
      console.log('el',myDiv.textContent)
      if ($page.text().includes(myDiv.textContent)){
        myDiv.classList.remove('redFont');
      }else{
        myDiv.classList.add('redFont');
      }
    });
    console.log('inner',textBox.innerHTML);
  });
}


function findURLs(ctag){
  const $eventBlock = cheerio.load(ctag.html());
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
  const regexWidth = /(width\s*=\s*\")(.*?)\"/;
  const regexHeight = /(height\s*=\s*\")(.*?)\"/;
  const regexImg = /\<(?:img|svg).*?\>/g;

  function innerReplace(e1,e2,e3){
      if (e3 > 100){
          return e2+'100"';
      }
      return e1;
  }

  function replace(p1){
    let res = regexWidth.test(p1)?p1.replace(regexWidth,innerReplace):p1.replace(/img/,'img width="100"').replace(/svg/,'svg width="100"');
    res = regexHeight.test(res)?res.replace(regexHeight,innerReplace):res.replace(/img/,'img height="100"').replace(/svg/,'svg height="100"');
  return res;
  }
  return html.replace(regexImg,replace);
}

// function reduceImgSize(html){
//   const regexWidth = /(\<(?:img|svg)[^\<]*width\s*=\s*\")([^\"]*)\"/g;
//   const regexHeight = /(\<(?:img|svg)[^\<]*height\s*=\s*\")([^\"]*)\"/g;

//   function replace(p1,p2,p3){
//     if (p3 > 100){
//       return p2+'50'+'\"';
//     }
//     return p1;
//   }
//   return html.replace(regexWidth,replace).replace(regexHeight,replace);
// }

function computeEventsNumber(){
  if (venue.hasOwnProperty('eventsDelimiterTag')){
    const nbEvents = countNonEmptyEvents(venue.eventsDelimiterTag,$page,venue);
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

selectNbPages.addEventListener('change', ()=>{
  nbPagesToShow = selectNbPages.selectedIndex + 1;
  loadPage();
});

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

function applyRegexp(){
  let $eventBlock;
  // console.log('mt',mainTag);
  // console.log('ht',$page(mainTag).html());
  if (!mainTag){
    for(let i=0; i < regexpTextBeforeList.length; i++){
      regexpTextBeforeList[i].style.display = 'none';
      regexpResultPanels[i].style.display = 'none';
      regexpTextAfterList[i].style.display = 'none';
    }
    return;
  }
  if (regexSelectorIndex.value === ''){
    $eventBlock = cheerio.load($page(mainTag).html());
  }else{
    const index = parseInt(regexSelectorIndex.value)-1;
    const tag = $page(venue.eventsDelimiterTag)[index];
    $eventBlock = cheerio.load($page(tag).html());
  }
  for(let i=0; i < regexpTextBeforeList.length; i++){
    const key = regexpKeyList[i];
    if (venue[currentPage].hasOwnProperty(key+'Tags')){
      const str = getText(key+'Tags', venue[currentPage], $eventBlock);
      regexpTextBeforeList[i].textContent = str;
      regexpTextBeforeList[i].style.display = 'block';
      regexpResultPanels[i].style.display = 'block';
    }else{
      regexpTextBeforeList[i].style.display = 'none';
      regexpResultPanels[i].style.display = 'none';
    }
    regexpTextAfterList[i].style.display = 'none';
  }
  if (venue.hasOwnProperty('regexp')){
    // console.log(venue.regexp);
    Object.keys(venue.regexp).forEach(key => {
      // const fieldMatch = document.getElementById(key+'RegexpInput');
      const source = document.getElementById(key+'RegexpTextBefore');
      const target = document.getElementById(key+'RegexpTextAfter');
      target.style.display = 'block';
      if (typeof venue.regexp[key] === 'string'){// a string, regexp is used for a match
        target.textContent = source.textContent.match(new RegExp(venue.regexp[key]));
      }else if (venue.regexp[key].length === 2){// a list of two elements. replace pattern (1st) with (2nd)
        target.textContent = source.textContent.replace(new RegExp(venue.regexp[key][0]),venue.regexp[key][1]);
      }
    });
  }
}


function focusTo(element){
  if (element){
    element.scrollIntoView({ behavior: 'auto', block: 'start' });
    rightPanel.scrollBy({top: -100, behavior: 'auto'});
   // rightPanel.scrollBy({top: -rightPanel.offsetHeight/2+focusedElement.offsetHeight/2, behavior: 'auto'});
  }
}

function getMainTagIndex(){
  const delimiterList = $page(venue.eventsDelimiterTag);
  let j;
  const pageRef = $page(mainTag).text();
  for(j=0;j<delimiterList.length;j++){
    if ($page(delimiterList[j]).text()===pageRef){
      break;
    }
  }
  return j;
}


function checkStringsNotFound(){
  for(let b=0;b<eventStringsBoxes.length;b++){
    if (eventStringsBoxes[b].value.split('\n').some(el => !$page.text().includes(el))){
      eventTagsBoxes[b].placeholder = 'Cannot find strings';
      eventStringsBoxes[b].classList.add('invalid');
      // console.log('value',eventStringsBoxes[b].value);
      // console.log('text',eventStringsBoxes[b].innerHTML);
      // const replacement = eventStringsBoxes[b].value.split('\n').map(str => '<span class="redFont">'+str+'XXX'+'</span>').join('\n');
      // console.log('repl',replacement);
      // // venueScrapInfo[currentPage][eventTagsBoxes[b].id] = replacement;
      // eventStringsBoxes[b].innerHTML = replacement;
      // console.log('value2',eventStringsBoxes[b].value);

      // console.log(eventStringsBoxes[b].value);
    }else{
      eventTagsBoxes[b].placeholder = 'Tags will be filled automatically';    
      eventStringsBoxes[b].classList.remove('invalid'); 
    }
  }
}

// for easyfield, put font in red if the string is not in the document
function validateString(box){
  if ($page.text().includes(box.value)){
    box.classList.remove('redFont');
  }else{
    box.classList.add('redFont');
  }

}