/**************************************/
/*          chatanalex.js            */
/**************************************/
// extract information using chatgpt

const rootPath = '..'

const fs = require('fs');
const { default: ollama } = require('ollama');


// const {removeDoubles, makeURL, cleanPage, extractBody} = require('./import/stringUtilities.js');
const {getVenuesFromArguments} = require(rootPath+'/import/fileUtilities.js');
const {loadVenuesJSONFile, saveToVenuesJSON, isAlias, initializeVenue} = require(rootPath+'/import/jsonUtilities.js');


const sourcePath = './webSources/';
const venueList = loadVenuesJSONFile();
const modelList = [ 'llama3', //0
                    'llama3.1:8b', //1
                    'llama3.3:70b',  //2
                    'deepseek-coder-v2', //3
                    'mistral-nemo' //4
                ]
const model = modelList[1];
const maxTokens = 128000;

console.log('\n\n*****************************************');
console.log('******** Using model '+model+' ********');
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
        + '\n\nPeux-tu trouver tous les événements contenus dans ce document ? Je ne veux garder que ceux dont la date est renseignée.';
        +' Présente les résultats sous la forme d\'une liste avec une ligne par événement qui contient dans l\'ordre suivant date, nom, lieu, heure, style et prix.';
        //' Présente les résultats sous la forme d\'un json avec pour chaque événement les champs suivants: nom, lieu, date, heure, prix, style.';

    // console.log(content);

    // const conversationHistory = [];

    // const result = await askTheLlama(question,conversationHistory);
    const result = await askTheLlama(question);

    // const q2 = "Quels sont les événements qui restent ?";
    // const res2 = await askTheLlama(q2,conversationHistory);

    console.log('\n\nSortie :\n\n');
    // console.log(result.message.content);
    console.log(result.response);
    
    // // console.log(result.response);
    // const cleanResult = result.message.content.replace(/^[^\[]*\[/,'\[').replace(/\][^\]]*$/,'\]');
    // const cleanResult = result.response.replace(/^[^\[]*\[/,'\[').replace(/\][^\]]*$/,'\]');
    // console.log('\n\nsous forme JSON:\n\n');
    // const eventJSON = JSON.parse(cleanResult);

    // console.log(eventJSON);

    // console.log('\n\n\nEnsuite:\n\n\n');
    // console.log(res2);
}

// version with generate
async function askTheLlama (question) {
    const response = await ollama.generate({
        model: model,
        prompt: question,
        stream: false,
        max_tokens: 4096,
        temperature: 0.0,
        // presence_penalty: 0.5,
        // frequency_penalty: 0.5
      });
    // for await (const part of response) {
    //   process.stdout.write(part)
    // }
    return response;
}

// version with chat and history
// async function askTheLlama (question,conversationHistory) {
//     const message = { role: 'user', content: question};
//     conversationHistory.push(message);
//     const response = await ollama.chat({ 
//         model: model, 
//         messages: conversationHistory, 
//         stream: false, 
//         max_tokens: 40000});
//     // for await (const part of response) {
//     //   process.stdout.write(part.message.content)
//     // };
//     const assistantMessage = { role: 'assistant', content: response.message.content };
//     conversationHistory.push(assistantMessage);
//     return response;
// }

// // version with chat
// async function askTheLlama (question) {
//     const message = { role: 'user', content: question}
//     const response = await ollama.chat({ 
//         model: model, 
//         messages: [message], 
//         stream: false, 
//         max_tokens: 128000})
//     // for await (const part of response) {
//     //   process.stdout.write(part.message.content)
//     // }
//     return response;
// }
