import * as fs from 'fs';

const removeScripts = true;

// Chemin vers le fichier à lire
var venuesListFile = './venues.json';
const outputPath = './webSources/';
var fileContent;

const venueToDownload = process.argv[2];
if (venueToDownload && typeof venueToDownload !== "string"){
  throw new Error('Argument for this script should be a venue name (string)');
}

console.log("\n\x1b[36m***********************************************************************************");
if (venueToDownload){
  console.log("ASPIRATOREX IS SNIFFING SOURCES FILES for venue " + venueToDownload);
}else{
  console.log("ASPIRATOREX IS SNIFFING SOURCES FILES contained in: " + venuesListFile );
}
console.log("***********************************************************************************\x1b[0m");

// Lecture du fichier de manière asynchrone
fs.readFile(venuesListFile, 'utf8', (erreur, fileContent) => {
    if (erreur) {
        console.error("Erreur lors de la lecture du fichier :", erreur);
        return;
    }

    try {
        // Parser le texte JSON
        var venues = JSON.parse(fileContent);
 
        // Parcourir chaque objet (ou uniquement celui passé en argument du script)
        venues.filter(obj => !venueToDownload || obj.name === venueToDownload).forEach((venue, index) => {
            // Afficher le numéro de l'objet
            console.log(`Venue ${index + 1}: \x1b[36m${venue.name}\x1b[0m`);
            console.log(`  url: ${venue.url}`);
            var URLlist = [];
            if (venue.hasOwnProperty('multiPages')){
              if (venue.multiPages.hasOwnProperty('startPage') && venue.multiPages.hasOwnProperty('nbPages')){
                let increment = (venue.multiPages.hasOwnProperty('increment'))?venue.multiPages.increment:1;
                for(let i=0;i<venue.multiPages.nbPages;i++){
                  const pageID = venue.multiPages.startPage+i*increment;
                  URLlist.push(venue.url+pageID);
                }
              }else{
                console.log("\x1b[36mAttribute \'startPage\' and \'nbPages' are mandatory for multipages. No page loaded\x1b[0m.");
                URLlist = [];
              }
            }else{
              URLlist = [venue.url];
            }

            for (let currentPage=0;currentPage<URLlist.length;currentPage++){
            fetch(URLlist[currentPage])
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
                  htmlContent = removeBRTags(htmlContent);
                  htmlContent = cleanHtml(htmlContent);
            //      htmlContent = removeImages(htmlContent);
                }
                if (!venue.hasOwnProperty('country') || !venue.hasOwnProperty('city')){
                  console.log('\x1b[31mErreur: le lieu \x1b[0m%s\x1b[31m n\'a pas de pays et/ou de ville définis',venue.name);
                }else{
                  const countryPath = (venue.hasOwnProperty('country')?venue.country:'undefined country');
                  const cityPath = (venue.hasOwnProperty('city')?venue.city:'undefined city');
                  if (!fs.existsSync(outputPath+countryPath)){
                      console.log('\x1b[31mErreur: le pays \x1b[0m%s\x1b[31m n\'est pas défini. Vérifiez si l\'orthographe est correcte. Si oui, créez un répertoire dans \x1b[0m%s',countryPath,outputPath);
                  }else{
                    if (!fs.existsSync(outputPath+countryPath+'/'+cityPath)){
                      console.log('\x1b[31mErreur: la ville \x1b[0m%s\x1b[31m n\'est pas définie pour le pays %s. Vérifiez si l\'orthographe est correcte. Si oui, créez un répertoire dans \x1b[0m%s',cityPath,countryPath,outputPath+countryPath);
                    }else{
                      let path = outputPath+countryPath+'/'+cityPath+'/'+venue.name+'/';
                      if (!fs.existsSync(path)){
                        fs.mkdirSync(path);
                      }
                      let outputFile;
                      if (URLlist.length === 0){
                        outputFile = path+venue.name+".html";
                      }else{
                        outputFile = path+venue.name+currentPage+".html";
                      }
                      
                      fs.writeFile(outputFile, htmlContent, 'utf8', (erreur) => {
                        if (erreur) {
                          console.error("\x1b[36mErreur lors de l'écriture dans le fichier \'%s\'\x1b[0m: %s",venue.name+'.html', erreur);
                        } else {
                          console.log("\""+venue.name + "\"" + " has been written in " + outputFile);
                        }
                      });

                      // extract baseURL and add it to JSON
                      const url = new URL(venue.url);
                      const baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
                      venue.baseURL = baseURL;
                      const jsonString = JSON.stringify(venues, null, 2); 
                      fs.writeFileSync(venuesListFile, jsonString);
                    }
                  }
                }   
              })
              .catch(error => {
                // Gérer les erreurs
                console.error('\x1b[31mErreur lors de la récupération de la page : %s: \x1b[0m%s', venue.name,error);
              });
            }

          console.log(); // Ajouter une ligne vide pour séparer les objets
        });
      } catch (erreur) {
        console.error("Erreur de parsing JSON :", erreur.message);
      }
});


function cleanScripts(content){
  let res = content.replace(/<script[^]*?<\/script>/g,'');// remove scripts
  res = res.replace(/<noscript[^]*?<\/noscript>/g,'');// remove scripts
  return res;
}

function removeBRTags(content){
  return content.replace(/<br>([^]*?)</gi, (_,p) => '<p class="addedTag">'+p+'<');// remove scripts
}

// function removeImages(content){
//   content.replace(/<[ ]*img[^]*?>/g,'[IMAGE]');
// }

function cleanHtml(content){
  function removeForbiddenCaracters(match,p,offset,string){// remove the forbidden caracters
    return p.replace(/[~!@$%^&*()+=\-,.\/';:?><\[\]\\{}|`#]/g,'');
  }

  function replaceClass(p) {//find the classes that are URLs (not href) and apply removeForbiddenCaracters
    return p.replace(/(?<!(?:href|src)=[^"]*)("[^"]*")/g,removeForbiddenCaracters);
  }

  function findClasses(match,p,offset,string) {
    return '<'+p.replace(/([^"]*)("[^"]*")/g,replaceClass)+'>';// find the classes within the tags and apply replaceClass
  }
  return content.replace(/<([^<>]*)>/g, findClasses); // find the tag contents and apply findClasses
}

