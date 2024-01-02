const fs = require('fs');
const { parse, isValid } = require('date-fns');

// Chemin vers le fichier à lire
const filePath = './venues-test.json';
const sourcePath = './webSources/';

const dateConversionFile = './dateConversion.json';
var out="";// = "PLACE,TITRE,UNIX,SIZE,GENRE,URL";
var outFile = "generated/scrapexResult.csv";
var months;


fs.readFile(dateConversionFile, 'utf8', (erreur, fileContent) => {
  if (erreur) {
      console.error("Erreur lors de la lecture du fichier :", erreur);
      return;
  }

  try {
      months = JSON.parse(fileContent);  
    } catch (erreur) {
      console.error("Erreur de parsing JSON pour les conversions de dates :", erreur.message);
    }
 

});

var fileContent;
console.log("\n\n\n\n\n");



// Lecture du fichier de manière asynchrone
fs.readFile(filePath, 'utf8', (erreur, fileContent) => {
    if (erreur) {
        console.error("Erreur lors de la lecture du fichier :", erreur);
        return;
    }

    try {
        // Parser le texte JSON
        const venues = JSON.parse(fileContent);
      
        scrapFiles(venues);

        
      } catch (erreur) {
        console.error("Erreur de parsing JSON :", erreur.message);
      }
   

})

setTimeout(function() {
  console.log('Scrap fini avec succex !!');
  fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
}, 2000);





async function scrapFiles(venues) {
  

  for (const venue of venues) {
    await analyseFile(venue);
  }

  //console.log("Fin de la boucle.");
}


async function analyseFile(venue) {
  // Simuler une opération asynchrone
  return new Promise((resolve) => {
    setTimeout(() => {
        var events,eventDate,eventName,unixDate,eventURL;

        // Afficher le numéro de l'objet
        console.log();
        console.log('\x1b[32m%s\x1b[0m', `******* Venue: ${venue.name}  *******`);
        const inputFile = sourcePath+venue.name+".html";
        fs.readFile(inputFile, 'utf8', (erreur, venueContent) => {
          if (erreur) {
              console.error("Erreur lors de la lecture du fichier : "+venue.name, erreur);
              return;
          }
          //console.log(venueContent);
          try{
            try{
              const regexDelimiter = new RegExp(venue.eventsDelimiter, 'g');
              events = venueContent.match(regexDelimiter);
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
                    if (i > 1){
                      eventDate += '-';
                    }
                    eventDate += res[i];
                  }
                  
                  console.log(eventDate);
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
//                  eventName = eve.match(regexName)[1];
                }catch(err){
                  console.log('\x1b[31m%s\x1b[0m', 'Erreur regexp sur le nom de l\'événement pour '+venue.name);
                }
                eventDate = convertDate(eventDate);
               // console.log(eventDate);
                const oldDate = eventDate;
                eventDate = parse(eventDate, dateFormat, new Date());
                  if (!isValid(eventDate)){
                    console.log('\x1b[31m%s\x1b[0m', 'Format de date invalide pour '+venue.name+': '+oldDate);
                  }else{
                    unixDate = eventDate.getTime();
                 //   console.log(unixDate);
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
               //   out = out+venue.name,','+eventName;
                  out = out+venue.name+','+eventName+','+unixDate+',100,'+eventURL+'\n';
                }
                console.log();
              }  
            }
            
            
          //  const regexEventName = new RegExp(venue.eventName);
          //  const eventName = events.match(regex)[1];
          //  console.log(eventName);
          }catch(error){
            console.log("Pas de regex pour "+venue.name,error);
          }
          console.log("\n\n");
          
        });
  
      resolve();
    }, 1000); // Une seconde de délai
  });
}



function convertDate(s) {
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents
  for (const key in months) {
     for (const str of months[key]){
       s = s.replace(new RegExp(str,'i'),key);
    }
  }
  return s;
}


function removeBlanks(s){
  return s.replace(/[\n\t]/g, '').replace(/ {2,}/g, ' ').replace(/^ /,'');
}