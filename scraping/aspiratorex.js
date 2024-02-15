/**************************************/
/*          aspiratorex.js            */
/**************************************/
// download files and save them to local directory, including linkedPages if indicated


const fs = require('fs');
const {removeDoubles, makeURL, cleanPage, extractBody} = require('./import/stringUtilities.js');
const {loadLinkedPages,fetchAndRecode, fetchWithRetry, fetchLink,getVenuesFromArguments} = require('./import/fileUtilities.js');
const {loadVenuesJSONFile, saveToVenuesJSON, isAlias, initializeVenue} = require('./import/jsonUtilities.js');
const {getURLListFromPattern} = require('./import/dateUtilities.js');
const cheerio = require('cheerio');


const outputPath = './webSources/';
const nbFetchTries = 2; // number of tries in case of internet connection time outs

const venues = loadVenuesJSONFile();

const filteredVenues = getVenuesFromArguments(process.argv, venues);

// initializes new venues
filteredVenues.forEach(venue => initializeVenue(venue, outputPath));

// const venueToDownload = process.argv[2];
// if (venueToDownload && typeof venueToDownload !== "string"){
//   throw new Error('Argument for this script should be a venue name (string)');
// }

console.log("\n\x1b[36m***********************************************************************************");
console.log("ASPIRATOREX IS SNIFFING SOURCES FILES contained in venues JSON file.");
console.log("***********************************************************************************\x1b[0m");

if (filteredVenues.length === 0){
  console.log("No place matching arguments.");
}else{
  filteredVenues.filter(obj => isAlias(obj)).forEach(el =>
    console.log("Place %s is only defined as an alias and is not processed.",el.name)
  );
  // for non aliases venues
  filteredVenues.filter(obj => !isAlias(obj)).forEach((venue, index) => {
        // Afficher le numéro de l'objet
    console.log(`Venue ${index + 1}: \x1b[36m${venue.name} (${venue.city}, ${venue.country})\x1b[0m (${venue.scrapURL})`);
    // extract baseURL and add it to JSON
    try{
      // update venue base URL in case of a change
      const scrapURL = new URL(venue.scrapURL);
      venue.baseURL = scrapURL.origin + scrapURL.pathname.replace(/\/[^\/]+$/, '/');
      if (!venue.hasOwnProperty('country') || !venue.hasOwnProperty('city')){
        console.log('\x1b[31mError: venue \x1b[0m%s\x1b[31m has no country and/or city defined.',venue.name);
      }else{
          let path = outputPath+venue.country+'/'+venue.city+'/'+venue.name+'/';
          erasePreviousHtmlFiles(path)
          .then(() => {downloadVenue(venue,path);})
      } 
    }catch(err){
      console.log('\x1b[31mCannot read URL for %s.x1b[0m', venue.name);
    }
  });
}



// save base URL to JSON file
saveToVenuesJSON(venues);// écrit à la fin. Problème de sauvegarde si un des fichiers a un pb ?





/******************************/
/*       main function        */
/******************************/

async function downloadVenue(venue,path){
  let URLlist = [];
  if (venue.hasOwnProperty('multiPages')){
    if (venue.multiPages.hasOwnProperty('pattern')){
      URLlist = getURLListFromPattern(venue.scrapURL,venue.multiPages.pattern,venue.multiPages.nbPages);
      console.log(URLlist);
    }else if (/\{index\}/.test(venue.scrapURL)){
      if (venue.multiPages.hasOwnProperty('startPage') && venue.multiPages.hasOwnProperty('nbPages')){
        let increment = (venue.multiPages.hasOwnProperty('increment'))?venue.multiPages.increment:1;
        for(let i=0;i<venue.multiPages.nbPages;i++){
          const pageID = venue.multiPages.startPage+i*increment;
            URLlist.push(venue.scrapURL.replace('{index}',pageID));
        }
      }else{
        console.log("\x1b[31mAttribute \'startPage\' and \'nbPages' are mandatory for multipages if there is a placeholder \'index\' in the URL. No page loaded\x1b[0m.");
        URLlist = [];
      }  
    }else if(venue.multiPages.hasOwnProperty('pageList')){
        venue.multiPages.pageList.forEach(el => URLlist.push(venue.scrapURL+el));
    }else{
        console.log("\x1b[31mFound \'multiPage\', but found neither a place holder \'{index}\' or a list of URLs \'pageList\' to load. No page loaded\x1b[0m.");
        URLlist = [];
        console.log(venue.scrapURL);
    }
  }else{
    URLlist = [venue.scrapURL];
  }

  async function getPage(page,pageIndex){
    let htmlContent;
    try{
      //htmlContent = cleanPage(await fetchAndRecode(page));
      htmlContent = cleanPage(await fetchWithRetry(page,2,2000));
    }catch(err){
      console.log("\x1b[31mNetwork error, cannot download \'%s\'\x1b[0m. %s",page,err);
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
      console.log('First entries:',shortList(hrefList));
      // check the URLS that already exist
      const linkedFileContent = fs.existsSync(path+'linkedPages.json')?loadLinkedPages(path):[];
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

