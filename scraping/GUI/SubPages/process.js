const webSources = '../webSources/';
const imports = '../../import/';

const fs = require('fs');
const cheerio = require('cheerio');
const { shell } = require('electron');

const {parseDocument} = require('htmlparser2');
const {app, Menu, ipcRenderer} = require('electron');
const { populate } = require('dotenv');
const {loadVenuesJSONFile, loadVenueJSON, initializeVenue, saveToVenuesJSON,
        fromLanguages, getLanguages, getDictionary, isValidEvent} = require(imports+'jsonUtilities.js');
const {simplify, extractBody, convertToLowerCase, removeDoubles,
      makeURL, isValidURL} = require(imports+'stringUtilities.js');
const {getFilesContent, getModificationDate, loadLinkedPages, getFilesNumber} = require(imports+'fileUtilities.js');
const {downloadVenue, erasePreviousHtmlFiles, getHrefListFrom, downloadLinkedPages} = require(imports+'aspiratorexUtilities.js');
const {getTagLocalization, tagContainsAllStrings, getTagContainingAllStrings,
  splitAndLowerCase, addJSONBlock, getAllDates,
  countNonEmptyEvents, regroupTags, getMostUsedTagClassSets} = require(imports+'analexUtilities.js');
const {cleanDate, initDateFormat} =require(imports+'dateUtilities.js');
// const {getText} =require(imports+'scrapexUtilities.js');

// global variables 

var showLog = false;

let linkedFileContent, eventURL;
let preventDownload = false;
var localPage, $page;
var lastDateList;
var lastAlternateDateList;
let pageManagerReduced = false;
let log ='';
let mustIncludeURL  = false;
let nbPagesToShow = 2;
let nbPages = 0;
let currentPage = 'mainPage';
let currentURLTag;
let keepTraceOfAltTags = {mainPage: false, linkedPage: true};
// let alternateTags = {mainPage: {}, linkedPage: {}};
let linkedPageFirstLoad = true;
let extendButton = undefined;
let useLinks;
let manualMode = false;
let currentSubEventIndex;
let tagsAdjustLevel = {mainPage: 0, linkedPage: 0};
let subEventPath;
let venueBeforeLoading;
let eventsMap = {};
let savedLinkPage;
let oldEventsMap;

let subTags = {
  'mainPage': null,
  'linkedPage': null
};

let candidatePrincipalTag;
let principalTagIndex;
let principalTag;
let eventTagList;
let depthPrefix;

function initVars(){
  eventURL = undefined;
  lastDateList = undefined;
  lastAlternateDateList = undefined;
  log ='';
  nbPages = 0;
  currentURLTag = undefined;
  keepTraceOfAltTags = {mainPage: false, linkedPage: false};
  // alternateTags = {mainPage: {}, linkedPage: {}};
  linkedPageFirstLoad = true;
  extendButton = undefined;
  currentSubEventIndex = undefined;
// let tagsAdjustLevel = {mainPage: 0, linkedPage: 0}; 
  subEventPath = undefined;
  venueBeforeLoading = undefined;
  eventsMap = {};
  savedLinkPage = undefined;
  oldEventsMap = undefined;
  subTags = {
    'mainPage': null,
    'linkedPage': null
  };
  
  candidatePrincipalTag = undefined;
  principalTagIndex = undefined;
  principalTag = undefined;
  eventTagList = undefined;
  depthPrefix = undefined;
}

// const keyNames = ['Dummy','Name','Date','Style','Place','URL','MultiName','MultiDate','MultiStyle','MultiPlace','MultiURL'];

const keyNames = ['Name','Date','Style','Place','URL'];
const colorClassList = ['SCRPXhighlightName','SCRPXhighlightDate','SCRPXhighlightStyle',
                        'SCRPXhighlightPlace','SCRPXhighlightURL','SCRPXhighlightURLOverlay','SCRPXhighlightUnknown'];
const reservedClassList = colorClassList.concat(['SCRPXhighlightAlternate','SCRPXhighlightMultiName','SCRPXhighlightMultiDate','SCRPXhighlightMultiStyle','SCRPXhighlightMultiPlace','SCRPXhighlightMultiURL',
  'SCRPXmainTag','SCRPXeventBlock','SCRPXeventBlockInvalid','SCRPXeventBlockWithURL','SCRPXshadow','SCRPXsubEvent',
  'SCRPXmouseHighlight','SCRPXmouseHighlight2']);
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
    // this.style.color = "blue";
    // this.style.textDecoration = "underline";
    // this.style.display = "block"; // 
    // this.style.padding = "5px";
  }
}

// Enregistrer la balise personnalisée
customElements.define(customTagName, customA);



/*****************************/
/*         initialize        */
/*****************************/


// get venue JSON
const venues = loadVenuesJSONFile();
const venueID = localStorage.getItem('currentVenueId');
const venue = loadVenueJSON(venueID,venues);

setLeftPanelDesign();

if (!venue.hasOwnProperty('mainPage')){
  venue.mainPage = {};
}

initAlternateValues();


activateLinksCheckbox = document.getElementById('activateLinksCheckbox');
activateLinksCheckbox.checked = useLinks;
missingLinksPanel.style.display = useLinks?'flex':'none';

activateLinksCheckbox.addEventListener('change',()=>{
  activateSaveButton();
  useLinks = activateLinksCheckbox.checked;
  if (useLinks && !venue.hasOwnProperty('linkedPage')){
    venue.linkedPage = {};
  }
  missingLinksPanel.style.display = useLinks?'flex':'none';
  if (useLinks){
    computeMissingLinks();
  }
  setSwitchStatus();
});

// create color theme for the page
createColorThemes();

// initialize new venue
initializeVenue(venue,webSources);

// get languages, dates and format info
const languages = getLanguages();
console.log('lagg',languages[venue.country])
const dictionary = getDictionary(languages[venue.country]);
console.log("dico", dictionary);

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


let rightPanel = document.getElementById('scrapEnDirexRightPanel');

rightPanel.addEventListener("mouseover", (event) => {
  const target = event.target; //

  if (target && target.textContent.trim() !== "" && target !== principalTag && target !== rightPanel) {
      if (colorClassList.some(cls => target.classList.contains(cls))){
        target.classList.add("SCRPXmouseHighlight2"); 
      }else{
        target.classList.add("SCRPXmouseHighlight"); 
      }   
  }
});

rightPanel.addEventListener("mouseout", (event) => {
  event.target.classList.remove("SCRPXmouseHighlight","SCRPXmouseHighlight2"); 
});

/* add context menu panel */

const contextMenu = document.createElement("div");
contextMenu.classList.add("context-menu");
contextMenu.style.display = "none";
contextMenu.linkedTag = undefined;

// Create buttons container
const contextMenuButtonContainer = document.createElement("div");
contextMenuButtonContainer.classList.add("menu-buttons");

// Create sub event div
const multipleEventOption = document.createElement("div");
multipleEventOption.classList.add("multiple-event");

const cmlabel = document.createElement('label');
const cminput = document.createElement('input');
const cmspan = document.createElement('span');
const cmicon = document.createElement('i');

// make context menu line for sub events
cmlabel.className = 'niceCheckBox';
cmlabel.classList.add('contextMenuLabel');
cmlabel.style.display = 'inline';

cminput.id = 'contextMenuCheckbox';
cminput.className = 'cb cb1';
cminput.type = 'checkbox';
cminput.checked = true;
cminput.addEventListener('change',()=>{
  const easyline = easyLines.find(el => el.tag === contextMenu.linkedTag);
  const event = new Event("click", { bubbles: true, cancelable: true });
  console.log(easyline.querySelector('input'));
  easyline.querySelector('input').dispatchEvent(event);
});

cmspan.textContent = 'Is a sub-event';

cmlabel.appendChild(cminput);
cmlabel.appendChild(cmspan);
cmlabel.appendChild(cmicon);

multipleEventOption.appendChild(cmlabel); 

// Add elements to the context menu
contextMenu.appendChild(contextMenuButtonContainer);
contextMenu.appendChild(multipleEventOption);
document.body.appendChild(contextMenu);


// close the context menu and remove the css attribute of the highlighted tags
function closeContextMenu(){
  if (contextMenu.style.display !== "none"){
    contextMenu.style.display = "none";
  }
  if (contextMenu.linkedTag){
    contextMenu.linkedTag.classList.remove('SCRPXshadow');
  }
  contextMenu.linkedTag = undefined;
}

rightPanel.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const clickedElement = event.target;
  closeContextMenu();

  if (!subTags[currentPage].some(el => el === clickedElement)){
    return;
  }

  contextMenu.linkedTag = clickedElement;

  // for each button of the easypanel, create one in the context menu, and dispatch event to the original button
  contextMenuButtonContainer.innerHTML = '';
  const myEasyLine = easyLines.find(el => el.tag === contextMenu.linkedTag);
  const buttons = myEasyLine.querySelectorAll('.easyButton');
  const contextMenuButtons = [];


  function updateContextMenu(){
    contextMenuButtons.forEach(b => {
      // clear b class list
      while (b.classList.length > 0) {
        b.classList.remove(b.classList.item(0));
      }
      Array.from(b.linkedButton.classList).filter(el => el.startsWith('easyButton') || el.startsWith('SCRPX')
      || el === 'inactiveURL' || el === 'inactive' || el === 'activeButton')
          .forEach(el => b.classList.add(el));
      setEasyButtonDesign(b, b.classList[1].replace('easyButton',''));
    });
    cminput.checked = contextMenu.linkedTag.isMulti;
  }


  for (const button of buttons){
    const b = document.createElement("button");
    b.linkedButton = button;
    if (button.classList.contains('eventTagTypeButton')){
      b.textContent = button.eventTagType.replace('event','').replace('Tags','').replace('Multi','');
    }
    else if (button.classList.contains('easyRemoveButton')){
      b.textContent = '✖';
    }
    contextMenuButtons.push(b);
    contextMenuButtonContainer.appendChild(b);
      
    b.addEventListener("click", (event) => {
      event.preventDefault();
      if (b.classList.contains('inactive') || b.classList.contains('inactiveURL')){
        return;
      }
      button.dispatchEvent(new Event("click"));
      if (button.classList.contains('eventTagTypeButton')){
        updateContextMenu();
      }else{
        closeContextMenu();
      }
    });
  }
  updateContextMenu();

  clickedElement.classList.add('SCRPXshadow');

  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.display = "block";

});


rightPanel.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (contextMenu.style.display !== "none"){
    closeContextMenu();
    return;
  }
  
  const clickedElement = event.target;

  // console.log(clickedElement);

  if (clickedElement === rightPanel){
    return;
  }

  // do nothing if the click is on an element that has been added by scrapex
  if (clickedElement.classList.contains('SCRPXsubEventHeader')){
    return;
  }

  if (clickedElement.classList.contains('SCRPXlinkedPageMainBlock')){
    movePrincipalTagTo(eventsMap[clickedElement.id]);
    updateEventIndexInput();
    return;
  }

  if (clickedElement.classList.contains('SCRPXlinkedPageEventHeader')){
    movePrincipalTagTo(eventsMap[clickedElement.parentElement.id]);
    updateEventIndexInput();
    return;
  }

  if (clickedElement.textContent.trim().length === 0){
    return;
  }

  if (currentPage === 'linkedPage'){
    if (subTags.linkedPage.includes(clickedElement)){
      subTags.linkedPage = subTags.linkedPage.filter(el => el !== clickedElement);
    }else{
      subTags.linkedPage.push(clickedElement);
    }
    populateEasyPanel();
    focusTo(clickedElement, 'instant');
    return;
  }

  // if the element clicked is the extend button, decrease one level for the principal tag
  if (clickedElement === extendButton){
    const target = extendButton.tagTarget;
    makePrincipalTag(target.parentElement);
    return;
  }

  behaviourSetup('automaticLastSetup');
   
  // provide visual effects to show what happens
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
function makePrincipalTag(initialTag, firstLoad = false){
  console.log("\x1b[43m\x1b[30mComputing main tag\x1b[0m");

  // remove old tags and extendButton
  clearAllTags();

  // remove sub event header from the page
  removeSubEventHeaders();

  if (extendButton){
    extendButton.remove();
  }
  
  if (!initialTag){
    delimiterTagField.classList.add('invalid');
    eventTagList = [];
    eventsMap = {};
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
    
    // if autoAdjustLevel> 0, adjust principal tag by removing classes that limit the number of events
    if (manualMode && autoAdjustLevel === 0){
      eventTagList = findTagsFromPath(rightPanel, delimiterTagField.value);
    }else{
      [cleanPath, eventTagList] = adjustPrincipalTag(principalTag);
      const oldDelimiterValue = delimiterTagField.value;
      delimiterTagField.value = cleanPath;
      venue.eventsDelimiterTag = cleanPath;
      if (delimiterTagField.value !== oldDelimiterValue){
        activateSaveButton();
      }
    }
    
    principalTagIndex = eventTagList.findIndex(el => el === principalTag);
  
    // find sub tags corresponding to each line
    subTags[currentPage] = getSubTags(principalTag);

    if (firstLoad){
      getDescFromJSON(principalTag,subTags[currentPage]);
    }
    initializeRegexFields();

    if (mainTagHasChanged){
      // remove sub event index when changing the event tag list, to prevent having an index that is larger than
      // the number of sub events. The following test avoids removing the value when coming back from linked pages
      if (!firstLoad){
        currentSubEventIndex = undefined;
      }
      populateEasyPanel(firstLoad);
      updateEventIndexInput();
    }else{// some tags may have change, for example if there are more events in eventTagList
      makeSubEvents(true);
    }
    makeExtendButton(principalTag);
  }

  // draw the delimiter panel
  setDelimiterPanel(countEvents(eventTagList));
  renderEventURLPanel();
}

function computeSubEventIndex(){
  if (currentPage !== 'mainPage' || !principalTag || !subEventPath){
    return undefined;
  }
  const multiTag = subTags[currentPage].find(tag => tag.isMulti);

  if (multiTag){
    const subEvents = findTagsFromPath(principalTag,subEventPath);
    const mainSubEventIndex = subEvents.findIndex(se => isAncestorOf(se,multiTag));
    if (mainSubEventIndex === -1){
      return null;
    }
    return mainSubEventIndex;
  }

  // in this case, sub events exist (subEventPath is not undefined), but no multi tag is defined. This happens when the sub event has been declared for example in the 
  // second sub event, but the current event has less than 2 sub events.
  // is this working when sub events have been defined, but no subeventpath has been set up ?
  // or should it be replaced by
  //
  // if (subEventPath){
  //   return 0;
  // } 
  // ??
  return 0;
  
}

/*****************************************/
/*             aux functions              */
/*****************************************/


function countEvents(eventTagList){
  return eventTagList.length;
}

function countSubEvents(){
  if (!subEventPath || !principalTag){
    return 0;
  }
  return  findTagsFromPath(principalTag,subEventPath).length;
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

  // eventTagList = findTagsFromPath(rightPanel, tagName+'.'+classes.join('.'));
  // let currentNumber = countEvents(eventTagList);
  // let currentTagList = eventTagList;
  let currentTagList = findTagsFromPath(rightPanel, tagName+'.'+classes.join('.'));
  let currentNumber = countEvents(currentTagList);

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
  bestInfo[0] = bestInfo[0].toLowerCase()===customTagName?'A':bestInfo[0];

  const tagPathString = bestInfo[0]+'.'+bestInfo[1].join('.');
  return [tagPathString, currentTagList];
}






/////////////////

//const leftPanel = document.getElementById('letPanel');
const analyzePanel = document.getElementById('analyzePanel');
const delimiterLowerPanel = document.getElementById('delimiterLowerPanel');

// modify left panel

// download page panel
venueInfo.textContent = venue.name+' ('+venue.city+', '+venue.country+')';
const lastScrapped = document.getElementById('lastScrapped');
lastScrapped.textContent = lastModified?'Updated: '+showDate(lastModified):"Page not downloaded yet.";
const downloadButton = document.getElementById('downloadButton');
const saveButton = document.getElementById('saveButton');
saveButton.classList.add('inactive');
const missingLinksButton = document.getElementById('missingLinksButton');
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

  console.log('saving...');

  venue.eventsDelimiterTag = delimiterTagField.value;

   // remove accidental blank lines from the fields
   removeEmptyFields(venue);

  // remove regexp keys if the corresponding regex are not active
  if (venue.hasOwnProperty('regexp')){
    regexKeys.forEach(key => {
      if (!regexElements[key].isActive){
        delete venue.regexp[key];
      }
    });
  }
 
  // remove regex if it does not contain any key
  if (venue.hasOwnProperty('regexp')){
    if (Object.keys(venue.regexp).length === 0){
      delete venue.regexp;
    }
  }

  // remove linked page if it is not in use, and date format
  if (!useLinks){
    delete venue.linkedPage;
    delete venue.linkedPageDateFormat;
  }else{
    if (!venue.linkedPage.hasOwnProperty('eventDateTags') && !venue.linkedPage.hasOwnProperty('eventMultiDateTags')){
      delete venue.linkedPageDateFormat;
    }
  }

  // remove unused date formats
  if (!venue.mainPage.hasOwnProperty('eventDateTags') && !venue.mainPage.hasOwnProperty('eventMultiDateTags')){
    delete venue.dateFormat;
  }

  if (!venue.hasOwnProperty('linkedPage')){
    delete venue.linkedPageDateFormat;
  }else{
    if (!venue.linkedPage.hasOwnProperty('eventDateTags') && !venue.linkedPage.hasOwnProperty('eventMultiDateTags')){
      delete venue.linkedPageDateFormat;
    }
  }

  // manage alternate tags
  // remove unused date formats
  ['mainPage','linkedPage'].filter(page => !Object.keys(venue.alternateTags[page]).some(key => key.includes('Date'))).forEach(page => {
    delete venue.alternateDateFormat[page];
  });

  // remove unused tags
  ['mainPage','linkedPage'].filter(page => !keepTraceOfAltTags[page] || Object.keys(venue.alternateTags[page]).length === 0).forEach(page => {
    delete venue.alternateTags[page];
    delete venue.alternateDateFormat[page];
  });
 
  if (Object.keys(venue.alternateTags).length === 0){
    delete venue.alternateTags;
  }

  if (Object.keys(venue.alternateDateFormat).length === 0){
    delete venue.alternateDateFormat;
  }

  console.log('saved');
  toLog("Saved to venue.json:");
  toLog(JSON.stringify(venue));
  saveToVenuesJSON(venues);

  // reset default values that were deleted for saving
  initAlternateValues();
  saveButton.classList.add('inactive');
});


// download button
downloadButton.addEventListener('click', function() {
  if (preventDownload){
    console.log('Wait before downloading, already working');
    return;
  }
  console.log("\x1b[45mUsing download button\x1b[0m");
  lastScrapped.textContent = "Downloading page...";
  downloadButton.classList.remove('reloadSingle');
  downloadButton.classList.add('loader');
  preventDownload = true;
  // cycleText(downloadButton);
  erasePreviousHtmlFiles(sourcePath)
  .then(() => {
    downloadVenue(venue,sourcePath, undefined, true)
    .then(() =>{
      initVars();
      lastModified = getModificationDate(sourcePath);
      if (lastModified){
        nbPages = getFilesNumber(sourcePath);
        renderMultiPageManager(nbPages);
        analyzePanel.style.display = 'block';
        delimiterLowerPanel.style.display = 'block';
      }
      lastScrapped.textContent = lastModified?'Updated: '+showDate(lastModified):"Page not downloaded yet.";
      preventDownload = false;
      downloadButton.classList.add('reloadSingle');
      downloadButton.classList.remove('loader');
      loadPage();
      makePrincipalTag(candidatePrincipalTag, true);
      focusTo(principalTag, 'instant');
    })
  })
});

missingLinksButton.addEventListener('click', function(){
  console.log('Starting links download');
  if (preventDownload){
    console.log('Already working, wait before download.');
    return;
  }
  preventDownload = true;
  missingLinksButton.classList.remove('reloadSingle');
  missingLinksButton.classList.add('loader');
  downloadLinkedPages(venueWithCustomTags(venue),sourcePath,[localPage])
  .then(_ =>
    {
      oldEventsMap = undefined;
      linkedPageFirstLoad = true;
      computeMissingLinks();
      preventDownload = false;
      console.log('Links downloaded');
      missingLinksButton.classList.add('reloadSingle');
      missingLinksButton.classList.remove('loader');
      setSwitchStatus();
    })
});




// delimiter panel


const DelimiterTitle = document.getElementById('DelimiterTitle');
const eventURLPanel = document.getElementById('eventURLPanel');
var delimiterTagField = document.getElementById('delimiterTagField');
delimiterTagField.addEventListener('input'||'change',event =>{
  if (!delimiterTagField.value || delimiterTagField.value.trim().length === 0){
    return;
  }
  behaviourSetup('manual');
  eventTagList = findTagsFromPath(rightPanel, delimiterTagField.value);
  candidatePrincipalTag = eventTagList[0];
  makePrincipalTag(candidatePrincipalTag);
  activateSaveButton();
});


const autoAdjustIndex = document.getElementById('autoAdjustIndex');
autoAdjustIndex.addEventListener('change', function(){
  autoAdjustIndexChange();
});
 
function autoAdjustIndexChange(){
  if (autoAdjustIndex.value < 0){
    autoAdjustIndex.value = 0;
  }
  autoAdjustLevel = autoAdjustIndex.value;
  makePrincipalTag(candidatePrincipalTag); 
}

document.getElementById('autoAdjustButtonUp').addEventListener('click', () => {
  autoAdjustIndex.value = parseInt(autoAdjustIndex.value) + 1;
  autoAdjustIndexChange();
});

document.getElementById('autoAdjustButtonDown').addEventListener('click', () => {
  autoAdjustIndex.value = parseInt(autoAdjustIndex.value) - 1;
  autoAdjustIndexChange();
});

const eventURLPanelWarning = document.getElementById('eventURLPanelWarning');

// adjust url check box
const adjustURLCheckbox = document.getElementById('adjustURLCheckbox');
adjustURLCheckbox.addEventListener('change',()=>{
  mustIncludeURL = adjustURLCheckbox.checked;
  console.log(mustIncludeURL);
  makePrincipalTag(candidatePrincipalTag);
});


/*****************************/
/*          grouping         */
/*****************************/

// group tags button
const toggleGroupingButtons = document.getElementsByClassName('toggleGroupingButton');

let groupTags = {mainPage: {}, linkedPage: {}};


for(const button of toggleGroupingButtons) {
 
  const key = button.id.replace('ToggleGroupingButton','')+'Tags';
  button.title = "Cliquer pour désactiver le groupage de balises";

  // tests if the tags contained in venue for a given key have been explicitly ungrouped.
  // if it is the case, some lines should be the same, but with different eq(XX) label.
  // after grouping, the number of tag strings will decrease
  if (venue[currentPage].hasOwnProperty(key)){
    const afterGrouping = regroupTags(venue[currentPage][key]);
    const groupingPreventionDetected = afterGrouping.length < venue[currentPage][key].length;

    groupTags[currentPage][key] = !groupingPreventionDetected;
  }else{
    groupTags[currentPage][key] = true;
  }

  // initialize the active/inactive state of the button
  setPanelButtonsCssProperties(button, groupTags[currentPage][key]);
  

  button.addEventListener('click',()=>{
    // set the new value for grouping
    groupTags[currentPage][key] = !groupTags[currentPage][key];
    // change the appearance of the button
    setPanelButtonsCssProperties(button, groupTags[currentPage][key]);
    computeTags();
    activateSaveButton();
  })
}

// change the appearance of the button
function setPanelButtonsCssProperties(button, isActive){
  if (isActive === true){
    button.classList.add('active');
    if (button.id.includes('Regex')){
      button.title = "Cliquez pour désactiver le filtre regex";
    }else{
      button.title = "Cliquez pour désactiver le groupage de balises";
    }
  }else{
    button.classList.remove('active');
    if (button.id.includes('Regex')){
      button.title = "Cliquez pour activer un filtre regex";
    }else{
      button.title = "Cliquez pour activer le groupage de balises:\nles balises similaires seront regroupées sous une balise générique";
    }
  }

  const key = button.id.replace('ToggleGroupingButton','')
                       .replace('ToggleRegexButton','')
                       .replace('event','').replace('Multi','');
  const isMulti = button.id.includes('Multi');
  // console.log('updating css');
  // console.log('*******************', isMulti);
  // if (!isMulti){
  //   return;
  // }
  setVarRefForCss(button, "--category-bg-color", key, isMulti);
  setVarRefForCss(button, "--category-font-color", key);
  setVarRefForCss(button, "--category-lighter-color", key);
  setVarRefForCss(button, "--category-inactive-font", key, isMulti);
}




/*****************************/
/*        easy panel         */
/*****************************/

const easyPanelFields = document.getElementById('easyPanelFields');
const missingPanelFields = document.getElementById('missingPanelFields');
let easyLines;


const lockButton = document.getElementById('lockButton');
lockButton.addEventListener("click", function() {
  keepTraceOfAltTags[currentPage] = !keepTraceOfAltTags[currentPage];
  updateLockButton(keepTraceOfAltTags[currentPage]);
});

function updateLockButton(keepTrace){
  const lockIcon = document.getElementById("lockIcon");

  if (keepTrace){
    lockIcon.classList.add("fa-lock");
    lockIcon.classList.remove("fa-lock-open");
    lockButton.title = "Garde les tags calculés, même s'il n'y a pas de correspondance dans l'événement actuel";
    document.getElementById('missingTagsPanel').style.display = 'block';
  }else{
    lockIcon.classList.remove("fa-lock");
    lockIcon.classList.add("fa-lock-open");
    lockButton.title = "Seuls les tags présents dans l'événement actuel sont conservés";
    document.getElementById('missingTagsPanel').style.display = 'none';
  }
}


tagAdjustIndexInput = document.getElementById('tagAdjustIndexInput');
tagAdjustIndexInput.value = tagsAdjustLevel.mainPage;
tagAdjustIndexInput.addEventListener('change', ()=>{
  tagsAdjustLevel[currentPage] = tagAdjustIndexInput.value;
  if (tagsAdjustLevel[currentPage] < 0){
    tagsAdjustLevel[currentPage] = 0;
    tagAdjustIndexInput.value = 0;
  }
  adjustLevelChanged()
});

document.getElementById('tagAdjustButtonUp').addEventListener('click', () => {
  tagAdjustIndexInput.value = parseInt(tagAdjustIndexInput.value) + 1;
  tagsAdjustLevel[currentPage] = tagAdjustIndexInput.value;
  adjustLevelChanged();
});

document.getElementById('tagAdjustButtonDown').addEventListener('click', () => {
  if (tagAdjustIndexInput.value <= 0){return;}
  tagAdjustIndexInput.value = parseInt(tagAdjustIndexInput.value) - 1;
  tagsAdjustLevel[currentPage] = tagAdjustIndexInput.value;
  adjustLevelChanged();
});

function adjustLevelChanged(){
  // update the marking of tags
  subTags[currentPage].forEach(tag => {
    console.log("tag", tag.desc);
    if (tag.desc || tag.isMulti || tag.hasAttribute('isURL')) {
      markAndPropagateTag(tag, { desc: tag.desc, isMulti: tag.isMulti, isURL: tag.hasAttribute('isURL') });
    }
  });

  computeTags();
  makeEventsMap();
  computeDateFormat();
}

function populateEasyPanel(firstLoad = false){

  console.log("\x1b[43m\x1b[30mpopulating Easy Panel\x1b[0m");
  easyLines = [];
  easyPanelFields.innerHTML = '';
 
  // keep only one isURL flag. If the previous currentURLTag is present, keep it, else keep the first tag with this flag
  
  const tagsWithURL = subTags[currentPage].filter(el => el.hasAttribute('isURL'));
  if (tagsWithURL.length > 1){
    tagsWithURL.forEach(el => el.removeAttribute('isURL'));
    if (currentURLTag && tagsWithURL.filter(el => el === currentURLTag).length > 0){
      currentURLTag.setAttribute('isURL',true);
    }else{
      tagsWithURL[0].setAttribute('isURL',true);
    }
  }

  traceMissingTagInfo(subTags, firstLoad);

  // create a new line in the panel for each tag
  subTags[currentPage].forEach((tag,index) => {
    newEasyLine(tag,index);
  });

  // if alternate tags have dates, compute the corresponding format
  // if (alternateTags && Object.keys(alternateTags[currentPage]).some(key => key.includes('Date'))){
  if (Object.keys(venue.alternateTags[currentPage]).some(key => key.includes('Date'))){
    venue.alternateDateFormat[currentPage] = computeAlternateDateFormat();
  }


  missingPanelFields.innerHTML = '';
  if (keepTraceOfAltTags[currentPage]){
    Object.keys(venue.alternateTags[currentPage]).forEach(key =>{
      venue.alternateTags[currentPage][key].forEach(tagPath => {
        newMissingTagLine(tagPath, key);
      });
    })
  }
  makeSubEvents(firstLoad);
  computeDateFormat();
}

// create an entry in the missing tag panel for the tags that have been declared but do not appear in the current event
function newMissingTagLine(tagPath, key){
  // console.log('new missing tag', tagPath, key);
  let newDiv = document.createElement('div');
  newDiv.classList.add('easyPanelLine');
  // newDiv.tagPath = tagPath;
  let inputElement = document.createElement('input');
  inputElement.readOnly = true;
  inputElement.classList.add('easyField');
  inputElement.setAttribute('type', 'text');
  inputElement.value = key.includes('Date') ? venue.alternateDateFormat[currentPage] : 'Tag not in current event';
  newDiv.appendChild(inputElement);

  for(i=0;i<keyNames.length;i++){
    const newFakeButton = document.createElement('div');
    newFakeButton.classList.add('fakeEasyButton'); 
    // setVarRefForCss(newFakeButton, "--category-bg-color", key.replace('Multi', '').replace('Tags', '').replace('event', ''));
    // setVarRefForCss(newFakeButton, "--category-bg-color", key);
    if (key.includes(keyNames[i])){
      // console.log('SCRPXhighlight'+keyNames[i]);
      // newFakeButton.classList.add('SCRPXhighlight'+keyNames[i]);
      newFakeButton.classList.add('SCRPXhighlightAlternate');
      setVarRefForCss(newFakeButton, "--category-bg-color", key.replace('Multi', '').replace('Tags', '').replace('event', ''));
      newFakeButton.title = keyNames[i];
    }else{
      newFakeButton.classList.add('inactive');
    }
    newDiv.appendChild(newFakeButton);
  }

  const newButton = document.createElement('button');
  newButton.classList.add('easyButton');
  newButton.classList.add('easyRemoveButton');
  newButton.title = 'Remove';
  newButton.textContent = '✖';
  newButton.addEventListener('click', function(){
    venue.alternateTags[currentPage][key] = venue.alternateTags[currentPage][key].filter(el => el !== tagPath);
    if (venue.alternateTags[currentPage][key].length === 0){
      delete venue.alternateTags[currentPage][key];
    }

    let tag;
    let rootTag;

    // find in which event can a tag defining this tagPath can be found
    for (rootTag of eventTagList){
      const tags = findTagsFromPath(rootTag, tagPath).filter(el => el.desc && el.desc === key);
      if (tags.length>0){
        tag = tags[0];
        break;
      }

    }
    // const rootTag = eventTagList.find(eventTag => findTagsFromPath(eventTag, tagPath)
                                        // .filter(tag => tag.desc & tag.desc === key).length>0);

    markAndPropagateTag(tag, {desc: null, isURL: false, isMulti: false}, rootTag);
    console.log(!Object.keys(venue.alternateTags[currentPage]).some(el => el.includes('Multi')));
    // if no more tag has multi, remove sub event path
    if (!subTags.linkedPage.some(el => el.isMulti) && !Object.keys(venue.alternateTags[currentPage]).some(el => el.includes('Multi'))){
    // if (!subTags.linkedPage.some(el => el.isMulti)) {
      console.log('removing sub event path');
      subEventPath = undefined;
    }
        
    newDiv.remove();
    if (missingPanelFields.children.length === 0){
      document.getElementById('missingTagsPanel').style.display = 'none';
    }
  });
  newDiv.appendChild(newButton);
  missingPanelFields.appendChild(newDiv);
}



// create new line in the easy panel. If several tags are marked as URL tags, only keep the first one
function newEasyLine(tag, index){

  const text = getTextFromTag(tag);

  // create html div panel for the line
  let newDiv = document.createElement('div');
  newDiv.classList.add('easyPanelLine');
  newDiv.tag = tag;
  easyLines.push(newDiv);

  // add tag text to the line
  let inputElement = document.createElement('input');
  inputElement.readOnly = true;
  inputElement.classList.add('easyField');
  inputElement.setAttribute('type', 'text');
  inputElement.value = text;
  newDiv.appendChild(inputElement);
  if (tag.isMulti){
    inputElement.classList.add('easyFieldBg');
  }

  inputElement.addEventListener("click", (event) => {
    event.preventDefault();
   
    if (tag.isMulti){
      markAndPropagateTag(tag,{
        desc: (tag.desc?tag.desc.replace('Multi',''):undefined),
        isMulti: null
      });
      inputElement.classList.remove('easyFieldBg');
    }else{
      markAndPropagateTag(tag,{
        desc: (tag.desc?tag.desc.replace('event','eventMulti'):undefined),
        isMulti: true
      });

      inputElement.classList.add('easyFieldBg');
    }
    makeSubEvents(true);
  });


  // create buttons for changing field type (name, date, ...)
  for(i=0;i<keyNames.length;i++){
    // if (tag !== principalTag || keyNames[i].toLowerCase() === 'url'){
 
    let newEasyButton = document.createElement('button');
    setEasyButtonDesign(newEasyButton, keyNames[i]);
    newEasyButton.classList.add('easyLine' + index); // used to identify buttons on the same line
    newEasyButton.eventTagType = 'event' + (tag.isMulti ? 'Multi' : '') + keyNames[i] + 'Tags'; // set the corresponding tag field
    // newEasyButton.colorClass = colorClassList[i]; // set the color class when active
    newEasyButton.inputElement = inputElement;

    // if the type (name, date, ...) is the same than the current button, make it active
    if (tag.desc === newEasyButton.eventTagType) {
      newEasyButton.classList.add('activeButton');
      //   newEasyButton.classList.add(newEasyButton.colorClass);
    }
    if (newEasyButton.eventTagType.replace('Multi', '') === 'eventURLTags' && tag.hasAttribute('isURL')) {
      newEasyButton.classList.add('activeButton');
      // newEasyButton.classList.add(newEasyButton.colorClass);
    }

    // if the tag and ancestors have no url link, deactivate the button
    if (keyNames[i] === 'URL') {
      if (!findAncestorWithURL(tag)) {
        newEasyButton.classList.add('inactiveURL');
      } else {
        newEasyButton.title = 'URL: ' + findAncestorWithURL(tag).getAttribute('href');
        // URL switch button 
        newEasyButton.addEventListener('click', function () {
          if (tag.hasAttribute('isURL')) {
            // turn button off when clicking on an active button
            // this.classList.remove(this.colorClass);
            this.classList.remove('activeButton');
            markAndPropagateTag(tag, { isURL: null });
            currentURLTag = undefined;
          } else {
            // turn of all other URL button and remove isURL marker (there can be only one URL)
            const easyButtons = easyPanelFields.getElementsByClassName('eventTagTypeButton');
            for (button of easyButtons) {
              if (button.eventTagType.replace('Multi', '') === 'eventURLTags') {
                button.classList.remove('activeButton');
              }
            }
            // activate the current button
            markAndPropagateTag(tag, { isURL: true });
            currentURLTag = tag;
            // this.classList.add(this.colorClass);
            this.classList.add('activeButton');
          }
          computeTags();
          makeEventsMap();
          if (currentPage === 'linkedPage' && useLinks) {
            computeMissingLinks();
          }
          renderEventURLPanel();
        });
      }
    } else {
      // new button for keyName !== URL
      newEasyButton.addEventListener('click', function () {
        if (newEasyButton.classList.contains('inactive')) {
          return;
        }
        // when clicking on the button, make all buttons of the line inactive
        const buttonList = easyPanelFields.getElementsByClassName('easyLine' + index);
        for (j = 0; j < buttonList.length; j++) {
          if (keyNames[j] !== 'URL') {
            // buttonList[j].classList.remove(colorClassList[j]);
            buttonList[j].classList.remove('activeButton');
          }
        }
        if (tag.desc === this.eventTagType) {
          // turn button off when clicking on an active button
          markAndPropagateTag(tag, { desc: null });
        } else {
          // activate the current button
          markAndPropagateTag(tag, { desc: this.eventTagType });
          // this.classList.add(this.colorClass);
          this.classList.add('activeButton');
        }
        computeTags();
        computeDateFormat();
        focusTo(tag, 'instant', 'center');
      });
    }
    newDiv.appendChild(newEasyButton);
  }

  if (currentPage === 'linkedPage'){
    const newButton = document.createElement('button');
    newButton.classList.add('easyButton');
    newButton.classList.add('easyRemoveButton');
    newButton.title = 'Remove';
    newButton.textContent = '✖';
    newButton.addEventListener('click', function(){
      subTags.linkedPage = subTags.linkedPage.filter(el => el !== newDiv.tag);
      // if all 'multi' tags have been removed, remove the subEventPath
      // should it be also for alternate tags ?
      // if (!subTags.linkedPage.some(el => el.isMulti) && !Object.keys(venue.alternateTags.linkedPage).some(el => el.includes('Multi'))){
      if (!subTags.linkedPage.some(el => el.isMulti) && !Object.keys(venue.alternateTags[currentPage]).some(key => key.includes('Multi'))){
        subEventPath = undefined;
      }
      markAndPropagateTag(tag, {desc: null, isURL: false, isMulti: false});
      populateEasyPanel();
      // if (!isElementVisible(tag)){
      focusTo(tag, 'instant');
      // }
    });
    newDiv.appendChild(newButton);
  }
  
  easyPanelFields.appendChild(newDiv);
}






function computeTags(){
  console.log('\x1b[43m\x1b[30mComputing tags\x1b[0m');
  // keep a trace of venue JSON to see later if it has changed. Used for updating save button
  venueBeforeLoading = JSON.parse(JSON.stringify(venue));

  // remove sub events divs and headers
  removeSubEventHeaders();
  clearAllTags();

  // if subEventPath exists, and no tag as .isMulti, and if a sub event can be found, that means that 
  // the sub event has been defined with an index that exceeds the current number of sub events. Ex: 
  // defining sub event on the 3rd sub event of one event, and the current event only has 2 subevents. 
  // In that case, the paths of "multi" tags should not be erased.
  if (subEventPath && findTagsFromPath(principalTag, subEventPath).length > 0 && !subTags[currentPage].some(el => el.isMulti)){
    Object.keys(venue[currentPage]).filter(key => !key.includes('Multi')).forEach(key => {
      delete venue[currentPage][key];
    });
  }else{
    venue[currentPage] = {};
  }
 

  // identify sub event delimiter. Could use subEventPath instead of findCommonAncestor ?
  const subEventDelimiter = findCommonAncestor(subTags[currentPage].filter(el => el.isMulti));

  // console.log(venue[currentPage]);
  // const currentRootTag = principalTag;
  // (currentPage === 'mainPage'?principalTag:rightPanel);
  
  // get the tag strings and put them in venue
  subTags[currentPage].forEach(tag => {
    // console.log(tag.textContent,tag.desc);
    if (tag.desc){
      if (!venue[currentPage].hasOwnProperty(tag.desc)){
        venue[currentPage][tag.desc] = [];
      }
      if (tag.desc.includes('Multi')){
        // remove all references to eq(xx) to the path of the sub event delimiter, and keep those
        // refs for the path from delimiter to tags
        // const pathAfterDelimiter = removeCustomTags(getPath(subEventDelimiter,tag));
        // const newPath = [removeCustomTags(subEventPath), pathAfterDelimiter].filter(el => el && el.length>0).join('>');
        // venue[currentPage][tag.desc].push(newPath);
        const pathAfterDelimiter = getPath(subEventDelimiter,tag);
        const newPath = [subEventPath, pathAfterDelimiter].filter(el => el && el.length>0).join('>');
        venue[currentPage][tag.desc].push(removeCustomTags(adjustTag(newPath, subEventPath)));
      }else{
        const rawPath = getPath(principalTag,tag);
        venue[currentPage][tag.desc].push(removeCustomTags(adjustTag(rawPath)));
        if (tag.desc.includes('Date')){
          console.log(tag.textContent, tag.desc, venue[currentPage][tag.desc]);
        }
      }
    }
    if (tag.hasAttribute('isURL')){
      if (subEventDelimiter &&  isAncestorOf(subEventDelimiter,tag)){
        const pathAfterDelimiter = removeCustomTags(getPath(subEventDelimiter,tag));
        const newPath = [removeCustomTags(subEventPath), pathAfterDelimiter].filter(el => el && el.length>0).join('>');
        venue[currentPage].eventMultiURLTags = [newPath];
      }else{
        venue[currentPage].eventURLTags = [removeCustomTags(getPath(principalTag,tag))];
      }
    }
  });

  // console.log('PRE',venue[currentPage].eventDateTags);

  Object.keys(groupTags[currentPage]).forEach(key => {
    if (groupTags[currentPage][key] === true && venue[currentPage].hasOwnProperty(key)){
      venue[currentPage][key] = regroupTags(venue[currentPage][key]);
    }
  });

  // console.log('POST',venue[currentPage].eventDateTags);

  // hide and show event tags panels
  keyNames.flatMap(key => ['event' + key, 'eventMulti' + key])
    .forEach(key => {
      const panel = document.getElementById(key);
      panel.style.display = venue[currentPage].hasOwnProperty(key + 'Tags') ? 'block' : 'none';
    });

  // hide/show regexp panels, process regex
  keyNames.filter(key => key !== 'URL')
  .forEach(key => {
    const regexPanel = document.getElementById('event' + key +'RegexpPanel');
    regexPanel.style.display = (regexElements['event' + key].isActive && (
      venue[currentPage].hasOwnProperty('event' +key + 'Tags') ||
      venue[currentPage].hasOwnProperty('eventMulti' + key + 'Tags') )) ? 'block' : 'none';
  });
  ProcessRegex();

  
  // update tag fields on the GUI
  for(let i = 0; i < eventTagsBoxes.length; i++){
    const textBox = eventTagsBoxes[i];
    textBox.value = getValue(venue[currentPage],textBox.id);
    setRows(textBox);
  }

  // Add the color css to the document
  applyTags();
  if (!JSONAreEqual(venue,venueBeforeLoading)){
    activateSaveButton();
  }
}


// scrap panels

const dateFormatPanel = document.getElementById('dateFormatPanel');
const dateFormatText = document.getElementById('dateFormatText');
const eventURLTagBox = document.getElementById('eventURLTags');
const eventTagsBoxes = document.getElementsByClassName('eventTags');

eventURLTagBox.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
      event.preventDefault();
  }
});


const eventURLPanelMessage = document.getElementById('eventURLPanelMessage');
// const followURLButton = document.getElementById('followURLButton');

eventURLPanelMessage.addEventListener('click',function(){
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
  groupTags[currentPage][textBox.id] = false;
  const button = Array.from(toggleGroupingButtons).find(el => el.id.endsWith(textBox.id.replace('event','').replace('Tags','')));
  setPanelButtonsCssProperties(button, groupTags[currentPage][textBox.id]);
  setRows(textBox);
  venue[currentPage][textBox.id] = getArray(textBox.value);
  clearAllTags(true);
  // easypanel tags should be marked ? does not seem necessary
  applyTags();
  renderEventURLPanel();
}


// event selectors panel

const eventSelectorIndex = document.getElementById('eventSelectorIndex');

document.getElementById('eventButtonUp').addEventListener('click', () => {
   updateEventIndexFromButton(false);
});

document.getElementById('eventButtonDown').addEventListener('click', () => {
  updateEventIndexFromButton(true);
});

function updateEventIndexFromButton(increaseIndex){

  let keyIndex = getKeyIndex();

  keyIndex += increaseIndex ? 1 : -1;
  keyIndex = mod(keyIndex, Object.keys(eventsMap).length); 

  changeEventIndex(Object.keys(eventsMap)[keyIndex]);
}

function getKeyIndex(){
  let keyIndex;
  if (currentPage === 'mainPage'){
    keyIndex =  Object.keys(eventsMap).findIndex(key => (eventsMap[key].mainIndex === principalTagIndex) && 
    (!currentSubEventIndex || eventsMap[key].subIndex === currentSubEventIndex));
  }else{
    keyIndex =  Object.keys(eventsMap).findIndex(key => (eventsMap[key].linkedPageIndex === principalTagIndex));
  }
  return keyIndex;
}


eventSelectorIndex.addEventListener('input', function(){

  if(!eventSelectorIndex.value || isNaN(eventSelectorIndex.value)){
    return;
  }

  eventKey = Object.keys(eventsMap).find(el => el.startsWith(eventSelectorIndex.value.trim()));

  if (!eventKey){
    return;
  }

  changeEventIndex(eventKey, false);
});





function changeEventIndex(eventKey, updateInput = true){

  if (currentPage === 'linkedPage'){
    movePrincipalTagTo(eventsMap[eventKey]);
    updateEventIndexInput();
    return;
  }

  const oldEventIndex = principalTagIndex;
  const oldSubEventIndex = currentSubEventIndex;

  principalTagIndex = eventsMap[eventKey].mainIndex;
  if (eventsMap[eventKey].hasOwnProperty('subIndex')){
    currentSubEventIndex = eventsMap[eventKey].subIndex;
  }

  // change current principal tag
  const principalTagHasChanged = principalTagIndex !== oldEventIndex;

  if (principalTagHasChanged){

    clearPrincipalTag();
    
    principalTag = eventTagList[principalTagIndex];
    removeSubEventHeaders();
    subTags[currentPage] = getSubTags(principalTag);

    populateEasyPanel();
    principalTag.classList.add('SCRPXmainTag');
    focusTo(principalTag);
    renderEventURLPanel();
    makeExtendButton(principalTag);
  }else if(currentSubEventIndex !== oldSubEventIndex) {
    removeSubEventHeaders();
    applySubEventDelimiterTags();
    renderEventURLPanel();
  }
  if (updateInput){
    updateEventIndexInput();
  } 
}

// update the content of the event index input with the current coordinates of the event
function updateEventIndexInput(){
    const keyIndex = getKeyIndex();
    eventSelectorIndex.value = Object.keys(eventsMap)[keyIndex];
}



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
    isActiveButton: document.getElementById(key+'ToggleRegexButton'),
    isActiveMultiButton: document.getElementById(key.replace('event','eventMulti')+'ToggleRegexButton'),
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

  // element.isActiveButton.title = "Cliquez pour activer un filtre regex";
  // element.isActiveMultiButton.title = "Cliquez pour activer un filtre regex";

  // set visibility handler
  element.isActiveButton.addEventListener('click',()=>{
    element.isActive = !element.isActive;
    // change the appearance of the button
    if (element.isActive){
      element.isActiveButton.classList.add('active');
      element.isActiveMultiButton.classList.add('active');
      element.panel.style.display = 'block';
      // store again the values of the field to venue.regexp. Is used when the user has clicked on save after removing regexp
      // (venue.regexp field has been removed doing that), then turn it back on 
      computeVenueRegexField(element);
    }else{
      element.isActiveButton.classList.remove('active');
      element.isActiveMultiButton.classList.remove('active');
      element.panel.style.display = 'none';
    }
    setPanelButtonsCssProperties(element.isActiveButton,element.isActive);
    setPanelButtonsCssProperties(element.isActiveMultiButton,element.isActive);
  });

  // handlers for match and replace inputs
  element.match.addEventListener('input', function () {
    activateSaveButton();
    computeVenueRegexField(element);
  });

  element.replace.addEventListener('input', function () {
    activateSaveButton();
    computeVenueRegexField(element);
  });
  

  element.isActiveMultiButton.addEventListener('click',()=>{
    element.isActiveButton.dispatchEvent(new Event("click"));
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

function initializeRegexFields(){
  if (venue.hasOwnProperty('regexp')){
    Object.keys(venue.regexp).forEach(key => {
      const element = regexElements[key];
      element.isActive = true;
      element.isActiveButton.classList.add('active');
      element.isActiveMultiButton.classList.add('active');
      
      // fill the corresponding fields
      element.match.value = venue.regexp[key][0];
      if (venue.regexp[key].length > 1){
        element.replace.value = venue.regexp[key][1];
        element.showReplace = true;
        element.replace.style.display = 'inline';
      }
    });
  }

  Object.keys(regexElements).forEach(key => {
    const element = regexElements[key];
    setPanelButtonsCssProperties(element.isActiveButton,element.isActive);
    setPanelButtonsCssProperties(element.isActiveMultiButton,element.isActive);
  });
}


function computeVenueRegexField(element){
  if (!element.isActive || element.match.value === ''){
    if (venue.hasOwnProperty('regexp')){
      delete venue.regexp[element.key];
    }
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
  const currentRootTag = currentPage === 'mainPage'?principalTag:rightPanel;
  // not tag to analyze
  if (!currentRootTag){
    element.textBefore.style.display = 'none';
    element.textAfter.style.display = 'none';
    return;
  }
  if (element.isActive){
    element.textBefore.style.display = 'block';
    element.textAfter.style.display = 'block';
    if (venue[currentPage].hasOwnProperty(element.key+'Tags') 
        || venue[currentPage].hasOwnProperty(element.key.replace('event','eventMulti')+'Tags')){
      element.textBefore.textContent = '';
      if (venue[currentPage].hasOwnProperty(element.key+'Tags')){
        element.textBefore.textContent = element.textBefore.textContent 
          +venue[currentPage][element.key+'Tags']
              .flatMap(path => findTagsFromPath(currentRootTag,path))
              .map(el => el.textContent).join(' ');
      }
      if (venue[currentPage].hasOwnProperty(element.key.replace('event','eventMulti')+'Tags')){
        element.textBefore.textContent = element.textBefore.textContent 
          +venue[currentPage][element.key.replace('event','eventMulti')+'Tags']
              .flatMap(path => findTagsFromPath(currentRootTag,path))
              .map(el => el.textContent).join(' ');
      }
      const regex = new RegExp(element.match.value);
      if (element.showReplace){
        element.textAfter.textContent = element.textBefore.textContent.replace(regex,element.replace.value);
      }else{
        element.textAfter.textContent = element.textBefore.textContent.match(regex);
      }
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

const switchPageButton = document.getElementById('switchPageButton');
const switchPageButtonAnimation = document.getElementById('switchPageButtonAnimation');
const switchPageButtonText = document.getElementById('switchPageButtonText');

if (!venue.hasOwnProperty('linkedPage')){
  switchPageButton.style.display = 'none';
}
switchPageButton.addEventListener('click',() =>{

  if (switchPageButton.classList.contains('inactive')){
    return;
  }

  switchPageButton.classList.add('inactive');

  // loading animation
  switchPageButtonText.textContent = '';
  switchPageButtonAnimation.classList.add('loader');

  // keep information about main tag
  const keyIndex = getKeyIndex();
  const event = eventsMap[Object.keys(eventsMap)[keyIndex]];

  if (currentPage === 'mainPage'){
    principalTagIndex = event.linkedPageIndex;
    currentPage = 'linkedPage';
    pageManagerDetailsPanel.style.display = 'none';
    switchDelimiterColors(delimiterPanel, 'linkedpagedelimiter');
    // delimiterPanel.style.backgroundColor = "var(--linkedpage-eventblock-bg-color)";
  }else{
    principalTagIndex = event.mainIndex;
    currentSubEventIndex = event.subIndex;
    currentPage = 'mainPage';
    console.log(venue);
    oldEventsMap = JSON.parse(JSON.stringify(eventsMap));
    switchDelimiterColors(delimiterPanel, 'delimiter');
    if (!pageManagerReduced){
      pageManagerDetailsPanel.style.display = 'block';
    }
  }

  // add a small timeout so the animation can start before calling initializeInterface
  setTimeout(() => {
    initializeInterface();
    switchPageButtonAnimation.classList.remove('loader');
    switchPageButton.classList.remove('inactive');
    if (currentPage === 'linkedPage'){
      switchPageButtonText.textContent = '< Switch to main page';
    }else{
      switchPageButtonText.textContent = 'Switch to linked page >';
    }

  }, 50); 

});


/*****************************/
/* intialize and right panel */
/*****************************/



initializeInterface();


function initializeInterface(){
  updateLockButton(keepTraceOfAltTags[currentPage]);
  if (currentPage === 'mainPage'){
    if (lastModified){// if the file exists
      loadPage();
      makePrincipalTag(candidatePrincipalTag, true);
      focusTo(principalTag, 'instant');
      analyzePanel.style.display = 'block';
      delimiterLowerPanel.style.display = 'block';
    }else{
      clearAllTags();
      rightPanel.textContent = 'Content not downloaded yet';
      analyzePanel.style.display = 'none';
      missingLinksPanel.style.display = 'none';
    }
  }else{
    analyzePanel.style.display = 'block';
    delimiterLowerPanel.style.display ='none';
    loadLinkedPageContent();
  }
}


function makeLinksPage(){
  Object.keys(eventsMap).forEach(key => {
    currentEventURL = eventsMap[key].url;
  
    // create one div per event, with 3 parts: 1: header, 2: text, 3: tags that have been identified
    const eventDiv = document.createElement('div');
    eventDiv.classList.add('SCRPXlinkedPageMainBlock');
    // eventDiv.id = currentEventURL;
    eventDiv.id = key;
    eventDiv.innerHTML = '<div class="SCRPXlinkedPageEventHeader">'+currentEventURL+'</div>';
    const eventDivPage = document.createElement('div');
    if (currentEventURL){
      eventDiv.innerHTML = '<div class="SCRPXlinkedPageEventHeader">'+currentEventURL+'</div>';
      const currentLinkedPage = linkedFileContent[currentEventURL];
      const parsedLinkedPage = parseDocument('<html><head></head>'
        +currentLinkedPage.replace(/<[\s\n\t]*a /gi,'<'+customTagName+' ').replace(/<[\s\n\t]*\/a[\s\n\t]*>/gi,'</'+customTagName+'>')
        +'</html>');
      eventDivPage.innerHTML = cheerio.load(parsedLinkedPage).html();
    }else{
      eventDiv.innerHTML = '<div class="SCRPXlinkedPageEventHeader">'+"Event with no link"+'</div>';
      eventDivPage.textContent = 'Invalid event.';
    }
    
    eventDiv.appendChild(eventDivPage);
    eventDivPage.style.display = 'none';
    const eventShowTags = document.createElement('div');
    eventDiv.appendChild(eventShowTags);
    rightPanel.appendChild(eventDiv); 
    // remove videos that may slow down the navigator
    rightPanel.querySelectorAll("iframe").forEach(iframe => {
      iframe.src = "";
    });
  });

  savedLinkPage = rightPanel.innerHTML;//rightPanel.cloneNode(true); 
}

function eventsMapHasChanged(){

  if (!oldEventsMap){
    return true;
  }

  if (Object.keys(eventsMap).length !== Object.keys(oldEventsMap).length){
    return true;
  }

  const oldKeys = Object.keys(oldEventsMap);
  return Object.keys(eventsMap).some(key => !oldKeys.includes(key) || eventsMap[key].url !== oldEventsMap[key].url);
}


function loadLinkedPageContent(){
  console.log('\x1b[41mSwitching to linked page\x1b[0m');
 
  rightPanel.innerHTML = '';
  if (Object.keys(eventsMap).some(key => eventsMap[key].url)){

    // get the adjust level corresponding to the mainPage
    tagAdjustIndexInput.value = tagsAdjustLevel.linkedPage;

    // load web page 

    const start = performance.now();
  
    if (eventsMapHasChanged()){
      makeLinksPage();
    }else{
      rightPanel.innerHTML = savedLinkPage;
    }
    
    eventTagList = Array.from(rightPanel.children).map(el => el.children[1]);

    principalTag = eventTagList[principalTagIndex];
    principalTag.style.display = 'block';

    // const end = performance.now();
    // console.log(`Le code a mis ${(end - start)/1000}s à s'exécuter.`);
    
    focusTo(principalTag.parentElement.children[0]);
    
    // find subtags and load properties for the easy panel
    subTags.linkedPage = [];

   
    getDescFromJSON(principalTag);

    subTags.linkedPage = Array.from(principalTag.querySelectorAll('*')).filter(el => 
      el.hasAttribute('isURL') || el.isMulti || el.desc);

    
    // place the window at the first tag registered, otherwise at the top of the page
    let focusElement;
    if (subTags.linkedPage.length > 0){
      focusElement = subTags.linkedPage[0];
    }else{
      focusElement = rightPanel;
      while(focusElement.children.length > 0){
        focusElement = focusElement.children[0];
      }
    }
    focusTo(focusElement, 'instant');
    // focusElement.scrollIntoView({ behavior: 'instant', block: 'center' });
    
    populateEasyPanel(linkedPageFirstLoad);
    linkedPageFirstLoad = false;
    
  }else{
    rightPanel.textContent = 'No URL links found.';
  }
}

// adjust tag in event by removing 'tagsAdjustLevel' classes max for each tag of the path
// if the tag is multi, keep classes before the delimiter
function adjustTag(path, subEventPath = undefined){
  // console.log('adjusting at level ', tagsAdjustLevel[currentPage]);
  if (tagsAdjustLevel[currentPage] === 0){
    return path;
  }

  const nbEvents = eventTagList.length;
  let currentMatchNb = nbOfMatchingEvents(path, eventTagList);
  
  if (currentMatchNb >= nbEvents){
    return path;
  }

  // const start = performance.now();
  // let tagName = principalTag.tagName;

  // identify what tag is the first to block finding tags in other events. If the tag
  // is a sub event tag, start after the sub event delimiter path

  let newPath;

  if (subEventPath){
    path = path.replace(subEventPath,'').replace(/^>/,'');
    newPath = subEventPath;
  }

  let splittedPath = path.split('>');
  let index = 0;
  let currentTarget = nbEvents;
  // test and modify the tags in increasing order
  while (index < splittedPath.length){
    // increase index until a problem is detected
    while (index < splittedPath.length && nbOfMatchingEvents(newPath?newPath+'>'+splittedPath[index]:splittedPath[0], eventTagList) >= currentTarget){   
      newPath = newPath?newPath+'>'+splittedPath[index]:splittedPath[0];
      // console.log(index,newPath);
      index++;
    }
    // console.log('pb detecté à ', index);
      
    if (index < splittedPath.length){// problem detected at index
     
      // try modifying the k-th tag on which a potential problem has been identified
      const tagsToTest = generateTag(splittedPath[index], tagsAdjustLevel[currentPage]).reverse().map(el => newPath +'>' + el);

      // set first element as reference and default value
      newPath = tagsToTest.pop();
      let currentMatchingEventsNumber = nbOfMatchingEvents(newPath, eventTagList);
 
      // choose the best of the list. Test from the most simple change to the more complex and stop when a good value is found
      while (tagsToTest.length > 0 && currentMatchingEventsNumber < currentTarget){
        const testPath = tagsToTest.pop();
        const nb = nbOfMatchingEvents(testPath, eventTagList);
        if (nb > currentMatchingEventsNumber){
          newPath = testPath;
          currentMatchingEventsNumber = nb;
        }
      }
      currentTarget = currentMatchingEventsNumber;
      index++;
    }
  }
  
  // console.log(newPath);

  return newPath;
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

  if (currentPage === 'linkedPage'){
    eventTagList.forEach(eventTag => {
      eventTag.parentElement.children[2].innerHTML = '';
    });
  }
}



// function clearTag(tag){
//   colorClassList.forEach(el => {
//       tag.classList.remove(el);
//     });
// }


function applyTags(){

  console.log('\x1b[43m\x1b[30mapplying tags\x1b[0m');

  // add css classes to event blocks

  eventTagList.filter(el => el.textContent.trim().length > 0).forEach(el => {
    const block = (currentPage === 'mainPage')?el:el.parentElement;
    if(isValid(el,venue[currentPage])){
      block.classList.add('SCRPXeventBlock');
      if (currentPage === 'mainPage' && !venue[currentPage].eventURLTags && !venue[currentPage].eventMultiURLTags
        && el.hasAttribute('href')) {
        el.classList.add('SCRPXeventBlockWithURL');
      }
    }else{
      block.classList.add('SCRPXeventBlockInvalid');
    }
    
  });
 

  // if (currentPage === 'mainPage'){
    principalTag.classList.add('SCRPXmainTag');
  // }


  // apply tags for sub events
  if (subEventPath) {
    applySubEventDelimiterTags();
  }


  // add classes for highlights in the right panel. The subevents for linked pages will be filled
  // later
 
  Object.keys(venue[currentPage]).forEach(key => {
    className = 'SCRPXhighlight'+key.replace('event','').replace('Tags','').replace('Multi','');
    venue[currentPage][key].forEach(path =>{
      eventTagList.forEach(rootTag =>{
        const tags = findTagsFromPath(rootTag,path); 
        tags.forEach(tag => {
          if (currentPage === 'mainPage'){
            if (path.length > 0){
              tag.classList.add(className);
            }else{
              tag.classList.remove('SCRPXeventBlock', 'SCRPXmainTag');
              tag.classList.add(className, 'SCRPXeventBlockWithField');
            }
            
          }else if(rootTag !== principalTag){
            // in the linked page, add a new div that shows the matches from the tag without showing 
            // the whole page. Do this only for non multi tags (multi tags will be processed seperatly)
            if (!key.includes('Multi')){
              const newDiv = document.createElement('div');
              newDiv.textContent = getTextFromTag(tag);
              newDiv.classList.add(className);
              rootTag.parentElement.children[2].append(newDiv);
            }
          }else{
            tag.classList.add(className);
          }
        });
      });
    })
  });

  // add classes for highlights for alternate tags in the right panel. The subevents for linked pages will be filled
  // later
  Object.keys(venue.alternateTags[currentPage]).forEach(key => {
    const className = 'SCRPXhighlight' + key.replace('event', '').replace('Tags', '').replace('Multi', '');
    venue.alternateTags[currentPage][key].forEach(path => {
      eventTagList.forEach(rootTag => {
        const tags = findTagsFromPath(rootTag, path);
        tags.forEach(tag => {
          if (currentPage === 'mainPage') {
            if (path.length > 0) {
              tag.classList.add(className);
            } else {
              tag.classList.remove('SCRPXeventBlock', 'SCRPXmainTag');
              tag.classList.add(className, 'SCRPXeventBlockWithField');
            }
          } else if (rootTag !== principalTag) {
            // in the linked page, add a new div that shows the matches from the tag without showing the whole page
            if (!key.includes('Multi')){
              const newDiv = document.createElement('div');
              newDiv.textContent = getTextFromTag(tag);
              newDiv.classList.add('SCRPXhighlightAlternate','miniBottomMargin');
              setVarRefForCss(newDiv, "--category-bg-color", key.replace('Multi', '').replace('Tags', '').replace('event', ''));
              // setVarRefForCss(newDiv, "--category-bg-color", 'Date');
              rootTag.parentElement.children[2].append(newDiv);  
            }
          } else {
            tag.classList.add(className);
          }
        });
      });
    })
  });


  // make subevent in linked page for events that are not in the principal tag
  if (currentPage === 'linkedPage' && subEventPath){
    
    const multiKeys = Object.keys(venue.linkedPage).filter(key => key.includes('Multi'));
    const multiKeysAlternate = Object.keys(venue.alternateTags.linkedPage).filter(key => key.includes('Multi'));

    eventTagList.forEach(rootTag =>{
      if(rootTag !== principalTag){
        findTagsFromPath(rootTag, subEventPath).forEach(subEventTag => {
          const subEventDiv = document.createElement('div');
          subEventDiv.classList.add('SCRPXsubEvent');
          const headerDiv = document.createElement('div');
          headerDiv.classList.add('SCRPXsubEventHeader');
          headerDiv.textContent = 'Sub event';
          subEventDiv.append(headerDiv);
          rootTag.parentElement.children[2].append(subEventDiv);

          // for regular keys
          multiKeys.forEach(key => {
            const className = 'SCRPXhighlight' + key.replace('eventMulti', '').replace('Tags', '');
            venue.linkedPage[key].forEach(tagPath => {
              const pathAfterDelimiter = tagPath.replace(subEventPath,'').replace(/^>/,'');
              findTagsFromPath(subEventTag, pathAfterDelimiter).forEach(tag => {
                const newDiv = document.createElement('div');
                newDiv.textContent = getTextFromTag(tag);
                newDiv.classList.add(className);
                subEventDiv.append(newDiv);
              });
            });
          });

          // for alternate keys
          multiKeysAlternate.forEach(key => {
           venue.alternateTags.linkedPage[key].forEach(tagPath => {
            const pathAfterDelimiter = tagPath.replace(subEventPath,'').replace(/^>/,'');
              findTagsFromPath(subEventTag, pathAfterDelimiter).forEach(tag => {
                const newDiv = document.createElement('div');
                newDiv.textContent = getTextFromTag(tag);
                newDiv.classList.add('SCRPXhighlightAlternate', 'miniBottomMargin');
                setVarRefForCss(newDiv, "--category-bg-color", key.replace('eventMulti', '').replace('Tags', ''));
                subEventDiv.append(newDiv);
              });
            });
          });

          // remove sub event if it there is no tag inside
          if (subEventDiv.children.length === 1){
            subEventDiv.remove();
          }
        });
      };
    });
  }


  // Colorize tags that have no type
  if (currentPage === 'linkedPage'){
    subTags.linkedPage.filter(tag => !tag.desc && !tag.hasAttribute('isURL'))
      .forEach(tag => {
        if (!tag.isMulti){
          tag.classList.add('SCRPXhighlightUnknown');
        }else{
          const subEvents = findTagsFromPath(rightPanel,subEventPath);
          const mainSubEvent = subEvents.find(se => isAncestorOf(se,tag));
          const path = getPath(mainSubEvent,tag);
          subEvents.forEach(se => {
            findTagsFromPath(se, path).forEach(t => t.classList.add('SCRPXhighlightUnknown'));
          });
        }
      });
  }
}





function loadPage(){
  // keep a trace of venue JSON to see later if it has changed. Used for updating save button
  // venueBeforeLoading = JSON.parse(JSON.stringify(venue));


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

  // get the adjust level corresponding to the mainPage
  tagAdjustIndexInput.value = tagsAdjustLevel.mainPage;

  // find the tag from eventsDelimiterTag, with the text in the strings. If not found, get the first tag
  // that matches eventsDelimiterTag
  
  behaviourSetup('automaticDefault');
  
  if (venue.hasOwnProperty('eventsDelimiterTag')){
    delimiterTagField.value = venue.eventsDelimiterTag;
    // load the first event, or event n°principalTagIndex if it exists (useful when exiting linkedPage edition)
    const candidatePrincipalTagList = findTagsFromPath(rightPanel, venue.eventsDelimiterTag);
    if (principalTagIndex){
      candidatePrincipalTag = candidatePrincipalTagList[principalTagIndex];
    }else{
      let bestScore = -1;
      // find the first valid tag. If not found, keep the first tag
      for (const tag of candidatePrincipalTagList){
        const score = eventScore(tag, venue.mainPage);
        if (score > bestScore){
          candidatePrincipalTag = tag;
          bestScore = score;
        }
      }
    }
  
    if (!candidatePrincipalTag){// start with default setup for automatic 
      behaviourSetup('automaticDefault');
    }else{
      behaviourSetup('initialize');
    }

  
  }

}

function makeEventsMap(){
  if (currentPage !== 'mainPage'){
    return;
  }

  console.log('\x1b[46mRecomputing Map\x1b[0m');

  let eventIndex = 1;
  let linkedPageIndex = 0;
  const oldKeys = Object.keys(eventsMap);

  eventsMap = {};
  for (let i = 0; i < eventTagList.length; i++) {
    // only register the current tag if it contains text
    if (eventTagList[i].textContent.trim().length > 0){
      if (venue.mainPage.hasOwnProperty('eventURLTags')) {
        let k = 0;
        let url;
        // take the first URL found in the url tag list
        while (!url && k < venue.mainPage.eventURLTags.length) {
          url = makeURL(venue.baseURL,getURLFromAncestor(findTagsFromPath(eventTagList[i], venue.mainPage.eventURLTags[k])[0]));
          k++;
        }
        eventsMap[eventIndex.toString()] = {url: url, mainIndex: i, linkedPageIndex: eventIndex-1};
        eventIndex++;
      } else if (venue.mainPage.hasOwnProperty('eventMultiURLTags')) {
        const subEvents = findTagsFromPath(eventTagList[i], subEventPath);
        const tagPathsFromSubEvent = (venue.mainPage['eventMultiURLTags'] || [])
              .map(el => replaceWithCustomTags(el))
              .map(el => el.replace(subEventPath, '').replace(/^>/, ''));
        for (let j = 0; j < subEvents.length; j++){
          let k = 0;
          let url;
          while (!url && k < tagPathsFromSubEvent.length) {
            url = makeURL(venue.baseURL,getURLFromAncestor(findTagsFromPath(subEvents[j], tagPathsFromSubEvent[k])[0]));
            k++;
          }
          eventsMap[eventIndex.toString()+'.'+(j+1).toString()] = {url: url, mainIndex: i, subIndex: j, linkedPageIndex: linkedPageIndex};
          linkedPageIndex++;
        }
        eventIndex++;
      } else {
        const url = makeURL(venue.baseURL,eventTagList[i].getAttribute('href'));
        eventsMap[(eventIndex).toString()] = {url: url, mainIndex: i, linkedPageIndex: eventIndex-1};
        eventIndex++;
      }
    }
  }

  // update the event index input only if the keys have changed
  if (Object.keys(eventsMap).length !== oldKeys.length || Object.keys(eventsMap).some((key, index) => key !== oldKeys[index])){
    updateEventIndexInput();
  }
 
}

function computeMissingLinks(){
  console.log('Computing missing links');

  linkedFileContent = fs.existsSync(sourcePath+'linkedPages.json')?loadLinkedPages(sourcePath):[];
  // console.log(getHrefListFrom([localPage],venueWithCustomTags(venue)));
  const hrefList = Object.keys(eventsMap).map(key => eventsMap[key].url).filter(el => el);
  const existingLinks = hrefList.filter(el => Object.keys(linkedFileContent).includes(el));
  const nbLinksToDownload = hrefList.length - existingLinks.length;

  const missingLinksPanel = document.getElementById('missingLinksPanel');
  
  // if (venue.hasOwnProperty('linkedPage') && lastModified){
  if (!lastModified){
    missingLinksPanel.style.display = 'none';
    return;
  }

  missingLinksPanel.style.display = 'flex';
  const missingLinksText = document.getElementById('missingLinksText');
 
  if (hrefList.length === 0) {
    missingLinksText.textContent = 'No linked page references.';
  } else {
    missingLinksText.textContent = 'Links downloaded: ' + existingLinks.length + '/' + hrefList.length;
    if (nbLinksToDownload === 0) {
      missingLinksText.classList.remove('redFont');
      missingLinksButton.style.display = 'none';
    } else {
      missingLinksText.classList.add('redFont');
      missingLinksButton.style.display = 'inline';
    }
  }

}








function showDate(date){
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); 
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  // const seconds = String(date.getSeconds()).padStart(2, '0');
  const string = day+'/'+month+'/'+year+' at '+hour+':'+minutes;
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


// function getPath(element) {
//   let path = '';
//   let currentElement = element;

//   while (currentElement.length) {
//       let name = currentElement.get(0).name;
//       let id = currentElement.attr('id');
//       let className = currentElement.attr('class');
//       let index = currentElement.index() + 1; // Ajout de 1 pour commencer à l'indice 1

//       let node = name;
//       if (id) {
//           // node += `#${id}`;
//           node += ':eq(0)';
//       }
//       if (className) {
//           node += `.${className.replace(/\s+/g, '.')}`;
//       }
//       if (index) {
//           node += `:eq(${index - 1})`; // Retrait de 1 pour commencer à l'indice 0
//       }

//       path = node + (path ? ' ' + path : '');
//       currentElement = currentElement.parent();
//   }
//   return path;
// }


function getDatesStrings(venueInfo){

  const dates = [];

  
  // Get the path of date tags from sub events root tag
  const tagPathsFromSubEvent = (venueInfo['eventMultiDateTags'] || [])
    .map(el => replaceWithCustomTags(el))
    .map(el => el.replace(subEventPath, '').replace(/^>/, ''));

  
  // for every event, get the date strings corresponding to the date tags and concatenate them.
  eventTagList.forEach(eventTag => {
    let dateString = '';

    if ('eventDateTags' in venueInfo) {
      dateString += venue[currentPage]['eventDateTags'].flatMap(dateTag => findTagsFromPath(eventTag, dateTag))
        .map(tag => getTextFromTag(tag)).join(' ');
    }

    if ('eventMultiDateTags' in venueInfo) {
      const subEventDelimiterTagList = findTagsFromPath(eventTag, subEventPath);
      if (subEventDelimiterTagList.length === 0) {
        dates.push(cleanDate(dateString, dictionary.rangeSeparators));
      } else {
        subEventDelimiterTagList.forEach(subEventTag => {
          let newDateString = dateString;
          tagPathsFromSubEvent.forEach(path => {
            findTagsFromPath(subEventTag, path).forEach(tag => {
              newDateString += ' ' + getTextFromTag(tag);
            });
          });
          dates.push(cleanDate(newDateString, dictionary.rangeSeparators));
        });
      }
    } else {
      dates.push(cleanDate(dateString, dictionary.rangeSeparators));
    }
  });

  return dates;
}

function computeAlternateDateFormat(){
  // console.log('\x1b[42m\x1b[30mComputing alternate date format\x1b[0m');
  // let dates = [];
 
  const dates = getDatesStrings(venue.alternateTags[currentPage]).filter(string => string.trim().length > 0);

  // lastAlternateDateList keeps memory of computation. If no new dates to analyze since the last valid
  // date format computation, no need to perform again a search for the best format

  if (lastAlternateDateList && lastAlternateDateList.join('') === dates.join('')){
    return venue.alternateDateFormat[currentPage];
  }

  lastAlternateDateList = dates;

  const [dateFormat, bestScore] = initDateFormat(dates, dictionary);

  // console.log('*****************', dateFormat, dateFormat.order);
  let formatRes;
  
  if (bestScore === 0) {
    return "No date format found.";
  }

  // if (bestScore !== 0) {
  //   formatRes += ' ('
  //     + (dates.length - bestScore) + '/' + dates.length + ')';
  // }
  
  return dateFormat;
}


function computeDateFormat(){
  console.log('\x1b[42m\x1b[30mComputing date format\x1b[0m');
  // let dates = [];

  // if no date tag is found, do nothing
  if (!venue[currentPage].hasOwnProperty('eventDateTags') && !venue[currentPage].hasOwnProperty('eventMultiDateTags')){
    dateFormatPanel.style.display = 'none';
    return;
  }

  // if no event can be found in the main page, do nothing
  if (currentPage === 'mainPage' && (!eventTagList || eventTagList.length === 0)){
    dateFormatPanel.style.display = 'none';
    return;
  }
      
  const dates = getDatesStrings(venue[currentPage]);

  // if no date found, no display
  if (dates.length === 0){
    dateFormatPanel.style.display = 'none';
    return;
  }

  // lastDateList keeps memory of computation. If no new dates to analyze since the last valid
  // date format computation, no need to perform again a search for the best format

  dateFormatPanel.style.display = 'block';

  if (lastDateList && lastDateList.join('') === dates.join('')){
    return;
  }

  lastDateList = dates;
  dateFormatPanel.classList.remove('redFont', 'warningFont');

  // compute date format information
  // console.log(dates.length, dates);
 const [dateFormat, bestScore] = initDateFormat(dates, dictionary);

  // console.log('*****************', dateFormat, dateFormat.order);

 
  if (currentPage === 'mainPage') {
    venue.dateFormat = dateFormat;
  } else {
    venue.linkedPageDateFormat = dateFormat;
  }

  if (bestScore !== 0) {
    dateFormatText.innerHTML = 'Format:  <span class="warningFont">('
      + bestScore + '/' + dates.length + ' valid dates)</span>';
  }else{
    dateFormatText.textContent = '';
  }
  
}

function renderEventURLPanel(){
  if (currentPage === 'linkedPage'){
    return;
  }
  console.log('render URL');


  eventURLPanel.classList.remove('activeLink');
  // venue.mainPage.eventURLTags || venue.mainPage.eventMultiUrlTags-> tags to be found in specified tag
  // nothing -> URL will be taken from delimiter if it exists
  // otherwise no URL will be returned
  
  if (!eventTagList || eventTagList.length === 0){
    eventURLPanel.style.display = 'none';
    // followURLButton.style.display = 'none';
    setSwitchStatus();
    return;
  }
  eventURLPanel.style.display = 'flex';

  // 1st case: no URL can be found in the event block
  if (!containsURL(principalTag)){
    eventURLPanelWarning.style.display = 'block';
    eventURLPanelWarning.textContent = 'Cannot find any URL in the event block.';
    eventURLPanelMessage.style.display = 'none';
    // followURLButton.style.display = 'none';
    setSwitchStatus();
    return;
  }
    
  eventURLPanelWarning.style.display = 'none';


  // if eventURLTags or eventMultiURLTags is defined, try to extract the URL
  if (venue.mainPage.hasOwnProperty('eventURLTags') || venue.mainPage.hasOwnProperty('eventMultiURLTags')){
    let urlTag;
    if(venue.mainPage.hasOwnProperty('eventURLTags')){
      urlTag = findTagsFromPath(principalTag,venue.mainPage.eventURLTags[0])[0];
    }else{
      const currentSubEvent = findTagsFromPath(principalTag, subEventPath)[currentSubEventIndex];
      urlTag = findTagsFromPath(principalTag,venue.mainPage.eventMultiURLTags[0])
        .find(el => isAncestorOf(currentSubEvent,el));
      // urlTag = principalTag.querySelector('[isURL = "true"]');
    }
    eventURL = urlTag? getURLFromAncestor(urlTag) : undefined;
    if (eventURL){
      eventURLPanelMessage.textContent = 'URL from tag: '+ eventURL;
      eventURLPanelMessage.style.display = 'inline';
      eventURLPanel.classList.add('activeLink');
      // followURLButton.style.display = 'inline';
    }else{
      eventURLPanelWarning.style.display = 'block';
      // followURLButton.style.display = 'none';
      eventURLPanelWarning.textContent = 'URL tag found, but it does not contain a URL reference. Maybe the format of the web page has been changed. Set another tag or choose a link from the list';
    }
    setSwitchStatus();
    return;
  }


  eventURLPanelMessage.style.display = 'inline';

  // if no eventURLTag is present, set the URL in the main delimiter as the default URL if it exists
  if (principalTag.hasAttribute('href')){
    eventURL = principalTag.getAttribute('href');
    eventURLPanelMessage.textContent = 'URL found in event block: ' + eventURL;
    eventURLPanel.classList.add('activeLink');
    // followURLButton.style.display = 'inline';
  }else{
    eventURLPanelMessage.textContent = 'Choose URL from tags.';
    // followURLButton.style.display = 'none';
  }
  setSwitchStatus();
}


//aux functions

function setSwitchStatus(){
  // console.log('\x1b[44mSetting switch status\x1b[0m');
  const linkURL = makeURL(venue.baseURL,eventURL);
  if(!useLinks){
    switchPageButton.style.display = 'none';
    return;
  }
  switchPageButton.style.display = 'block';

  if (!linkedFileContent){
    switchPageButton.classList.remove('activeButton');
    switchPageButton.classList.add('inactive');
    switchPageButton.disabled = true;
    return;
  }

  if (linkedFileContent.hasOwnProperty(linkURL)){
    switchPageButton.title = linkURL;
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
      inputElement.setAttribute('type', 'text');
      inputElement.textContent = el;
      textBox.appendChild(inputElement);
    });
  }
}



// to be removed, only find the url in the main delimiter now
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
  eventSelectorIndex.disabled = n>0?false:true;
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
  makePrincipalTag(candidatePrincipalTag,true);
  focusTo(principalTag, 'instant');
});

function removeEmptyFields(object){
  fieldsToCheck = ['linkedPage','mainPage'];
  fieldsToCheck.forEach(field => {
    if (object.hasOwnProperty(field)){
      Object.keys(object[field]).forEach(key =>{
        // object[field][key] = object[field][key].filter(el =>  /\S/.test(el));
        if (object[field][key].length === 0){
          delete object[field][key];
        }
      })
    }
  });
}



function focusTo(element, behavior = 'smooth', position = 'center'){
  if (element){
    if (isElementVisible(element)){
      return;
    }
    element.scrollIntoView({ behavior: behavior, block: position });
  }
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
}


// find ancestor with a href attribute. If tag is not specified, returns undefined
function getAncestorWithUrl(tag) {

  if (!tag){
    console.warn('Warning: try to find an URL for an undefined tag');
    return undefined;
  }

  if (containsURL(tag)) {// if a tag or successors contains an href attribute
    return tag;
  } 
  
  // else try the parent

  const parentTag = tag.parentElement;
  if (parentTag && parentTag.id !== 'scrapEnDirexRightPanel') {
    return getAncestorWithUrl(parentTag);
  } else {
    console.xarn('Warning: ancestor with URL not found.');
    return null;
  }
}


function getURLFromAncestor(tag) {

  const ancestor = getAncestorWithUrl(tag);

  if (!tag) {
    return null;
  } 
  return ancestor.getAttribute('href');
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

function generateTag(desc, n){
  const descSplit = desc.split(':');
  const tagEq = descSplit.length ===2?descSplit[1]:undefined;
  const descSplit2 = descSplit[0].split('.');
  const tagName = descSplit2[0];
  let tagClasses = descSplit2.slice(1);
 
  const depthClassName = tagClasses.find(el => el.startsWith(depthPrefix));
  if (depthClassName === undefined){
    console.log("\x1b[33m Warning:\x1b[0m 'depth' class not found. Html file is too old. Run again aspiratorex.");
  }
  tagClasses = tagClasses.filter(item => item !== depthClassName);

  const nbAdjust = Math.min(n, tagClasses.length);

  const res = [desc];
  for(let i = 1; i <= nbAdjust;i++){
    // check if a better solution exists for i class removal
    let comboList = generateCombinationsByRemoval(tagClasses,i);
    comboList.forEach(combo =>{
      const newClassList = depthClassName?combo.concat(depthClassName):combo;
      const newDesc = tagName+'.'+newClassList.join('.')+ (tagEq?':'+tagEq:'');
      res.push(newDesc);
    });
  }
return res;
}

function behaviourSetup(string){
  manualMode = false;
  if(string === 'automaticDefault'){
    autoAdjustLevel = defautAutoAdjustLevel;
    mustIncludeURL = true;
  }else if (string === 'automaticLastSetup'){
    if (!lastConfig.setup.startsWith('automatic')){
      autoAdjustLevel = lastConfig.autoAdjustLevel;
      mustIncludeURL = lastConfig.urlCheck;
    }
  }else if (string === 'manual'){
    manualMode = true;
    lastConfig.autoAdjustLevel = autoAdjustLevel;
    lastConfig.urlCheck = mustIncludeURL;
    autoAdjustLevel = 0;
    mustIncludeURL = false;
  }else if (string === 'initialize'){
    autoAdjustLevel = 0;
    mustIncludeURL = containsURL(candidatePrincipalTag);
    
    lastConfig.autoAdjustLevel = autoAdjustLevel;
    lastConfig.urlCheck = mustIncludeURL;
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
  // set URL adjust panel

    adjustURLCheckbox.checked = mustIncludeURL;
    
  lastConfig.setup = string;
  autoAdjustIndex.value = autoAdjustLevel;
  adjustURLCheckbox.checked = mustIncludeURL;
}

// for tag, find the description 'eventXXXTags' that corresponds to it if it is registered in venue.json
function getDescFromJSON(rootTag, subTagsList){

  // for regular data (not sub event)
  Object.keys(venue[currentPage]).filter(key => !key.includes('Multi'))
    .forEach(key => {
      venue[currentPage][key].forEach(path => {
        updateTagAdjustLevel(path, eventTagList);
        const tags = findTagsFromPath(rootTag, path);
        if (subTagsList){
          tags.filter(tag => subTagsList.includes(tag));
        }
        tags.forEach(tag => {
          if (key === 'eventURLTags') {
            markAndPropagateTag(tag, {isURL: true});
            currentURLTag = tag;
          } else {
            markAndPropagateTag(tag, {desc: key});
          }
        });
      });
    });

  // find the sub event delimiter path (the path string at the starts of every sub event tag)

  
  const multiTags = Object.keys(venue[currentPage]).filter(key => key.includes('Multi'))
    .map(key => venue[currentPage][key]).flat();

  if(multiTags.length === 0){// stop here if there is no multi tags
    return;
  }

  let subEventDelimiterPath = multiTags[0];

  while (multiTags.some(tagPath => !tagPath.startsWith(subEventDelimiterPath))){
    if (!subEventDelimiterPath.includes('>')){
      console.log('Warning, unexpected error. Tag '+subEventDelimiterPath+' does not contain \'>\'');
      break;
    }
    subEventDelimiterPath = subEventDelimiterPath.replace(/>[^>]*$/,'');
  }
  subEventPath = subEventDelimiterPath; // is it always true ? Can we just compute subEventPath and remove subEventDelimiterPath ?

  const tagPathsFromSubEvent = multiTags.map(el => el.replace(subEventDelimiterPath,'').replace(/^>/,''));
 
  // find the delimiter which has the most matching fields for sub events
  const subEventDelimiters = findTagsFromPath(rootTag, subEventDelimiterPath);

  if(subEventDelimiters.length === 0){// no sub event found. all multi tags are alternate
    return;
  }

  // computes the number of matching fields for sub events. Use lexicographic order:
  // count 1 for each path that have a match (weight 1), then 0.01 for each matching tag after the first 
  function tagScore(d){
    let count = tagPathsFromSubEvent.filter(el => findTagsFromPath(d,el).length > 0).length;
    count = count + 0.01 * (tagPathsFromSubEvent.map(el => findTagsFromPath(d,el)).flat().length - count);
    return count;
  }

  const selectedTag = subEventDelimiters.reduce((maxElement, currentElement) => {
    return tagScore(currentElement) > tagScore(maxElement) ? currentElement : maxElement;
  }, subEventDelimiters[0]);


  Object.keys(venue[currentPage]).filter(key => key.includes('Multi'))
    .forEach(key => {
      venue[currentPage][key].forEach(path => {
        path = path.replace(subEventDelimiterPath,'').replace(/^>/,'');
        const tags = findTagsFromPath(selectedTag, path);
        updateTagAdjustLevel(path, eventTagList);
        if (subTagsList){
          tags.filter(tag => subTagsList.includes(tag));
        }
        if (tags.length === 0){// no tag found for this key
          // anything to do ?
        }else{
          tags.forEach(tag => {
            // tag.isMulti = true;
            if (key === 'eventMultiURLTags') {
              markAndPropagateTag(tag, {isURL: true, isMulti: true});
              currentURLTag = tag;
            } else {
              markAndPropagateTag(tag, {desc: key, isMulti: true});
            }
          });
        }  
      });
    });

}





function getSubTags(tag){
  const descendants = Array.from(tag.children);
  // count if there are children that are not inline tags. This is to address the following cases:
  // <div> hello <span> world</span></div> should return ['hello word']
  // <div><div> hello </div><div> world</div></div> should return ['hello', 'word']
  // <div><div> hello </div><span> world</span></div> should return ['hello', 'word']
  const nbNonInlineTags=descendants.filter(el => !inlineTags.some(t => t === el.tagName.toLowerCase())).length;

  // if it only has inline tags, returns empty list, or [tag] 
  if (nbNonInlineTags === 0){
    if (tag.textContent.trim() !== ''){
      return [tag];
    }else{
      return [];
    }
    
  }
  const selectedTags = descendants.flatMap(el => getSubTags(el));

  // badly nested divs: this part processes badly nested divs by keeping a text for the whole tag 
  //<div> hello <div> world</div></div> should return ['hello world', 'world'] ???
  
  // tests if there are badly nested divs:
  // For each nested <div>, its text is removed from the parent text. If some text remains, it means
  // that it is badly nested
  let parentText = tag.textContent;
  descendants.forEach(function(div) {

    parentText = parentText.replace(div.textContent.trim(), '').trim();
  });

  if (parentText.length > 0){
    console.log("\x1b[33mWarning: badly nested divs found in tag \x1b[36m'"+tag.tagName+"'\x1b[0m: "+tag.textContent
      +'. \x1b[33mBadly nested text:\x1b[0m '+parentText
    );
    selectedTags.push(tag);
  }
  return selectedTags;
}



// used to find the tags that are successors of root tag that match the infos from the string path
// subfunction fromCheerioSyntax introduces an intermediate object
// infoList (list of list) which is a list of info [[tagName1, classList1, eq1],[tagName2, classList2, e2],...]
// where eqn is the is nth element if only a specific element has to be returned (optional)
// such that the resulting tags follow a chain of successors (not just children) with tagName n and classList n
// returns a list of tags filling the conditions

function findTagsFromPath(rootTag, path) {
  if (!rootTag){
    throw new Error("Undefined variable 'rootTag'.");
  }

  if (path.trim().length === 0){
    return [rootTag];
  }

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
  let currentElements = [rootTag];  // start with root tag

  for (const [tagName, classes, numero] of infoList) {
      let nextElements = [];
      let selector = tagName + (classes.length > 0 ? '.' + classes.join('.') : '');
      // console.log(selector);
      for (const parent of currentElements) {
        try {
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
        } catch (err) {
          console.log('selector', selector);
          console.log('path', path);
          console.log(infoList);
          throw err;
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


function getPath(rootTag, tag, noDivNumber = false) {
  if (!tag){
    return null;
  }
  if (tag === rootTag){
    return '';
  }

  const pathList = [];

  while (tag && tag !== rootTag){
    const parent = tag.parentElement;
    let tagClasses = Array.from(tag.classList)
                        .filter(el => !reservedClassList.includes(el)); // remove SCRPX reserved names classes
    const index = Array.from(parent.children)
                .filter(child => child.tagName === tag.tagName) // filter the tags with the same name
                .filter(child => tagClasses.every(cls => child.classList.contains(cls))) // filter tags which contain the same classes. Need this code to avoid pb with === 
                .findIndex(ch => ch === tag);
    pathList.push(tag.tagName +'.'+ tagClasses.join('.') + (noDivNumber?'':':eq('+index+')'));
    tag = parent;
  }

  return pathList.reverse().join('>');
  


  // const parent = tag.parentElement;
  // let path = getPath(rootTag, parent, noDivNumber);
  // let tagClasses = Array.from(tag.classList)
  //                       .filter(el => !reservedClassList.includes(el)); // remove SCRPX reserved names classes
  // const index = Array.from(parent.children)
  //               .filter(child => child.tagName === tag.tagName) // filter the tags with the same name
  //               .filter(child => tagClasses.every(cls => child.classList.contains(cls))) // filter tags which contain the same classes. Need this code to avoid pb with === 
  //             //   .filter(child => {                         
  //             //     let chClasses = Array.from(ch.classList).sort();
  //             //     return chClasses.length === tagClasses.length && 
  //             //            chClasses.every((cls, i) => cls === tagClasses[i]);
  //             // })
  //               .findIndex(ch => ch === tag);
  // path = (path.length>0?path+'>':'') + tag.tagName 
  //           +'.'+ tagClasses.join('.') 
  //           + (noDivNumber?'':':eq('+index+')');
  // return path;
}

function removeCustomTags(path){
  const regex = new RegExp(customTagName,"gi");
  return path.replace(regex,'A');
}

function replaceWithCustomTags(path){
  return path.replace(/(>?)a(?=$|>|\.)/gi, '$1'+customTagName.toUpperCase());
}


function ProcessRegex(){
  Object.keys(regexElements).forEach(key => applyRegexp(regexElements[key]));
}



// replace tags with custom tags
// just process tags for urls, may need improvement
function venueWithCustomTags(v){
  const v2 = JSON.parse(JSON.stringify(v));

  if (v.hasOwnProperty('eventsDelimiterTag')) {
    v2.eventsDelimiterTag = replaceWithCustomTags(v.eventsDelimiterTag);
  }
  if (v.hasOwnProperty('mainPage')) {
    v2.mainPage = {};
    Object.keys(v.mainPage).forEach(key => {
      v2.mainPage[key] = v.mainPage[key].map(el => replaceWithCustomTags(el));
    })
  }
  if (v.hasOwnProperty('linkedPage')) {
    v2.linkedPage = {};
    Object.keys(v.linkedPage).forEach(key => {
      v2.linkedPage[key] = v.linkedPage[key].map(el => replaceWithCustomTags(el));
    })
  }

  return v2;
}


function makeExtendButton(tag){

  // does not make extend button if the parent is the right panel
  if(tag.parentElement === rightPanel){return;}

  extendButton = document.createElement("button");
  extendButton.innerText = "◀";
  extendButton.title = "Extend the selection";
  extendButton.classList.add("extend-button");
  extendButton.tagTarget = tag;
  tag.style.position = "relative";
  tag.prepend(extendButton);

  // resizes the extendButton
  let observer = new ResizeObserver(() => {
    extendButton.style.height = `${tag.offsetHeight}px`;
  });
  observer.observe(tag);
}



// find common ancestor for tag list
function findCommonAncestor(tags) {
  if (tags.length === 0) return null;
  if (tags.length === 1) return tags[0];

  // Convert each element as a list of ancestors
  let ancestors = tags.map(tag => {
      let list = [];
      while (tag) {
          list.push(tag);
          tag = tag.parentNode;
      }
      return list.reverse(); 
  });
  const candidateList = [...ancestors[0]];

  // Compare ancestors paths and keep the highest level common ancestor
  let commonAncestor = null;
  while (commonAncestor === null){
    candidate = candidateList.pop();
    if (ancestors.every(tagList => tagList.includes(candidate))){
      commonAncestor = candidate;
    }
  }
  return commonAncestor;
}

// test if the candidate is an ancestor of tag
function isAncestorOf(candidate,tag){
  if (tag === candidate){
    return true;
  }
  if (tag === rightPanel){
    return false;
  }
  const parent = tag.parentNode;
  if (!parent){
    return false;
  }
  return isAncestorOf(candidate, parent);
}



// add classes and headers for sub event
function applySubEventDelimiterTags(){
  rightPanel.querySelectorAll('*').forEach(el => {
    if (el.isSubEventDelimiter){
      // console.log(el.textContent);
      el.classList.add('SCRPXsubEvent');
      const headerDiv = document.createElement('div');
      headerDiv.classList.add('SCRPXsubEventHeader');
      headerDiv.textContent = 'Sub event';
      el.parentNode.insertBefore(headerDiv, el);
    }
  });

  if (currentPage === 'mainPage'){
    const mainSubEvents = principalTag.querySelectorAll('.SCRPXsubEventHeader');
    if (currentSubEventIndex < mainSubEvents.length){
      mainSubEvents[currentSubEventIndex].classList.add('mainFont');
    }
  }
}
        


// functions for sub events

function groupDivs(mainDiv, groupList) {
  if (groupList.length === 0){
    return;
  }

  // make a header on the left, and a div that will containt easylines on the right
  const headerDiv = document.createElement('div');
  headerDiv.classList.add('PanelSubEventHeader');
  headerDiv.textContent = groupList.length>1?'Sub event':'S. evt';
  const subEventRightDiv = document.createElement("div");
  subEventRightDiv.classList.add('subEventRightDiv');
  // mainDiv.insertBefore(headerDiv, groupList[0] || null);

  // insert the group
  const subEventDiv = document.createElement("div");
  
  subEventDiv.className = "multiEventEasyPanelGroup";
  mainDiv.insertBefore(subEventDiv, groupList[0] || null);
  subEventDiv.appendChild(headerDiv); 
  subEventDiv.appendChild(subEventRightDiv); 
  groupList.forEach(div => subEventRightDiv.appendChild(div));

  // make all buttons multiTags
  groupList.forEach(line => {
    line.querySelectorAll('.eventTagTypeButton').forEach(button => {
      button.eventTagType = button.eventTagType.replace('event','eventMulti');
    });
  });
}





function ungroupDivs(mainDiv) {
  
  
  // remove group headers and css classes from html
  
  Array.from(rightPanel.querySelectorAll('*')).filter(el => el.isSubEventDelimiter).forEach(el => {
    delete el.isSubEventDelimiter;
    el.classList.remove('SCRPXsubEvent');
  });


  // remove all "multi" references for subEvents
  easyPanelFields.querySelectorAll('.eventTagTypeButton').forEach(button => button.eventTagType = button.eventTagType.replace('Multi',''));

  // reactivate all buttons
  easyPanelFields.querySelectorAll('button.inactive').forEach(button => button.classList.remove('inactive'));

  // find existing multi event groups
  const subDivs = mainDiv.querySelectorAll(".multiEventEasyPanelGroup");

  subDivs.forEach(subDiv => {
      const subDivRight = subDiv.children[1];
      // insert a child of subDiv before itself
      while (subDivRight.firstChild) {
          mainDiv.insertBefore(subDivRight.firstChild, subDiv);
      }
      // remove the empty subDiv
      subDiv.remove();
  });

  // remove additional info from easypanel
  easyPanelFields.querySelectorAll('div.PanelSubEventHeader').forEach(div => div.remove());
  easyPanelFields.querySelectorAll('div.subEventRightDiv').forEach(div => div.remove());
}

function makeSubEvents(recomputeSubEventPath = false){

  console.log('Making sub events');
  
  ungroupDivs(easyPanelFields);
  
  
  const commonAncestor = findCommonAncestor(subTags[currentPage].filter(el => el.isMulti));

  // if there is no common ancestor, but if there are tags in alternate tags, keep the previous subEventPath
  if (recomputeSubEventPath){
    if (commonAncestor || !Object.keys(venue.alternateTags[currentPage]).some(key => key.includes('Multi'))){
      subEventPath = getPath(principalTag, commonAncestor, true);
    }
  }

  
  // applying grouping to all subevents
  if (subEventPath) {
    eventTagList.forEach(eventTag => {
      const subEventDelimiterTagList = findTagsFromPath(eventTag, subEventPath);
      subEventDelimiterTagList.forEach(subEventTag => {
        // group easylines
        if (eventTag === principalTag) {
          const groupedList = easyLines.filter(el => isAncestorOf(subEventTag, el.tag));
          groupDivs(easyPanelFields, groupedList);
          // deactivate easy lines that are not the current active one that is being modified
          if (subEventTag !== commonAncestor) {
            groupedList.forEach(line => {
              for (const button of line.querySelectorAll('.easyButton')) {
                colorClassList.forEach(cl => button.classList.remove(cl));
                button.classList.add('inactive');
              }
              markAndPropagateTag(line.tag, {desc: null, isURL: null});
            });
          }else{

          }
        }
        subEventTag.isSubEventDelimiter = true;
      });
    });
    if (!currentSubEventIndex){
      currentSubEventIndex = computeSubEventIndex();
    }  
  }else{
    currentSubEventIndex = undefined;
  }
 
  computeTags();
  makeEventsMap();

  // refresh the map of urls

  if (currentPage === 'mainPage' && useLinks){
    computeMissingLinks();
  }

}


// mark tag with with the changes in 'change' then propagate to other events
// changes is a json object with the optional following fields:
// desc: value is null if the desc is to be cleared
// isURL: null/false if the field 'isURL' if the tag is not an URL tag
// isMulti: null/false if the tag has not been marked as multi
//
// rootTag (optional): the tag from which the path should be computed.
function markAndPropagateTag(tag, change, rootTag = undefined){

  desc = change.hasOwnProperty('desc')?change.desc:undefined;
  isURL = change.hasOwnProperty('isURL')?change.isURL:undefined;  
  isMulti = change.hasOwnProperty('isMulti')?change.isMulti:undefined;

  // get the path of the tag that is being modified

  // const tagPath = currentPage === 'mainPage'?getPath(principalTag,tag):getPath(rightPanel,tag);
  let tagPath = rootTag ? getPath(rootTag,tag) : getPath(principalTag,tag);

  // adjust the path. WORKING FOR SUB EVENTS, OR ADJUSTMENT SHOULD START AFTER subEventPath ?
  tagPath = adjustTag(tagPath);

  if (isURL){// isURL !== undefined and null: a new URL tag is set, isURL has to be removed of all other tags
    rightPanel.querySelectorAll('[isURL = "true"]').forEach( t => {
      t.removeAttribute('isURL');
    });
  }

  function setTag(myTag){
    if (desc !== undefined){// the desc has to be modified
      myTag.desc = desc; // desc or null
    }
    if (isMulti !== undefined){// the desc has to be modified
      myTag.isMulti = isMulti; // desc or null
    }
    if (isURL !== undefined){// the isURL field has to be modified and is not null
      if (isURL){
        myTag.setAttribute('isURL', isURL); 
      }else{
        myTag.removeAttribute('isURL'); 
      }
    }
  }

  // modify tag propagate the changes to the corresponding tags in the other events. Only the first matching tag is marked per event:
  // it prevents propagating the tag to several sub events.
 
  eventTagList.forEach(rootTag => {
    const similarTags = findTagsFromPath(rootTag, tagPath);
    if (similarTags.length > 0) {
      const myTag = similarTags[0];
      setTag(myTag);
    }
  });
  
  
}



function showURLTags(txt){
console.log('show URL '+(txt?'\x1b[46m'+txt+'\x1b[0m':''));
  rightPanel.querySelectorAll('[isURL]')
    .forEach(el => {
        if (isAncestorOf(principalTag,el)){
          console.log('\x1b[45misURL\x1b[0m', el.textContent.replace(/[\n\s\t]{1,}/g,' '));
        }
        
      });
}

// This function is used to verify if a tag may be used as information for an URL link. If the tag itself is no a link
// it will find if an ancestor can be. The reason is that some links are not at the top level of tags, and thus not listed
// in the easy panel.
// if the tag is the principalTag, then it returns principalTag if it contains an URL, or null otherwise
// if the tag is not the principalTag, it will find an ancestor that is not principal tag, containing an URL
function findAncestorWithURL(tag){

  if (tag.tagName.toLowerCase() === 'body'){// tag with URL not found
    return null;
  }
  if (principalTag && tag === principalTag){// the tag is principal tag. Checks if it contains href
    return principalTag.hasAttribute('href')?principalTag:null;
  }
  // else find the first ancestor found with an URL if it can be found before the principal tag.
  if (tag.hasAttribute('href')){
    return tag;
  }
  if (tag.parentElement && tag.parentElement !== principalTag){
    return findAncestorWithURL(tag.parentElement);
  }else{
    return null;
  }
}

function showTagInfos(tag){
  console.log(tag.textContent.replace(/[\n\t\s]{1,}/g,' '),tag.getAttribute('isURL'));
}




// count the number of keys that have a match for tag.
// if keys is indicated, compute only the score for the given keys (including multi)
// test with Petit Salon events
function eventScore(tag, venueInfo, keyword = undefined){
  return Object.keys(venueInfo).filter(key => keyword === undefined || key.includes(keyword))
    .flatMap(key => venueInfo[key])
    .filter(path => findTagsFromPath(tag, path).length > 0)
    .length;
}

// test if the event is valid (has name and date if specified)

function isValid(tag, venueInfo){
  if (Object.keys(venueInfo).filter(key => key.includes('Name')).length > 0){
    if (eventScore(tag, venueInfo, 'Name') === 0){
      return false;
    }
  }

  if (Object.keys(venueInfo).filter(key => key.includes('Date')).length > 0){
    if (eventScore(tag, venueInfo, 'Date') === 0){
      return false;
    }
  }

  return true;
}

function removeSubEventHeaders(){
  rightPanel.querySelectorAll('div.SCRPXsubEventHeader').forEach(div => div.remove());
}
 

function nbOfMatchingEvents(path, eventTagList){
  let count = 0;
  // console.log('me',path,eventTagList.length);
  eventTagList.forEach(el => {

    findTagsFromPath(el, path);
  });
  eventTagList.forEach(eventTag => count += (findTagsFromPath(eventTag, path).length >0)?1:0);
  return count;
}



// update the Tag Adjust Level: if some classes are missing from the path of any of the tags that
// can be reached with a given path from a given tagList
function updateTagAdjustLevel(path, tagList){
  let updatedLevel = 0;
  // get the classes for each tag for a given path
  const splittedPath= path.split('>')
  .map(el => el.split(':')[0].split('.').slice(1));
  // browse the event tag list and verify that the path is relievant for each event tag
  tagList.forEach(rootTag => {
    findTagsFromPath(rootTag, path).forEach(tag => {
      // keep the list of class names
      const splittedNewPath = getPath(rootTag, tag).split('>')
        .map(el => el.split(':')[0].split('.').slice(1));
      splittedPath.forEach(pathEl => {
        const depth = pathEl.at(-1);
        const correspondingTag = splittedNewPath.find(el => el.at(-1) === depth).slice(0,-1);
        const nbClassDiff = correspondingTag.filter(el => !pathEl.includes(el)).length;
        updatedLevel = Math.max(updatedLevel, nbClassDiff);
      });
    });
  });
  // console.log('udpate adjust level to: ',updatedLevel);
  tagsAdjustLevel[currentPage] = updatedLevel;
  tagAdjustIndexInput.value = tagsAdjustLevel[currentPage];
}

function JSONAreEqual(obj1, obj2) {
  if (obj1 === obj2) return true; // same memory reference
  if (typeof obj1 !== "object" || typeof obj2 !== "object" || obj1 == null || obj2 == null) return false;

  let keys1 = Object.keys(obj1);
  let keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  return keys1.every(key => JSONAreEqual(obj1[key], obj2[key]));
}

function activateSaveButton(){
  saveButton.classList.remove('inactive');
}



function setLeftPanelDesign(){
  const analyzePanel = document.getElementById('analyzePanel');

  // console.log(analyzePanel.getElementsByClassName('subPanel'));
  // sub panels
  for (const subPanel of analyzePanel.getElementsByClassName('subPanel')){
    const key = subPanel.id.replace('event','').replace('Multi','');
    const isMulti = subPanel.id.includes('Multi');
    setVarRefForCss(subPanel, "--category-bg-color", key, isMulti);
  }

  // regexp panels
  for (const regexpPanel of analyzePanel.getElementsByClassName('regexpPanel')){
    const key = regexpPanel.id.replace('event','').replace('RegexpPanel','');
    setVarRefForCss(regexpPanel, "--category-bg-color", key);
  }

}

/* keep a trace of missing tags */

// find tags from venue that have no match 
function traceMissingTagInfo(subTags, firstLoad = false){
  console.log('Tracing missing info');

  // verify if previous alternate tags now correspond to a tag. If yes, remove it from alternate tags,
  // mark corresponding tags, and if it is the linked page, push the tag in subTagsList.
  // Venue will be recomputed later in computeTags()

  console.log(venue);
  console.log(venue.alternateTags[currentPage]);

  Object.keys(venue.alternateTags[currentPage]).forEach(key => {
    [...venue.alternateTags[currentPage][key]].forEach(tagPath => {
      // find tags corresponding to the given key. If on the main page, only keep the results
      // that have a match in the subtags
      let foundTags = findTagsFromPath(principalTag, tagPath);
      if (currentPage === 'mainPage'){
        foundTags = foundTags.filter(tag => subTags[currentPage].includes(tag));
      }
      if (foundTags.length > 0){

        // if alternate tags have not marked tags in the current event, mark them
        if (subTags[currentPage].filter(t => foundTags.includes(t)).length === 0){
          subTags[currentPage].push(foundTags[0]);
          markAndPropagateTag(foundTags[0],{
                desc: (key.includes('URL')?undefined:key),
                isMulti: key.includes('Multi')?true:undefined,
                isURL: key.replace('Multi','') === 'eventURLTags'
              });
              // Array.from(rightPanel.querySelectorAll('*')).filter(el => el.desc).forEach(el => console.log(el.desc));
        }
        
        // console.log('moving tag from alternate');
        // if (!venue[currentPage].hasOwnProperty(key)){
        //   venue[currentPage][key] = [];
        // }
        // venue[currentPage][key].push(tagPath);

        venue.alternateTags[currentPage][key] = venue.alternateTags[currentPage][key].filter(el => el !== tagPath);
        if (venue.alternateTags[currentPage][key].length === 0){
          delete venue.alternateTags[currentPage][key];
        }
        // foundTags.forEach(tag => {
        //   const desc = key.includes('URL')?undefined:key;
        //   console.log(desc);
        //   if (currentPage === 'linkedPage' && !subTags[currentPage].includes(tag)){
        //     subTags[currentPage].push(tag);
        //   }
          
        //   markAndPropagateTag(tag,{
        //     desc: (key.includes('URL')?undefined:key),
        //     // isMulti: key.includes('Multi'),
        //     isURL: key.replace('Multi','') === 'eventURLTags'
        //   });
        // });
      }
    });
  });

  // verify if tags are missing. If yes, add them to the alternate list

  if (!keepTraceOfAltTags[currentPage] && !firstLoad){
    return;
  }

  Object.keys(venue[currentPage]).forEach(key => {
    venue[currentPage][key].forEach(tagPath => {
      let existingTags = findTagsFromPath(principalTag, tagPath)
      if (currentPage === 'mainPage'){
        existingTags = existingTags.filter(tag => subTags[currentPage].includes(tag));
      }
      if (existingTags.length === 0){
        if (!venue.alternateTags[currentPage].hasOwnProperty(key)){
          venue.alternateTags[currentPage][key] = [];
        } 
        venue.alternateTags[currentPage][key].push(tagPath);
      }
    });
  });

  Object.keys(venue.alternateTags[currentPage]).forEach(key => {
    if (venue.alternateTags[currentPage][key].length === 0){
      delete venue.alternateTags[currentPage][key];
    }
  });

  if (firstLoad){
    if(Object.keys(venue.alternateTags[currentPage]).length > 0){
      keepTraceOfAltTags[currentPage] = true;
      updateLockButton(true);
    }
  }

}


// prepare data structure for alternate values
function initAlternateValues(){
  if (!venue.hasOwnProperty('alternateTags')) {
    venue.alternateTags = {};
  }

  useLinks = venue.hasOwnProperty('linkedPage') || venue.alternateTags.hasOwnProperty('linkedPage');

  ['mainPage', 'linkedPage'].forEach(page => {
    if (!venue.alternateTags.hasOwnProperty(page)) {
      venue.alternateTags[page] = {};
    }
  });

  venue.alternateDateFormat = {};
}

/* CSS functions */


function setEasyButtonDesign(button, key){
  button.classList.add('eventTagTypeButton', 'easyButton', 'easyButton'+key); // add class easybutton for css (coloring, hoovering)
  button.title = key;
  setVarRefForCss(button, "--category-bg-color", key);
}


// make var refering to 'key' color for css. If replaceMulti is true, use alternate color ('-alt')
function setVarRefForCss(element, varString, key, replaceMulti = false){

  const prop = 'var('+varString.replace('category',key.toLowerCase())+(replaceMulti?'-alt':'')+')';
  // console.log(prop);
  element.style.setProperty(varString, prop);
}

function switchDelimiterColors(element, varString){
  varList = ['--xxx-bg-color', '--xxx-font-color', '--xxx-lighter-color',
              '--xxx-button-color', '--xxx-lightest-color'];
              varList.forEach(variable => {
                const computedStyle = getComputedStyle(document.documentElement);
            
                // old and new CSS variable
                const oldVar = variable.replace('xxx', varString);
                const newVar = variable.replace('xxx', varString === 'delimiter' ? 'linkedpagedelimiter' : 'delimiter');
            
                // get the values in :root
                const oldValue = computedStyle.getPropertyValue(oldVar).trim();
                const newValue = computedStyle.getPropertyValue(newVar).trim();
            
                // exchange values in root:root
                document.documentElement.style.setProperty(oldVar, newValue);
                document.documentElement.style.setProperty(newVar, oldValue);
              });
}


function adjustLightness(colorVar, variation) {
  let color = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim();

  // Extraction of H, S, L values
  let match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return color; // Return original color if there is a problem

  let [_, h, s, l] = match.map(Number);
  l = Math.max(Math.min(l + variation, 100),0); // keep values between 0 and 100%

  return `hsl(${h}, ${s}%, ${l}%)`;
}

function createColorThemes(){

  const colorVariables = getRootCSSVariables("--xxx");

  keyNames.forEach(key => {
    const refVarName = '--category-bg-color'.replace('category',key.toLowerCase());
    colorVariables.forEach(colorVariable => {
      const varName = colorVariable.name.replace('xxx',key.toLowerCase());
      const variation = parseInt(colorVariable.value);
      document.documentElement.style.setProperty(varName, adjustLightness(refVarName, variation));
    });
  });
}


function getRootCSSVariables(prefix = "") {
  const variables = [];

  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule.selectorText === ":root") {
        const styles = rule.style;
        for (let i = 0; i < styles.length; i++) {
          let name = styles[i];
          if (name.startsWith(prefix)) {
            variables.push({ name, value: styles.getPropertyValue(name).trim() });
          }
        }
      }
    }
  }
  return variables;
}


/* aux functions for clicks on the right panel */

function isElementVisible(element) {

  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
 
  return (
    rect.top >= 0 &&
    rect.bottom <= windowHeight
  );
}


// used to move through linked page
function movePrincipalTagTo(eventInfo) {

  if (eventInfo.linkedPageIndex === principalTagIndex) { return };

  principalTagIndex = eventInfo.linkedPageIndex;
 
  const newTag = eventTagList[principalTagIndex];
  principalTag.style.display = 'none';
  principalTag = newTag;
  principalTag.style.display = 'block';
  if (!isElementVisible(principalTag.parentElement.children[0])) {
    focusTo(principalTag.parentElement.children[0], 'smooth', 'start');
  }

  subTags.linkedPage = Array.from(principalTag.querySelectorAll('*')).filter(el =>
    el.hasAttribute('isURL') || el.isMulti || el.desc);

  populateEasyPanel();
}


/* for changing main tag */

function clearPrincipalTag(){
  principalTag.classList.remove('SCRPXmainTag');
  if (extendButton){
    // remove the extend button
    extendButton.remove();
  }
}


function mod(k, n) {
  return ((k % n) + n) % n;
}


// get the text from tag. Add missing white spaces between blocks (eg 10mai2025 should be 10 mai 2025).
// Missing white spaces sometimes occur when the tag has children.
// this function is supposed to be working with badly nested divs.
// this should only happen in linked pages because only terminal tags are found in the main page
function getTextFromTag(tag){
  let res = tag.textContent;
  if (tag.children.length > 0){
    Array.from(tag.children).forEach(child => {
      res = res.replace(child.textContent, ' '+getTextFromTag(child)+' ');
    });
  }
  return res.trim().replace(/[\n\s\t]{1,}/g,' ');
}