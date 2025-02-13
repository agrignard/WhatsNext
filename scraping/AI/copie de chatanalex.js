/**************************************/
/*          chatanalex.js            */
/**************************************/
// extract information using chatgpt

const rootPath = '..'

require('dotenv').config();
const { default: Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
// const { default: ollama } = require('ollama');


const API_KEY = process.env.ANTHROPIC_KEY;


// const {removeDoubles, makeURL, cleanPage, extractBody} = require('./import/stringUtilities.js');
const {getVenuesFromArguments} = require(rootPath+'/import/fileUtilities.js');
const {loadVenuesJSONFile, saveToVenuesJSON, isAlias, initializeVenue} = require(rootPath+'/import/jsonUtilities.js');


const sourcePath = './webSources/';
const venueList = loadVenuesJSONFile();
// const modelList = [ 'llama3', //0
//                     'llama3.1:8b', //1
//                     'llama3.3:70b',  //2
//                     'deepseek-coder-v2', //3
//                     'mistral-nemo' //4
//                 ]
// const model = modelList[1];
// const maxTokens = 128000;

console.log('\n\n*****************************************');
console.log('********   Using model Claude   ********');
console.log('*****************************************\n\n');

//const API_KEY = 

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
                // console.log(content);
                analyseContent(content);
            });
                
        } catch (err) {
            console.error('\x1b[31mError reading html files in directory \'%s\'.\x1b[0m Error: %s',sourcePath, err);
        }
    });
}else{
    console.log("No input venue");
}

async function analyseContent(content){

    // const question = 'Voici un code html:\n\n'
    // + content
    // + '\n\nPeux-tu trouver tous les événements contenus dans ce code ?' 
    // + 'Je souhaite avoir le résultat sous forme de liste, avec les informations suivantes: nom, lieu, date, heure, prix, style,'
    // + 'et lien url vers l\'événement.';

    
    // const question = 'Voici un code html:\n\n'
    //     + content
    //     + '\n\nPeux-tu trouver tous les événements contenus dans ce code ?' 
    //     + 'Je souhaite avoir le résultat sous forme de liste, avec les informations suivantes: nom, lieu, date, heure, prix, style,'
    //     + 'et lien url vers l\'événement.';
    //     + 'Renvoie le résultat sous la forme d\'un json'
    //     + 'Je veux les informations suivantes: nom, lieu, date, heure, prix, style,'
    //     + 'et lien url vers l\'événement'
    //     + 'Si un des champs n\'est pas spécifié, la valeur de l\'attribut sera \'\'.'
    //     + 'Les catégories json se nommeront respectivement '
    //     + ' nom, lieu, date, heure, prix, style, url.';

        const question = 'Voici un document d\'information sur des événements à venir:\n\n'
        + content
        + '\n\nPeux-tu trouver tous les événements contenus dans ce document ?';
        // + ' Présente les résultats sous la forme d\'une liste avec une ligne par événement qui contient dans l\'ordre suivant date, nom, lieu, heure, style et prix.';
        // +' Présente les résultats sous la forme d\'un json avec pour chaque événement les champs suivants: nom, lieu, date, heure, prix, style.';

    // console.log(content);

    // const conversationHistory = [];

    // const result = await askTheLlama(question,conversationHistory);
    const result = await askClaude(question);

   

    console.log('\n\nSortie :\n\n');
    // console.log(result.message.content);
    // console.log(result.response);
    
    // // console.log(result.response);
    // const cleanResult = result.message.content.replace(/^[^\[]*\[/,'\[').replace(/\][^\]]*$/,'\]');
    const cleanResult = result.replace(/^[^\[]*\[/,'\[').replace(/\][^\]]*$/,'\]');
    console.log('\n\nsous forme JSON:\n\n');
    const eventJSON = JSON.parse(cleanResult);

    console.log(eventJSON);
}


async function askClaude(question) {
    const anthropic = new Anthropic({
        apiKey: API_KEY
    });

    const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        temperature: 0,
        system: "Provide the result as a json with fields name, place, date, time, style, price, url.",
        messages: [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": question
                    }
                ]
            }
        ]
    });
    console.log(msg);
    console.log("Request complete.\nstop reason: "+msg.stop_reason);
    console.log('Usage: '+msg.usage);
    return msg.content[0].text;
  }
