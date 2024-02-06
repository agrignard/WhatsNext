/**************************************/
/*          reparatorex.js            */
/**************************************/
// to fix event errors due to download errors

import * as fs from 'fs';
import {loadVenuesJSONFile,loadLinkedPages,fetchLink} from './import/fileUtilities.mjs';
import {getSource,jsonRemoveDouble,samePlace} from './import/jsonUtilities.mjs';


const webSourcesPath = './webSources/';
const errorLogFile = './generated/errorLog.json';
const nbFetchTries = 2;


// load error JSON

let eventList;
try{
    eventList = await JSON.parse(await fs.promises.readFile(errorLogFile, 'utf8'));
}catch(err) {
    console.error('\x1b[36mCannot open error log file:  \'%s\'\x1b[0m%s\n',errorLogFile,err);
    throw err;
}

console.log("\n\x1b[36m***********************************************************************************");
console.log("REPARATOREX will try to fix some errors");
console.log("***********************************************************************************\x1b[0m\n");


// load venues file

let venues = await loadVenuesJSONFile();

function hasLinkedPage(venue){
    const v = venues.find(el => el.name === venue.source.name && el.city === venue.source.city && el.country === venue.source.country);
    return v.hasOwnProperty('linkedPage');
}


// processing linked page errors
const LPElist = eventList.filter(el => hasLinkedPage(el));

console.log("REPARATOREX will try to fix %s errors by redownloading the linked pages.",LPElist.length);
let venuesToFix = jsonRemoveDouble(LPElist.map(el => getSource(el)));

venuesToFix.forEach(venue =>{
    fixVenue(venue,LPElist.filter(el => samePlace(getSource(el),venue)));
});


async function fixVenue(venue,eventList){
    // re-download links
    const linkedPagesList = (await Promise.all(eventList.map(el => fetchLink(el.eventURL,nbFetchTries))));
    const failedDownloads = linkedPagesList.reduce((acc, value) => {
        return acc + (value === undefined ? 1 : 0);
    }, 0);
    if (failedDownloads>0){
        console.log("\n\x1b[31mDownloads failed: \x1b[0m%s/%s\x1b[31m for venue %s. Run again \'reparatorex\' (you main run \'scrapex\' once before in order to purge error log).\n\x1b[0m",failedDownloads,LPElist.length,venue.name);
    }
    // modify linkedPages.json to add the downloaded files
    const path = webSourcesPath+venue.country+'/'+venue.city+'/'+venue.name+'/';
    if (!fs.existsSync(path+'linkedPages.json')){
        console.log('\x1b[31mError, file \'linkedPages.json\' is missing for venue %s. No fix can be done.\x1b[0m.',venue.name);
    }else{
        const linkedFileContent = await loadLinkedPages(path);
        eventList.forEach((el,index) => linkedFileContent[el.eventURL]=linkedPagesList[index]);
        try{
            const jsonString = JSON.stringify(linkedFileContent, null, 2); 
            fs.writeFileSync(path+'linkedPages.json', jsonString);
            console.log('Replaced/added %s event linked pages for venue %s',eventList.length,venue.name);
        }catch(err){
            console.log('\x1b[31mCannot save event linked pages to \'linkedPages.json\' for venue %s: \x1b[0m%s',venue.name,err);
        }
        
    }
}

