/**************************************/
/*          chatanalex.js            */
/**************************************/
// extract information using chatgpt

const rootPath = '..'

const fs = require('fs');
require('dotenv').config();
const { default: Anthropic } = require('@anthropic-ai/sdk');


// const {removeDoubles, makeURL, cleanPage, extractBody} = require('./import/stringUtilities.js');
const {getVenuesFromArguments, minimalizeHtml} = require(rootPath+'/import/fileUtilities.js');
const {loadVenuesJSONFile, saveToVenuesJSON, isAlias, initializeVenue, 
    getDateConversionPatterns, fromLanguages, getCommonDateFormats} = require(rootPath+'/import/jsonUtilities.js');
const {analyze} = require(rootPath+'/import/analexUtilities.js');
const {askClaude} = require(rootPath+'/import/aiUtilities.js');


const sourcePath = '../webSources/';
const venueList = loadVenuesJSONFile();

const maxTokens = 128000;

const notVenues = ['Shotgun','Infoconcert', 'Le Petit Bulletin', 'L\'agend\'arts', 'Ninkasi', 'Likdo'];
const knownStyle = ['concert','live','club','techno','jazz','rock','pop','classique','théâtre','conférence'];

console.log('\n\n******************************************');
console.log('********    Using model Claude    ********');
console.log('******************************************\n\n');
 

let venues = venueList;
if (process.argv.length >2){
    venues = getVenuesFromArguments(process.argv, venueList); // venueList is kept to allow finding matches with event places

    venues.filter(el => !isAlias(el));


    venues.forEach(el => {
        // open hmtl files corresponding to the venue
        const venueSourcePath = sourcePath+el.country+'/'+el.city+'/'+el.name+'/';
        let inputFileList;
        try {
            inputFileList = fs.readdirSync(venueSourcePath)
            .filter(fileName => fileName.endsWith('.html'));
        //  console.log(inputFileList);
            inputFileList.forEach(element => {
                let content = fs.readFileSync(venueSourcePath+element, 'utf-8');
                content = minimalizeHtml(content, 'text');
                // console.log(content);
                analyseContent(content, el);            
            });
                
        } catch (err) {
            console.error('\x1b[31mError reading html files in directory \'%s\'.\x1b[0m Error: %s',sourcePath, err);
        }
    });
}else{
    console.log("No input venue");
}

async function analyseContent(content, venue) {
    try {
        const isNotAVenue = notVenues.includes(venue.name);

        console.log('\x1b[36mLe chat\x1b[0m va analexer la page suivante: \x1b[36m'+venue.name+'\x1b[0m.'); 

        let loadingComplete = false;
        let dots = "";
        const interval = setInterval(() => {
            dots += ".";
            process.stdout.write(`\r\x1b[36mLe Chat\x1b[0m réfléchit${dots}`);
            if (loadingComplete){
                clearInterval(interval);
            }else{
                dots += ".";
                process.stdout.write(`\r\x1b[36mLe Chat\x1b[0m réfléchit${dots}`);
                if (dots.length > 10) {
                    dots = "            ";
                    process.stdout.write(`\r\x1b[36mLe Chat\x1b[0m réfléchit${dots}`);
                    dots = "";
                }
            }           
        }, 500);

        // // console.log('Is not a venue: ', isNotAVenue);
        const event = await extractEvent(content, isNotAVenue);
        // console.log(event);
        const eventJSON = JSON.parse(event);

        // const eventJSON = {
        //     name: [ 'mini club' ],
        //     date: [ 'vend. 31 jan.' ],
        //     style: [ 'Club' ],
        //     price: [],
        //     other: [ 'Sha Ru', 'Islyz', 'De Grandi' ]
        // };
        loadingComplete = true;
        console.log('\n\n\x1b[36mLe chat\x1b[0m a trouvé les informations suivantes:\n'); 
        console.log(eventJSON);

        const tmp = {
            eventNameStrings: eventJSON.name,
            eventDateStrings: eventJSON.date,
            eventStyleStrings: eventJSON.style
        }

        const scrapJSON = {
            mainPage: tmp,
        }
        console.log('\n\x1b[36mLe chat\x1b[0m commence à chercher les tags.\n'); 
        // console.log(scrapJSON);

        analyze(venue, scrapJSON, '../webSources/', venueList, false);

        console.log('\x1b[36mLe Chat\x1b[0m a fini d\'analexer ! Lancez scrapex pour vérifier qu\'il bien taffé.');
        
    } catch (error) {
        console.error('Erreur dans analyseContent:', error);
    }
}


async function extractEvent(text, isNotAVenue) {
    // const systemPrompt = "Provide the result as a json with fields name, date, style and text. Syntax must be exactly the same than in the document."
    //     +" The text is the exact copy of the block corresponding to the event in the document.";

    // const question = 'Voici un document d\'information sur des événements à venir:\n\n'
    //     + text
    //     + '\n\nPeux-tu trouver un événement contenu dans ce document ? Indentify les lignes qui correspondent à';

    const systemPrompt = "Provide the result as a json with fields name, date, style, price and other, with a list of strings for each field." 
    +" For each line of the event block in the document, add it the the most suitable field. Syntax must be exactly the same than in the document.\n"
    +"Only provide the json, with no comment before or after.";
    // +" The text is the exact copy of the block corresponding to the event in the document.";

    const question = 'Voici un document d\'information sur des événements à venir:\n\n'
    + text
    + '\n\nPeux-tu trouver un (et un seul) événement contenu dans ce document ? ';

    try {
        const result = await askClaude(question, systemPrompt);
        // console.log(result);
        return result;
    } catch (error) {
        console.error('Erreur lors de l\'extraction des concerts:', error);
        return [];
    }
}





