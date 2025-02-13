const webSources = '../webSources/';
const imports = '../../import/';

const fs = require('fs');
const cheerio = require('cheerio');
const { shell } = require('electron');


const {parseDocument} = require('htmlparser2');
const {app, Menu, ipcRenderer} = require('electron');
const {loadVenuesJSONFile, loadVenueJSON, initializeVenue, saveToVenuesJSON,
        fromLanguages, getLanguages, isValidEvent} = require(imports+'jsonUtilities.js');
const {simplify, removeBlanks, extractBody, convertToLowerCase, removeDoubles,
      makeURL, isValidURL} = require(imports+'stringUtilities.js');
const {getFilesContent, getModificationDate, loadLinkedPages, getFilesNumber} = require(imports+'fileUtilities.js');
const {downloadVenue, erasePreviousHtmlFiles, getHrefListFrom, downloadLinkedPages} = require(imports+'aspiratorexUtilities.js');
const {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings,
  splitAndLowerCase, addJSONBlock, reduceTag, getAllDates, getBestDateFormat,
  adjustMainTag, countNonEmptyEvents, regroupTags, getMostUsedTagClassSets} = require(imports+'analexUtilities.js');
const {getDateConversionPatterns} =require(imports+'dateUtilities.js');
const {getText} =require(imports+'scrapexUtilities.js');

var showLog = false;

let intervalId, linkedFileContent, linkedPage, eventURL;
let stopCounter = false;
var localPage, $page, mainTag;
var nbEvents = {main:undefined, adjusted:undefined};
var delimiterTag, adjustedDelimiterTag, lastDateList;
let pageManagerReduced = false;
let log ='';
let mustIncludeURL  = false;
let mainTagAbsolutePath;
let nbPagesToShow = 5;
let nbPages = 0;
let currentPage = 'mainPage';

// const keyNames = ['Dummy','Name','Date','Style','Place','URL','MultiName','MultiDate','MultiStyle','MultiPlace','MultiURL'];

const keyNames = ['Name','Date','Style','Place','URL'];
const colorClassList = ['SCRPXhighlightName','SCRPXhighlightDate','SCRPXhighlightStyle',
                        'SCRPXhighlightPlace','SCRPXhighlightURL','SCRPXhighlightURLOverlay'];
const reservedClassList = colorClassList.concat(['SCRPXhighlightMultiName','SCRPXhighlightMultiDate','SCRPXhighlightMultiStyle','SCRPXhighlightMultiPlace','SCRPXhighlightMultiURL',
  'SCRPXmainTag','SCRPXeventBlock','SCRPXeventBlockInvalid']);
const easyButtonClassList = ['easyButtonName','easyButtonDate','easyButtonStyle','easyButtonPlace','easyButtonURL'];

const inlineTags = ['b','i','em','u','span','code','small','strong','sub','sup','del', 'ins','mark'];

let autoAdjustLevel = 0;
const defautAutoAdjustLevel = 2;
let lastConfig = {
  autoAdjustLevel: defautAutoAdjustLevel,
  urlCheck: true,
  setup:''
}

const customTagName = 'custom-a';
// custom tag class to replace <a> tags that conflict with click events
class customA extends HTMLElement {
  constructor() {
    super(); 
    this.style.color = "blue";       // Texte en bleu
    this.style.textDecoration = "underline";
    this.style.display = "block"; // Comportement similaire à une <div>
    this.style.padding = "5px";
  }
}

// Enregistrer la balise personnalisée
customElements.define(customTagName, customA);

// global variables 



let subTags = {
  'mainPage': null,
  'linkedPage': null
};
let urlTags = [];
let candidatePrincipalTag;
let principalTagIndex;
let principalTag;
let eventTagList;
let urlTag;
let depthPrefix;

/*****************************/
/*         initialize        */
/*****************************/


// get venue JSON
const venues = loadVenuesJSONFile();
const venueID = localStorage.getItem('currentVenueId');
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

rightPanel.addEventListener('click', (event) => {
  behaviourSetup('automaticLastSetup');
  event.preventDefault();
  event.stopPropagation();
   
  // provide visual effects to show what happens
  const clickedElement = event.target;
  // console.log('Tag clicked :', clickedElement.tagName);
  const previousBackground = clickedElement.style.backgroundColor;
  clickedElement.style.border = '2px solid red';
  clickedElement.style.backgroundColor = 'red';

  setTimeout(() => {
    clickedElement.style.border = '';
    clickedElement.style.backgroundColor = previousBackground;
  }, 200);

  makePrincipalTag(clickedElement);
}, {
  capture: true,    // Use capture phase
  passive: false    // Allow preventDefault
});


/*****************************************/
/*             compute tags              */
/*****************************************/


// compute the delimiter tag, starting from the selected one 'initialTag'. 
// the value of 'initialTag is provided when clicking on the page, and its value is stored in the global variable
// 'candidateTag'. If a checkbox is changed, the value passed should be this 'candidateTag' in order to recompute the delimiter tags.
function makePrincipalTag(initialTag){
  console.log("\x1b[43m\x1b[30mComputing main tag\x1b[0m");

  // remove old tags
  clearAllTags();
  
  if (!initialTag){
    delimiterTagField.classList.add('invalid');
    eventTagList = [];
  }else{
    const mainTagHasChanged = principalTag === undefined || initialTag !== principalTag;
    delimiterTagField.classList.remove('invalid');
    // compute new principal tag
    candidatePrincipalTag = initialTag;

    // extend the tag until an URL is found
    principalTag = candidatePrincipalTag;

    // extend delimiter tag to include at least one url
    if (mustIncludeURL){
      principalTag = getAncestorWithUrl(principalTag) || principalTag;
    }


    // adjust principal tag by removing classes that limit the number of events
    [cleanPath, eventTagList] = adjustPrincipalTag(principalTag);

    // compute other event tags and highlight them
   
    const newEventTagList = findTagsFromPath(rightPanel,cleanPath);

    // if the new event list and the old one have elements in common, keep track of some information
    // such as URL index or URL tag. Otherwise, make a clean sheet
    let hasCommonElement = newEventTagList.some(item => eventTagList.includes(item));
    if (hasCommonElement){

    }else{
      if (venue.mainPage.hasOwnProperty('eventURLTags')){
        delete venue.mainPage.eventURLTags; 
      }
      if (venue.mainPage.hasOwnProperty('eventURLIndex')){
        delete venue.mainPage.eventURLIndex;
      }
    }
  
    principalTagIndex = eventTagList.findIndex(el => el === principalTag);
    delimiterTagField.value = cleanPath;
    // console.log('Main tag registered :', principalTag.tagName);

    // find sub tags corresponding to each line
    subTags[currentPage] = getSubTags(principalTag);

    if (mainTagHasChanged){
      populateEasyPanel();
    }else{// some tags may have change, for example if there are more events in eventTagList
      applyTags();
    }
    
  }

  // draw the delimiter panel
  setDelimiterPanel(countEvents(eventTagList));
  renderEventURLPanel();
}


/*****************************************/
/*             aux functions              */
/*****************************************/


function countEvents(eventTagList){
  return eventTagList.length;
}

// remove classes that are too specific (like 't5410' that is associated to concerts for 'Le Sucre') which cause losing events
// such as 'concert' events ('t5411')
// returns [bestInfo, currentTagList]:  bestInfo: best tag info [tagName, classList]
//                                      currentTagList: the list of tag matching the same tagName and classList
// adjustLevel indicates how many classes may be dropped. Having a number too high may cause an overselection
//
// this version of the function assumes that a tag delimiter is only defined by the last tag (type, class) and not a chain of
// successors since a depth level is defined. Should be ajusted if this does not work (see adjustMainTag in analexUtilities.js)
// for a way to do it.

function adjustPrincipalTag(principalTag){
  let tagName = principalTag.tagName;
  let classes = Array.from(principalTag.classList);
  let bestInfo = [tagName, classes];

  eventTagList = findTagsFromPath(rightPanel, tagName+'.'+classes.join('.'));
  // const mainTagEventsNumber = countEvents();
  let currentNumber = countEvents(eventTagList);
  let currentTagList = eventTagList;
  // console.log('start number', currentNumber);

  // console.log(classes);
  const depthClassName = classes.find(el => el.startsWith(depthPrefix));
  if (depthClassName === undefined){
    console.log("\x1b[33m Warning:\x1b[0m 'depth' class not found. Html file is too old. Run again aspiratorex.");
  }
  classes = classes.filter(item => item !== depthClassName);
 
  const adjustLevel = Math.min(autoAdjustLevel, classes.length -1);

  for(let i = 1;i <= adjustLevel;i++){
    // check if a better solution exists for i class removal
    let comboList = generateCombinationsByRemoval(classes,i);
    comboList.forEach(combo =>{
      const newClassList = depthClassName?combo.concat(depthClassName):combo;
      const path = tagName+'.'+newClassList.join('.');
      const newEventList = findTagsFromPath(rightPanel,path);  
      if (countEvents(newEventList) > currentNumber){
        currentNumber = newEventList.length;
        currentTagList = newEventList;
        bestInfo = [tagName, newClassList];
      }
    })
  }
  // console.log(currentNumber);
  bestInfo[0] = bestInfo[0].toLowerCase()===customTagName?'A':bestInfo[0];

  const tagPathString = bestInfo[0]+'.'+bestInfo[1].join('.');
  return [tagPathString, currentTagList];
  // return [bestInfo, currentTagList];
}





















/////////////////

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
  venue.eventsDelimiterTag = delimiterTagField.value;

  // remove regexp keys if the corresponding regex are not active
  if (venue.hasOwnProperty('regexp')){
    regexKeys.forEach(key => {
      if (!regexElements[key].isActive){
        delete venue.regexp[key];
      }
    });
  }
  // remove accidental blank lines from the fields
  removeEmptyFields(venue);
  // remove regex if it does not contain any key
  if (venue.hasOwnProperty('regexp')){
    if (Object.keys(venue.regexp).length === 0){
      delete venue.regexp;
    }
  }
  toLog("Saved to venue.json:");
  toLog(JSON.stringify(venue));
  saveToVenuesJSON(venues);
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
      makePrincipalTag(candidatePrincipalTag);
      focusTo(principalTag);
      ProcessRegex();
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




// delimiter panel

const delimiterPanel = document.getElementById('delimiterPanel');
const DelimiterTitle = document.getElementById('DelimiterTitle');
const eventURLPanel = document.getElementById('eventURLPanel');
var delimiterTagField = document.getElementById('delimiterTagField');
delimiterTagField.addEventListener('input'||'change',event =>{
  behaviourSetup('manual');
  eventTagList = findTagsFromPath(rightPanel, delimiterTagField.value);
  candidatePrincipalTag = eventTagList[0];
  makePrincipalTag(candidatePrincipalTag);
});


const autoAdjustIndex = document.getElementById('autoAdjustIndex');
autoAdjustIndex.addEventListener('change', function(){
  autoAdjustIndexChange();
});
 
function autoAdjustIndexChange(){
  autoAdjustLevel = autoAdjustIndex.value;
  makePrincipalTag(candidatePrincipalTag);
  
}

const eventURLPanelWarning = document.getElementById('eventURLPanelWarning');

// adjust url check box
const adjustURLCheckbox = document.getElementById('adjustURLCheckbox');
adjustURLCheckbox.addEventListener('change',()=>{
  mustIncludeURL = adjustURLCheckbox.checked;
  makePrincipalTag(candidatePrincipalTag);
});


/*****************************/
/*          grouping         */
/*****************************/

// group tags button
const groupTagsButtons = document.getElementsByClassName('groupTagsButton');

let groupTags = {};


for(const button of groupTagsButtons) {
 
  const key = 'event'+button.id.replace('groupTagsButton','')+'Tags';
  button.title = "Cliquer désactiver le groupage de balises";

  // tests if the tags contained in venue for a given key have been explicitly ungrouped.
  // if it is the case, some lines should be the same, but with different eq(XX) label.
  // after grouping, the number of tag strings will decrease
  if (venue[currentPage].hasOwnProperty(key)){
    const afterGrouping = regroupTags(venue[currentPage][key]);
    const groupingPreventionDetected = afterGrouping.length < venue[currentPage][key].length;

    groupTags[key] = !groupingPreventionDetected;
  }else{
    groupTags[key] = true;
  }

  // initialize the active/inactive state of the button
  setGroupButtonActivity(button, groupTags[key]);
  

  button.addEventListener('click',()=>{
    // set the new value for grouping
    groupTags[key] = !groupTags[key];
    // change the appearance of the button
    setGroupButtonActivity(button, groupTags[key]);
    computeTags();
  })
}

// change the appearance of the button
function setGroupButtonActivity(button, isActive){
  if (isActive === true){
    button.classList.add('activeGroupTagButton');
    button.classList.remove('inactive');
    button.title = "Cliquez pour désactiver le groupage de balises";
  }else{
    button.classList.remove('activeGroupTagButton');
    button.classList.add('inactive');
    button.title = "Cliquez pour activer le groupage de balises:\nles balises similaires seront regroupées sous une balise générique";
  }
}




/*****************************/
/*        easy panel         */
/*****************************/

const easyPanelFields = document.getElementById('easyPanelFields');

function populateEasyPanel(){
  console.log("\x1b[43m\x1b[30mpopulating Easy Panel\x1b[0m");
  let markFirstURL = true;
  easyPanelFields.innerHTML = '';
  // create a new line in the panel for each tag
  subTags[currentPage].forEach(tag => {
    markFirstURL = newEasyLine(tag,markFirstURL);
  });
  computeTags();
  computeDateFormat();
}

// This function is used to verify if a tag may be used as information for an URL link. If the tag itself is no a link
// it will find if an ancestor can be. The reason is that some links are not at the top level of tags, and thus not listed
// in the easy panel.
function findAncestorWithURL(tag){
  if (tag.tagName.toLowerCase() === 'body'){// tag with URL not found
    return null;
  }
  if (principalTag && tag === principalTag){// the first ancestor found with an URL is the principal tag. This tag is not candidate for being a tag.
    return null;
  }
  if (tag.hasAttribute('href')){
    return tag;
  }
  return findAncestorWithURL(tag.parentElement);
}

// create new line in the easy panel. If several tags are marked as URL tags, only keep the first one
function newEasyLine(tag, markFirstURL = true){
  const text = tag.textContent.trim().replace(/[\n\s\t]{1,}/g,' ');
  const index = easyPanelFields.getElementsByClassName('easyField').length; //count the lines already existing

  // create html div panel for the line
  let newDiv = document.createElement('div');
  newDiv.classList.add('easyPanelLine');

  // add tag text to the line
  let inputElement = document.createElement('input');
  inputElement.readOnly = true;
  inputElement.classList.add('easyField');
  inputElement.setAttribute('type', 'text');
  inputElement.value = text;
  newDiv.appendChild(inputElement);

  // create buttons for changing field type (name, date, ...)
  for(i=0;i<keyNames.length;i++){
    let newEasyButton = document.createElement('button');
    newEasyButton.classList.add('easyButton'); // for css
    newEasyButton.classList.add(easyButtonClassList[i]); // add class easybutton for css (coloring, hoovering)
    newEasyButton.classList.add('easyLine'+index); // used to identify buttons on the same line
    newEasyButton.eventTagType = 'event'+keyNames[i]+'Tags'; // set the corresponding tag field
    newEasyButton.colorClass = colorClassList[i]; // set the color class when active
    newEasyButton.title = easyButtonClassList[i].replace('easyButton','');
    
    // if the type (name, date, ...) is the same than the current button, make it active
    if (tag.desc === newEasyButton.eventTagType){
      newEasyButton.classList.add(newEasyButton.colorClass);
    }
    if (markFirstURL && newEasyButton.eventTagType === 'eventURLTags' && tag.isURL){
      newEasyButton.classList.add(newEasyButton.colorClass);
      markFirstURL = false;
    }

    // if the tag and ancestors have no url link, deactivate the button
    if (keyNames[i] === 'URL'){
      if (!findAncestorWithURL(tag)){
        newEasyButton.classList.add('inactive');
      }else{
        newEasyButton.title = 'URL: '+findAncestorWithURL(tag).getAttribute('href');
        // URL switch button 
        newEasyButton.addEventListener('click',function() {
          if (tag.isURL){
              // turn button off when clicking on an active button
              this.classList.remove(this.colorClass);
              tag.isURL = false;
          }else{
            // turn of all other URL button and remove isURL marker (there can be only one URL)
            subTags[currentPage].forEach(tag => { 
              tag.isURL = false;
            });
            const easyButtons = easyPanelFields.getElementsByClassName('easyButton');
            for (button of easyButtons){
              if (button.eventTagType === 'eventURLTags'){
                button.classList.remove(this.colorClass);
              }
            }
            // activate the current button
            tag.isURL = true;
            this.classList.add(this.colorClass);
          }
          computeTags();
          renderEventURLPanel();
        });
      }
    }else{
      // new button for keyName !== URL
      newEasyButton.addEventListener('click',function() {
        // when clicking on the button, make all buttons of the line inactive
        const buttonList = easyPanelFields.getElementsByClassName('easyLine'+index);
        for(j=0;j<buttonList.length;j++){
          if (keyNames[j] !== 'URL'){
            buttonList[j].classList.remove(colorClassList[j]);
          }
        }
        if (tag.desc === this.eventTagType){
            // turn button of when clicking on an active button
            tag.desc = undefined;
        }else{
          // activate the current button
          tag.desc = this.eventTagType;
          this.classList.add(this.colorClass);
          // tag.classList.add(this.colorClass);
        }
        computeTags();
        computeDateFormat();
      });
    }
    newDiv.appendChild(newEasyButton);
  }
  // const newButton = document.createElement('button');
  // newButton.id = 'removeButton'+index;
  // newButton.classList.add('easyButton');
  // newButton.classList.add('easyRemoveButton');
  // newButton.textContent = '✖';
  // newButton.addEventListener('click', function(){
  //   const lineIndex = parseInt(this.id.match(/\d+$/));
  //   const renderURL = easyPanelInfo.indexList[lineIndex] === easyConvert['eventURLTags'];
  //   let lineToRemove = document.getElementById('easyPanelLine'+lineIndex);
  //   easyPanelInfo.indexList[lineIndex] = undefined;
  //   lineToRemove.remove();
  //   // getStringsFromEasyField();
  //   if (currentPage ==='mainPage'){
  //     // computeDelimiterTag(renderURL);
  //   }else{
  //    
  //   }
  // });
  // newDiv.appendChild(newButton);
  easyPanelFields.appendChild(newDiv);
  return markFirstURL;
}

function computeTags(){
  console.log('\x1b[43m\x1b[30mComputing tags\x1b[0m');
  clearAllTags();
  venue[currentPage] = {};
  
  // get the tag strings and put them in venue
  subTags[currentPage].forEach(tag => {
    if (tag.desc){
      if (!venue[currentPage].hasOwnProperty(tag.desc)){
        venue[currentPage][tag.desc] = [];
      }
      venue[currentPage][tag.desc].push(removeCustomTags(getPath(principalTag,tag)));
    }
    if (tag.isURL){
      venue[currentPage].eventURLTags = [removeCustomTags(getPath(principalTag,tag))];
    }
  });
  // console.log('venue data',venue[currentPage]);

  // propagate tags to other events in the list. Does not propagate tags that will be selected
  // due to grouping. Does not put color css in the document (should be done after grouping)
  applyTags(true);

  // group tags and put the new tag strings to venue
  if(Object.keys(groupTags).some(key => groupTags[key] === true)){
    console.log('\x1b[42m\x1b[30mGrouping tags\x1b[0m');
  }

  Object.keys(groupTags).forEach(key => {
    if (groupTags[key] === true && venue[currentPage].hasOwnProperty(key)){
      venue[currentPage][key] = regroupTags(venue[currentPage][key]);
    }
  });
  
  // update tag fields on the GUI
  for(let i = 0; i < eventTagsBoxes.length; i++){
    const textBox = eventTagsBoxes[i];
    textBox.value = getValue(venue[currentPage],textBox.id);
    setRows(textBox);
  }
  
  // Add the color css to the document
  applyTags();
}




// scrap panels

const dateFormatText = document.getElementById('dateFormatText');
const eventURLTagBox = document.getElementById('eventURLTags');
const eventTagsBoxes = document.getElementsByClassName('eventTags');

eventURLTagBox.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
      event.preventDefault();
  }
});


const eventURLPanelMessage = document.getElementById('eventURLPanelMessage');
const eventURLSelectPanel = document.getElementById('eventURLSelectPanel');
const eventURLSelect = document.getElementById('eventURLSelect');
const followURLButton = document.getElementById('followURLButton');

followURLButton.addEventListener('click',function(){
    const url = makeURL(venue.baseURL,eventURL);
    shell.openExternal(url);
});

// initialize scraptextboxes for tags
for(let i = 0; i < eventTagsBoxes.length; i++){
  const textBox = eventTagsBoxes[i];
  setRows(textBox);
  textBox.addEventListener('input', event =>{
    tagTextBoxUpdate(textBox);
  });
}

function tagTextBoxUpdate(textBox){
  // prevent grouping 
  groupTags[textBox.id] = false;
  const button = Array.from(groupTagsButtons).find(el => el.id.endsWith(textBox.id.replace('event','').replace('Tags','')));
  setGroupButtonActivity(button, groupTags[textBox.id]);
  setRows(textBox);
  venue[currentPage][textBox.id] = getArray(textBox.value);
  clearAllTags(true);
  // successively mark the tags and apply the colors
  applyTags(true);
  applyTags(false);
  // applyTags(textBox.id === 'eventURLTags');
  renderEventURLPanel();
}


// event selectors panel

const eventSelectorPanel = document.getElementById('eventSelectorPanel');
const eventSelectorIndex = document.getElementById('eventSelectorIndex');

eventSelectorIndex.addEventListener('change', function(){
  if (eventSelectorIndex.value >= eventTagList.length){
    eventSelectorIndex.value = 1;
  }
  if (eventSelectorIndex.value < 1){
    eventSelectorIndex.value = eventTagList.length;
  }
  principalTag.classList.remove('SCRPXmainTag');
  principalTagIndex = eventSelectorIndex.value-1;
  principalTag = eventTagList[principalTagIndex];

  subTags[currentPage] = getSubTags(principalTag);

  populateEasyPanel();
  principalTag.classList.add('SCRPXmainTag');
  focusTo(principalTag);
  renderEventURLPanel();
  ProcessRegex();
});


/**************************************/
/*      initialize regexp panels      */
/**************************************/


// regexp buttons and panels

const regexElements = {};
const regexKeys = Array.from(document.getElementsByClassName('regexpPanel')).map(el => el.id.replace('RegexpPanel',''));

regexKeys.forEach(key => {
  const element = {
    key: key,
    isActive: false,
    isActiveButton: document.getElementById(key+'RegexActivateButton'),
    panel: document.getElementById(key+'RegexpPanel'),
    textBefore: document.getElementById(key+'RegexpTextBefore'),
    match: document.getElementById(key+'RegexpInput'),
    replaceButton: document.getElementById(key+'RegexpButton'),
    showReplace: false,
    replace: document.getElementById(key+'RegexpReplace'),
    textAfter: document.getElementById(key+'RegexpTextAfter'),
  };

  regexElements[key] = element;
  element.panel.style.display = 'none';
  element.replace.style.display = 'none';

  element.isActiveButton.title = "Cliquez pour activer un filtre regex";

  // set visibility handler
  element.isActiveButton.addEventListener('click',()=>{
    element.isActive = !element.isActive;
    // change the appearance of the button
    if (element.isActive){
      element.isActiveButton.classList.add('activeGroupTagButton');
      element.isActiveButton.classList.remove('inactive');
      element.panel.style.display = 'block';
      element.isActiveButton.title = "Cliquez pour désactiver le filtre regex";
      // store again the values of the field to venue.regexp. Is used when the user has clicked on save after removing regexp
      // (venue.regexp field has been removed doing that), then turn it back on 
      computeVenueRegexField(element);
    }else{
      element.isActiveButton.classList.remove('activeGroupTagButton');
      element.isActiveButton.classList.add('inactive');
      element.panel.style.display = 'none';
      element.isActiveButton.title = "Cliquez pour activer un filtre regex";
    }

    // handlers for match and replace inputs
    element.match.addEventListener('input', function(){
      computeVenueRegexField(element);
    });
    element.replace.addEventListener('input', function(){
      computeVenueRegexField(element);
    });
  });

  // set replace button action
  element.replaceButton.addEventListener('click', function (){
    element.showReplace = !element.showReplace;
    if (element.showReplace){
      element.replace.style.display = 'inline';
    }else{
      element.replace.style.display = 'none';
    }
    computeVenueRegexField(element);
  });
});

// initialize regexp fields from venue info

if (venue.hasOwnProperty('regexp')){
  Object.keys(venue.regexp).forEach(key => {
    const element = regexElements[key];
    // make the regexp panel visible
    element.panel.style.display = 'block';
    element.isActive = true;
    element.isActiveButton.classList.add('activeGroupTagButton');
    element.isActiveButton.classList.remove('inactive');

    // fill the corresponding fields
    element.match.value = venue.regexp[key][0];
    if (venue.regexp[key].length > 1){
      element.replace.value = venue.regexp[key][1];
      element.showReplace = true;
      element.replace.style.display = 'inline';
    }
  });
}

function computeVenueRegexField(element){
  if (!element.isActive || element.match.value === ''){
    delete venue.regexp[element.key];
  }else{
    if (!venue.hasOwnProperty('regexp')){
      venue.regexp = {};
    }
    if (element.showReplace){
      venue.regexp[element.key] = [element.match.value, element.replace.value];
    }else{
      venue.regexp[element.key] = [element.match.value];
    }
  }
  applyRegexp(element);
}


function applyRegexp(element){

  // not tag to analyze
  if (!principalTag){
    element.textBefore.style.display = 'none';
    element.textAfter.style.display = 'none';
    // Array.from(regexpResultPanels).forEach(el => el.style.display = 'none');
    return;
  }
  if (element.isActive){
    element.textBefore.style.display = 'block';
    element.textAfter.style.display = 'block';
    element.textBefore.textContent = venue[currentPage][element.key+'Tags']
                    .flatMap(path => findTagsFromPath(principalTag,path))
                    .map(el => el.textContent).join(' ');
    const regex = new RegExp(element.match.value);
    if (element.showReplace){
      element.textAfter.textContent = element.textBefore.textContent.replace(regex,element.replace.value);
    }else{
      element.textAfter.textContent = element.textBefore.textContent.match(regex);
    }
  }
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
  if (currentPage === 'mainPage'){
    currentPage = 'linkedPage';
    switchPageButton.textContent = '< Switch to main page';
    delimiterPanel.style.display = 'none';
  }else{
    currentPage = 'mainPage';
    switchPageButton.textContent = 'Switch to linked page >';
    delimiterPanel.style.display = 'block';
  }
  initializeInterface();
});

/*****************************/
/* intialize and right panel */
/*****************************/



initializeInterface();

function initializeInterface(){
  if (currentPage === 'mainPage'){
    if (lastModified){// if the file exists
      loadPage();
      makePrincipalTag(candidatePrincipalTag);
      focusTo(principalTag);
      ProcessRegex();
    }else{
      rightPanel.textContent = 'Content not downloaded yet';
      analyzePanel.style.display = 'none';
      missingLinksPanel.style.display = 'none';
    }
  }else{
    loadLinkedPageContent();
  }
  // initScrapTextStrings();
  // initScrapTextTags();
  
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


function clearAllTags(clearOnlySubTags = false){
  (clearOnlySubTags?colorClassList:reservedClassList).forEach(el => {
    rightPanel.querySelectorAll('.'+el).forEach(tag => {
      tag.classList.remove(el);
    })
  });
}

function clearTag(tag){
  colorClassList.forEach(el => {
      tag.classList.remove(el);
    });
}



// marktag: true: only mark the tags for history (run before grouping)
// marktag: false: add classes to highlight the tags
function applyTags(markTags = false){

  if (!markTags){
    console.log('\x1b[43m\x1b[30mapplying tags\x1b[0m');
    eventTagList.forEach(el => {
      el.classList.add('SCRPXeventBlock');
    });
    principalTag.classList.add('SCRPXmainTag');
  }


  Object.keys(venue[currentPage]).forEach(key => {
    className = 'SCRPXhighlight'+key.replace('event','').replace('Tags','');
    venue[currentPage][key].forEach(path =>{
      eventTagList.forEach(rootTag =>{
        const tags = findTagsFromPath(rootTag,path);
        tags.forEach(tag => {
          if (markTags){
            tag.isURL = false; 
            if (key === 'eventURLTags'){
              // console.log('marking URL');
              tag.isURL = true;
            }else{
              tag.desc = key;
            }
          }else{
            if (key === 'eventURLTags' && tag.desc){// add a striped overlay if the tag has also another key
              tag.classList.add('SCRPXhighlightURLOverlay');
            }else{
              tag.classList.add(className);
            }
          }
        });
      });
    })
  });
  
  // if (currentPage === 'mainPage'){
  //   // div.site>div.contentarea:eq(0)>main.sitemain.wrap_agenda.allconcerts:eq(0)>div:not([class]):eq(1)>div:not([class]):eq(1)>div.smallcontent.ukwidth14m.ukgridmargin:eq(8)>div:not([class]):eq(0)>a:not([class]):eq(0)
  //   const mainTagBlock = $page(mainTagAbsolutePath);
  //   mainTagBlock.addClass('SCRPXmainTag');
  //   mainTagBlock.addClass('SCRPXeventBlock');
  //   fillTags(mainTagBlock);
  //   $page(venue.eventsDelimiterTag).each((index, dTag) => {
  //     // console.log($page(dTag).text());
  //     const event = fillTags(dTag);
  //     if (isValidEvent(event, venue)){
  //       $page(dTag).addClass('SCRPXeventBlock');
  //     }else{
  //       $page(dTag).addClass('SCRPXeventBlockInvalid');
  //     }
  //   });
  //   // rightPanel.innerHTML = $page.html();
  //   rightPanel.querySelectorAll('a'||'select').forEach(link => {
  //     link.addEventListener('click', e => {
  //       e.preventDefault(); 
  //     });
  //   });

  //   mainTagBlock.addClass('SCRPXmainTag');
  //   mainTagBlock.addClass('SCRPXeventBlock');
  
  //   if (localPage){
  //     if (renderURL === true){
  //       // renderEventURLPanel();
  //     }
  //   }else{
  //     analyzePanel.style.display = 'none';
  //   }
  
  //   const focusedElement = document.getElementsByClassName("SCRPXmainTag")[0];
  //   focusTo(focusedElement);
  //   // console.log($page.html());
  // }else{
  //   fillTags($page('BODY'));
  //   // rightPanel.innerHTML = $page.html();
  //   rightPanel.querySelectorAll('a'||'select').forEach(link => {
  //     link.addEventListener('click', e => {
  //       e.preventDefault(); 
  //     });
  //   });
  // }
}




function loadPage(){
  
  analyzePanel.style.display = 'block';
  localPage = reduceImgSize(getFilesContent(sourcePath, nbPagesToShow));
  // replace <a> tags with something that is not conflicting with click events for right panel
  localPage = localPage.replace(/<[\s\n\t]*a /gi,'<'+customTagName+' ').replace(/<[\s\n\t]*\/a[\s\n\t]*>/gi,'</'+customTagName+'>');
  $page = cheerio.load(parseDocument(localPage));
  setDepthPrefix($page);

  rightPanel.innerHTML = $page.html();
  const linkTags = rightPanel.querySelectorAll(customTagName);
  for(tag of linkTags){
    tag.title = makeURL(venue.baseURL,tag.getAttribute('href'));
  }
  // console.log(rightPanel.innerHTML);

  // autosuggest
  // const cl = getMostUsedTagClassSets($page);
  // console.log(cl);
  
  // find the tag from eventsDelimiterTag, with the text in the strings. If not found, get the first tag
  // that matches eventsDelimiterTag
  // venue.eventsDelimiterTag = 'a.pureu11.pureumd12.truc>div>a.truc2.truc3';
  // a.pureu11.pureumd12.pureulg14.t5410.pureug.agendacard
  // venue.eventsDelimiterTag = 'a.pureu11.pureumd12.pureulg14.t5410.pureug.agendacard';
  behaviourSetup('automaticDefault');
  
  if (venue.hasOwnProperty('eventsDelimiterTag')){
    delimiterTagField.value = venue.eventsDelimiterTag;
    candidatePrincipalTag = findTagsFromPath(rightPanel, venue.eventsDelimiterTag)[0];
    // eventTagList = findTagsFromPath(rightPanel, venue.eventsDelimiterTag);
    // candidatePrincipalTag = eventTagList[0];
    if (!candidatePrincipalTag){// start with default setup for automatic 
      behaviourSetup('automaticDefault');
    }else{
      behaviourSetup('initialize');
    }
    
    // console.log(eventTagList);
    // console.log(venue.eventsDelimiterTag);
    // eventTagList = rightPanel.querySelectorAll('a.pureu11.pureumd12.pureulg14.t5410.pureug.agendacard');
    // console.log(eventTagList);
    // la suite à filtrer et enlever
    
    // const mainTagCandidates = $page(venue.eventsDelimiterTag);
    // let i;
    // for(i=mainTagCandidates.length-1;i>=0;i--){
    //   const text = $page(mainTagCandidates[i]).text();
    //   const containStrings = !stringsToFind.some(str => !text.includes(str));
    //   // console.log('to find',stringsToFind,'\n',text);
    //   if (containStrings){
    //     break;
    //   }
    // }
  
    // mainTag = mainTagCandidates[i];
    // mainTagAbsolutePath = getTagLocalization($page(mainTag),$page,false);
    // delimiterTag = reduceTag(getTagLocalization($page(mainTag),$page,true),$page);
    // // nbEvents.main = computeEventsNumber(delimiterTag);
    // [adjustedDelimiterTag, nbEvents.adjusted] = adjustMainTag(delimiterTag,$page,venue,nbEvents.main);
    
  }


  computeMissingLinks();
  // if (validateDelimiterTags()){
  // }
  // applyTags(true);
}

function computeMissingLinks(){
  linkedFileContent = fs.existsSync(sourcePath+'linkedPages.json')?loadLinkedPages(sourcePath):[];
  // console.log(linkedFileContent);
  // console.log(venue, venueWithCustomTags(venue));
  const hrefList = getHrefListFrom([localPage],venueWithCustomTags(venue));
  console.log(hrefList);
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
    // if (typeof(object)==="string"){
    //   return object;
    // }else{
    return object.join('\n');
    // }
  }else{
    return '';
  }
}

function getArray(string){
  return  string.split('\n')
                .filter(line => line.trim().length > 0);
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


function computeDateFormat(){
  console.log('\x1b[42m\x1b[30mComputing date format\x1b[0m');
  let dates = [];
  if (currentPage === 'mainPage'){
    if (eventTagList && venue.mainPage.hasOwnProperty('eventDateTags')){
      // for every event, get the date strings corresponding to the date tags and concatenate them.
      eventTagList.forEach(eventTag => {
        const dateString = venue.mainPage['eventDateTags'].flatMap(dateTag => findTagsFromPath(eventTag,dateTag))
                                                  .map(tag => tag.textContent).join(' ');
        dates.push(dateString);
      });
    }
  }else{
    const dates = [venue.linkedPage['eventDateTags'].flatMap(dateTag => findTagsFromPath(eventTag,dateTag))
                                                  .map(tag => tag.textContent).join(' ')];

    // dates = getAllDates("BODY",venue[currentPage]['eventDateTags'],$page);
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

function renderEventURLPanel(){

  // console.log('url render');
  eventURL = undefined;

  if (!eventTagList || eventTagList.length === 0){
    // eventURLPanel.style.display = 'none';
    setSwitchStatus();
    return;
  }
  eventURLPanel.style.display = 'block';

  if (!containsURL(principalTag)){
    eventURLSelectPanel.style.display = 'none';
    eventURLPanelWarning.style.display = 'block';
    eventURLPanelWarning.textContent = 'Cannot find any URL in the event block.';
    eventURLPanelMessage.style.display = 'none';
    setSwitchStatus();
    return;
  }

  eventURLPanelWarning.style.display = 'none';

  // if eventURLTags, is defined, try to extract the URL
  if (venue.mainPage.hasOwnProperty('eventURLTags')){
    // console.log('url tag found in venue');
    urlTag = findTagsFromPath(principalTag,venue.mainPage.eventURLTags[0])[0];
    eventURL = getAncestorWithUrl(urlTag).getAttribute('href');
    // console.log(venue.mainPage.eventURLTags[0]);
    // console.log(findTagsFromPath(principalTag,venue.mainPage.eventURLTags[0]));
    // console.log(urlTag.tagName);
    eventURLSelectPanel.style.display = 'none';
    if (eventURL){
      eventURLPanelMessage.textContent = 'URL from tag: '+ eventURL;
      eventURLPanelMessage.style.display = 'block';
      setSwitchStatus();
      return;
    }else{
      eventURLPanelWarning.style.display = 'block';
      eventURLPanelWarning.textContent = 'URL tag found, but it does not contain a URL reference. Set another tag or choose a link from the list';
    }
  }

  // if no eventURL is present, or if it doesn't provide a valid URL, try to find the URLs contained in the block
  
  eventURLPanelMessage.style.display = 'block';
  
  urlTags = findURLTags(principalTag);
  // const index = urlList.findIndex(function(element) {
  //   return typeof element !== 'undefined';
  // });
  let index = 0;
  if (venue.mainPage.hasOwnProperty('eventURLIndex') && venue.mainPage.eventURLIndex != undefined){
    index = venue.eventURLIndex;
    if (index >= urlTags.length){
      index = 0;
    }
  }
  venue.eventURLIndex = index;

  // console.log('URLs found: '+urlTags.length);
  eventURLPanelMessage.style.display = 'block';
  
  eventURL = urlTags[index].getAttribute('href');
  if (urlTags.length === 1) {
    eventURLPanelMessage.textContent = 'URL found: ' + eventURL;
    eventURLSelectPanel.style.display = 'none';
    if (venue.mainPage.hasOwnProperty('eventURLTags')){
      delete venue.mainPage.eventURLTags;
    }
  } else {
    eventURLPanelMessage.textContent = 'Choose URL to keep: ';
    eventURLSelect.innerHTML = '';
    urlTags.forEach((tag, ind) => {
      // console.log('adding '+ind);
      if (isValidURL(tag.getAttribute('href'))){
        const option = document.createElement('option');
        option.text = tag.getAttribute('href');
        option.value = ind;
        eventURLSelect.appendChild(option);
      }
    });
    eventURLSelectPanel.style.display = 'inline';
    eventURLSelect.selectedIndex = index;
    eventURLSelect.addEventListener('click', event => {
      urlSelectAction();
    });
    eventURLSelect.addEventListener('change', event => {
      urlSelectAction();
    });

    function urlSelectAction(){
      venue.mainPage.eventURLIndex = eventURLSelect.selectedIndex;
      eventURL = eventURLSelect.options[eventURLSelect.selectedIndex].text;
      venue.mainPage.eventURLIndex =  eventURLSelect.value;
      eventURLPanelWarning.style.display = 'none';
      if (venue.mainPage.hasOwnProperty('eventURLTags')){
        delete venue.mainPage.eventURLTags;
      }
      setSwitchStatus();
    }
  }
  setSwitchStatus();
  
}


//aux functions

function setSwitchStatus(){
  // console.log('\x1b[44mSetting switch status\x1b[0m');
  const linkURL = makeURL(venue.baseURL,eventURL);
  if (!linkedFileContent){
    switchPageButton.classList.remove('activeButton');
    switchPageButton.classList.add('inactive');
    switchPageButton.disabled = true;
    return;
  }
  linkedPage = linkedFileContent[linkURL];
  if (linkedPage){
    switchPageButton.classList.add('activeButton');
    switchPageButton.classList.remove('inactive');
    switchPageButton.disabled = false;
  }else{
    switchPageButton.classList.remove('activeButton');
    switchPageButton.classList.add('inactive');
    switchPageButton.disabled = true;
  }
}

function setRows(textBox) {
  textBox.style.height = "auto"; 
  textBox.style.height = textBox.scrollHeight + "px";
  // textBox.setAttribute('rows', 3);
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



function findURLTags(tag){

  let links = [];
  if (tag.hasAttribute('href')) {
    links.push(tag);
  } 
  links = links.concat(Array.from(tag.querySelectorAll(customTagName)));
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

function setDelimiterPanel(n){
  DelimiterTitle.textContent = "Delimiter tag (found "+n+" events)";
  eventSelectorPanel.style.display = n>0?'block':'none';
  eventSelectorIndex.disabled = n>0?false:true;
}

// by default, return the number of events with the eventDelimiter in venue. Otherwise, count the number
// of events for the given tag
function computeEventsNumber(tag){
  if (tag === undefined){
    // console.log('comptage');
    tag = venue.eventsDelimiterTag;
  }
  // console.log('Tag: ',tag);
  const count = countNonEmptyEvents(tag,$page,venue);
  // console.log('compté: ',count);
  setDelimiterPanel(count);
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



function focusTo(element){
  if (element){
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// for easyfield, put font in red if the string is not in the document
// function validateString(box){
//   if ($page.text().includes(box.value.trim())){
//     box.classList.remove('redFont');
//   }else{
//     box.classList.add('redFont');
//   }

// }

function highlightStringsNotFound(divsChildren){
  divsChildren.forEach(myDiv =>{
    if ($page.text().includes(myDiv.textContent.trim())){
      myDiv.classList.remove('redFont');
    }else{
      myDiv.classList.add('redFont');
    }
  });
}


///////////////////////////////////////////////
// new functions
///////////////////////////////////////////////

// if a tag or successors contains an href attribute
function containsURL(tag){
  if (tag.hasAttribute('href')) {
    return true;
  } 
  const successors = tag.querySelectorAll('*');
  for (const el of successors) {
    if (el.hasAttribute('href')) {
        return true;
    }   
  }
  return false;
  // const successors = Array.from(tag.querySelectorAll('*'));
  // return (successors.some(el => el.hasAttribute('href')));
}

function getAncestorWithUrl(tag) {
  if (containsURL(tag)) {// if a tag or successors contains an href attribute
    return tag;
  } 
  
  // else try the parent

  const parentTag = tag.parentElement;
  if (parentTag && parentTag.id !== 'scrapEnDirexRightPanel') {
    return getAncestorWithUrl(parentTag);
  } else {
    console.log('Warning: ancestor with URL not found.');
    return null;
  }
  
}

// find depth class prefix added by aspiratorex to avoid empty classes. Should be the last class of the first tag encountered <...>
function setDepthPrefix($page) {
  let firstElementClassArray = $page('*').first().attr('class')?.split(' ') || [];
  depthPrefix = (firstElementClassArray.length > 0) ? firstElementClassArray.at(-1).replace(/[0-9]/g, '') : null;
}

// generate all combination of lists by removing n elements
function generateCombinationsByRemoval(list, n) {
  // If n is 0, return the original list as a single combination
  if (n === 0) {
      return [list];
  }
  
  // If n equals list length, return empty list
  if (n === list.length) {
      return [[]];
  }
  
  // If n is greater than list length, return empty result
  if (n > list.length) {
      return [];
  }

  const combinations = [];

  // Helper function to generate combinations
  function generateCombinations(currentList, start, elementsToRemove, currentCombination = []) {
      // If we've removed enough elements, add this combination
      if (elementsToRemove === 0) {
          combinations.push([...currentCombination]);
          return;
      }

      // For each position, try removing the element at that position
      for (let i = start; i <= currentList.length - elementsToRemove; i++) {
          // Take elements before i and after i
          const newCombination = [
              ...currentList.slice(0, i),
              ...currentList.slice(i + 1)
          ];
          generateCombinations(
              newCombination, 
              i, 
              elementsToRemove - 1,
              newCombination
          );
      }
  }

  // Start the recursive process
  generateCombinations(list, 0, n);
  return combinations;
}

function behaviourSetup(string){
  if(string === 'automaticDefault'){
    autoAdjustLevel = defautAutoAdjustLevel;
    mustIncludeURL = true;
  }else if (string === 'automaticLastSetup'){
    if (!lastConfig.setup.startsWith('automatic')){
      autoAdjustLevel = lastConfig.autoAdjustLevel;
      mustIncludeURL = lastConfig.urlCheck;
    }
  }else if (string === 'manual'){
    lastConfig.autoAdjustLevel = autoAdjustLevel;
    lastConfig.urlCheck = mustIncludeURL;
    autoAdjustLevel = 0;
    mustIncludeURL = false;
  }else if (string === 'initialize'){
    lastConfig.autoAdjustLevel = autoAdjustLevel;
    lastConfig.urlCheck = mustIncludeURL;
    autoAdjustLevel = 0;
    mustIncludeURL = false;
    // when loading, try to find the autoadjust level that corresponds best to the string in venue
    let candidatePrincipalTagClassList = Array.from(candidatePrincipalTag.classList);
    const classListFromVenue = venue.eventsDelimiterTag.split('.').slice(1);
    while(autoAdjustLevel < autoAdjustIndex.max && candidatePrincipalTagClassList.some(el => !classListFromVenue.includes(el))){
      autoAdjustLevel++;
      const [cleanPath] = adjustPrincipalTag(candidatePrincipalTag);
      candidatePrincipalTagClassList = cleanPath.split('.').slice(1);
    }
  }else{
    error.log('unknown mode: ', string);
  }
  lastConfig.setup = string;
  autoAdjustIndex.value = autoAdjustLevel;
  adjustURLCheckbox.checked = mustIncludeURL;
}



// for tag, find the description 'eventXXXTags' that corresponds to it if it is registered in venue.json
function getDescFromJSON(tag){
  Object.keys(venue[currentPage]).forEach(key => {
    venue[currentPage][key].forEach(path =>{
      const tags = findTagsFromPath(principalTag,path);
      if (tags.some(t => t === tag)){
        if (key === 'eventURLTags'){
          tag.isURL = true;
        }else{
          tag.desc = key;
        }
      }
    });
  })
}



function getSubTags(tag){
  const descendants = Array.from(tag.children);
  // count if there are children that are not inline tags. This is to address the following cases:
  // <div> hello <span> world</span></div> should return ['hello word']
  // <div><div> hello </div><div> world</div></div> should return ['hello', 'word']
  // <div><div> hello </div><span> world</span></div> should return ['hello', 'word']
  const nbNonInlineTags=descendants.filter(el => !inlineTags.some(t => t === el.tagName.toLowerCase())).length;

  if (nbNonInlineTags === 0){
    // delete tag.desc; // don't delete, keep track of previous categories
    if (tag.textContent.trim() !== ''){
      getDescFromJSON(tag);
      return [tag];
    }else{
      return [];
    }
    
  }
  const selectedTags = descendants.flatMap(el => getSubTags(el));

  // badly nested divs: this part processes badly nested divs by keeping a text for the whole tag 
  //<div> hello <div> world</div></div> should return ['hello world', 'word'] ???
  
  let parentText = tag.textContent;
  descendants.forEach(function(div) {
    // For each nested <div>, its text is removed from the parent text. 
    parentText = parentText.replace(div.textContent.trim(), '').trim();
  });

  if (parentText.length > 0){
    console.log("\x1b[33mWarning: badly nested divs found in tag \x1b[36m'"+tag.tagName+"'\x1b[0m: "+tag.textContent
      +'. \x1b[33mBadly nested text:\x1b[0m '+parentText
    );
    // descendants.forEach(el => console.log(el.tagName, el.textContent));
    selectedTags.push(tag);
  }
  // selectedTags.forEach(el => console.log(el.tagName,el.textContent));
  return selectedTags;
}



// used to find the tags that are successors of root tag that match the infos from the string path
// subfunction fromCheerioSyntax introduces an intermediate object
// infoList (list of list) which is a list of info [[tagName1, classList1, eq1],[tagName2, classList2, e2],...]
// where eqn is the is nth element if only a specific element has to be returned (optional)
// such that the resulting tags follow a chain of successors (not just children) with tagName n and classList n
// returns a list of tags filling the conditions

function findTagsFromPath(rootTag, path) {

  // intermediate function for easier manipulation
  function fromCheerioSyntax(string){
    let res = [];
    string.split('>').map(tagString => {
      const splittedTagString = tagString.split(':');
      const classes = splittedTagString[0].split('.');
      let tmp = [classes[0], classes.slice(1)];
      if (tmp[0].toLowerCase() === 'a'){
        tmp[0] = customTagName;
      }
      // remove the last class if it is empty
      if (tmp[1][tmp[1].length-1] === ''){
        tmp[1] = tmp[1].slice(0, tmp[1].length-1);
      }
      if (splittedTagString.length > 1){
        const match = splittedTagString[1].match(/\((\d+)\)/);
        tmp = tmp.concat(parseInt(match[1], 10));
      }
      res = res.concat([tmp]);
    });
    return res;
  }

  const infoList = fromCheerioSyntax(path);
  // let currentElements = [rootTag]; // start with root tag

  // for (const [tagName, classes, numero] of infoList) {
  //   let nextElements = [];
  //   currentElements.forEach(parent => {
  //     let selector = tagName + (classes.length > 0 ? '.' + classes.join('.') : '');
  //     let foundElements = Array.from(parent.querySelectorAll(selector));
  //     if (numero !== undefined) {
  //       if (numero >= 0 && numero < foundElements.length) {
  //         nextElements.push(foundElements[numero]);
  //       }
  //     } else {
  //       nextElements.push(...foundElements);
  //     }
  //   });

  //     currentElements = nextElements;
  // }

  let currentElements = [rootTag];  // start with root tag

  for (const [tagName, classes, numero] of infoList) {
      let nextElements = [];
      for (const parent of currentElements) {
          let selector = tagName + (classes.length > 0 ? '.' + classes.join('.') : '');
          let foundElements = parent.querySelectorAll(selector); 
          if (numero !== undefined) {
              if (numero >= 0 && numero < foundElements.length) {
                  nextElements.push(foundElements[numero]);
              }
          } else {
              for (const el of foundElements) { 
                  nextElements.push(el);
              }
          }
      }

      currentElements = nextElements;
  }
  return currentElements; // final list of elements
}

// function getInfoFromTag(rootTag, tag){
//   // console.log(Array.from(tag.classList));
//   if (tag === rootTag){
//     return [];
//   }
//   const parent = tag.parentElement;
//   const infoList = getInfoFromTag(rootTag, parent);
//   const index = Array.from(parent.children).findIndex(ch => ch === tag);
//   infoList.push([tag.tagName, Array.from(tag.classList), index]);
//   // console.log(Array.from(tag.classList));
//   return infoList;
// }


function getPath(rootTag, tag) {
  if (tag === rootTag){
    return '';
  }
  const parent = tag.parentElement;
  let path = getPath(rootTag, parent);
  let tagClasses = Array.from(tag.classList);
  const index = Array.from(parent.children)
                .filter(child => child.tagName = tag.tagName) // filter the tags with the same name
                .filter(child => tagClasses.every(cls => child.classList.contains(cls))) // filter tags which contain the same classes. Need this code to avoid pb with === 
              //   .filter(child => {                         
              //     let chClasses = Array.from(ch.classList).sort();
              //     return chClasses.length === tagClasses.length && 
              //            chClasses.every((cls, i) => cls === tagClasses[i]);
              // })
                .findIndex(ch => ch === tag);
  path = (path.length>0?path+'>':'') + tag.tagName +'.'+ Array.from(tag.classList).join('.') + ':eq('+index+')';
  return path;
}

function removeCustomTags(path){
  const regex = new RegExp(customTagName,"gi");
  return path.replace(regex,'A');
}

function replaceWithCustomTags(path){
  return path.replace(/(?:^|>)(a)(?=$|>|\.)/gi, customTagName);
}


function ProcessRegex(){
  Object.keys(regexElements).forEach(key => applyRegexp(regexElements[key]));
}

// function toCheerioSyntax(infoList){
//   return infoList.map(infos =>  (infos[0].toLowerCase() === customTagName.toLocaleLowerCase()?'a':infos[0].toLowerCase())
//                                 +(infos[1].length>0?'.'+infos[1].join('.'):'')
//                                 +(infos[2]?'eq('+infos[2]+')':'')).join('>');
// }


// replace tags with custom tags
// just process tags for urls, may need improvement
function venueWithCustomTags(v){
  const v2 = {};
    if (v.hasOwnProperty('eventsDelimiterTag')){
      v2.eventsDelimiterTag = replaceWithCustomTags(v.eventsDelimiterTag);
    }
    if (v.hasOwnProperty('eventURLIndex')){
      v2.eventURLIndex = v.eventURLIndex;
    }
    if (v.hasOwnProperty('mainPage')){
      v2.mainPage = {};
      Object.keys(v.mainPage).forEach(key => {
        v2.mainPage[key] = v.mainPage[key].map(el => replaceWithCustomTags(el));
      })
    }
    if (v.hasOwnProperty('linkedPage')){
      v2.linkedPage = {};
      Object.keys(v.linkedPage).forEach(key => {
        v2.linkedPage[key] = v.linkedPage[key].map(el => replaceWithCustomTags(el));
      })
    }

  return v2;
}