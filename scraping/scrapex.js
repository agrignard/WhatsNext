const fs = require('fs');

// Chemin vers le fichier à lire
const filePath = './venues.json';
const sourcePath = './webSources/';
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
  const tableau = [1, 2, 3, 4, 5];

  for (const venue of venues) {
    await analyseFile(venue);
  }

  //console.log("Fin de la boucle.");
}


async function analyseFile(venue) {
  // Simuler une opération asynchrone
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Traitement de l'élément :", venue);
      // Parcourir chaque objet

        // Afficher le numéro de l'objet
        console.log(`\n******* Venue: ${venue.name}  *******`);
        const inputFile = sourcePath+venue.name+".html";
        fs.readFile(inputFile, 'utf8', (erreur, venueContent) => {
          if (erreur) {
              console.error("Erreur lors de la lecture du fichier : "+venue.name, erreur);
              return;
          }
          //console.log(venueContent);
          try{
            const regexDelimiter = new RegExp(venue.eventsDelimiter, 'g');
            const events = venueContent.match(regexDelimiter);
            console.log("total number of events: " + events.length);
            const regexDate = new RegExp(venue.date);
            const regexName = new RegExp(venue.eventName);
            const regexURL = new RegExp(venue.eventURL);
            console.log(regexName);
            
            if (!('date' in venue)){
              console.log('\x1b[33m%s\x1b[0m', 'Pas de regexp défini pour '+venue.name);

            }else{
              for (eve of events){
                const eventDate = eve.match(regexDate)[1];
                const eventName = eve.match(regexName)[1];
                console.log(eventDate);
                console.log(eventName);
                if ('eventURL' in venue){
                    const eventURL = eve.match(regexURL)[1];
                    console.log(eventURL);
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



