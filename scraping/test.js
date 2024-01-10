// Texte d'exemple
let texte = "Ceci est une phrase <img etzmif>  <truc pofj> de démonstration";

// Découper la chaîne de caractères à chaque espace
console.log(texte.replace(/<[ ]*img[^]*?>/g,'TTTT'));