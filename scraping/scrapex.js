const fs = require('fs');

// Chemin vers le fichier à lire
const filePath = './venues.json';
const sourcePath = './webSources/';

const dateConversionFile = './dateConversion.json';
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
   

});


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
        var events,eventDate,eventName;

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
  

            
            if (!('eventDate' in venue) || !('eventName' in venue)){
              console.log('\x1b[33m%s\x1b[0m', 'Pas de regexp défini pour '+venue.name);

            }else{
              for (eve of events){
                try{
                  eventDate = eve.match(regexDate)[1];
                } catch(err){
                  console.log('\x1b[31m%s\x1b[0m', 'Erreur regexp sur la date pour '+venue.name);
                }
                try{
                  eventName = eve.match(regexName)[1];
                }catch(err){
                  console.log('\x1b[31m%s\x1b[0m', 'Erreur regexp sur le nom de l\'événement pour '+venue.name);
                }
                eventDate = convertDate(eventDate);
                console.log(eventDate);
                console.log(eventName);
                if ('eventURL' in venue){
                  try{
                    const eventURL = eve.match(regexURL)[1];
                    console.log(eventURL);
                  }catch(err){
                    console.log('\x1b[33m%s\x1b[0m', 'URL non fonctionnelle pour '+venue.name);
                  }
                    
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
  for (const key in months) {
    for (str of months[key]){
      s = s.replace(str,key);
    }
    return s;
  }
}
