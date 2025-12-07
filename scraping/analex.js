const {simplify} = require('./import/stringUtilities.js');
// const {loadLinkedPages, getFilesContent} = require('./import/fileUtilities.js');
const {loadVenueScrapInfofromFile, loadVenuesJSONFile, checkLanguages} = require('./import/jsonUtilities.js');
const {analyze} = require('./import/analexUtilities.js');

module.exports = {analyze};

const fs = require('fs');
const cheerio = require('cheerio');


const sourcePath = './webSources/';

// load venues json list
let venuesListJSON = loadVenuesJSONFile();

const venueID = IDFromArguments(process.argv);
const matchingVenues = venuesListJSON.filter(el => simplify(el.ID).startsWith(simplify(venueID)));

if (matchingVenues.length === 0){
    console.log("No venue matching arguments");
}else if (matchingVenues.length > 1){
    console.log("Too many venues match arguments:");
    matchingVenues.forEach(el =>console.log("%s (%s, %s)",el.name,el.city,el.country));
}else{
    console.log('Venues found: '+matchingVenues.length);
    let eventStrings = loadVenueScrapInfofromFile(matchingVenues[0].ID);
//    analyze(matchingVenues[0], sourcePath, venuesListJSON);
   analyze(matchingVenues[0], eventStrings, sourcePath, venuesListJSON);
   console.log("\n\n");
   checkLanguages([matchingVenues[0]]);
}





//************************************************/
//               Auxiliary functions             //
//************************************************/








function IDFromArguments(args){
    args = args.slice(2).map(el => el.toLowerCase()); 
    if (args.length > 3){
      console.log(args.length);
      console.log("\x1b[31mError: too many arguments\x1b[0m");
      args = ['--help'];
    }
    if (args.length === 0){
        console.log("\x1b[31mError: not enough arguments\x1b[0m");
        args = ['--help'];
      }
    if (args.some(arg => arg === '--help')){
        console.log('\nSyntax: node ./analex [\x1b[32msource_name\x1b[0m] '+
                    '[\x1b[32mcity\x1b[0m \x1b[90m(optional)\x1b[0m] '+
                    '[\x1b[32mcountry\x1b[0m \x1b[90m(optional)\x1b[0m]\n'+
                    'This will analyse the website with the corresponding name/city/country.\n'+
                    'Only one venue should correspond to the arguments. Use the optional arguments to ensure that the venue is unique');
        return undefined;
    }else{
        return args.join('|');
    }
}