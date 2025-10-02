/**************************************/
/*  utilities to deal with the files  */
/**************************************/

const outputFormat = 'text';// for tests, to be removed

const puppeteer = require('puppeteer');
// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());


// const { BrowserPool } = require('browser-pool');
const fs = require('fs');
// const fetch = require('electron-fetch').default;
// const axios = require('axios');
const cheerio = require('cheerio');
const {cleanPage, removeBlanks, extractBody, simplify} = require('./stringUtilities.js');




class BrowserPool {
    constructor(maxConcurrent = 3) {
        this.maxConcurrent = maxConcurrent;
        this.activeBrowsers = new Set();
    }

    async acquire() {
        while (this.activeBrowsers.size >= this.maxConcurrent) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.activeBrowsers.add(browser);
        return browser;
    }

    async release(browser) {
        if (browser && this.activeBrowsers.has(browser)) {
            await browser.close();
            this.activeBrowsers.delete(browser);
        }
    }
}

module.exports = {fetchLink, fetchAndRecode, fetchWithRetry, loadLinkedPages, saveToJSON, 
                    saveToCSV, getVenuesFromArguments,getFilesContent, getFilesNumber, 
                    getModificationDate, getPageByPuppeteer, getIframesList,
                    minimalizeHtmlFile, minimalizeHtml, 
                    BrowserPool};


/*******************************/
/***        functions        ***/
/*******************************/


// minimalize file and save to output directory
async function minimalizeHtmlFile(fileName, inputPath, outputPath){
    console.log("minimalizing file \x1b[36m"+fileName+"\x1b[0m and saving to \x1b[36m"+outputPath+"\x1b[0m.");
    // console.log(outputPath);
    const file = inputPath+fileName;
    // console.log("opening "+file);
    let content = fs.readFileSync(file, 'utf-8');
    htmlContent = minimalizeHtml(content, outputFormat);
    saveToFile(htmlContent, fileName, outputPath);
}

// function to reduce the size of the html.
function minimalizeHtml(content, action = "basic"){    //option: 'basic' (default) to have a more compact file, 
                                                    //'compact': basic+replace classes names with more compact one
                                                    //'minimal': keep html structure with only basic information (tags...)
                                                    //'text': to keep only the text
                                                    //'parenthesis': replace tags by 

    let regex;

    // remove head information
    content = content.replace(/<head[^]*?<\/head>/g,'');

    // remove useless tags
    tagsToRemove = ["path","header","svg","video","option","button","footer","nav","select"];
    tagsToRemove.forEach(el => {
        regex = new RegExp("<"+el+"[^]*?<\/"+el+">","g");
        content = content.replace(regex,'');
    });

    // remove images
    content = content.replace(/<img[^]*?>/g,'');

    if (action === 'parenthesis'){
        console.log('fddsfds');
        // remove blanks and new line
        content = content.replace(/>[\n\s\t]*</g,'><');
        content = content.replace(/<\/[^>]*>/g,']');
        content = content.replace(/<[^>]*>/g,'[');
        return content;
    }
  
    // remove useless attributes
    attrToRemove = ["style","alt","decoding","srcSet","src","sizes","rel","target","aria-label",
        "aria-haspopup","aria-expanded","aria-current","aria-hidden","aria-disabled","aria-controls",
        "data-state"];
    if (action === 'minimal'){
        attrToRemove.push('class');
    }
    
    attrToRemove.forEach(el => {
        regex = new RegExp(el+"[ ]*=[ ]*\"[^]*?\"","g");
        content = content.replace(regex,'');
    });

    // remove all tags
    if (action === 'text'){
        // remove blanks and new line
        content = content.replace(/>[\n\s\t]*</g,'><');

        content = content.replace(/<\/time[^>]*>/g,'\n');
        content = content.replace(/<time[^>]*>/g,' ');
        content = content.replace(/<![^>]*>/g,'');

        // remove <a> tags but keep the link
        content = content.replace(/<[\s\t\n]*a\s[^>]*href[\s\t\n]*=[\s\t\n]*"([^"]+)"[^>]*>/g, (match, url) => {
            return `lien web : https://www.shotgun.fr${url}\n`;});// base url to be replaced
        // content = content.replace(/<[\s\t\n]*\/a[\s\t\n]*>/g,'');

        const endTagReplacements = {
            ['\n']: ['div', 'h1', 'h2','h3','h4','h5','h6','h7','body','head','html','section', 'li','p','ul'],
            ' ': ['span','a','strong','b','em'],
        };

        Object.keys(endTagReplacements).forEach(key =>{
            endTagReplacements[key].forEach(el =>{
                // remove opening tag
                regex = new RegExp("<[\s\t\n]*"+el+"[^>]*>","g");
                content = content.replace(regex,'');
                // replace closing tag with key
                regex = new RegExp("<\/[\s\t\n]*"+el+"[^>]*>","g");
                content = content.replace(regex,key);
            });
        })  

        // test if some tags have been forgotten
        const errors = content.match(/<[\s\t\n]*(\w+)[^>]*>.*?<\/\1>/g);
        if (errors){
            const unlistedTags = [...new Set(errors.map(e => e.match(/<[\s\t\n]*(\w+)/)[1]))];
            unlistedTags.forEach(e => console.log('\x1b[31mWarning: tag \x1b[0m'+e+'\x1b[31m found in html that was '
                                  +'not in minimalizeHtml fileUtilities.js.\x1b[0m'));
        } 

        content = content.replace(); /// ????

    }

   
    // // compact class names
    if (action === 'compact'){
        regex = /class[\s\t]*=[\s\t]*"([^"]+)"/g;
        let correspondance;
        const classes = [];
        // find all the unique classes
        while ((correspondance = regex.exec(content)) !== null) {
        classes.push(...correspondance[1].split(" "));
        }
        const uniqueClasses = [...new Set(classes)];
        const mapRangs = {};
        uniqueClasses.forEach((classe, index) => {
            mapRangs[classe] = "c"+(index + 1); 
        });
        content = content.replace(/class[\s\t]*=[\s\t]*"([^"]+)"/g, (_, classContent) => {
            const classWithRank = classContent
            .split(" ")
            .map(classe => mapRangs[classe]) 
            .join(" ");
            return `class="${classWithRank}"`;
        });
    }  

    //remove extra line breaks
    // content = content.replace(/\n[\s\t]*\n/g,'\n');
    return content;
}


function saveToFile(content,fileName, path){
    // console.log(path);
    verifyPath(path);
    fs.writeFileSync(path+fileName, content, 'utf8', (err) => {
        if (err) {
          console.error("\x1b[31mCannot write local file \'%s\'\x1b[0m: %s",file, err);
        } 
    });
}

// create country, city and venue directories if they don't exist
function verifyPath(path){
    let dirs = path.split("/");
    for (let i=dirs.length-4;i<dirs.length-1;i++){
        const currentPath = dirs.slice(0,i+1).join("/");
        // console.log(currentPath);
        if (!fs.existsSync(currentPath)){
            fs.mkdirSync(currentPath);
        }
    }
}


async function detectIframes(page){
    // Récupérer toutes les iframes
    const iframeList = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map(f => ({
            src: f.src,
            id: f.id,
            name: f.name
        }));
    });

    // console.log('Iframes détectées :', iframeList);
    return iframeList;

};


async function getIframesList(pageURL) {
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto(pageURL, { waitUntil: 'networkidle2' });

        const iframeList = await detectIframes(page);

        return iframeList;

    } catch (err) {
        console.error("Error in getIframesList:", err.message);
        throw err;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}


async function getPageByPuppeteer(pageURL, venue, multipagesOptions, browserPool, parentBrowser = null, iframesDetection = false, verbose = false){

    venueName = venue.name;
    let browser = parentBrowser;
    if (!browser) {
        browser = await browserPool.acquire();
    }
    const page = await browser.newPage();

    try{
    
        try{
            await page.goto(pageURL, { waitUntil: 'networkidle2', timeOut: 15000});
        }catch(err){
            console.log('\x1b[31mError in Puppeteer for venue \x1b[0m'+venue.name
                        +'\x1b[31m (page.goto) with URL \'\x1b[0m'+pageURL+'\x1b[31m\'. Check URL or iframe settings.\x1b[0m');
            throw err;
        }
        
        const iframeList = iframesDetection?await detectIframes(page):[];

        if (multipagesOptions.hasOwnProperty('useIframes') && iframeList.length > 0) {
            console.log('detected Iframes:',iframeList);
            await page.close();
            return await getPageByPuppeteer(iframeList[0].src, venue, multipagesOptions, browserPool, browser, iframesDetection = false, verbose = false);
        }

        await page.setViewport({ width: 1200, height: 3000 });
        

        if (multipagesOptions.hasOwnProperty('scroll')){
            if (verbose) {console.log('scrolling...');}
            const maxScrolls = multipagesOptions.hasOwnProperty('dynamicPageLimit')?multipagesOptions.dynamicPageLimit:null;
            await autoScroll(page, maxScrolls);
            if (verbose) {console.log('scrolling ended.');}
        }

        try{
            try{
                if (multipagesOptions.hasOwnProperty('nextButton')){
                    if (verbose) {
                        console.log("Start clicking...");
                        page.on('console', (msg) => {
                            console.log('Browser message ('+venue.name+'): '+msg.text());
                        });
                    }

                    let hasMoreContent = true;
                    count = 0;
                    const buttonText = multipagesOptions.nextButton;

                    while (hasMoreContent) {
                        count++;
                        // stop clicking if a max number of pages has been set
                        if (multipagesOptions.hasOwnProperty('dynamicPageLimit') && count > multipagesOptions.dynamicPageLimit){
                            console.log('Download successful for venue \x1b[36m%s\x1b[0m: %s clicks were performed. Stopped because the maximum number of clicks has been reached.', venueName, multipagesOptions.dynamicPagesLimit);
                            break;
                        }
                        hasMoreContent = await page.evaluate((buttonText, count, verbose) => { 
                            const buttons = Array.from(document.querySelectorAll('button')); 

                            const button = buttons.find(
                                btn => btn.textContent.trim() === buttonText && btn.offsetParent !== null
                            );
                            if (button) {
                                if (verbose) {console.log("click", count)};
                                button.click();
                                return true;
                            }else{
                                if (count == 1){
                                    return 'buttonNotFound';
                                }
                                return false;
                            }
                        },buttonText,count, verbose);
                        if (hasMoreContent === 'buttonNotFound'){
                            console.log('\x1b[38;5;226mWarning: button \x1b[0m\'%s\'\x1b[38;5;226m not found\x1b[0m for venue \x1b[36m%s\x1b[0m.',buttonText,venueName);
                            break;
                        }
                        if (hasMoreContent === false){
                            console.log('Download successful for venue \x1b[36m%s\x1b[0m: %s clicks were performed.', venueName, count);
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
    
            } catch (err) {
                console.log('\x1b[31mError in puppeteer: \x1b[0m',err);
            }
            
            const content = await page.content();
            await browser.close();

            return content;
        }catch (error) {
            console.error(`Error processing ${pageURL}: ${error.message}`);
            throw error;
        } finally {
            if (browser) {
                await browserPool.release(browser);
            }
        }
    }catch(err){
        if (parentBrowser){
            page.close();
        }else{
            browser.close();
        }
        throw err;
    }
};




// can this autoscroll function replace the other one ?

async function autoScroll(page, maxScrolls = null, delay = 500) {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    let lastHeight = await page.evaluate(() => document.body.scrollHeight);

    // end the loop if maxscrolls is defined and i > maxscrolls
    for (let i = 0; !maxScrolls || i < maxScrolls; i++) {
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
        });

        await wait(delay);

        const newHeight = await page.evaluate(() => document.body.scrollHeight);

        // stops if the height has not changed
        if (newHeight === lastHeight) {
            break;
        }

        lastHeight = newHeight;
    }
}

// async function autoScroll(page) {
//     await page.evaluate(async () => {
//         await new Promise((resolve) => {
//             let lastHeight = document.body.scrollHeight;
//             const distance = 300; // pixels to scroll at each step
//             const timer = setInterval(() => {
//                 window.scrollBy(0, distance);
//                 const newHeight = document.body.scrollHeight;

//                 // stops if height doesn't change 
//                 if (newHeight === lastHeight) {
//                     clearInterval(timer);
//                     resolve();
//                 }

//                 lastHeight = newHeight;
//             }, 500); // 0.5s delay
//         });
//     });
// }








async function fetchWithPuppeteer(url){
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url,{ waitUntil: 'networkidle2' });
    const html = await page.content();
    // console.log(html);
    await browser.close();
    return html;
}

// fetch linked page
async function fetchLink(page, nbFetchTries, usePuppeteer = false){
    try{
        if (usePuppeteer){
            const content = await fetchWithPuppeteer(page);
            return extractBody(removeBlanks(cleanPage(content)));
        }else{
            const content = await fetchWithRetry(page, nbFetchTries, 2000);
            return extractBody(removeBlanks(cleanPage(content)));
        }
    }catch(err){
        console.log("\x1b[31mNetwork error, cannot download \'%s\'.\x1b[0m",page,err);
    }
}
  
function fetchWithRetry(page, tries, timeOut, verbose = false) {
    return fetchAndRecode(page)
        .catch(error => {
        if (tries > 1){
            if (true) {
                console.log('Download failed (%s). Trying again in %ss (%s %s left).',page,timeOut/1000,tries-1,tries ===2?'attempt':'attempts');
            }
            return new Promise(resolve => setTimeout(resolve, timeOut))
            .then(() => fetchWithRetry(page,tries-1,timeOut));
        }else{
            if (true){
                console.log('Download failed (%s). Aborting (too many tries).',page);
            }
            throw error;
        }
    });
}


// fetch url and fix the coding when it is not in UTF-8 (axios version)
// this version does work with le sucre. Why ???

// async function fetchAndRecode(url) {
//     try {
//     //   console.log('fetchAndRecode début');
//     //   const response = await axios.get(url, { responseType: 'arraybuffer' });
//       const response = await fetch(url);
//     //   console.log('fetchAndRecode fin');
//       const contentType = response.headers['content-type'];
//       const encodingMatch = contentType && contentType.match(/charset=([^;]+)/i);
//       const encoding = encodingMatch ? encodingMatch[1] : 'utf-8'; // Par défaut, utf-8
//       const decoder = new TextDecoder(encoding);
//       return decoder.decode(response.data);
//     } catch (error) {
//       console.error(`Erreur lors du téléchargement de ${url} : ${error}`);
//       throw error;
//     }
//   }



async function fetchAndRecode(url){
    try{
        // console.log('fetchAndRecode debut');
        const response = await fetch(url);
        // const response = await fetchWithPuppeteer(url);

        // console.log('fetchAndRecode fin');
        const encoding = response.headers.get('content-type').split('charset=')[1]; // identify the page encoding
        if (encoding === 'utf-8'){// || encoding ==='UTF-8'){
            return await response.text();
        }else{
            try{
                //console.log('Page encoding: ',encoding);
                const decoder = new TextDecoder(encoding); // convert to plain text (UTF-8 ?)
                return  response.arrayBuffer().then(buffer => decoder.decode(buffer));
            }catch(err){
                console.log('Decoding problem while processing %s. Error: %s',url,err);
                throw err;
            }
        }
    }catch(error){
        throw error;
    }
}


// load linked files (subpages with more details about the event)
function loadLinkedPages(sourcePath){
    try{
        return JSON.parse(fs.readFileSync(sourcePath+'linkedPages.json', 'utf8'));
    }catch(err) {
        console.error("\x1b[31mError while retrieving linked pages: %s\x1b[0m\n",sourcePath+'linkedPages.json');
        return undefined;
    }
}

// save json data to .json
function saveToJSON(data,fileName){
    try{
        const jsonString =  JSON.stringify(data, null, 2);  
        fs.writeFileSync(fileName, jsonString);
      }catch(err){
          console.log('\x1b[31mError saving to \'%s\': \x1b[0m%s',fileName,err);
      }
} 

// save json data to .csv
function saveToCSV(eventList, outFile){
    let out = '';
    eventList.forEach(eventInfo =>{
      out = out+''+eventInfo.eventPlace+';'
      +eventInfo.eventName+';'+eventInfo.unixDate+';100;'+eventInfo.eventStyle+';'+eventInfo.eventDetailedStyle+';'+eventInfo.eventURL+';'+eventInfo.eventTime+';'+eventInfo.eventDate+'\n';
    });
    try{
      fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
    }catch(err){
      console.log("\x1b[31mImpossible de sauvegarder dans le fichier \x1b[0m\'%s\'\x1b[31m. %s\x1b[0m",outFile,err.message);
    } 
}


// used to analyse arguments passed to scrapex or aspiratorex
function getVenuesFromArguments(args, venueList){
    let venues = venueList;
    if (args.length > 2){
        const venuesFilter = filterFromArguments(args);
        if (venuesFilter){
          venues = (venuesFilter.name==='*'||venuesFilter.name==='?')?
                venues:venues.filter(el => simplify(el.name) === simplify(venuesFilter.name));
          venues = (venuesFilter.city==='*'||venuesFilter.city==='?')?
                venues:venues.filter(el => simplify(el.city) === simplify(venuesFilter.city));
          venues = (venuesFilter.country==='*'||venuesFilter.country==='*')?
                venues:venues.filter(el => simplify(el.country) === simplify(venuesFilter.country));
        }else{
          venues = [];
        }
    }
    return venues;
}

function filterFromArguments(args){
    const scriptName = args[1].split(/[\/\\]/).pop().split('.').shift();
    args = args.slice(2).map(el => el.toLowerCase());
    const action = scriptName === 'scrapex'?'scrap':'download';

    if (args.length > 3){
        console.log(args.length);
        console.log("\x1b[31mError: too many arguments\x1b[0m");
        args = ['--help'];
      }
      if (args.some(arg => arg === '--help')){
        console.log('\nSyntax: node ./'+scriptName+' [\x1b[32msource_name\x1b[0m] '+
                    '[\x1b[32mcity\x1b[0m \x1b[90m(optional)\x1b[0m] '+
                    '[\x1b[32mcountry\x1b[0m \x1b[90m(optional)\x1b[0m]\n'+
                    'This will '+action+' websites with the corresponding name/city/country.\n'+
                    'Wildcards \'*\' allowed (\x1b[90mnode ./'+scriptName+' * Lyon\x1b[0m will '+
                    action+' all websites from cities called Lyon)\n'+
                    'Alternatively, you can use options \x1b[90m--city=city_name\x1b[0m or \x1b[90m--country=country_name\x1b[0m, wildcards will be filled automatically');
        return undefined;
    }else{
        let i=0;
        let res ={name:'*', city:'*', country:'*'};
        for (let j = 0; j<args.length; j++){
            if (args[j].startsWith('--')){
                if (args[j].startsWith('--city=')){
                    res.city = args[j].replace('--city=','');
                }else if (args[i].startsWith('--country=')){
                    res.city = args[j].replace('--country=','');
                }else{
                    console.log('Wrong option: %s. Use option --help for syntax details.',args[i]);
                    return undefined;
                }
            }else{
                res[Object.keys(res)[i]] = args[j];
                i++;
            }
        }
        return res;
    }
}

// return the content of the files
function getFilesContent(sourcePath, maxPages){
    let inputFileList;
    try {
        inputFileList = fs.readdirSync(sourcePath)
        .filter(fileName => fileName.endsWith('.html'))
        .map(el => sourcePath+el);
    } catch (err) {
        console.error('\x1b[31mError reading html files in directory \'%s\'.\x1b[0m Error: %s',sourcePath, err);
    }

    function readBodyContent(file) {
        const content = fs.readFileSync(file, 'utf-8');
        const $ = cheerio.load(content);
        return $('body').html();
    }
    if (maxPages && inputFileList.length > maxPages){
        inputFileList = inputFileList.filter(el => el.match(/[0-9]*(?=\.html$)/) < maxPages);
    }
    // load main pages
    return inputFileList.map(readBodyContent).join('\n');
}


// return the content of the files
function getModificationDate(sourcePath){
    let fileName;
    try {
        fileName = fs.readdirSync(sourcePath).find(fileName => fileName.endsWith('.html')); 
    } catch (err) {
        return undefined;
    }
    if (fileName){
        const inputFilePath = sourcePath+fileName;
        const stats = fs.statSync(inputFilePath);
        return new Date(Math.round(stats.mtimeMs));
    }else{
        return undefined;
    }
}

// return the number of files

function getFilesNumber(sourcePath){
    let inputFileList;
    try {
        inputFileList = fs.readdirSync(sourcePath)
        .filter(fileName => fileName.endsWith('.html'))
    } catch (err) {
        console.error('\x1b[31mError reading html files in directory \'%s\'.\x1b[0m Error: %s',sourcePath, err);
    }
    return inputFileList.length;
}