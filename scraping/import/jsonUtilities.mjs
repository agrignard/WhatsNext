/**********************************************************/
/*    utilities to deal with json objects and files for   */
/*    venues, events, style                               */
/**********************************************************/

import * as fs from 'fs';
import {simplify} from './stringUtilities.mjs';
import {removeAccents, removeBlanks, extractBody} from './stringUtilities.mjs';

export const venuesListJSONFile = "./venues.json";
const scrapInfoFile = "./venuesScrapInfo.json"; // path should start from the directory of the calling script
const styleConversionFile = "./import/styleConversion.json";



// returns the venue (name, city, country) of an object
export function getEventPlace(object){
    return {'name':object.eventPlace, 'city':object.source.city, 'country':object.source.country};
}

// returns the source (website from which the event was scrapped)
export function getSource(event){
    return event.source;
}

// test if the event has been scraped from a local source (web site scraped and event place are the same)
export function fromLocalSource(event){
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
export function jsonRemoveDouble(objectList) {
    const ListWithoutDuplicates = [];
    for (const object of objectList) {
        if (!ListWithoutDuplicates.some(item => isEqual(object, item))) {
            ListWithoutDuplicates.push(object);
        }
      }
   return ListWithoutDuplicates;
}

// tests if two objects are at the same place. Objects could be venues or events
export function samePlace(p1,p2){
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
export function getStyleConversions(){
    try{
        const res = JSON.parse(fs.readFileSync(styleConversionFile, 'utf8'));
//        const res = await JSON.parse(await fs.promises.readFile(styleConversionFile, 'utf8'));
        Object.keys(res).forEach(key =>{
            res[key] = res[key].map(val => removeAccents(val.toLowerCase()));
        });
        return res;
    }catch(err){
        console.log('\x1b[36mWarning: cannot open style conversion file JSON file:  \'%s\'.\x1b[0m%s\n',styleConversionFile,err);
    }
}
// get the default styles and their aliases
export function getStyleList(){
    try{
     //   const res = await JSON.parse(await fs.promises.readFile(styleConversionFile, 'utf8'));
        const res = JSON.parse(fs.readFileSync(styleConversionFile, 'utf8'));
        return Object.keys(res);
    }catch(err){
        console.log('\x1b[36mWarning: cannot open style conversion file JSON file:  \'%s\'.\x1b[0m%s\n',styleConversionFile,err);
    }
}

// return a list of json object with aliases to change the place name
export function getAliases(list){
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

export function writeToLog(type,eventInfo, messageList, display){
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
export function loadVenueScrapInfofromFile(venueName){
    let scrapInfo = loadScrapInfoFile();
    try{
        return scrapInfo[venueName];
    }catch(err) {
        console.error("\x1b[31m  Cannot find venue \x1b[0m\'%s\'\x1b[31m in file :%s\x1b[0m\n",venueToAnalyse,scrapInfoFile);
        throw err;
    }
}

// load venue JSON 'venues.json'
export function loadVenuesJSONFile(){
    try{
        return JSON.parse(fs.readFileSync(venuesListJSONFile, 'utf8'));
    }catch(err) {
        console.error('\x1b[36mCannot open venues JSON file:  \'%s\'\x1b[0m%s\n',venuesListJSONFile,err);
        throw err;
    }
}

// load a JSON containing info and return the info only for venue venueName
export function loadVenueJSON(venueName,venuesListJSON){
    const venueJSON = venuesListJSON.find(function(element) {
        return element.name === venueName;
    });
    if (!venueJSON){
        console.error("\x1b[31mError venue info. Venue \'%s\' not found in %s\x1b[0m.\n Aborting process",venueName,venuesListJSONFile);
        throw err;
    }else{
        return venueJSON;
    }
}

export function saveToVenuesJSON(jsonList){
    try{
        const jsonString = JSON.stringify(jsonList, null, 2); 
        fs.writeFileSync(venuesListJSONFile, jsonString);
        console.log('Added to venues in %s',venuesListJSONFile);
    }catch(err){
        console.log('\x1b[31mError saving to .json: \'%s\' %s\x1b[0m',venuesListJSONFile,err);
    }
}
