/**********************************************************/
/*    utilities to deal with json objects and files for   */
/*    venues, events, style                               */
/**********************************************************/

//const path = require('path');
const fs = require('fs');
const {removeDoubles, makeURL, cleanPage} = require('./stringUtilities.js');
const {loadLinkedPages, fetchWithRetry, fetchLink, getPageByPuppeteer, BrowserPool} = require('./fileUtilities.js');
//const {loadVenuesJSONFile, saveToVenuesJSON, isAlias, initializeVenue} = require('./jsonUtilities.js');
const {getURLListFromPattern} = require('./dateUtilities.js');
const cheerio = require('cheerio');

const nbFetchTries = 2; // number of tries in case of internet connection time outs


module.exports = {downloadVenue, erasePreviousHtmlFiles, getHrefListFrom, downloadLinkedPages, getHrefFromAncestor};

const browserPool = new BrowserPool(3);
    

/******************************/
/*       main function        */
/******************************/

async function downloadVenue(venue, filePath, verbose = false, syncWriting = false){

  // set the list of URL of the pages that will be downloaded and merged to extract events.
  let URLlist = []; 
  // let failedDownloads;
  if (venue.hasOwnProperty('multiPages')){
    if (venue.multiPages.hasOwnProperty('pattern')){
      URLlist = getURLListFromPattern(venue.url,venue.multiPages.pattern,venue.multiPages.nbPages);
      // console.log(URLlist);
    }else if (/\{index\}/.test(venue.url) || venue.multiPages.hasOwnProperty('startPage')){
      if (venue.multiPages.hasOwnProperty('startPage') && venue.multiPages.hasOwnProperty('nbPages')){
        let increment = (venue.multiPages.hasOwnProperty('increment'))?venue.multiPages.increment:1;
        for(let i=0;i<venue.multiPages.nbPages;i++){
          const pageID = parseInt(venue.multiPages.startPage)+i*increment;
          if (/\{index\}/.test(venue.url) ){
            URLlist.push(venue.url.replace('\{index\}',pageID));
          }else{
            URLlist.push(venue.url+pageID);
          }
          
        }
      }else{
        console.log("\x1b[31mAttribute \'startPage\' and \'nbPages' are mandatory for multipages if there is a placeholder \'index\' in the URL. No page loaded\x1b[0m.");
        URLlist = [];
      }
    }else if(venue.multiPages.hasOwnProperty('scroll') || venue.multiPages.hasOwnProperty('nextButton')){
      URLlist = [venue.url];
    }else if(venue.multiPages.hasOwnProperty('pageList')){
        venue.multiPages.pageList.forEach(el => URLlist.push(venue.url+el));
    }else{
        console.log("\x1b[31mFound \'multiPage\', but found neither a place holder \'{index}\' or a list of URLs \'pageList\' to load. No page loaded\x1b[0m.");
        URLlist = [];
        console.log(venue.url);
    }
  // }else if (venue.hasOwnProperty('dynamicPage')){
  }else{
    URLlist = [venue.url];
  }
  if (verbose){
    console.log(URLlist);
  }
  
  async function getPage(page,pageIndex){
    let htmlContent;
    try{
      if (venue.hasOwnProperty('multiPages') && (venue.multiPages.hasOwnProperty('scroll') || venue.multiPages.hasOwnProperty('nextButton'))){
        htmlContent = cleanPage(await getPageByPuppeteer(page,venue.name,venue.multiPages, browserPool));
      }else if (venue.hasOwnProperty('dynamicPage')) {
        htmlContent = cleanPage(await getPageByStealthPuppeteer(page,venue.name,venue.multiPages, browserPool));
      }else{
        htmlContent = cleanPage(await fetchWithRetry(page,2,2000));
      }
    }catch(err){
      if (verbose){
        console.log("\x1b[38;5;226mNetwork error (or file not exists), cannot download \'%s\'\x1b[0m. %s",page,err);
      }else{
        console.log("\x1b[38;5;226mCannot download page \x1b[0m%s\x1b[38;5;226m (error: %s).\x1b[0m",page,err);
      }
      return null;
    }

    let outputFile;
    if (!venue.hasOwnProperty('multiPages') || venue.multiPages.hasOwnProperty('scroll') || venue.multiPages.hasOwnProperty('nextButton')){
      outputFile = filePath+venue.name+".html";
    }else{
      outputFile = filePath+venue.name+pageIndex+".html";
    }

    if (syncWriting){
      try {
        fs.writeFileSync(outputFile, htmlContent, 'utf8');
        if (verbose) {
          console.log("File downloaded for venue \x1b[36m" + venue.name + "\x1b[0m to " + outputFile);
        }
      } catch (err) {
        console.error("\x1b[31mCannot write local file \'%s\'\x1b[0m: %s", outputFile, err);
      }
    }else{
      fs.writeFile(outputFile, htmlContent, 'utf8', (err) => {
        if (err) {
          console.error("\x1b[31mCannot write local file \'%s\'\x1b[0m: %s", outputFile, err);
        } else {
          if (verbose){
            console.log("File downloaded for venue \x1b[36m" + venue.name  + "\x1b[0m to " + outputFile);
          } 
        }
      });
    }

    return htmlContent;
  }

  // read the pages and save them to local files
  let pageList = (await Promise.all(URLlist.map((page,pageIndex)=>getPage(page,pageIndex)))).flat();

  // test if the download process worked.


  const nullCount = pageList.filter(p => p === null).length;
  const nonNullCount = pageList.length - nullCount;

  // if some page downloads failed: if some files were downloaded properly, send a warning message (maybe index problem for multipages)
  // otherwise raise an error, with download failed

  if (nullCount > 0){
    if (nonNullCount > 0){
      console.log("\x1b[38;5;226mWarning: %d pages were correctly downloaded for venue \x1b[0m%s\x1b[38;5;226m, but some failed. "+
        "Possible causes: wrong index for some pages, network error, or non existing files.",nonNullCount,venue.name);
      console.log("Proceeding with existing files and ignore missing ones.\x1b[0m");
      pageList = pageList.filter(p => p !== null);
    }else{
      console.log("\x1b[31mPage download for venue \x1b[0m%s\x1b[31m failed. Possible causes: network error or file not exists.\x1b[0m", venue.name);
      return;
    }
  }

  // test if delimiters can be found in the downloaded page. If not found, probably the structure of the page has changed
  // or the site is down and shows a filler page

  if (await hasDelimiter(pageList, venue.eventsDelimiterTag)) {
    if (verbose){
      console.log("Event found for %s.",venue.name);
    }
    
    
  } else {
     console.log('\x1b[31mPage was successfully downloaded for \x1b[0m\'%s\'\x1b[31m, but no event delimiter was found.\n'+
                'Possible issues: 1) the page does not exist anymore 2) its structure has changed '+
                '3) It is a dynamic page that is not fully loaded, check dynamic/multipage parameters.\x1b[0m',venue.name)
        return;
  }
  
  // get linked pages
  if (venue.hasOwnProperty('linkedPage')){
    await downloadLinkedPages(venue, filePath, pageList);
  }
  
}
  
  
/******************************/
/*       aux functions        */
/******************************/

async function downloadLinkedPages(venue, filePath, pageList, verbose = false, messageTarget = undefined){
  
  const hrefList = getHrefListFrom(pageList,venue);


  let count = 0;
  if (messageTarget){
    let intervalAction = setInterval(() => {
      console.log(count++);
      messageTarget.textContent = "essai "+count;
      
      if (count > 5) {
        clearInterval(intervalAction);
      }
    }, 1000); 
  }
  

  // if no URL found, abort download
  if(!venue.mainPage.hasOwnProperty('eventsURLTags') && !venue.mainPage.hasOwnProperty('eventsMultiURLTags')
      && hrefList.length === 0){
    console.log('\x1b[31mTrying to download linked pages for \x1b[0m\'%s\'\x1b[31m, but no URL link could be found automatically.'+
                'Check if URL to linked page exists. If yes, try to set the URL tag manually, then run aspiratorex.js again.\x1b[0m',venue.name);
        return;
  }
 
  if (verbose) {
    console.log('First entries:', shortList(hrefList));
  }

  // check the URLS that already exist
  const linkedFileContent = fs.existsSync(filePath + 'linkedPages.json') ? loadLinkedPages(filePath) : [];
  const existingLinks = hrefList.filter(el => Object.keys(linkedFileContent).includes(el));
  const linksToDownload = hrefList.filter(el => !Object.keys(linkedFileContent).includes(el));

  // const linksToDownload = ['https://le-sucre.eu/agenda/techno-body-music/',
  // 'https://le-sucre.eu/agenda/warum-residency/',
  // 'https://le-sucre.eu/agenda/s-society-99/',
  // 'https://le-sucre.eu/agenda/mini-club-x-promesses-2/',
  // 'https://le-sucre.eu/agenda/club-x-vel-residency/',
  // 'https://le-sucre.eu/agenda/s-society-101/'];


  const nbLinksToDownload = linksToDownload.length;
  // 
  if (linksToDownload.length === 0) {
    console.log('All links (%s) already downloaded for venue \x1b[36m%s\x1b[0m.', hrefList.length, venue.name);
  } else {
    console.log('Loading linked pages for venue \x1b[36m%s\x1b[0m. '
      + 'Found %s links: %s already exist and won\'t be downloaded, '
      + 'downloading %s links...', venue.name, hrefList.length, existingLinks.length,
      nbLinksToDownload);
  }
    
  // put the existing links in a new JSON object
  let hrefJSON = {};
  existingLinks.forEach(key => {
    hrefJSON[key] = linkedFileContent[key];
  });

  // console.log('start download');
  const start = performance.now();

  let hrefContents;
  try {
    if (venue.hasOwnProperty('linkedPageDownloadMethod') && venue.linkedPageDownloadMethod === 'Puppeteer'){
      hrefContents = (await Promise.all(linksToDownload.map(el => fetchLink(el, 0, true))));
    }else{
      hrefContents = (await Promise.all(linksToDownload.map(el => fetchLink(el, nbFetchTries))));
    }
  } catch (err) {
    console.log("\x1b[31mNetwork error, cannot load linked page for \'%s\'\x1b[0m: %s", venue.name, err);
  }
  linksToDownload.forEach((href, index) => hrefJSON[href] = hrefContents[index]);

  let downloadedCount = 0;
  // const downloadPromises = linksToDownload.map(async (link) => {
  //   try {
  //     const content = await fetchLink(link, nbFetchTries);
  //     console.log('count: ',downloadedCount);
  //     downloadedCount++;
  //     // update GUI message
  //     if (messageTarget){
  //       console.log('test');
  //       // messageTarget.textContent = `Links downloaded : ${downloadedCount}/${nbLinksToDownload}`;
  //       messageTarget.textContent = `Now: ${downloadedCount}/${nbLinksToDownload}`;
  //     }
  //     if (true){
  //       console.log(`Links downloaded : ${downloadedCount}/${nbLinksToDownload}`);
  //     }
  //     return content;
  //   } catch (err) {
  //     console.error(`Download error for ${link} : ${err}`);
  //     return null;
  //   }
  // });

  // console.log('avant');

  // // wait for all promises to be resolved
  // const results = await Promise.all(downloadPromises);
  // hrefContents = results.map(el => el.value);

  // console.log('end download');
  const end = performance.now();
  console.log(`Le code a mis ${(end - start)/1000}s à s'exécuter.`);

  // put the new links
  


  // linksToDownload.forEach((href, index) => hrefJSON[href] = hrefContents[index]);


  

  try {
    const jsonString = JSON.stringify(hrefJSON, null, 2);
    fs.writeFileSync(filePath + 'linkedPages.json', jsonString);

    failedDownloads = hrefContents.reduce((acc, val) => {
      return acc + (val === undefined ? 1 : 0);
    }, 0);

    // test if all downloads are successful
    if (linksToDownload.length !== 0) {
      if (failedDownloads === 0) {
        console.log('All linked pages successfully downloaded and saved for \x1b[36m%s\x1b[0m.', venue.name);;
      } else {
        console.log('\x1b[31mVenue \x1b[36m%s: \x1b[31m%s\x1b[0m/%s links downloaded. '
          + '(%s) new links downloaded this run. '
          + '\x1b[31mRun aspiratorex again to load remaining links.\x1b[0m',
          venue.name, hrefList.length - failedDownloads, hrefList.length,
          hrefList.length - failedDownloads - existingLinks.length);
      }
    }
  } catch (err) {
    console.log('\x1b[31mCannot save links to file \'linkedPages.json\' %s\x1b[0m', err);
  }
  
}
  
  

function getLinksFromPage(page,delimiter, atag, subEventPath){// get the URL from atag (optional), or from the delimiters if atag is not present
  const $ = cheerio.load(page);
  let res = [];

  // console.log($.html());
  $(':root').find(delimiter).each(function () {

  // $(delimiter).each(function () {
    let href;
    // console.log('delimiter',$(this).text());
    if (atag){// get the URL from tag with path atag
      const $delimiterBlock = $(this);
      if (subEventPath){
        $delimiterBlock.find(subEventPath).each(function() {
          $(this).find(atag).each(function (){
            href = getHrefFromAncestor($(this));
            if (href){
              res.push(href);
            }
          });
          // const href = $(this).closest('A.agendaevent.depth8').attr('href');
        });
      }else{
        href = getHrefFromAncestor($delimiterBlock.find(atag));
        if (href){
          res.push(href);
        }
      }
    }else{// the link is in the delimiter. If for any reason the link is in an ancestor of the delimiter, the next line should be modified (use also function getHrefFromAncestor ?)
      href = $(this).attr('href');
      if (href){
        res.push(href);
      }
    }
  });
  return res;
}


  
async function erasePreviousHtmlFiles(filePath){

  fs.readdir(filePath, (err, files) => {
    if (err) {
      console.error('\x1b[31mCannot open directory.\x1b[0m', err);
      return;
    }
    files.filter(fileName => fileName.endsWith('.html'))
    .forEach(file => {
      const fileToErase = `${filePath}/${file}`;
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

// test for the presence of events in the page list. Maybe too resource consuming because it forces to load pages with Cheerio until
// it finds a valid event delimiter

async function hasDelimiter(pageList, delimiter) {
  for (const page of pageList) {
    const $ = cheerio.load(page);
    if ($(delimiter).length > 0) {
      return true; // found a valid delimiter. Stop here
    }
  }
  return false; // no page contains a delimiter
}



  
function getHrefListFrom(pageList,venue){
  let hrefList;
  if (venue.mainPage.hasOwnProperty('eventURLTags') || venue.mainPage.hasOwnProperty('eventMultiURLTags')){// URL is found manually
    hrefList = [];
    if (venue.mainPage.hasOwnProperty('eventURLTags')){
      hrefList = pageList.flatMap((page)=> 
        getLinksFromPage(page,venue.eventsDelimiterTag,venue.mainPage.eventURLTags[0])
    )};
    if (venue.mainPage.hasOwnProperty('eventMultiURLTags')){
      // compute path from sub event delimiter
      let path = venue.mainPage.eventMultiURLTags[0];
      const subEventPath = path.split('>').filter(el => !el.endsWith(')')).join('>');
      path = path.split('>').filter(el => el.endsWith(')')).join('>');
      hrefList = hrefList.concat(pageList.flatMap((page)=> 
        getLinksFromPage(page,venue.eventsDelimiterTag,path,subEventPath))
    )};
  }else{// URL is found in delimiter if it exists
    hrefList = pageList.map((page)=>getLinksFromPage(page,venue.eventsDelimiterTag)).flat();
  }
  // get the list of URLs to download
  hrefList = removeDoubles(hrefList.filter(el => el !== undefined));
  hrefList = hrefList.map((el) => makeURL(venue.baseURL,el));
  // console.log(hrefList.length);
  return hrefList;

}

function getHrefFromAncestor(tag){
  if (tag.length === 0){
    return null;
  }
  while (tag.length > 0){
    if (tag.attr('href')){
      return tag.attr('href');
    }
    tag = tag.parent();
  }
  console.log('Error');
  throw new Error("No ancestor with URL could be found.");
}


// function reduceImgSize(html){
//   const regexWidth = /(\<(?:img|svg)[^\<]*width\s*=\s*\")([^\"]*)\"/g;
//   const regexHeight = /(\<(?:img|svg)[^\<]*height\s*=\s*\")([^\"]*)\"/g;

//   function replace(p1,p2,p3){
//     if (p3 > 100){
//       return p2+'50'+'\"';
//     }
//     return p1;
//   }
//   return html.replace(regexWidth,replace).replace(regexHeight,replace);
// }
  