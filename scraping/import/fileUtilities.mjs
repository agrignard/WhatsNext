/**************************************/
/*  utilities to deal with the files  */
/**************************************/

import * as fs from 'fs';
import {removeAccents, cleanPage, removeBlanks, extractBody} from './stringUtilities.mjs';

const scrapInfoFile = "./venuesScrapInfo.json"; // path should start from the directory of the calling script
export const venuesListJSONFile = "./venues.json";
const styleConversionFile = "./import/styleConversion.json";

// fetch linked page
export async function fetchLink(page, nbFetchTries){
    try{
        const content = await fetchWithRetry(page, nbFetchTries, 2000);
        return extractBody(removeBlanks(cleanPage(content)));
    }catch(err){
        console.log("\x1b[31mNetwork error, cannot download \'%s\'.\x1b[0m",page);
    }
}
  
function fetchWithRetry(page, tries, timeOut) {
    return fetchAndRecode(page)
        .catch(error => {
        if (tries > 1){
            console.log('Download failed (%s). Trying again in %ss (%s %s left).',page,timeOut/1000,tries-1,tries ===2?'attempt':'attempts');
            return new Promise(resolve => setTimeout(resolve, timeOut))
            .then(() => fetchWithRetry(page,tries-1,timeOut));
        }else{
            console.log('Download failed (%s). Aborting (too many tries).',page);
            throw error;
        }
    });
}

// get the style conversion JSON
export async function getStyleConversions(){
    try{
        const res = await JSON.parse(await fs.promises.readFile(styleConversionFile, 'utf8'));
        Object.keys(res).forEach(key =>{
            res[key] = res[key].map(val => removeAccents(val.toLowerCase()));
        });
        return res;
    }catch(err){
        console.log('\x1b[36mWarning: cannot open style conversion file JSON file:  \'%s\'.\x1b[0m%s\n',styleConversionFile,err);
    }
}

export async function getStyleList(){
    try{
        const res = await JSON.parse(await fs.promises.readFile(styleConversionFile, 'utf8'));
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

// fetch url and fix the coding when it is not in UTF-8
export async function fetchAndRecode(url){
    try{
        const response = await fetch(url);
        const encoding = response.headers.get('content-type').split('charset=')[1]; // identify the page encoding
        if (encoding === 'utf-8'){// || encoding ==='UTF-8'){
            //console.log('UTF8');
            return await response.text();
        }else{
            try{
                //console.log('Page encoding: ',encoding);
                const decoder = new TextDecoder(encoding); // convert to plain text (UTF-8 ?)
                return  response.arrayBuffer().then(buffer => decoder.decode(buffer));
            }catch(err){
                console.log('Decoding problem while processing %s. Error: %s',url,err);
                throw err;
            }
        }
    }catch(error){
        throw error;
    }
}


// load linked files (subpages with more details about the event)
export async function loadLinkedPages(sourcePath){
    try{
        return JSON.parse(await fs.promises.readFile(sourcePath+'linkedPages.json', 'utf8'));
    }catch(err) {
        console.error("\x1b[31mError while retrieving linked pages: %s\x1b[0m\n",sourcePath+'linkedPages.json');
        throw err;
    }
}

// load file that contains scrap info 'venuesScrapInfo.json'
async function loadScrapInfoFile(){
    try{
        return JSON.parse(await fs.promises.readFile(scrapInfoFile, 'utf8'));
    }catch(err) {
        console.error("\x1b[31mError loading scrap info file: \'%s\'\x1b[0m\n. Aborting process",scrapInfoFile);
        throw err;
    }
}

// load file that contains scrap info 'venuesScrapInfo.json', and return scrap info only for venue venueName
export async function loadVenueScrapInfofromFile(venueName){
    let scrapInfo = await loadScrapInfoFile();
    try{
        return scrapInfo[venueName];
    }catch(err) {
        console.error("\x1b[31m  Cannot find venue \x1b[0m\'%s\'\x1b[31m in file :%s\x1b[0m\n",venueToAnalyse,scrapInfoFile);
        throw err;
    }
}

// load venue JSON 'venues.json'
export async function loadVenuesJSONFile(){
    try{
        return await JSON.parse(await fs.promises.readFile(venuesListJSONFile, 'utf8'));
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


export function saveToJSON(fileName,data){
    try{
        const jsonString =  JSON.stringify(data, null, 2);  
        fs.writeFileSync(fileName, jsonString);
      }catch(err){
          console.log('\x1b[31mError saving to \'%s\': \x1b[0m%s',fileName,err);
      }
} 