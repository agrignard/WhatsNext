/**************************************/
/*          reparatorex.js            */
/**************************************/
// to fix event errors due to download errors

const fs = require('fs');
const {loadLinkedPages,fetchLink} = require('./import/fileUtilities.js');
const {loadVenuesJSONFile,getSource,jsonRemoveDouble,samePlace, loadErrorLog} = require('./import/jsonUtilities.js');

const webSourcesPath = './webSources/';
const errorLogFile = './generated/errorLog.json';
const nbFetchTries = 2;


// load error JSON

let eventList = loadErrorLog(errorLogFile);


console.log("\n\x1b[36m***********************************************************************************");
console.log("REPARATOREX will try to fix some errors");
console.log("***********************************************************************************\x1b[0m\n");


// load venues file

let venues = loadVenuesJSONFile();

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
        console.log("\n\x1b[31mDownloads failed: \x1b[0m%s/%s\x1b[31m for venue %s (%s, %s). Run again \'reparatorex\' (you main run \'scrapex\' once before in order to purge error log).\n\x1b[0m",
            failedDownloads,LPElist.length,venue.name,venue.city,venue.country);
    }
    // modify linkedPages.json to add the downloaded files
    const path = webSourcesPath+venue.country+'/'+venue.city+'/'+venue.name+'/';
    if (!fs.existsSync(path+'linkedPages.json')){
        console.log('\x1b[31mError, file \'linkedPages.json\' is missing for venue %s (%s, %s). No fix can be done.\x1b[0m.',venue.name,venue.city,venue.country);
    }else{
        const linkedFileContent = loadLinkedPages(path);
        eventList.forEach((el,index) => linkedFileContent[el.eventURL]=linkedPagesList[index]);
        try{
            const jsonString = JSON.stringify(linkedFileContent, null, 2); 
            fs.writeFileSync(path+'linkedPages.json', jsonString);
            console.log('Replaced/added %s event linked pages for venue %s (%s, %s)',eventList.length,venue.name,venue.city,venue.country);
        }catch(err){
            console.log('\x1b[31mCannot save event linked pages to \'linkedPages.json\' for venue %s (%s, %s): \x1b[0m%s',venue.name,venue.city,venue.country,err);
        }
        
    }
}

