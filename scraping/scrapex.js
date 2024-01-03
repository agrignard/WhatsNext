const fs = require('fs');
const fs2 = require('fs').promises;
const { parse, isValid } = require('date-fns');
const cheerio = require('cheerio');

// Chemin vers le fichier à lire
const filePath = './venues-test.json';
const sourcePath = './webSources/';

const dateConversionFile = './dateConversion.json';
var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";
var outFile = "generated/scrapexResult.csv";
var months;

fs2.readFile(dateConversionFile, 'utf8')
  .then((fileContent) =>{
    try {
      months = JSON.parse(fileContent); 
    } catch (erreur) {
      console.error("Erreur de parsing JSON pour les conversions de dates :", erreur.message);
    }
    fs2.readFile(filePath, 'utf8')
    .then((fileContent) =>{
      try {
        // Parser le texte JSON
        const venues = JSON.parse(fileContent);
        scrapFiles(venues);
      } catch (erreur) {
        console.error("Erreur de parsing des lieux :", erreur.message);
      }
    })
    console.log("\n\n\n\n\n");
  })
  .catch((erreur ) => {
    console.error("Erreur lors de la lecture des fichiers de configuration :", erreur);
  });

async function scrapFiles(venues) {
//  await Promise.all(venues.map(analyseFile));
  for (const venue of venues) {
    await analyseFile(venue);
  }
  console.log('Scrap fini avec succex !!\n\n');
}



async function analyseFile(venue) {
  var events,eventDate,eventName,unixDate,eventURL, venueContent;
  const inputFile = sourcePath+venue.name+".html";
  try{
    venueContent = await fs2.readFile(inputFile, 'utf8');
  }catch (erreur){
    console.error("Erreur lors de la lecture du fichier local de :",venue.name, erreur);
  }
  console.log();
  console.log('\x1b[32m%s\x1b[0m', `******* Venue: ${venue.name}  *******`);
  try{
    try{
      if (venue.hasOwnProperty('eventsDelimiter')){
        const regexDelimiter = new RegExp(venue.eventsDelimiter, 'g');
        events = venueContent.match(regexDelimiter);
      }else{
        const eventAnchor = venue.eventsAnchor;
        const $ = cheerio.load(venueContent);
  
        events = [];
        $('.'+venue.eventsAnchor).each((index, element) => {
          let ev = $(element).html();
          events.push(ev);
        });
      }

      console.log("total number of events: " + events.length);       
    }catch(err){        
      console.log('\x1b[31m%s\x1b[0m', 'Délimiteur mal défini pour '+venue.name);      
    }

    const regexDate = new RegExp(venue.eventDate);
    const regexName = new RegExp(venue.eventName);
    const regexURL = new RegExp(venue.eventURL);
    const dateFormat = venue.dateFormat;
    
    if (!('eventDate' in venue) || !('eventName' in venue) || !('dateFormat' in venue)){
      console.log('\x1b[33m%s\x1b[0m', 'Pas de regexp défini pour '+venue.name);      
    }else{
      for (eve of events){
        try{
          const res = eve.match(regexDate);
          eventDate = "";
          for (let i = 1; i <= res.length-1; i++) {
            if (!(res[i] === undefined)){
              if (!(eventDate === "")){
                        eventDate += '-';
                }
                      eventDate += res[i];
            }    
          }        
        } catch(err){
          console.log('\x1b[31m%s\x1b[0m', 'Erreur regexp sur la date pour '+venue.name);
        }
        try{
          const res = eve.match(regexName);
          eventName = "";
          for (let i = 1; i <= res.length-1; i++) {
            if (!(res[i] === undefined)){
              if (i > 1){
                eventName += ' ';
              }
              eventName += res[i];      
            }
          }
          eventName = removeBlanks(eventName);
        }catch(err){
          console.log('\x1b[31m%s\x1b[0m', 'Erreur regexp sur le nom de l\'événement pour '+venue.name);
        }

        const oldDate = eventDate;
        console.log(eventDate);
        eventDate = convertDate(eventDate,dateFormat);
        if (!isValid(eventDate)){
          console.log('\x1b[31m%s\x1b[0m', 'Format de date invalide pour '+venue.name+': '+oldDate);
        }else{
          unixDate = eventDate.getTime();
                  //console.log(unixDate);
        }


        console.log(eventName);
        if ('eventURL' in venue){
          try{
            eventURL = eve.match(regexURL)[1];
            if (!(eventURL === undefined)){
              eventURL = venue.baseURL+eventURL;
            }
            console.log(eventURL);
          }catch(err){
            console.log('\x1b[33m%s\x1b[0m', 'URL non fonctionnelle pour '+venue.name);
          }
          out = out+venue.name+','+eventName+','+unixDate+',100,'+eventURL+'\n';
        }
        console.log();
      }  
    }
  }catch(error){
    console.log("Pas de regex pour "+venue.name,error);
  }
  console.log("\n\n");
}
  



function convertDate(s,dateFormat) {
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents
  for (const key in months) {
     for (const str of months[key]){
       s = s.replace(new RegExp(str,'i'),key);
    }
  }  
  if (s.includes('tonight')){
    return new Date();
  }else{
    return parse(s, dateFormat, new Date());
  }
}


function removeBlanks(s){
  return s.replace(/[\n\t]/g, '').replace(/ {2,}/g, ' ').replace(/^ /,'');
}

