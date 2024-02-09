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

const args = process.argv.slice(2).map(el => el.toLocaleLowerCase());

import {loadVenuesJSONFile} from './import/fileUtilities.mjs';
const venueList = loadVenuesJSONFile();


function getVenue(args,venueList){
    let venues = [];
    if (args.length ===1){// one argument, it is supposed to be a place
        if (args[0] === '*'){
    
        }
    }
}
