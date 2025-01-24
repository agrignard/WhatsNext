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

var showLog = false;

let intervalId, linkedFileContent, linkedPage, eventURL;
let stopCounter = false;
var localPage, $page, mainTag;
var nbEvents = {main:undefined, adjusted:undefined};
var delimiterTag, adjustedDelimiterTag, lastDateList;
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

const keyNames = ['Name','Dummy','Date','Style','Place','URL','MultiName','MultiDate','MultiStyle','MultiPlace','MultiURL'];
const colorClassList = ['SCRPXhighlightName','SCRPXhighlightDate','SCRPXhighlightStyle',
                        'SCRPXhighlightPlace','SCRPXhighlightURL','SCRPXhighlightDummy'];
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
  toLog("saved.");
  removeEmptyFields(venue);
  if (venue.hasOwnProperty('regexp')){
    if (Object.keys(venue.regexp).length === 0){
      delete venue.regexp;
    }
  }
  toLog("venue.json:");
  toLog(JSON.stringify(venue));
  saveToVenuesJSON(venues);
  removeEmptyFields(venueScrapInfo);
  scrapInfo[venueID] = venueScrapInfo;
  toLog("\nvenueSrapInfo.json:");
  toLog(JSON.stringify(venueScrapInfo)+'\n');
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
const eventSelectorPanel = document.getElementById('eventSelectorPanel');
const subtitles = document.getElementsByClassName('subtitle');
const multipleEventsPanels = document.getElementsByClassName('multipleEventsPanel')
tabList = document.getElementsByClassName('tab');

for(let i=0;i < regexpPanels.length; i++){
  regexpPanels[i].style.display = 'none';
}
for(let i=0;i < multipleEventsPanels.length; i++){
  multipleEventsPanels[i].style.display = 'none';
}

for (let iTab = 0; iTab<tabList.length; iTab++){
  tabList[iTab].addEventListener('click',function(){
    currentTab = this.id;
    for (let i = 0; i < tabList.length; i++){
      tabList[i].classList.remove('selectedTab');
    }
    this.classList.add('selectedTab');
    const visibility = {scrapTab:'none', multipleEventsTab:'none', regexpTag:'none'};
    visibility[currentTab] = 'block';
    for(let i = 0; i < scrapElementPanels.length; i++){scrapElementPanels[i].style.display = visibility.scrapTab;};
    for(let i = 0; i < regexpPanels.length; i++){regexpPanels[i].style.display = visibility.regexpTag;};
    for(let i = 0; i < multipleEventsPanels.length; i++){multipleEventsPanels[i].style.display = visibility.multipleEventsTab;};
    if (currentTab === 'regexpTag'){
      applyRegexp();
      setSubtitles('(regex)');
    }else if (currentTab === 'scrapTab'){
      setSubtitles('');
    }else{
      setSubtitles('(multiple events)')
    }
  });
}
let currentTab = tabList[0].id;
tabList[0].classList.add('selectedTab');

function setSubtitles(string){
  for(let i=0; i < subtitles.length; i++){
    subtitles[i].textContent = string;
  }
}


// delimiter panel

const delimiterPanel = document.getElementById('delimiterPanel');
const DelimiterTitle = document.getElementById('DelimiterTitle');
const eventURLPanel = document.getElementById('eventURLPanel');
var delimiterTagField = document.getElementById('delimiterTagField');
delimiterTagField.value = venue.hasOwnProperty('eventsDelimiterTag')?venue.eventsDelimiterTag:'';
delimiterTagField.addEventListener('input'||'change',event =>{
  venue.eventsDelimiterTag = delimiterTagField.value.trim();//replace(/\s*$/,'');
  const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo)[currentPage]));
  const mainTagCandidates = $page(venue.eventsDelimiterTag+stringsToFind.map(el=>':contains('+el+')').join(''));
  if (mainTagCandidates.length > 0){
    clearTags();
    mainTag = mainTagCandidates[0];
    mainTagAbsolutePath = getTagLocalization($page(mainTag),$page,false);
    delimiterTag = reduceTag(getTagLocalization($page(mainTag),$page,true),$page);
    nbEvents.main = computeEventsNumber();
    adjustedDelimiterTag = undefined;
    nbEvents.adjusted = undefined;
  }
  freezeDelimiter = true;
  freezeDelimiterButton.textContent = "Unfreeze";
  delimiterTagField.classList.add('inactive');
  computeTags(true);
  // computeEventsNumber();
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
  let hasChanged;
  if (autoAdjustCheckbox.checked === true){
    if (adjustedDelimiterTag === undefined){
      [adjustedDelimiterTag, nbEvents.adjusted] = adjustMainTag(delimiterTag,$page,venue);
    }
    hasChanged = delimiterTagField.value !== adjustedDelimiterTag;
    delimiterTagField.value = adjustedDelimiterTag;
    venue.eventsDelimiterTag = adjustedDelimiterTag;
    setEventPanel(nbEvents.adjusted);
  }else{
    hasChanged = delimiterTagField.value !== delimiterTag;
    delimiterTagField.value = delimiterTag;
    venue.eventsDelimiterTag = delimiterTag;
    setEventPanel(nbEvents.main);
  }
  computeTags(hasChanged);
});
// adjust url check box
const adjustURLCheckbox = document.getElementById('adjustURLCheckbox');
adjustURLCheckbox.checked = mustIncludeURL;
adjustURLCheckbox.addEventListener('change',()=>{
  mustIncludeURL = adjustURLCheckbox.checked;
  computeDelimiterTag();
});


/*****************************/
/*          Fields           */
/*****************************/

// group tags check box
const regroupTagsCheckbox = document.getElementById('regroupTagsCheckbox');
regroupTagsCheckbox.checked = true;
regroupTagsCheckbox.addEventListener('change',()=>{
  computeTags(false);
});

const inputRows = document.getElementsByClassName('hideWhenEasyPanel');
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
      newEasyLine(el.trim());
    });
    getStringsFromEasyField();
    if (!freezeDelimiter && currentPage ==='mainPage'){
      computeDelimiterTag();
    }else{
      computeTags(false);
    }
  }
});



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
    populateField(stringTextBoxes[catIndex], newStrings.join('\n'));
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
    const lineIndex = parseInt(this.id.match(/\d+$/));
    easyPanelInfo.stringList[lineIndex] = this.value.trim();
    validateString(this);
    getStringsFromEasyField();
    const renderURL = easyPanelInfo.indexList[lineIndex] === easyConvert['eventURLStrings'];
    if (!freezeDelimiter && currentPage ==='mainPage'){
      computeDelimiterTag(renderURL);
    }else{
      computeTags(renderURL);
    }
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
      const renderURL = easyPanelInfo.indexList[lineIndex] === easyConvert['eventURLStrings'] 
                        || typeIndex === easyConvert['eventURLStrings'] ;
      if (typeIndex === easyPanelInfo.indexList[lineIndex]){// set to default value (dummy)
        easyPanelInfo.indexList[lineIndex] = defaultIndex;
      }else{
        easyPanelInfo.indexList[lineIndex] = typeIndex;
        newButton.classList.add(colorClassList[typeIndex]);
      }
      getStringsFromEasyField();
      computeTags(renderURL);// if url is changed
    });
    newDiv.appendChild(newButton);
  }
  const newButton = document.createElement('button');
  newButton.id = 'removeButton'+index;
  newButton.classList.add('easyButton');
  newButton.classList.add('easyRemoveButton');
  newButton.textContent = '✖';
  newButton.addEventListener('click', function(){
    const lineIndex = parseInt(this.id.match(/\d+$/));
    const renderURL = easyPanelInfo.indexList[lineIndex] === easyConvert['eventURLStrings'];
    let lineToRemove = document.getElementById('easyPanelLine'+lineIndex);
    easyPanelInfo.stringList[lineIndex] = undefined;
    easyPanelInfo.indexList[lineIndex] = undefined;
    lineToRemove.remove();
    getStringsFromEasyField();
    if (!freezeDelimiter && currentPage ==='mainPage'){
      computeDelimiterTag(renderURL);
    }else{
      computeTags(renderURL);
    }
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
  let textCopy = selection.toString();
  // const myNode = getParentElement(selection.anchorNode);
  // console.log(myNode);
  // console.log(getPathTo(myNode));
  if (textCopy) {
    if (target.classList.contains("eventURLgroup")){// prevents field URL tag to have more than one line
      textCopy = textCopy.replace(/\n/g,'');
    }
    textCopy = textCopy.replace(/(\s*\n\s*)+/g,'\n').replace(/^\n/,'').replace(/\n$/,'');// remove blank lines
    populateField(target, textCopy, true);
    console.log(target.innerHTML);
    stringTextBoxUpdate(target);
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

// initialize scraptextboxes for tags
for(let i = 0; i < eventTagsBoxes.length; i++){
  const textBox = eventTagsBoxes[i];
  setRows(textBox);
  textBox.addEventListener('input', event =>{
    tagTextBoxUpdate(textBox);
  });
}

function tagTextBoxUpdate(textBox){
  setRows(textBox);
  venue[currentPage][textBox.id] = getArray(textBox.value);
  clearTags();
  applyTags(textBox.id === 'eventURLTags');
}

// initialize scraptextboxes for strings
for(let i = 0; i < eventStringsBoxes.length; i++){
  const textBox = eventStringsBoxes[i];
  textBox.addEventListener('input',function(){
    if(!/[^\s\t\n]/.test(this.textContent)){// remove unwanted divs if they contain no text
      this.innerHTML = '';
    }
    if (!this.innerHTML.includes('<div') && this.innerHTML !== ''){
      this.innerHTML = '<div type="text">'+this.innerHTML+'</div>';
      const newSelection = window.getSelection();
      const range = document.createRange();
      range.setStart(this.childNodes[0], 1);
      newSelection.removeAllRanges();
      newSelection.addRange(range);
    }
    const divsChildren = textBox.querySelectorAll('div');
    highlightStringsNotFound(divsChildren);
    stringTextBoxUpdate(textBox);
  });
}


function stringTextBoxUpdate(textBox){
  venueScrapInfo[currentPage][textBox.id] = getValueFromBox(textBox);//getArray(textBox.value);
  if (!freezeDelimiter && currentPage ==='mainPage'){
    // console.log(textBox.id);
    const renderURL = textBox.id === 'eventURLStrings';
    computeDelimiterTag(renderURL);
  }else{
    computeTags(textBox.id === 'eventURLStrings');
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

const eventSelectorMainTag = document.getElementById('eventSelectorMainTag');
const eventSelectorIndex = document.getElementById('eventSelectorIndex');
const eventSelectorPrevious = document.getElementById('eventSelectorPrevious');
const eventSelectorNext = document.getElementById('eventSelectorNext');

eventSelectorPrevious.addEventListener('click', function(){
  if (eventSelectorIndex.value===''){
    eventSelectorIndex.value = getMainTagIndex();
  }
  eventSelectorIndex.value = parseInt(eventSelectorIndex.value) - 1;
  selectorIndexChange();
});

eventSelectorNext.addEventListener('click', function(){
  if (eventSelectorIndex.value===''){
    eventSelectorIndex.value = getMainTagIndex();
  }
  eventSelectorIndex.value = parseInt(eventSelectorIndex.value) + 1;
  selectorIndexChange();
});

eventSelectorIndex.addEventListener('change', function(){
 selectorIndexChange();
});

function selectorIndexChange(){
  if (eventSelectorIndex.value > $page(venue.eventsDelimiterTag).length){
    eventSelectorIndex.value = 1;
  }
  if (eventSelectorIndex.value < 1){
    eventSelectorIndex.value = $page(venue.eventsDelimiterTag).length;
  }
  const tag = $page(venue.eventsDelimiterTag)[parseInt(eventSelectorIndex.value)];
  $page('.focusedOn').each(function(index, element) {
    $page(element).removeClass('focusedOn');
  });
  $page(tag).addClass('focusedOn');
  rightPanel.innerHTML = $page.html();
  focusTo(document.getElementsByClassName('focusedOn')[0]);
  renderEventURLPanel(eventSelectorIndex.value);
  applyRegexp();
}




eventSelectorMainTag.addEventListener('click', function(){
  eventSelectorIndex.value = '';
  console.log('reset');
  $page('.focusedOn').each(function(index, element) {
    console.log('t',index);
    $page(element).removeClass('focusedOn');
  });
  rightPanel.innerHTML = $page.html();
  focusTo(document.getElementsByClassName('SCRPXmainTag')[0]);
  renderEventURLPanel();
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
  });
}


// log text
const logText = document.getElementById('logText');
function toLog(string){
  log += string.replace(/,/g,',\n') + '\n';
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
  initScrapTextStrings();
  initScrapTextTags();
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
  const classes = colorClassList
    .concat(['SCRPXhighlightMultiName','SCRPXhighlightMultiDate','SCRPXhighlightMultiStyle','SCRPXhighlightMultiPlace','SCRPXhighlightMultiURL',
              'SCRPXmainTag','SCRPXeventBlock','SCRPXeventBlockInvalid']);
  classes.forEach(el => {
    const tags = $page('.'+el);
    tags.each(function(index, element) {
      $page(this).removeClass(el);
      if (!/\S/.test($page(this).attr('class'))){
        $page(this).removeAttr('class');
      }
    });
  });
}

function gotoTag(ctag,tagString){
  // const $2 = cheerio.load(ctag.html());
  // // console.log($2(tagString).length);
  // let truc = [];
  // $2(tagString).each((index,tg)=> truc.push(tg));
  // console.log(truc.length);
  // return truc;
  let currentTag = [ctag];
  
  tagString.split('\>').forEach(el =>{
    // if (currentTag.length > 0){
      // currentTag.forEach(ct => console.log(el,$page(ct.children(el)).length,$page(ct.children(el)).text()));
    // }
    
    // 
    // currentTag = currentTag.map(ct => $page(ct.children(el))).flat();
    currentTag = currentTag.map(ct => $page(ct.find(el))).flat();// this was commented. Why did I once put children instead of find ?
  });
  return currentTag;
}


function applyTagForKey(keyName, dtag, event){// tags application should be delayed and stored in a list, to avoid
  // interferences from adding classes to node (problem with :Not([class]))
  const key = 'event'+keyName+'Tags';
  const tagsToApply = [];
  if (venue[currentPage].hasOwnProperty(key)){
    let string = "";
    // console.log('\n\n','début',keyName,$page(dtag).html());
    venue[currentPage][key].forEach(tag =>{
      //  console.log(tag);
      const ntag = gotoTag($page(dtag),tag);
      // console.log($page(ntag).html());
      ntag.forEach(el => {
        // if (keyName==='Date'){
        //   console.log(keyName,ntag.length,$page(el).text());
        //   // console.log($page(tag).text());
        // }
        // console.log(key,$page(el).text());
        string += $page(el).text();
        tagsToApply.push([$page(el),'SCRPXhighlight'+keyName]);
      });
    });
    if (keyName.includes('Name')){
      event.eventName = event.eventName?event.eventName+string:string;
    }
    if (keyName.includes('Date')){
      event.eventDate = event.eventDate?event.eventDate+string:string;
    }
  }
  return tagsToApply;
}


function applyTags(renderURL){
  function fillTags(dtag){
    const event = {};
    let tagsToApply = [];
    keyNames.forEach(keyName =>{
      tagsToApply = tagsToApply.concat(applyTagForKey(keyName, dtag, event));
    });
    // console.log(tagsToApply);
    tagsToApply.forEach(el => {
      el[0].addClass(el[1]);
    });
    return event;
  }

  if (currentPage === 'mainPage'){
    // clearTags();
    // div.site>div.contentarea:eq(0)>main.sitemain.wrap_agenda.allconcerts:eq(0)>div:not([class]):eq(1)>div:not([class]):eq(1)>div.smallcontent.ukwidth14m.ukgridmargin:eq(8)>div:not([class]):eq(0)>a:not([class]):eq(0)
    const mainTagBlock = $page(mainTagAbsolutePath);
    mainTagBlock.addClass('SCRPXmainTag');
    mainTagBlock.addClass('SCRPXeventBlock');
    fillTags(mainTagBlock);
    $page(venue.eventsDelimiterTag).each((index, dTag) => {
      // console.log($page(dTag).text());
      const event = fillTags(dTag);
      if (isValidEvent(event, venue)){
        $page(dTag).addClass('SCRPXeventBlock');
      }else{
        $page(dTag).addClass('SCRPXeventBlockInvalid');
      }
    });
    rightPanel.innerHTML = $page.html();
    rightPanel.querySelectorAll('a'||'select').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault(); 
      });
    });

    mainTagBlock.addClass('SCRPXmainTag');
    mainTagBlock.addClass('SCRPXeventBlock');
  
    if (localPage){
      if (renderURL === true){
        renderEventURLPanel();
      }
    }else{
      analyzePanel.style.display = 'none';
    }
  
    const focusedElement = document.getElementsByClassName("SCRPXmainTag")[0];
    focusTo(focusedElement);
    // console.log($page.html());
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
      // console.log('to find',stringsToFind,'\n',text);
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
    mainTagAbsolutePath = getTagLocalization($page(mainTag),$page,false);
    // console.log('MTAP: ',mainTagAbsolutePath);
    delimiterTag = reduceTag(getTagLocalization($page(mainTag),$page,true),$page);
    // console.log('tct:',$page(mainTagAbsolutePath).text());
    nbEvents.main = computeEventsNumber(delimiterTag);
    [adjustedDelimiterTag, nbEvents.adjusted] = adjustMainTag(delimiterTag,$page,venue,nbEvents.main);
    if (adjustedDelimiterTag === venue.eventsDelimiterTag){
      setEventPanel(nbEvents.adjusted);
    }else{
      autoAdjustCheckbox.checked = false;
    }
  }
  computeMissingLinks();
  if (validateDelimiterTags()){
    computeDateFormat();
  }
  applyTags(true);
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


function getPath(element) {
  let path = '';
  let currentElement = element;

  while (currentElement.length) {
      let name = currentElement.get(0).name;
      let id = currentElement.attr('id');
      let className = currentElement.attr('class');
      let index = currentElement.index() + 1; // Ajout de 1 pour commencer à l'indice 1

      let node = name;
      if (id) {
          // node += `#${id}`;
          node += ':eq(0)';
      }
      if (className) {
          node += `.${className.replace(/\s+/g, '.')}`;
      }
      if (index) {
          node += `:eq(${index - 1})`; // Retrait de 1 pour commencer à l'indice 0
      }

      path = node + (path ? ' ' + path : '');
      currentElement = currentElement.parent();
  }
  return path;
}


function computeDelimiterTag(renderURL){// renderURL forces to update the URL in the delimiter tag. If false or undefined, the panel will be rendered only if the main tag has changed.
  clearTags();
  const stringsToFind = [].concat(...Object.values(splitAndLowerCase(venueScrapInfo)[currentPage])).filter(el => el !== '');
  const tagsCandidates =  getTagContainingAllStrings($page,stringsToFind);
  if (tagsCandidates.length === 0){
    setEventPanel(0);
  }else{
    mainTag = tagsCandidates.last();
    scrapInfoTooOld = false;
    if (mustIncludeURL){// extend delimiter tag to include at least one url
      while(!containsURL(mainTag)){
        mainTag = mainTag.parent();
      }
    }
    const oldTag = mainTagAbsolutePath;
    mainTagAbsolutePath = getTagLocalization(mainTag,$page,false);

    // console.log('*** verif ***',oldTag === mainTagAbsolutePath);
    console.log(mainTagAbsolutePath);
    // console.log('abs',mainTagAbsolutePath); 
    // console.log('maintag:',$page(mainTag).text());
    tagsFromStrings(cheerio.load($page(mainTag).html()));
    if (oldTag !== mainTagAbsolutePath){
      delimiterTag = reduceTag(getTagLocalization(mainTag,$page,true),$page,false);
      nbEvents.main = computeEventsNumber();
      // console.log('deli',delimiterTag);
      if (autoAdjustCheckbox.checked === true){
        [adjustedDelimiterTag, nbEvents.adjusted] = adjustMainTag(delimiterTag,$page,venue,nbEvents.main);
        setEventPanel(nbEvents.adjusted);
        delimiterTagField.value = adjustedDelimiterTag;
        venue.eventsDelimiterTag = adjustedDelimiterTag;
      }else{
        delimiterTagField.value = delimiterTag;
        venue.eventsDelimiterTag = delimiterTag;
        adjustedDelimiterTag = undefined;
      }
    }else{
      if (autoAdjustCheckbox.checked === true){
        if (adjustedDelimiterTag === undefined){
          [adjustedDelimiterTag, nbEvents.adjusted] = adjustMainTag(delimiterTag,$page,venue);
        }
        setEventPanel(nbEvents.adjusted);
      }else{
        setEventPanel(nbEvents.main);
      }
    }
    computeDateFormat();
    initScrapTextTags();
    if (renderURL === true || oldTag !== mainTagAbsolutePath){
      renderEventURLPanel();
    }
    applyTags();
  }
}

function tagsFromStrings(source){
  // let $eventBlock = cheerio.load($page(mainTag).html());
  venue[currentPage] = addJSONBlock(venueScrapInfo[currentPage],source, showLog);
  if (regroupTagsCheckbox.checked){
    Object.keys(venue[currentPage]).forEach(key =>{
      venue[currentPage][key] = regroupTags(venue[currentPage][key]); 
    });
  }
}

function computeTags(renderURL){
  clearTags();
  if (currentPage === 'mainPage'){
    if (validateDelimiterTags()){
      tagsFromStrings(cheerio.load($page(mainTag).html()));
      computeDateFormat();
      initScrapTextTags();
      applyTags(renderURL);
    }
  }else{
    venue[currentPage] = addJSONBlock(venueScrapInfo[currentPage],$page, showLog);
    // tagsFromStrings($page);
    // console.log(venueScrapInfo[currentPage]);
    computeDateFormat();
    initScrapTextTags();
    applyTags(false);
  }
}


function computeDateFormat(){
  let dates;
  if (currentPage === 'mainPage'){
    dates = getAllDates(venue.eventsDelimiterTag,venue[currentPage]['eventDateTags'],$page);
  }else{
    dates = getAllDates("BODY",venue[currentPage]['eventDateTags'],$page);
  }
  // lastDateList keeps memory of computation. If no new dates to analyze, no need to perform 
  // again a search for the best format
  if (lastDateList === undefined || lastDateList.join('') !== dates.join('')){;
    lastDateList = dates;
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
  
}

function renderEventURLPanel(eventIndex){
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
  if (eventIndex){
    tag = $page(venue.eventsDelimiterTag)[eventIndex];
  }else if (scrapInfoTooOld === true){
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
  // const nbLines = textBox.value.split('\n').length;
  // textBox.setAttribute('rows', nbLines);
  // textBox.setAttribute('rows', textBox.scrollHeight / 24);
  textBox.setAttribute('rows', 5);
} 

function isValidTag(tag){
  try{
    let tagExists = $page(tag).length > 0;
    if (tagExists === false && tag.endsWith(':not([class])')){
      const tagsAlt = [tag.replace(/:not\(\[class\]\)$/,'.SCRPXeventBlock'), 
                       tag.replace(/:not\(\[class\]\)$/,'.SCRPXmainTag'),
                       tag.replace(/:not\(\[class\]\)$/,'.SCRPXeventBlockInvalid')];
      tagExists = tagsAlt.some(el => $page(el).length > 0);
    }
    return tagExists;
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

function initScrapTextStrings(){
  for(let i = 0; i < eventStringsBoxes.length; i++){
    const textBox = eventStringsBoxes[i];
    populateField(textBox, getValue(venueScrapInfo[currentPage],textBox.id));
    const divsChildren = textBox.querySelectorAll('div');
    highlightStringsNotFound(divsChildren);
  }
}

function initScrapTextTags(){
  for(let i = 0; i < eventTagsBoxes.length; i++){
    const textBox = eventTagsBoxes[i];
    textBox.value = getValue(venue[currentPage],textBox.id);
    setRows(textBox);
  }
}

function populateField(textBox, strings, append){
  if (append === undefined || append === false){
    textBox.innerHTML ='';
  }
  if (strings.length > 0){
    strings.split('\n').forEach(el =>{
      let inputElement = document.createElement('div');
      // inputElement.classList.add(textBox.id+'Field');
      inputElement.setAttribute('type', 'text');
      inputElement.textContent = el;
      textBox.appendChild(inputElement);
    });
  }
}

function getValueFromBox(textBox){
  const divsChildren = Array.from(textBox.querySelectorAll('div'));
  return divsChildren.map(myDiv => myDiv.textContent.trim());
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

function setEventPanel(n){
  DelimiterTitle.textContent = "Delimiter tag (found "+n+" events)";
  if (n>0){
    eventSelectorPanel.style.display = 'block';
  }else{
    eventSelectorPanel.style.display = 'none';
  }
}

// by default, return the number of events with the eventDelimiter in venue. Otherwise, count the number
// of events for the given tag
function computeEventsNumber(tag){
  if (tag === undefined){
    tag = venue.eventsDelimiterTag;
  }
  const count = countNonEmptyEvents(tag,$page,venue);
  setEventPanel(count);
  return count;
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
  fieldsToCheck = ['linkedPage','mainPage','regexp'];
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
  if (eventSelectorIndex.value === ''){
    $eventBlock = cheerio.load($page(mainTag).html());
  }else{
    const index = parseInt(eventSelectorIndex.value);
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



// for easyfield, put font in red if the string is not in the document
function validateString(box){
  if ($page.text().includes(box.value.trim())){
    box.classList.remove('redFont');
  }else{
    box.classList.add('redFont');
  }

}

function highlightStringsNotFound(divsChildren){
  divsChildren.forEach(myDiv =>{
    if ($page.text().includes(myDiv.textContent.trim())){
      myDiv.classList.remove('redFont');
    }else{
      myDiv.classList.add('redFont');
    }
  });
}