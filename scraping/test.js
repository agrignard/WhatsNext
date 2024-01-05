// Votre expression régulière avec des parenthèses pour capturer un groupe
const regex = /(\b\w*)o\w*\b/g;

// Votre texte
const texte = "Exemple de mots contenant la lettre 'o' : chocolat, orange, tomate";

// Fonction de rappel pour remplacer le groupe capturé
//const texteModifie = texte.replace(regex, (match, groupeCapture) => match + "###");
//const texteModifie = texte.replace(regex, $0);
//

function replacer(match, p1, p2, p3, offset, string) {
  console.log(p1);
  // p1 is non-digits, p2 digits, and p3 non-alphanumerics
  return p1+"06"+p3;
}
//const newString = "20 jui.".replace(/(jui.)([^a-zA-Z.]|$)/, replacer);
const newString = "04 jui. 2023".replace(/([^a-zA-Z.]|^)(jui.)([^a-zA-Z.]|$)/, replacer);
//const newString = "abc12345#$*%".replace(/([^\d]*)(\d*)([^\w]*)/, replacer);
console.log(newString);


//"": ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche","lun.","mar.","mer.","jeu.","ven.","sam.","dim."]

