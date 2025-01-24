/**************************************/
/*          chatanalex.js            */
/**************************************/
// extract information using chatgpt

const rootPath = '..'

// const fetch = require('node-fetch');


const fs = require('fs');
// const { default: ollama } = require('ollama');

const API_KEY = '';

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
console.log('********   Using model HF NER   ********');
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
    const result = await askHF(content);

    console.log('Résultat brut de NER:', result);

  const events = [];
  let currentEvent = {};

  result.forEach(entity => {
    if (entity.entity_group === 'PER') currentEvent.artiste = entity.word;
    if (entity.entity_group === 'DATE') currentEvent.date = entity.word;
    if (entity.entity_group === 'LOC') currentEvent.lieu = entity.word;

    // Si un événement est complet, ajoutez-le à la liste
    if (currentEvent.artiste && currentEvent.date && currentEvent.lieu) {
      events.push(currentEvent);
      currentEvent = {};
    }
  });

  console.log('Événements extraits :', events);


   

    console.log('\n\nSortie :\n\n');
    // console.log(result.message.content);
    // console.log(result.response);
    
    // // console.log(result.response);
    // const cleanResult = result.message.content.replace(/^[^\[]*\[/,'\[').replace(/\][^\]]*$/,'\]');
    // const cleanResult = result.replace(/^[^\[]*\[/,'\[').replace(/\][^\]]*$/,'\]');
    // console.log('\n\nsous forme JSON:\n\n');
    // const eventJSON = JSON.parse(cleanResult);

    // console.log(eventJSON);
}


async function askHF(question) {
    const fetch = (await import('node-fetch')).default;

    const HUGGINGFACE_API_KEY = ''; // Remplacez par votre clé

    // URL du modèle NER (exemple : CamemBERT pour le français)
    //  const MODEL_URL = 'https://api-inference.huggingface.co/models/Jean-Baptiste/camembert-ner';
    const MODEL_URL = 'https://api-inference.huggingface.co/models/dbmdz/bert-large-cased-finetuned-conll03-english';

    async function checkModelAccess() {
        try {
          const response = await fetch(MODEL_URL, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
            },
          });
      
          if (response.status === 200) {
            console.log('Accès au modèle réussi!');
          } else {
            console.log(`Erreur d'accès au modèle : ${response.statusText}`);
          }
        } catch (error) {
          console.error('Erreur lors de la vérification de l\'accès au modèle :', error);
        }
      }
      
      checkModelAccess();

    // Fonction pour appeler l'API Hugging Face
    // try {
        const response = await fetch(MODEL_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: question }),
        });
    
        if (!response.ok) {
          throw new Error(`Erreur : ${response.statusText}`);
        }
    
        const data = await response.json();
        // console.log(data);
        return data;
    //   } catch (error) {
    //     console.error('Erreur lors de l\'appel à Hugging Face:', error);
    // }
}



