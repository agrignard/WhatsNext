/**************************************/
/*          aspiratorex.js            */
/**************************************/
// download files and save them to local directory, including linkedPages if indicated


import * as fs from 'fs';
import {removeDoubles, makeURL, cleanPage, removeBlanks,extractBody} from './import/stringUtilities.mjs';
import {loadVenuesJSONFile,venuesListJSONFile,loadLinkedPages,fetchAndRecode,fetchLink} from './import/fileUtilities.mjs';
import {getURLListFromPattern} from './import/dateUtilities.mjs';
import * as cheerio from 'cheerio';


const outputPath = './webSources/';
const nbFetchTries = 2; // number of tries in case of internet connection time outs

let venues;

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
  try{
    const url = new URL(venue.url);
    //const baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    venue.baseURL = url.origin + url.pathname.replace(/\/[^\/]+$/, '/');
    if (!venue.hasOwnProperty('country') || !venue.hasOwnProperty('city')){
      console.log('\x1b[31mError: venue \x1b[0m%s\x1b[31m has no country and/or city defined.',venue.name);
    }else{
      const countryPath = venue.country;
      const cityPath = venue.city;
      if (!fs.existsSync(outputPath+countryPath)){
          console.log('\x1b[31mError: Country \x1b[0m%s\x1b[31m doesn\'t exist. If orthograph is correct, create a new directory in \x1b[0m%s.',countryPath,outputPath);
      }else{
        if (!fs.existsSync(outputPath+countryPath+'/'+cityPath)){
          console.log('\x1b[31mError: City \x1b[0m%s\x1b[31m does not exist in %s. If orthographe is correct, create a new directory in \x1b[0m%s',cityPath,countryPath,outputPath+countryPath);
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
  }catch(err){
    console.log('\x1b[31mCannot read URL for %s.x1b[0m', venue.name);
  }
});

// save base URL to JSON file
const jsonString = JSON.stringify(venues, null, 2); 
fs.writeFileSync(venuesListJSONFile, jsonString);// écrit à la fin. Problème de sauvegarde si un des fichiers a un pb ?





/******************************/
/*       main function        */
/******************************/

async function downloadVenue(venue,path){
  let URLlist = [];
  if (venue.hasOwnProperty('multiPages')){
    if (venue.multiPages.hasOwnProperty('pattern')){
      URLlist = getURLListFromPattern(venue.url,venue.multiPages.pattern,venue.multiPages.nbPages);
    }else if (/\{index\}/.test(venue.url)){
      if (venue.multiPages.hasOwnProperty('startPage') && venue.multiPages.hasOwnProperty('nbPages')){
        let increment = (venue.multiPages.hasOwnProperty('increment'))?venue.multiPages.increment:1;
        for(let i=0;i<venue.multiPages.nbPages;i++){
          const pageID = venue.multiPages.startPage+i*increment;
            URLlist.push(venue.url.replace('{index}',pageID));
        }
      }else{
        console.log("\x1b[31mAttribute \'startPage\' and \'nbPages' are mandatory for multipages if there is a placeholder \'index\' in the URL. No page loaded\x1b[0m.");
        URLlist = [];
      }  
    }else if(venue.multiPages.hasOwnProperty('pageList')){
        venue.multiPages.pageList.forEach(el => URLlist.push(venue.url+el));
    }else{
        console.log("\x1b[31mFound \'multiPage\', but found neither a place holder \'{index}\' or a list of URLs \'pageList\' to load. No page loaded\x1b[0m.");
        URLlist = [];
        console.log(venue.url);
    }
  }else{
    URLlist = [venue.url];
  }

  async function getPage(page,pageIndex){
    let htmlContent;
    try{
      htmlContent = cleanPage(await fetchAndRecode(page));
     // response = await fetch(page);
    }catch(err){
      console.log("\x1b[31mNetwork error, cannot download \'%s\'\x1b[0m.",page);
      return '';
    }
    //const htmlContent = cleanPage(await response.text());

    let outputFile;
    if (!venue.hasOwnProperty('multiPages')){
      outputFile = path+venue.name+".html";
    }else{
      outputFile = path+venue.name+pageIndex+".html";
    }
    fs.writeFile(outputFile, htmlContent, 'utf8', (erreur) => {
      if (erreur) {
        console.error("\x1b[31mCannot write local file for \'%s\'\x1b[0m: %s",venue.name+'.html', erreur);
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
    if (venue.scrap.hasOwnProperty('eventsURLTags')||
        (venue.hasOwnProperty('eventsDelimiterTag') && venue.hasOwnProperty('eventURLIndex') && venue.eventURLIndex !== -1)){
      let hrefList;
      if (venue.scrap.hasOwnProperty('eventURLTags')){// URL is found manually
        hrefList = pageList.map((page)=>getManualLinksFromPage(page,venue.eventsDelimiterTag,venue.scrap.eventURLTags[0])).flat();
      }else{
        let index = venue.hasOwnProperty('eventURLIndex')?venue.eventURLIndex:0;
        hrefList = pageList.map((page)=>getLinksFromPage(page,venue.eventsDelimiterTag,index)).flat();
      }
      // get the list of URLs to download
      hrefList = removeDoubles(hrefList.filter(el => el !== undefined));
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
        hrefContents = (await Promise.all(linksToDownload.map(el => fetchLink(el,nbFetchTries))));
      }catch(err){
        console.log("\x1b[36mNetwork error, cannot load linked page for \'%s\'\x1b[0m: %s",venue.name,err);
      }
      linksToDownload.forEach((href,index) =>hrefJSON[href]=hrefContents[index]);

      try{
        const jsonString = JSON.stringify(hrefJSON, null, 2); 
        fs.writeFileSync(path+'linkedPages.json', jsonString);

        const failedDownloads = hrefContents.reduce((acc, val) => {
          return acc + (val === undefined ? 1 : 0);
        }, 0);
 
        // test if all downloads are successful
        if (failedDownloads === 0){
          console.log('All linked pages successfully downloaded and saved for %s.',venue.name);;
        }else{
          console.log('to do: ',hrefList.length,'done: ',Object.keys(hrefJSON).length);
          console.log('\x1b[31mVenue: %s: \x1b[0m%s/%s\x1b[31m links downloaded. \x1b[36mRun aspiratorex again\x1b[31m to load remaining links.\x1b[0m',venue.name,hrefList.length-failedDownloads, hrefList.length);
        }
      }catch(err){
          console.log('\x1b[31mCannot save links to file \'linkedPages.json\' %s\x1b[0m',err);
      }
    }else{
      console.log('\x1b[31mTrying to download linked pages for \x1b[0m\'%s\'\x1b[31m, but no URL delimiter found. Run analex.js to set locate URL tag, then run again aspiratorex.js.\x1b[0m',venue.name)
    }
  }
}


/******************************/
/*       aux functions        */
/******************************/


function getManualLinksFromPage(page,delimiter,atag){
  const $ = cheerio.load(page);
  let res = [];
  $(delimiter).each(function () {
    const block = $(this).html();
    const $b = cheerio.load(block);
    const href = $b(atag).attr('href');
    res.push(href);
  });
  return res;
}

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


// async function fetchLink(page){
//   try{
//     const content = await fetchWithRetry(page, nbFetchTries, 2000);
//     return extractBody(removeBlanks(cleanPage(content)));
//   }catch(err){
//     console.log("\x1b[31mNetwork error, cannot download \'%s\'.\x1b[0m",page);
//   }
// }

// function fetchWithRetry(page, tries, timeOut) {
//   return fetchAndRecode(page)
//     .catch(error => {
//       if (tries > 1){
//         console.log('Download failed (%s). Trying again in %ss (%s %s left).',page,timeOut/1000,tries-1,tries ===2?'attempt':'attempts');
//         return new Promise(resolve => setTimeout(resolve, timeOut))
//           .then(() => fetchWithRetry(page,tries-1,timeOut));
//       }else{
//         console.log('Download failed (%s). Aborting (too many tries).',page);
//         throw error;
//       }
//     });
// }




async function erasePreviousHtmlFiles(path){

  fs.readdir(path, (err, files) => {
    if (err) {
      console.error('\x1b[31mCannot open directory.\x1b[0m', err);
      return;
    }
    files.filter(fileName => fileName.endsWith('.html'))
    .forEach(file => {
      const fileToErase = `${path}/${file}`;
   //   console.log("suppression fichier "+fileToErase);
      fs.unlink(fileToErase, err => {
        if (err) {
          console.error(`\x1b[31mCannot remove file  \x1b[0m${file}\x1b[31m:\x1b[0m`, err);
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

