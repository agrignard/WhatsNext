/**************************************/
/*  utilities to deal with the files  */
/**************************************/

const puppeteer = require('puppeteer');
const fs = require('fs');
const cheerio = require('cheerio');
const {cleanPage, removeBlanks, extractBody, simplify} = require('./stringUtilities.js');


module.exports = {fetchLink, fetchAndRecode, fetchWithRetry, loadLinkedPages, saveToJSON, 
                    saveToCSV, getVenuesFromArguments,getFilesContent, getFilesNumber, 
                    getModificationDate, getPageByPuppeteer, minimalizeFile};

// minimalize file and save to output directory
async function minimalizeFile(file){
    console.log("minimalizing file "+file);

    //const venueSourcePath = sourcePath+venue.country+'/'+venue.city+'/'+venue.name+'/';
}

// minimalize file and return content
async function minimalizeFile(file){
    console.log("minimalizing file "+file);

    //const venueSourcePath = sourcePath+venue.country+'/'+venue.city+'/'+venue.name+'/';
}

async function getPageByPuppeteer(pageURL){
    const browser = await puppeteer.launch({
        // headless: false
    });
    const page = await browser.newPage();
    await page.goto(pageURL);
    await page.setViewport({
        width: 1200,
        height: 800
    });

    await autoScroll(page);

    const content = await page.content();
    await browser.close();

    // fs.writeFileSync('page.html', content);
    return content;
};


async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if(totalHeight >= scrollHeight - window.innerHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 300); // why can't it be set in a variable ?
        });
    });
}


// fetch linked page
async function fetchLink(page, nbFetchTries){
    try{
        const content = await fetchWithRetry(page, nbFetchTries, 2000);
        return extractBody(removeBlanks(cleanPage(content)));
    }catch(err){
        console.log("\x1b[31mNetwork error, cannot download \'%s\'.\x1b[0m",page);
    }
}
  
function fetchWithRetry(page, tries, timeOut) {
    return fetchAndRecode(page)
        .catch(error => {
        if (tries > 1){
            console.log('Download failed (%s). Trying again in %ss (%s %s left).',page,timeOut/1000,tries-1,tries ===2?'attempt':'attempts');
            return new Promise(resolve => setTimeout(resolve, timeOut))
            .then(() => fetchWithRetry(page,tries-1,timeOut));
        }else{
            console.log('Download failed (%s). Aborting (too many tries).',page);
            throw error;
        }
    });
}


// fetch url and fix the coding when it is not in UTF-8
async function fetchAndRecode(url){
    try{
        const response = await fetch(url);
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