/**********************************************************/
/*    utilities used in scrapex                           */
/**********************************************************/

//const path = require('path');
//const fs = require('fs');
const {removeBlanks} = require('./stringUtilities.js');
//const {loadLinkedPages, fetchWithRetry, fetchLink} = require('./fileUtilities.js');
// const {unique, isValidEvent} = require('./jsonUtilities.js');
// const {numberOfInvalidDates, getCommonDateFormats, createDate} = require('./dateUtilities.js');
const cheerio = require('cheerio');
const {getHrefFromAncestor} = require('./aspiratorexUtilities.js');

module.exports = {getInfo};


// returns the text of the specified element. If the element contains sub divs, format the text
// in order to have white spaces between the sub texts.

function textWithWhiteSpace($, element){
  return $(element).contents().map((_, el) => {
    if ($(el).children().length > 0) {
        return textWithWhiteSpace($,el); // Appel récursif
    }
    return $(el).text();
  }).get().join(' ');
  // return $(tag).contents().map((_, el) => $(el).text()).get().join(' ');
}

// given a path tagPath, returns the corresponding elements
// when :eq(x) is precised, choose the only children corresponding, otherwise choose all the children
// of the right class
// The starting tag can be optionally specified

function getElements(tagPath, $, rootTag) {
  let splitTag = tagPath.split('>');
  
  if (splitTag.every(tag => tag.endsWith(')'))) { // Case where all tags have restriction
      return rootTag ? $(rootTag).find(tagPath).toArray() : $(tagPath).toArray();
  }

  let resList = rootTag ? [rootTag] : [...$(splitTag.shift())]; // base definition
  return splitTag.reduce((elements, tagDesc) => 
      elements.flatMap(el => $(el).children(tagDesc).toArray()), resList);
}


// auxiliary function to extract data. For a given key ('eventNameTags', ...), get the list of tags from venueInfo 
// (mainPage or linkedPage) and return the corresponding text. If the tag is an URL tag, returns
// the info in href.
// for sub event, the sub event delimiter should be provided 

function getText(key, venueInfo, $, subEventDelimiter, eventTag){

  let string = "";
  let tagList = venueInfo[key].map(tagPath => tagPath.replace(subEventDelimiter,'').replace(/^>/,''));
  const $subEv = $(eventTag);

  try {
    if (key.includes('URL')){
      if (tagList[0].length > 0){
        if (eventTag){
          string = getHrefFromAncestor($subEv.find(tagList[0])) || '';
        }else{
          string = getHrefFromAncestor($(tagList[0])) || '';
        }
      }else{
        string = getHrefFromAncestor($subEv) || '';
      }
    }else{
      // get the text for each tag in tagList
      for (const tag of tagList) {
        if (tag === '') {
            string += ' ' + textWithWhiteSpace($, eventTag || '');
        } else {
          // let matchingTags = eventTag ? $subEv.find(tag).toArray() : getElements(tag, $, null);
          let matchingTags = getElements(tag, $, eventTag);//eventTag ? $subEv.find(tag).toArray() : getElements(tag, $, null);
          let separator = key.includes('Name') ? ', ' : ' ';
            string += (string.length > 0 ? separator : '') + matchingTags.map(el => textWithWhiteSpace($, el)).join(separator);
        }
      }
    }
  } catch (err) {
    console.log('\x1b[31m%s\x1b[0m', 'Erreur d\'extraction à partir des balises.\x1b[0m', tagList);
    throw err;
  }
  // console.log('string',string);
  // if (!string){
  //   return null;
  // }
  return removeBlanks(string);
}

// used to decide if alternative tag should be used
function checkAltTag(eventInfo, key){
  if (!eventInfo.hasOwnProperty(key)){
    return true;
  }
  if (key.includes('Date')){
    // to be modified
    return true;
  }
  if (eventInfo[key] === undefined || eventInfo[key] === null || eventInfo[key].trim().length === 0){
    return true;
  }
  return false;
}

// get info from the event block. for each key, if key already exists in eventInfo, append the info to eventInfo[key], otherwise 
// create a new entry. Keys such as eventPlaceTags or eventURLTags should not be appended, the value in eventInfo should be overwritten instead
// 'Multi' tags should not have an existing value, so there is no need to test if there is something to append
// overwrite = true may be used when using linked pages, to overwrite stuff already from the main page

function getInfo(venueTags, $, eventInfo = {}, overwrite = false, altEventInfo = undefined) {

  const keysToOverwrite = ['eventPlaceTags','eventURLTags'];

  // **** extraction of main tags ****/
  Object.keys(venueTags).filter(el => !el.includes('Multi'))
    .forEach(key => {
      const newKey = key.replace('Tags', '');
      const string = getText(key, venueTags, $);
      if (keysToOverwrite.includes(key) || overwrite){
        if (string && string.trim().length > 0)
          {
            eventInfo[newKey] = string.trim();
          } 
      }else{
        eventInfo[newKey] = (eventInfo[newKey] || '') + string.trim();
      }
    });

  // **** extraction of alt info ***/
  // for regular tags and url, replace the ones that are invalid
  // for dates, add an alternate dateTag, that will be processed later

  if (altEventInfo){
    Object.keys(altEventInfo).filter(el => !el.includes('Multi'))
    .forEach(key => {
      let newKey = key.replace('Tags', '');
      if (checkAltTag(eventInfo,newKey)){
        if (newKey.includes('Date')){
          newKey = altEventDate; 
        }
        const string = getText(key, venueTags, $);
        if (string && string.trim().length > 0) {
          eventInfo[newKey] = string.trim();
        } 
      }
    });
  }
  
  
  // **** find sub events and extract data ****/
  const multiTags = Object.keys(venueTags).filter(key => key.includes('Multi'));
  const altMultiTags = altEventInfo ? Object.keys(altEventInfo).filter(key => key.includes('Multi')) : [];

  if (multiTags.length === 0 && altMultiTags.length === 0){
    // stop here if there is no sub event
    return;
  }

  let subEvents = [];
  // if (multiTags.length !== 0) {
  let subEventDelimiterPath = multiTags.length !== 0 ? venueTags[multiTags[0]][0] : altEventInfo[altMultiTags[0]][0];

  while (multiTags.flatMap(key => venueTags[key]).concat(altMultiTags.flatMap(key => altEventInfo[key]))
    .some(tagPath => !tagPath.startsWith(subEventDelimiterPath))) {
    if (!subEventDelimiterPath.includes('>')) {
      console.log('Warning, unexpected error. Tag ' + subEventDelimiterPath + ' does not contain \'>\'');
      break;
    }
    subEventDelimiterPath = subEventDelimiterPath.replace(/>[^>]*$/, '');
  }

  // browse sub events and return a json object containing sub event infos and url
  $(subEventDelimiterPath).each((index, element) => {
    let subEventInfo = {};
    multiTags.forEach(key => {
      let newKey = key.replace('Tags', '').replace('Multi', '');
      subEventInfo[newKey] = getText(key, venueTags, $, subEventDelimiterPath, element);
    });
    // replace by alt tag if needed
    altMultiTags.forEach(key => {
      let newKey = key.replace('Tags', '').replace('Multi', '');
      if (checkAltTag(subEventInfo,newKey)){
        if (newKey.includes('Date')){
          newKey = 'altEventDate'; 
        }
        subEventInfo[newKey] = getText(key, altEventInfo, $, subEventDelimiterPath, element);
      }
    });
    subEvents.push(subEventInfo);
    // hrefInDelimiterList.push($(venue.eventsDelimiterTag+':eq('+index+')').attr('href'));
  });
  eventInfo.subEvents = subEvents;
}

  
