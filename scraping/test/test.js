import * as fs from 'fs';

const texte = '<body tru>A poil</body>fkmo <a class="toto"> de caractères.';
const regex = /<a[^]*?href\s*?=\s*?\"([^\"]*)\"/g;

const res = texte.match(/<body[^]*?>([^]*?)<\/body/)[1];

console.log(res);


// Utiliser une expression régulière pour récupérer le texte qui ne contient pas "can"
//const regex = /^(?!.*can).*$/s;




// if (resultat) {
//   const texteSansCan = resultat[0];
//   console.log(texteSansCan);
// } else {
//   console.log("Aucune correspondance trouvée.");
// }
