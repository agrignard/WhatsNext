import * as fs from 'fs';
import { mergeEvents} from '../import/mergeUtilities.mjs';
import { saveToJSON,saveToCSV} from '../import/fileUtilities.mjs';

const outFile ="./test/afterMerge.csv";

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
 //   console.log(el);
});

saveToJSON(res,'./test/mergeResults.json');
saveToCSV(res, outFile);
//console.log(mergeLog);
    

  

// import leven from 'leven';

// function sontApproximativementLesMemes(chaine1, chaine2, seuil) {
//   const distance = leven(chaine1, chaine2);
//   return distance <= seuil;
// }

// const chaine1 = 'AZYR B2B LESSSS + FRANCK + LUCIA LU +...';
// const chaine2 = 'chien';

// const seuilDeSimilarite = 2;

// if (sontApproximativementLesMemes(chaine1, chaine2, seuilDeSimilarite)) {
//   console.log('Les chaînes sont à peu près les mêmes.');
// } else {
//   console.log('Les chaînes ne sont pas à peu près les mêmes.');
// }
