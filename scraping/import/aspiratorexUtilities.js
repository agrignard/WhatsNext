/**********************************************************/
/*    utilities to deal with json objects and files for   */
/*    venues, events, style                               */
/**********************************************************/

//const path = require('path');
const fs = require('fs');
const {removeDoubles, makeURL, cleanPage} = require('./stringUtilities.js');
const {loadLinkedPages, fetchWithRetry, fetchLink, getPageByPuppeteer} = require('./fileUtilities.js');
//const {loadVenuesJSONFile, saveToVenuesJSON, isAlias, initializeVenue} = require('./jsonUtilities.js');
const {getURLListFromPattern} = require('./dateUtilities.js');
const cheerio = require('cheerio');

const nbFetchTries = 2; // number of tries in case of internet connection time outs


module.exports = {downloadVenue, erasePreviousHtmlFiles, getHrefListFrom, downloadLinkedPages};


    

/******************************/
/*       main function        */
/******************************/

async function downloadVenue(venue,filePath){
  let URLlist = [];
  let failedDownloads;
  if (venue.hasOwnProperty('multiPages')){
    if (venue.multiPages.hasOwnProperty('pattern')){
      URLlist = getURLListFromPattern(venue.url,venue.multiPages.pattern,venue.multiPages.nbPages);
      console.log(URLlist);
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
    }else if(venue.multiPages.hasOwnProperty('scroll')){
      URLlist = [venue.url];
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
      if (venue.hasOwnProperty('multiPages') && venue.multiPages.hasOwnProperty('scroll')){
        htmlContent = cleanPage(await getPageByPuppeteer(page));
      }else{
        console.log('files',URLlist);
        htmlContent = cleanPage(await fetchWithRetry(page,2,2000));
      }
    }catch(err){
      console.log("\x1b[31mNetwork error, cannot download \'%s\'\x1b[0m. %s",page,err);
      return '';
    }

    let outputFile;
    if (!venue.hasOwnProperty('multiPages') || venue.multiPages.hasOwnProperty('scroll')){
      outputFile = filePath+venue.name+".html";
    }else{
      outputFile = filePath+venue.name+pageIndex+".html";
    }

    fs.writeFileSync(outputFile, htmlContent, 'utf8', (erreur) => {
      if (erreur) {
        console.error("\x1b[31mCannot write local file \'%s\'\x1b[0m: %s",outputFile, erreur);
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
    await downloadLinkedPages(venue, filePath, pageList);
  }
}
  
  
/******************************/
/*       aux functions        */
/******************************/

async function downloadLinkedPages(venue, filePath, pageList){
  // if event tags are defined and contain URLs, download the URLs. Otherwise, ask to run an analyze 
  if (venue.mainPage.hasOwnProperty('eventsURLTags')||
    (venue.hasOwnProperty('eventsDelimiterTag') && venue.hasOwnProperty('eventURLIndex') && venue.eventURLIndex !== -1)){
    const hrefList = getHrefListFrom(pageList,venue);
    console.log('First entries:',shortList(hrefList));
    // check the URLS that already exist
    const linkedFileContent = fs.existsSync(filePath+'linkedPages.json')?loadLinkedPages(filePath):[];
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
      fs.writeFileSync(filePath+'linkedPages.json', jsonString);

      failedDownloads = hrefContents.reduce((acc, val) => {
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
  
function getHrefListFrom(pageList,venue){
  let hrefList;
  if (venue.mainPage.hasOwnProperty('eventURLTags')){// URL is found manually
    hrefList = pageList.map((page)=>getManualLinksFromPage(page,venue.eventsDelimiterTag,venue.mainPage.eventURLTags[0])).flat();
  }else{
    let index = venue.hasOwnProperty('eventURLIndex')?venue.eventURLIndex:0;
    hrefList = pageList.map((page)=>getLinksFromPage(page,venue.eventsDelimiterTag,index)).flat();
  }
  // get the list of URLs to download
  hrefList = removeDoubles(hrefList.filter(el => el !== undefined));
  hrefList = hrefList.map((el) => makeURL(venue.baseURL,el));
  return hrefList;
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
  