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
    // const question = 'Why is the sky blue?' ;
    // const question = 'Voici un code html:\n\n'
    //     + content
    //     + '\n\nPeux-tu lister l\'intégralité les événements dont on connaît la date ? Il ne doit pas manquer d\'événement. ' 
    //     // + 'Renvoie le résultat sous la forme d\'un json et uniquement d\'un json, sans commentaire ni avant, ni après?'
    //     + 'Renvoie le résultat sous la forme d\'un json'
    //     + 'Je veux les informations suivantes: nom, lieu, date, heure, prix, style,'
    //     + 'et lien url vers l\'événement'
    //     + 'Si un des champs n\'est pas spécifié, la valeur de l\'attribut sera \'\'.'
    //     + 'Les catégories json se nommeront respectivement '
    //     + ' eventName, eventPlace, eventDate, eventTime, price, style, eventURL.';

        const question = 'Voici un code html:\n\n'
        + content
        + '\n\nPeux-tu lister l\'intégralité des événements dont on connaît la date ?';
       // + ' Liste sous la forme: date, nom, lieu, heure, style, prix.'
        // +' Peux-tu ensuite convertir cette liste en json avec les champs nom, lieu, date, heure, prix, style ?';
    // console.log(content);

    // const conversationHistory = [];

    // const result = await askTheLlama(question,conversationHistory);
    const result = await askTheLlama(question);

    // const q2 = "Quels sont les événements qui restent ?";
    // const res2 = await askTheLlama(q2,conversationHistory);

    console.log('\n\nfin\n\n');
    console.log(result.message.content);
    
    
    // // console.log(result.response);
    // const cleanResult = result.message.content.replace(/^[^\[]*\[/,'\[').replace(/\][^\]]*$/,'\]');
    // // const cleanResult = result.response.replace(/^[^\[]*\[/,'\[').replace(/\][^\]]*$/,'\]');
    // console.log('\n\nsous forme JSON:\n\n');
    // const eventJSON = JSON.parse(cleanResult);

    // console.log(eventJSON);

    // console.log('\n\n\nEnsuite:\n\n\n');
    // console.log(res2);
}

// version with generate
// async function askTheLlama (question) {
//     const response = await ollama.generate({
//         model: 'llama3',
//         prompt: question,
//         max_tokens: 4000
//       });
//     // for await (const part of response) {
//     //   process.stdout.write(part.message.content)
//     // }
//     return response;
// }

// version with chat and history
// async function askTheLlama (question,conversationHistory) {
//     const message = { role: 'user', content: question};
//     conversationHistory.push(message);
//     const response = await ollama.chat({ 
//         model: 'llama3', 
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

// version with chat
async function askTheLlama (question) {
    const message = { role: 'user', content: question}
    const response = await ollama.chat({ 
        model: 'llama3', 
        messages: [message], 
        stream: false, 
        max_tokens: 4000 })
    // for await (const part of response) {
    //   process.stdout.write(part.message.content)
    // }
    return response;
}

// const question = 'Voici un code html:\n\n'
//         + content
//         + '\n\nPeux-tu lister l\'intégralité les événements dont on connaît la date ? Il ne doit pas manquer d\'événement. ' 
//         // + 'Renvoie le résultat sous la forme d\'un json et uniquement d\'un json, sans commentaire ni avant, ni après?'
//         + 'Renvoie le résultat sous la forme d\'un json'
//         + 'Je veux les informations suivantes: nom, lieu, date, heure, prix, style,'
//         + 'et lien url vers l\'événement'
//         + 'Si un des champs n\'est pas spécifié, la valeur de l\'attribut sera \'\'.'
//         + 'Les catégories json se nommeront respectivement '
//         + ' eventName, eventPlace, eventDate, eventTime, price, style, eventURL.';

// function analyseContent(content){
//     sendRequest("Bonjour, pouvez-vous m'aider ?").then((reponse) => {
//         console.log("ChatGPT a répondu :", reponse);
//     });
// }


// async function sendRequest(message) {

//     const url = "https://api.openai.com/v1/chat/completions";

//     const headers = {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${API_KEY}`,
//     };

//     const body = {
//         model: "gpt-4", // Ou "gpt-3.5-turbo" selon votre besoin
//         messages: [{ role: "user", content: message }], // Message utilisateur
//         temperature: 0.7, // Facultatif : contrôle la créativité des réponses
//     };

//     try {
//         const response = await fetch(url, {
//           method: "POST",
//           headers: headers,
//           body: JSON.stringify(body),
//         });
    
//         if (!response.ok) {
//           throw new Error(`Erreur HTTP : ${response.status}`);
//         }
    
//         const data = await response.json();
//         console.log("Réponse de ChatGPT :", data.choices[0].message.content);
//         return data.choices[0].message.content;
//     } catch (error) {
//         console.error("Request error :", error);
//     }
    

// }