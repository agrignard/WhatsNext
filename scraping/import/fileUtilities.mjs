/**************************************/
/*  utilities to deal with the files  */
/**************************************/

import * as fs from 'fs';
import {cleanPage, removeBlanks, extractBody} from './stringUtilities.mjs';

// fetch linked page
export async function fetchLink(page, nbFetchTries){
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
export async function fetchAndRecode(url){
    try{
        const response = await fetch(url);
        const encoding = response.headers.get('content-type').split('charset=')[1]; // identify the page encoding
        if (encoding === 'utf-8'){// || encoding ==='UTF-8'){
            //console.log('UTF8');
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
export function loadLinkedPages(sourcePath){
    try{
        return JSON.parse(fs.readFileSync(sourcePath+'linkedPages.json', 'utf8'));
    }catch(err) {
        console.error("\x1b[31mError while retrieving linked pages: %s\x1b[0m\n",sourcePath+'linkedPages.json');
        throw err;
    }
}

// save json data to .json
export function saveToJSON(data,fileName){
    try{
        const jsonString =  JSON.stringify(data, null, 2);  
        fs.writeFileSync(fileName, jsonString);
      }catch(err){
          console.log('\x1b[31mError saving to \'%s\': \x1b[0m%s',fileName,err);
      }
} 

// save json data to .csv
export function saveToCSV(eventList, outFile){
    let out = '';
    eventList.forEach(eventInfo =>{
      out = out+''+eventInfo.eventPlace+';'
      +eventInfo.eventName+';'+eventInfo.unixDate+';100;'+eventInfo.eventStyle+';'+eventInfo.eventDetailedStyle+';'+eventInfo.eventURL+';'+eventInfo.eventDate+'\n';
    });
    try{
      fs.writeFileSync(outFile, out, 'utf-8', { flag: 'w' });
    }catch(err){
      console.log("\x1b[31mImpossible de sauvegarder dans le fichier \x1b[0m\'%s\'\x1b[31m. %s\x1b[0m",outFile,err.message);
    } 
}

