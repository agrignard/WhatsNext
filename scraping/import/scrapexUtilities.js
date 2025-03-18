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


    
// auxiliary function to extract data. For a given key ('eventNameTags', ...), get the list of tags from venueInfo 
// (mainPage or linkedPage) and return the corresponding text. If the tag is an URL tag, returns
// the info in href.
// for sub event, the sub event delimiter should be provided 

function textWithWhiteSpace($, element){
  return $(element).contents().map((_, el) => {
    if ($(el).children().length > 0) {
        return getTextWithSpaces($(el)); // Appel récursif
    }
    return $(el).text();
  }).get().join(' ');
  // return $(tag).contents().map((_, el) => $(el).text()).get().join(' ');
}

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
      for (let i = 0; i <= tagList.length - 1; i++) {
        if (tagList[i] === ''){
          if (eventTag){
            // string += ' ' + $subEv.text();
            string += ' ' + textWithWhiteSpace($, eventTag);
          }else{
            // string += ' ' + $.text();
            string += ' ' + textWithWhiteSpace($, '');
          }
            
        }else{
          if (eventTag){
            $subEv.find(tagList[i]).each((index, descendant) => {
              // string += ' ' + $(descendant).text();
              string += ' ' + textWithWhiteSpace($, descendant);
            });
          }else{
            $(tagList[i]).each((index, element) => {
              // string += ' ' +  $(element).text();
              string += ' ' + textWithWhiteSpace($, element);
            });
            
          }
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


// get info from the event block. for each key, if key already exists in eventInfo, append the info to eventInfo[key], otherwise 
// create a new entry. Keys such as eventPlaceTags or eventURLTags should not be appended, the value in eventInfo should be overwritten instead
// 'Multi' tags should not have an existing value, so there is no need to test if there is something to append
// overwrite = true may be used when using linked pages, to overwrite stuff already from the main page

function getInfo(venueTags, $, eventInfo = {}, overwrite = false) {

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
        eventInfo[newKey] = (eventInfo[newKey] || '') + getText(key, venueTags, $).trim();
      }
    });


  // *** find sub events and extract data ***/
  const multiTags = Object.keys(venueTags).filter(key => key.includes('Multi'));

  let subEvents = [];
  if (multiTags.length !== 0) {// stop here if there is no sub event
    let subEventDelimiterPath = venueTags[multiTags[0]][0];

    while (multiTags.flatMap(key => venueTags[key])
      .some(tagPath => !tagPath.startsWith(subEventDelimiterPath))) {
      if (!subEventDelimiterPath.includes('>')) {
        console.log('Warning, unexpected error. Tag ' + subEventDelimiterPath + ' does not contain \'>\'');
        break;
      }
      subEventDelimiterPath = subEventDelimiterPath.replace(/>[^>]*$/, '');
    }

    // console.log(subEventDelimiterPath);
    // browse sub events and return a json object containing sub event infos and url
    $(subEventDelimiterPath).each((index, element) => {
      let subEventInfo = {};
      multiTags.forEach(key => {
        subEventInfo[key.replace('Tags','').replace('Multi','')] = getText(key, venueTags, $, subEventDelimiterPath, element);
      });
      subEvents.push(subEventInfo);
      // hrefInDelimiterList.push($(venue.eventsDelimiterTag+':eq('+index+')').attr('href'));
    });
    eventInfo.subEvents = subEvents;
  }
}

  
