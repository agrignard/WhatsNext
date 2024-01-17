import * as fs from 'fs';

const texte = 'Ceci est un texte qui peut contenir <a class ="toto"> différentes <a class ="toto"> chaînes <a class="toto"> de caractères.';
const regex = /(<a class[ ]*=[ ]*"[^]*?")(?![^]*?<\/a>)?([^]*?)(?=\1)/g;


fs.readFile('./test.html', 'utf8', (erreur, fileContent) => {
    const resultat = fileContent.replace(regex,(p,p1,p2) => p1+p2+'<\/a>');
    console.log(resultat);
});


// Utiliser une expression régulière pour récupérer le texte qui ne contient pas "can"
//const regex = /^(?!.*can).*$/s;




// if (resultat) {
//   const texteSansCan = resultat[0];
//   console.log(texteSansCan);
// } else {
//   console.log("Aucune correspondance trouvée.");
// }
