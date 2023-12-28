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
      
   

        // Parcourir chaque objet
        venues.forEach((venue, index) => {
            // Afficher le numéro de l'objet
            console.log(`\n******* Venue ${index + 1}: ${venue.name}  *******`);
            const inputFile = sourcePath+venue.name+".html";
            fs.readFile(inputFile, 'utf8', (erreur, venueContent) => {
              if (erreur) {
                  console.error("Erreur lors de la lecture du fichier : "+venue.name, erreur);
                  return;
              }
              //console.log(venueContent);
              try{
                regexName = venue.event;
                console.log(regexName);
                var events = venueContent.match(regexName);
                console.log("total number of event" + events.length);
              }catch(error){
                console.log("Pas de regex pour "+venue.name);
              }
    
              
            });
        });
      } catch (erreur) {
        console.error("Erreur de parsing JSON :", erreur.message);
      }
   

});


async function boucleAsynchrone() {
  const tableau = [1, 2, 3, 4, 5];

  for (const element of tableau) {
    await traitementAsynchrone(element);
  }

  console.log("Fin de la boucle.");
}


async function traitementAsynchrone(element) {
  // Simuler une opération asynchrone
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Traitement de l'élément :", element);
      resolve();
    }, 1000); // Une seconde de délai
  });
}



