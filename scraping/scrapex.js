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

  console.log("Fin de la boucle.");
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
            regexName = new RegExp(venue.event, 'g');
            console.log(regexName);
            var events = venueContent.match(regexName);
            console.log("total number of event" + events.length);
          }catch(error){
            console.log("Pas de regex pour "+venue.name);
          }
          console.log("\n\n");
          
        });
  
      resolve();
    }, 1000); // Une seconde de délai
  });
}



