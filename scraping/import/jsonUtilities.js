/**********************************************************/
/*    utilities to deal with json objects and files for   */
/*    venues, events, style                               */
/**********************************************************/

const path = require('path');
const fs = require('fs');
const {removeAccents, removeDoubles, simplify} = require('./stringUtilities.js');
const {getDateConversionPatterns, dateConversionFile} = require('./dateUtilities.js');

const rootDirectory = path.resolve('.').match(/.*scraping/)[0]+'/';
const venuesListJSONFile = rootDirectory+"/venues.json";
const scrapInfoFile = rootDirectory+"/venuesScrapInfo.json"; // path should start from the directory of the calling script
const styleConversionFile = rootDirectory+"/import/styleConversion.json";
const cancellationKeywordsJSONFile = rootDirectory+"/import/cancellationKeywords.json";
//const languagesFile = "./import/languages.json";
//const languagesFile = "D:\\Travail\\Github\\Shared Projects\\WhatsNext\\scraping\\import\\languages.json";
const languagesFile = rootDirectory+'import/languages.json';

module.exports = {venuesListJSONFile, isAlias, geAliasesToURLMap, getEventPlace, getSource,
    fromLocalSource, jsonRemoveDouble, samePlace, getStyleConversions, getStyleList, getAliases,
    writeToLog, loadVenueScrapInfofromFile, loadVenuesJSONFile, loadVenueJSON, saveToVenuesJSON,
    getLanguages, loadCancellationKeywords, fromLanguages, checkLanguages, loadErrorLog, 
    getAvailableLanguages, initializeVenue, getNameFromID, makeID, loadScrapInfoFile, saveToScrapInfoJSON,
    unique, isValidEvent};

// test if an event has a name or a date if required by scrapping
// it takes into account that for some websites, the date or the name may not be scrapped from the main page
function isValidEvent(event, venue){
    if (venue.mainPage.hasOwnProperty('eventNameTags')){
        if (!event.hasOwnProperty('eventName') || event.eventName === undefined || /^\s*$/.test(event.eventName)){
            return false;
        }
    }
    if (venue.mainPage.hasOwnProperty('eventDateTags')){
        if (!event.hasOwnProperty('eventDate') || event.eventDate === undefined || /^\s*$/.test(event.eventDate)){
            return false;
        }
    }
    return true;
}

// remove doubles from a list of json objects
function unique(list) {
    const uniqueSet = new Set(list.map(obj => JSON.stringify(obj)));
    return Array.from(uniqueSet).map(str => JSON.parse(str));
}

// returns true is a venue is only an alias (not for scrapping)
function isAlias(venue){
    return !venue.hasOwnProperty('url') || !venue.hasOwnProperty('mainPage');
}

// provide a map between places and URLs, for aliases places which have a declared URL
function geAliasesToURLMap(){
    return loadVenuesJSONFile().filter(el => isAlias(el) && el.hasOwnProperty('url'));
}

// returns the venue (name, city, country) of an object
function getEventPlace(object){
    return {'name':object.eventPlace, 'city':object.source.city, 'country':object.source.country};
}

// returns the source (website from which the event was scrapped)
function getSource(event){
    return event.source;
}

// test if the event has been scraped from a local source (web site scraped and event place are the same)
function fromLocalSource(event){
    return event.eventPlace === event.source.name;
}

// test if two JSON object have exactly the same key:value pairs
function isEqual(object1, object2) {
    const keyList = Object.keys(object1);
    if (keyList.length != Object.keys(object2).length){
        return false;
    }
    return keyList.every(key => object1[key] === object2[key]);
}

// return a list without duplicates
function jsonRemoveDouble(objectList) {
    const ListWithoutDuplicates = [];
    for (const object of objectList) {
        if (!ListWithoutDuplicates.some(item => isEqual(object, item))) {
            ListWithoutDuplicates.push(object);
        }
      }
   return ListWithoutDuplicates;
}

// tests if two objects are at the same place. Objects could be venues or events
function samePlace(p1,p2){
    let p1name, p2name;
    if (p1.hasOwnProperty('eventPlace')){
        p1name = p1.eventPlace;
    }else if (p1.hasOwnProperty('name')){
        p1name = p1.name;
    }
    if (p2.hasOwnProperty('eventPlace')){
        p2name = p2.eventPlace;
    }else if (p2.hasOwnProperty('name')){
        p2name = p2.name;
    }
    return simplify(p1name) === simplify(p2name) && p1.city === p2.city && p1.country === p2.country;
}


// get the style conversion JSON
function getStyleConversions(){
    try{
        const res = JSON.parse(fs.readFileSync(styleConversionFile, 'utf8'));
//        const res = await JSON.parse(await fs.promises.readFile(styleConversionFile, 'utf8'));
        Object.keys(res).forEach(language =>{
            Object.keys(res[language]).forEach(key =>{
                res[language][key] = res[language][key].map(val => removeAccents(val.toLowerCase()));
            });
        });
        return res;
    }catch(err){
        console.log('\x1b[36mWarning: cannot open style conversion file JSON file:  \'%s\'.\x1b[0m%s\n',styleConversionFile,err);
    }
}
// get the default styles and their aliases
function getStyleList(){
    try{
        const res = JSON.parse(fs.readFileSync(styleConversionFile, 'utf8'));
        const language = Object.keys(res)[0];
        return Object.keys(res[language]);
    }catch(err){
        console.log('\x1b[36mWarning: cannot open style conversion file JSON file:  \'%s\'.\x1b[0m%s\n',styleConversionFile,err);
    }
}

// return a list of json object with aliases to change the place name
function getAliases(list){
    return list
    .map(el => {
      const res = {};
      res.country = el.country;
      res.city = el.city;
      res.name = el.name;
      res.aliases = [el.name];
      if (el.hasOwnProperty('aliases')){
        res.aliases = res.aliases.concat(el.aliases);
      }
      return res;
    });
}

function writeToLog(type,eventInfo, messageList, display){
    if (['error','warning'].includes(type)){
        const key = type+'Log';
        let string = messageList[0];
        
        for(let i=1;i<messageList.length;i++){
          string = string.replace('%s',messageList[i]);
        }
        if (display){
            console.log(string);
        }
        string = string.replace(/\x1b\[\d+m/g, ''); // remove color tags
        if (eventInfo.hasOwnProperty(key)){
          eventInfo[key] = eventInfo[key]+" | "+string;
        }else{
          eventInfo[key] = string;
        }
    }else{
        console.log('\x1b[31mError in \'writeToLog\'. Expected type \'error\' or \'warning\', but received %s.\x1b[0m',type)
    }
  
  }


  // load file that contains scrap info 'venuesScrapInfo.json'
function loadScrapInfoFile(){
    try{
        return JSON.parse(fs.readFileSync(scrapInfoFile, 'utf8'));
    }catch(err) {
        console.error("\x1b[31mError loading scrap info file: \'%s\'\x1b[0m\n. Aborting process",scrapInfoFile);
        throw err;
    }
}

// load file that contains scrap info 'venuesScrapInfo.json', and return scrap info only for venue venueName
function loadVenueScrapInfofromFile(venueName){
    let scrapInfo = loadScrapInfoFile();
    try{
        return scrapInfo[venueName];
    }catch(err) {
        console.error("\x1b[31m  Cannot find venue \x1b[0m\'%s\'\x1b[31m in file :%s\x1b[0m\n",venueToAnalyse,scrapInfoFile);
        throw err;
    }
}

// load venue JSON 'venues.json'
function loadVenuesJSONFile(){
    try{
        return JSON.parse(fs.readFileSync(venuesListJSONFile, 'utf8'));
    }catch(err) {
        console.error('\x1b[36mCannot open venues JSON file:  \'%s\'\x1b[0m%s\n',venuesListJSONFile,err);
        throw err;
    }
}

// load a JSON containing info and return the info only for venue venueName
function loadVenueJSON(id,venuesListJSON){
    const venueJSON = venuesListJSON.find(element => simplify(element.ID) === simplify(id));
    if (!venueJSON){
        console.error("\x1b[31mError venue info. Venue \'%s\' not found in %s\x1b[0m.\n Aborting process",venueName,venuesListJSONFile);
        throw err;
    }else{
        return venueJSON;
    }
}

// // load a JSON containing info and return the info only for venue venueName
// function loadVenueJSON(venueName,venuesListJSON){
//     const venueJSON = venuesListJSON.find(function(element) {
//         return element.name === venueName;
//     });
//     if (!venueJSON){
//         console.error("\x1b[31mError venue info. Venue \'%s\' not found in %s\x1b[0m.\n Aborting process",venueName,venuesListJSONFile);
//         throw err;
//     }else{
//         return venueJSON;
//     }
// }

function saveToScrapInfoJSON(jsonList){
    try{
        const jsonString = JSON.stringify(jsonList, null, 2); 
        fs.writeFileSync(scrapInfoFile, jsonString);
        console.log('Saved to in %s',scrapInfoFile);
    }catch(err){
        console.log('\x1b[31mError saving to .json: \'%s\' %s\x1b[0m',scrapInfoFile,err);
    }
}

function saveToVenuesJSON(jsonList){
    try{
        const jsonString = JSON.stringify(jsonList, null, 2); 
        fs.writeFileSync(venuesListJSONFile, jsonString);
        console.log('Saved to in %s',venuesListJSONFile);
    }catch(err){
        console.log('\x1b[31mError saving to .json: \'%s\' %s\x1b[0m',venuesListJSONFile,err);
    }
}

function getLanguages(){
    try{
        return JSON.parse(fs.readFileSync(languagesFile, 'utf8'));
    }catch(err) {
        console.error('\x1b[36mCannot open languages JSON file:  \'%s\'\x1b[0m%s\n',languagesFile,err);
    }
    
    
}

// this function is supposed to be multi-languages proof
function loadCancellationKeywords(){
    try{
        const languages = getLanguages();
        const cancellationKeywords = JSON.parse(fs.readFileSync(cancellationKeywordsJSONFile, 'utf8'));
        function getKeywords(language){
            if (Object.keys(cancellationKeywords).includes(language)){
                return cancellationKeywords[language].map(el => simplify(el));
            }else{
                console.log("\x1b[36mWarning, no cancellation keywords defined for language %s. Add it to \'import\\cancellationKeywords.json\'\x1b[0m", language);
                return [];
            }
        }
        const res = {};
        Object.keys(languages).forEach(country => {
            res[country] = languages[country].map(language => getKeywords(language)).flat();
        });
        return res;
    }catch(err) {
        console.error('\x1b[36mCannot open cancellation keywords JSON file:  \'%s\'\x1b[0m%s\n',cancellationKeywordsJSONFile,err);
    }
}


function fromLanguages(jsonObject, languages){
    const res = {};
    Object.keys(jsonObject).filter(language => languages.includes(language))
    .forEach(language => {
        Object.keys(jsonObject[language]).forEach(key =>{
            res[key] = res.hasOwnProperty(key)?res[key].concat(jsonObject[language][key]):jsonObject[language][key];
        });
    }); 
    return res;
}

function checkLanguages(venues){
    let showMessage = false;
    const countriesToLanguages = getLanguages();
    const languages = removeDoubles(venues.map(el => countriesToLanguages[el.country]).flat());
    const styleLanguages = Object.keys(getStyleConversions());
    languages.filter(language => !styleLanguages.includes(language))
    .forEach(language =>{
        showMessage = true;
        console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m not defined for \x1b[0mstyles\x1b[31m. Update '%s\'.\x1b[0m", language, styleConversionFile)
    });
    const dateLanguages = Object.keys(getDateConversionPatterns());
    languages.filter(language => !dateLanguages.includes(language))
    .forEach(language =>{
        showMessage = true;
        console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m not defined for \x1b[0mdates\x1b[31m. Update '%s\'.\x1b[0m", language, dateConversionFile)
    });
    const cancellationLanguages = Object.keys(getDateConversionPatterns());
    languages.filter(language => !cancellationLanguages.includes(language))
    .forEach(language =>{
        showMessage = true;
        console.log("\x1b[31mLanguage \x1b[0m%s\x1b[31m not defined for \x1b[0mcancellation keywords\x1b[31m. Update '%s\'.\x1b[0m", language, dateConversionFile)
    });
    if (showMessage){
        console.log('Fix languages issues then run script again.\n');
    }
}

// load events JSON from error log
function loadErrorLog(errorLogFile){
    try{
        eventList = JSON.parse(fs.readFileSync(errorLogFile, 'utf8'));
    }catch(err) {
        console.error('\x1b[36mCannot open error log file:  \'%s\'\x1b[0m%s\n',errorLogFile,err);
        throw err;
    }
    return eventList;
}

// languages are available if they are defined in at least dateConversion and style conversion
function getAvailableLanguages(){
    const res = Object.keys(getDateConversionPatterns()).filter(lang =>
        Object.keys(getStyleConversions()).includes(lang)
    );
    return res;
}

function makeID(venue){
    if (!venue.hasOwnProperty('country') || !venue.hasOwnProperty('city')){
        console.log('\x1b[31mError: venue \x1b[0m%s\x1b[31m has no country and/or city defined.',venue.name);
    }else{
        venue.ID = venue.name+'|'+venue.city+'|'+venue.country;
    } 
}

function getNameFromID(ID){
    return ID.replace(/\|.*?\|.*?$/,'');

}

// add keys ID and baseURL to new venue
function initializeVenue(venue, outputPath){
    if (!venue.hasOwnProperty('country') || !venue.hasOwnProperty('city')){
        console.log('\x1b[31mError: venue \x1b[0m%s\x1b[31m has no country and/or city defined.',venue.name);
    }else{
        if (!venue.hasOwnProperty('ID')){
            console.log('Initializing new venue %s',venue.name);
            venue.ID = makeID(venue);
        }
        if (!isAlias(venue)){
            // initializes base url
            const url = new URL(venue.url);
            venue.baseURL = url.origin + url.pathname.replace(/\/[^\/]+$/, '/');
            // initializes directory for storage
            const path = outputPath+venue.country+'/'+ venue.city+'/'+venue.name+'/';
            if (!fs.existsSync(path)){
              fs.mkdirSync(path);
            }
        }
    } 
}