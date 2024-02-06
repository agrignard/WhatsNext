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




const nc2 = ["eeee","captinKKiogj","1234567890","érlect"];

// Vérifie si la chaîne est entièrement en majuscules
// const estTouteMajuscule = /^[A-Z]+$/.test(chaine);

// // Vérifie si la chaîne contient des majuscules ou des minuscules
// const contientMajusculesMinuscules = /[a-z]/.test(chaine);


const regexUpperCase = /[A-Z]/g;
const regexLowerCase = /[a-z]/g;
function caseBalanceIndex(string){// a low score means a better balance between lower and upper case letters. It favorizes a little lower case letters
    return Math.abs(1+(string.match(/[A-Z]/g) || []).length - (string.match(/[a-z]/g) || []).length);
}      
const caseBalance = nc2.reduce((max, string) => Math.max(max, caseBalanceIndex(string)), 0);
const nameCandidates = nc2.filter(string => caseBalanceIndex(string) === caseBalance);// keep the most balanced name

console.log(caseBalanceIndex('abc'));