
import * as fs from 'fs';
import { mergeEvents} from './import/mergeUtilities.mjs';

const outFile ="./generated/afterMerge.csv";

let eventList;
try{
    eventList = JSON.parse(fs.readFileSync('./generated/scrapResult.json', 'utf8'));
   //eventList =  await JSON.parse(await fs.promises.readFile('./generated/scrapResult.json', 'utf8'));
}catch(err) {
    console.error('\x1b[36mCannot open event JSON file\x1b[0m%s\n',err);
    throw err;
}

let res = mergeEvents(eventList,false);

res.forEach(el=> {
    console.log(el);
});

saveToCSV(res, outFile);
//console.log(mergeLog);
    

// merge function. The problematic here is to find if there are different time schedule for a same event, it is
// legit (several event times like afternoon and evening shows) or if it is a mistake from one of the sources
  






  function saveToCSV(eventList, outFile){
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
  
