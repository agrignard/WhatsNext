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


module.exports = {getText};


    
// auxiliary function to extract data. For a given tagName, get the list of tags from JSONBlock (mainPage
// or linkedPage and return the corresponding text)
// if multiple events are defined, 
function getText(tagName,JSONblock,source){
    let string = "";
    const tagList = JSONblock[tagName];
    // if (tagName !== 'eventMultiDateTags'){
    if (!tagName.includes('Multi')){
      try{
        for (let i = 0; i <= tagList.length-1; i++) {
          let ev = tagList[i]===''?source.text():source(tagList[i]).text();
          string += ev+' ';
        }
      }catch(err){
        console.log('\x1b[31m%s\x1b[0m', 'Erreur d\'extraction à partir des balises.\x1b[0m',tagList);
      }
      return removeBlanks(string);
    }else{
      const res = source(tagList[0]).map((index, element) => source(element).text()).get();
      return res;
    }
 }

  