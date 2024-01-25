import * as fs from 'fs';

const scrapInfoFile = "./venuesScrapInfo.json"; // path should start from the directory of the calling script
export const venuesListJSONFile = "./venues.json";
const unlistedVenuesFile = "./unlistedVenues.json";

// fetch url and fix the coding
export async function fetchAndRecode(url){
    try{
        const response = await fetch(url);
        const encoding = response.headers.get('content-type').split('charset=')[1];
        if (encoding === 'utf-8'){
            return await response.text();
        }else{
            try{
                const decoder = new TextDecoder(encoding);
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

export async function loadUnlistedVenues(){
    try{
        return JSON.parse(await fs.promises.readFile(unlistedVenuesFile, 'utf8'));
    }catch(err) {
        console.error("\x1b[31mError while loading unlisted venues.\x1b[0m\n");
        throw err;
    }
}

// load linked files
export async function loadLinkedPages(sourcePath){
    try{
        return JSON.parse(await fs.promises.readFile(sourcePath+'linkedPages.json', 'utf8'));
    }catch(err) {
        console.error("\x1b[31mError while retrieving linked pages: %s\x1b[0m\n",sourcePath+'linkedPages.json');
        throw err;
    }
}

// load scrap info file
async function loadScrapInfoFile(){
    try{
        return JSON.parse(await fs.promises.readFile(scrapInfoFile, 'utf8'));
    }catch(err) {
        console.error("\x1b[31mError loading scrap info file: \'%s\'\x1b[0m\n. Aborting process",scrapInfoFile);
        throw err;
    }
}

export async function loadVenueScrapInfofromFile(venueName){
    let scrapInfo = await loadScrapInfoFile();
    try{
        return scrapInfo[venueName];
    }catch(err) {
        console.error("\x1b[31m  Cannot find venue \x1b[0m\'%s\'\x1b[31m in file :%s\x1b[0m\n",venueToAnalyse,scrapInfoFile);
        throw err;
    }
}

// load venue JSON

export async function loadVenuesJSONFile(){
    try{
        return await JSON.parse(await fs.promises.readFile(venuesListJSONFile, 'utf8'));
    }catch(err) {
        console.error('\x1b[36mCannot open venues JSON file:  \'%s\'\x1b[0m%s\n',venuesListJSONFile,err);
        throw err;
    }
}

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

