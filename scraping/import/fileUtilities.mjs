/**************************************/
/*  utilities to deal with the files  */
/**************************************/

import * as fs from 'fs';

const scrapInfoFile = "./venuesScrapInfo.json"; // path should start from the directory of the calling script
export const venuesListJSONFile = "./venues.json";

// return a list of json object with aliases to change the place name
export function getAliases(list){
    return list.filter(el => el.hasOwnProperty('aliases'))
    .map(el => {
      const res = {};
      res.country = el.country;
      res.city = el.city;
      res.name = el.name;
      res.aliases = el.aliases;
      return res;
    });
}

// fetch url and fix the coding when it is not in UTF-8
export async function fetchAndRecode(url){
    try{
        const response = await fetch(url);
        const encoding = response.headers.get('content-type').split('charset=')[1]; // identify the page encoding
        if (encoding === 'utf-8'){
            return await response.text();
        }else{
            try{
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

// not useful anymore. To be removed
// async function loadUnlistedVenues(){
//     try{
//         return JSON.parse(await fs.promises.readFile(unlistedVenuesFile, 'utf8'));
//     }catch(err) {
//         console.error("\x1b[31mError while loading unlisted venues.\x1b[0m\n");
//         throw err;
//     }
// }

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

