const fs = require('fs');

// Chemin vers le fichier à lire
const filePath = './venues.json';
const outputPath = './webSources/';
var fileContent;
console.log("***********************************************************************************");
console.log("ASPIRATOREX IS SNIFFING SOURCES FILES Ccontained in: " + filePath );
console.log("***********************************************************************************");

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
            console.log(`Venue ${index + 1}:`);
          
            // Afficher les propriétés "name" et "url"
            console.log(`  name: ${venue.name}`);
            console.log(`  url: ${venue.url}`);
            fetch(venue.url)
            .then(response => {
              // Vérifier si la requête a réussi (statut 200)
              if (!response.ok) {
                throw new Error('Erreur de réseau');
              }

              // Extraire le contenu de la réponse
              return response.text();
            })
            .then(htmlContent => {
                const outputFile = outputPath+venue.name+".html";
                fs.writeFile(outputFile, htmlContent, 'utf8', (erreur) => {
                    if (erreur) {
                      console.error("Erreur lors de l'écriture dans le fichier :", erreur);
                    } else {
                      console.log("\""+venue.name + "\"" + " has been written in " + outputFile);
                    }
                  });
              
            })
            .catch(error => {
              // Gérer les erreurs
              console.error('Erreur lors de la récupération de la page :', venue.name);
            });
            

          console.log(); // Ajouter une ligne vide pour séparer les objets
        });
      } catch (erreur) {
        console.error("Erreur de parsing JSON :", erreur.message);
      }
   

});



//var venues = fileContent.match(regex);
//console.log("regex :", venues);


