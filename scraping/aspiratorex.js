import * as fs from 'fs';

const removeScripts = true;

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
              if (removeScripts){
                // clean html content
                htmlContent = cleanScripts(htmlContent);
                htmlContent = cleanHtml(htmlContent);
              }
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
              console.error('\x1b[31mErreur lors de la récupération de la page : %s: \x1b[0m%s', venue.name,error);
            });
            

          console.log(); // Ajouter une ligne vide pour séparer les objets
        });
      } catch (erreur) {
        console.error("Erreur de parsing JSON :", erreur.message);
      }
   

});


function cleanScripts(content){
  return content.replace(/<script[^]*?<\/script>/g,'');// remove scripts
}

function cleanHtml(content){
  function removeForbiddenCaracters(match,p,offset,string){// remove the forbidden caracters
    return p.replace(/[~!@$%^&*()+=\-,.\/';:?><\[\]\\{}|`#]/g,'');
  }

  function replaceClass(p) {//find the classes that are URLs (not href) and apply removeForbiddenCaracters
    return '<'+p.replace(/(?<!href=[^"]*)("[^"]*")/g,removeForbiddenCaracters)+'>';
  }

  function findClasses(match,p,offset,string) {
    return '<'+p.replace(/([^"]*)("[^"]*")/g,replaceClass)+'>';// find the classes within the tags and apply replaceClass
  }

  return content.replace(/<([^<]*)>/g, findClasses); // find the tag contents and apply findClasses
}
