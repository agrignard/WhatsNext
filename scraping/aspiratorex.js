/**************************************/
/*          aspiratorex.js            */
/**************************************/
// download files and save them to local directory, including linkedPages if indicated


const fs = require('fs');
const {removeDoubles, makeURL, cleanPage, extractBody} = require('./import/stringUtilities.js');
const {loadLinkedPages,fetchAndRecode, fetchWithRetry, fetchLink,getVenuesFromArguments} = require('./import/fileUtilities.js');
const {loadVenuesJSONFile, saveToVenuesJSON, isAlias, initializeVenue} = require('./import/jsonUtilities.js');
const {getURLListFromPattern} = require('./import/dateUtilities.js');
const cheerio = require('cheerio');

const {downloadVenue, erasePreviousHtmlFiles} = require('./import/aspiratorexUtilities.js')
//module.exports = {downloadVenue, erasePreviousHtmlFiles};

const outputPath = './webSources/';
//const nbFetchTries = 2; // number of tries in case of internet connection time outs

const venues = loadVenuesJSONFile();
let log = '';

const filteredVenues = getVenuesFromArguments(process.argv, venues);

// initializes new venues
filteredVenues.forEach(venue => initializeVenue(venue, outputPath));

// const venueToDownload = process.argv[2];
// if (venueToDownload && typeof venueToDownload !== "string"){
//   throw new Error('Argument for this script should be a venue name (string)');
// }

console.log("\n\x1b[36m***********************************************************************************");
console.log("ASPIRATOREX IS SNIFFING SOURCES FILES contained in venues JSON file.");
console.log("***********************************************************************************\x1b[0m");

if (filteredVenues.length === 0){
  console.log("No place matching arguments.");
}else{
  filteredVenues.filter(obj => isAlias(obj)).forEach(el =>{
    let text = "Place "+el.name+" not processed (considered as alias: ";
    if (!el.hasOwnProperty('url') && !el.hasOwnProperty('mainPage')){
      text += "keys \'url\' and \'mainPage\'";
    }else if (!el.hasOwnProperty('url')) {
      text += "key \'url\' ";
    }else if (!el.hasOwnProperty('mainPage')) {
      text += "key \'scarp\' ";
    }
    text += " not defined in \'venue.json\')";
    console.log(text);
    log +=text;
  });
  // for non aliases venues
  filteredVenues.filter(obj => !isAlias(obj)).forEach((venue, index) => {
        // Afficher le numéro de l'objet
    console.log(`Venue ${index + 1}: \x1b[36m${venue.name} (${venue.city}, ${venue.country})\x1b[0m (${venue.url})`);
    let venueLog = 'Venue ${index + 1}: \x1b[36m${venue.name} (${venue.city}, ${venue.country})\n';
    try{
      // // update venue base URL in case of a change => now done in initializeVenue !
      // const url = new URL(venue.url);
      // venue.baseURL = url.origin + url.pathname.replace(/\/[^\/]+$/, '/');
      if (!venue.hasOwnProperty('country') || !venue.hasOwnProperty('city')){
        console.log('\x1b[31mError: venue \x1b[0m%s\x1b[31m has no country and/or city defined.',venue.name);
        venueLog += '\x1b[31mError: venue '+venue.name+' has no country and/or city defined.\x1b[0m';
      }else{
          let path = outputPath+venue.country+'/'+venue.city+'/'+venue.name+'/';
          erasePreviousHtmlFiles(path)
          .then(() => {
            downloadVenue(venue,path);
            venueLog += '\x1b[31mEssaid URL for '+venue.name+'.x1b[0m';
          })
      } 
    }catch(err){
      console.log('\x1b[31mCannot read URL for %s.x1b[0m', venue.name);
      venueLog += '\x1b[31mCannot read URL for '+venue.name+'.x1b[0m';
    }
  });
}



// save base URL to JSON file
saveToVenuesJSON(venues);// écrit à la fin. Problème de sauvegarde si un des fichiers a un pb ?
