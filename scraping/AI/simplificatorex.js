/**************************************/
/*          simplificatorex.js            */
/**************************************/
// clean html file to keep minimal information to avoid token limitation when processing

const rootPath = '..'
const fs = require('fs');
// const {removeDoubles, makeURL, cleanPage, extractBody} = require('./import/stringUtilities.js');
const {loadLinkedPages,getVenuesFromArguments,minimalizeHtmlFile} = require(rootPath+'/import/fileUtilities.js');
const {loadVenuesJSONFile, saveToVenuesJSON, isAlias, initializeVenue} = require(rootPath+'/import/jsonUtilities.js');
// const {getURLListFromPattern} = require('./import/dateUtilities.js');
// const cheerio = require('cheerio');

//const {parseDocument} =require('htmlparser2');

const sourcePath = rootPath+'/webSources/';
const outputPath = rootPath+'/AI/webSources/'
const venueList = loadVenuesJSONFile();


let venues = venueList;
if (process.argv.length >2){
    venues = getVenuesFromArguments(process.argv, venueList); // venueList is kept to allow finding matches with event places
}
venues.filter(el => !isAlias(el));

//console.log(venues);

venues.forEach(el => {
    // open hmtl files corresponding to the venue
    const venueSourcePath = sourcePath+el.country+'/'+el.city+'/'+el.name+'/';
    const venueOutputPath = outputPath+el.country+'/'+el.city+'/'+el.name+'/';
    let inputFileList;
    try {
        inputFileList = fs.readdirSync(venueSourcePath)
        .filter(fileName => fileName.endsWith('.html'));
      //  console.log(inputFileList);
        inputFileList.forEach(element => {
            minimalizeHtmlFile(element, venueSourcePath, venueOutputPath);
        });
            
    } catch (err) {
        console.error('\x1b[31mError reading html files in directory \'%s\'.\x1b[0m Error: %s',sourcePath, err);
    }
});

