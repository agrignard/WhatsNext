import * as fs from 'fs';
import {removeDoubles, makeURL, cleanPage, removeBlanks,extractBody} from './import/stringUtilities.mjs';
import {loadVenuesJSONFile,venuesListJSONFile,loadLinkedPages} from './import/fileUtilities.mjs';
import * as cheerio from 'cheerio';

// Chemin vers le fichier à lire
const outputPath = './webSources/';
const nbFetchTries = 1;

var fileContent,venues;

const venueToDownload = process.argv[2];
if (venueToDownload && typeof venueToDownload !== "string"){
  throw new Error('Argument for this script should be a venue name (string)');
}

console.log("\n\x1b[36m***********************************************************************************");
if (venueToDownload){
  console.log("ASPIRATOREX IS SNIFFING SOURCES FILES for venue " + venueToDownload);
}else{
  console.log("ASPIRATOREX IS SNIFFING SOURCES FILES contained in: " + venuesListJSONFile);
}
console.log("***********************************************************************************\x1b[0m");

venues = await loadVenuesJSONFile();


// Parcourir chaque objet (ou uniquement celui passé en argument du script)
venues.filter(obj => !venueToDownload || obj.name === venueToDownload).forEach((venue, index) => {
      // Afficher le numéro de l'objet
  console.log(`Venue ${index + 1}: \x1b[36m${venue.name} (${venue.city}, ${venue.country})\x1b[0m (${venue.url})`);

  // extract baseURL and add it to JSON
  const url = new URL(venue.url);
  const baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
  venue.baseURL = baseURL;
 
  if (!venue.hasOwnProperty('country') || !venue.hasOwnProperty('city')){
    console.log('\x1b[31mErreur: le lieu \x1b[0m%s\x1b[31m n\'a pas de pays et/ou de ville définis',venue.name);
  }else{
    const countryPath = venue.country;
    const cityPath = venue.city;
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
        erasePreviousHtmlFiles(path)
        .then(() => {downloadVenue(venue,path);})
      }
    }
  }
  console.log(); 
});

// save base URL to JSON file
const jsonString = JSON.stringify(venues, null, 2); 
fs.writeFileSync(venuesListJSONFile, jsonString);// écrit à la fin. Problème de sauvegarde si un des fichiers a un pb ?





/******************************/
/*       main function        */
/******************************/

async function downloadVenue(venue,path){
  var URLlist = [];
  if (venue.hasOwnProperty('multiPages')){
    if (venue.multiPages.hasOwnProperty('startPage') && venue.multiPages.hasOwnProperty('nbPages')){
      let increment = (venue.multiPages.hasOwnProperty('increment'))?venue.multiPages.increment:1;
      for(let i=0;i<venue.multiPages.nbPages;i++){
        const pageID = venue.multiPages.startPage+i*increment;
        URLlist.push(venue.url+pageID);
      }
    }else if(venue.multiPages.hasOwnProperty('pageList')){
      venue.multiPages.pageList.forEach(el => URLlist.push(venue.url+el));
    }else{
      console.log("\x1b[36mAttribute \'startPage\' and \'nbPages', or \'pageList\' are mandatory for multipages. No page loaded\x1b[0m.");
      URLlist = [];
    }
  }else{
    URLlist = [venue.url];
  }

  async function getPage(page,pageIndex){
    let response;
    try{
      response = await fetch(page);
    }catch(err){
      console.log("\x1b[31mErreur de réseau, impossible de récupérer la page \'%s\'\x1b[0m: %s",venue.name,err);
      throw err;
    }
    const htmlContent = cleanPage(await response.text());

    let outputFile;
    if (!venue.hasOwnProperty('multiPages')){
      outputFile = path+venue.name+".html";
    }else{
      outputFile = path+venue.name+pageIndex+".html";
    }
    fs.writeFile(outputFile, htmlContent, 'utf8', (erreur) => {
      if (erreur) {
        console.error("\x1b[31mErreur lors de l'écriture dans le fichier \'%s\'\x1b[0m: %s",venue.name+'.html', erreur);
      } else {
        console.log("\'"+venue.name + "\'" + " file downloaded to " + outputFile);
      }
    });
    return htmlContent;
  }

  // read the pages and save them to local files
  let pageList = (await Promise.all(URLlist.map((page,pageIndex)=>getPage(page,pageIndex)))).flat();
  
  // get linked pages
  if (venue.hasOwnProperty('linkedPage')){
    // if event tags are defined and contain URLs, download the URLs. Otherwise, ask to run an analyze 
    if (venue.hasOwnProperty('eventsDelimiterTag') && venue.hasOwnProperty('eventURLIndex') && venue.eventURLIndex !== -1){
      // get the list of URLs to download
      var index = venue.hasOwnProperty('eventURLIndex')?venue.eventURLIndex:0;
      let hrefList = pageList.map((page)=>getLinksFromPage(page,venue.eventsDelimiterTag,index)).flat();
      hrefList = removeDoubles(hrefList);
      hrefList = hrefList.map((el) => makeURL(venue.baseURL,el));
      console.log(shortList(hrefList));
      // check the URLS that already exist
      const linkedFileContent = fs.existsSync(path+'linkedPages.json')?await loadLinkedPages(path):[];
      const existingLinks = hrefList.filter(el => Object.keys(linkedFileContent).includes(el));
      const linksToDownload = hrefList.filter(el => !Object.keys(linkedFileContent).includes(el));
      console.log('Loading linked pages for venue %s. Found %s links: %s already exist and won\'t be downloaded, %s will be downloaded.',venue.name,hrefList.length, existingLinks.length,linksToDownload.length);
      // put the existing links in a new JSON object
      let hrefJSON = {};
      existingLinks.forEach(key => {
        hrefJSON[key] = linkedFileContent[key];
      });
      // put the new links
      let hrefContents;
      try{
        hrefContents = (await Promise.all(linksToDownload.map(el => fetchLink(el,venue))));
      }catch(err){
        console.log("\x1b[36mErreur de réseau, impossible de récupérer la dépendance pour \'%s\'\x1b[0m: %s",venue.name,err);
      }
      linksToDownload.forEach((href,index) =>hrefJSON[href]=hrefContents[index]);

      try{
        const jsonString = JSON.stringify(hrefJSON, null, 2); 
        fs.writeFileSync(path+'linkedPages.json', jsonString);

        const nombreUndefined = hrefContents.reduce((acc, valeur) => {
          return acc + (valeur === undefined ? 1 : 0);
        }, 0);
        console.log('undefined:',nombreUndefined);
        const nombreNull = hrefContents.reduce((acc, valeur) => {
          return acc + (valeur === null ? 1 : 0);
        }, 0);
        console.log('null:',nombreNull);
 
        // test if all downloads are successful
        if (Object.keys(hrefJSON).length === hrefList.length){
          console.log('All linked pages successfully downloaded and saved for %s.',venue.name);
          console.log('to do: ',hrefList.length,'done: ',Object.keys(hrefJSON).length);
        }else{
          console.log('to do: ',hrefList.length,'done: ',Object.keys(hrefJSON).length);
          console.log('\x1b[36mVenue: %s: \x1b[0m%s/%s\x1b[36m links downloaded. Run aspiratorex again to load remaining links.\x1b[0m',venue.name,Object.keys(hrefJSON).length, hrefList.length);
        }
      }catch(err){
          console.log('\x1b[31mImpossible de sauvegarder les liens dans\'linkedPages.json\' %s\x1b[0m',err);
      }
    }else{
      console.log('\x1b[31mTrying to download linked pages for \x1b[0m\'%s\'\x1b[31m, but no URL delimiter found. Run analex.js to set locate URL tag, then run again aspiratorex.js.\x1b[0m',venue.name)
    }
  }
}


/******************************/
/*       aux functions        */
/******************************/


function getLinksFromPage(page,delimiter,index){
  const $ = cheerio.load(page);
  let res = [];
  if (index == 0){// the URL is in A href 
    $(delimiter).each(function () {
      const href = $(this).attr('href');
      res.push(href);
    });
  }else{// URL is in inner tags
    index = index - 1;
    let events = [];
    $(delimiter).each((i, element) => {
      let ev = $(element).html();
      events.push(ev);
    });
    events.forEach((eve,eveIndex) =>{
      const $eventBlock = cheerio.load(eve);
      const tagsWithHref = $eventBlock('a[href]');
      const hrefs = $eventBlock(tagsWithHref[index]).attr('href');
      res = res.concat(hrefs);
    }); 
  }
  //console.log(res);
  return res;
}


async function fetchLink(page,venue){
  try{
    // const response = await fetch(page);
    // const content = await response.text();
    const content = await fetchWithRetry(page, nbFetchTries, 2000);
    return extractBody(removeBlanks(cleanPage(content)));
  }catch(err){
    console.log("\x1b[36mErreur de réseau, impossible de récupérer la dépendance \'%s\'.\x1b[0m (Erreur: %s)",page,err.name);
  }
}

function fetchWithRetry(page, tries, timeOut) {
  return fetch(page)
    .then(response => {
      if (!response.ok) {
        throw new Error('Echec du téléchargement');
      }
      // if (response.text().includes('Pig Boy')){
      //   throw "erreur pourrie";
      // }
      return response.text();
    })
    .catch(error => {
      if (tries > 0){
        console.log('Echec du téléchargement (%s). Essai dans %ss.',page,timeOut/1000);
        return new Promise(resolve => setTimeout(resolve, 5000))
          .then(() => fetchWithRetry(page,tries-1,timeOut));
      }else{
        console.log('Echec du téléchargement (%s). Abandon (trop de tentatives).',page);
        throw error;
      }
    });
}

// function getLinks(htmlContent){
//   const linksRegex = /<a[^]*?href\s*?=\s*?\"[^\"]*\"/g;
//   var res = htmlContent.match(linksRegex).map(el => el.match(/href\s*?=\s*?\"([^\"]*)\"/)[1]);
//   res = res.filter(el => !el.includes('mailto:'));
//   return res;
// };






async function erasePreviousHtmlFiles(path){

  fs.readdir(path, (err, files) => {
    if (err) {
      console.error('Erreur lors de la lecture du répertoire:', err);
      return;
    }
    files.filter(fileName => fileName.endsWith('.html'))
    .forEach(file => {
      const fileToErase = `${path}/${file}`;
   //   console.log("suppression fichier "+fileToErase);
      fs.unlink(fileToErase, err => {
        if (err) {
          console.error(`Erreur lors de la suppression du fichier ${file}:`, err);
        }
      });
    });
  });

}

function shortList(list){
  if (list.length <= 3){
    return list;
  }else{
    return list.slice(0,3).concat(['...('+list.length+' elements)']);
  }
}


