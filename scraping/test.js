const cheerio = require('cheerio');

const html = `
  <div>
    <p>Paragraphe 1</p>
    <p>Paragraphe 3</p>
  </div>
  <div>
    <p>Paragraphe 4</p>
    <p>Paragraphe 5</p>
    <p>Paragrap
      <span> 
        ttzpjopj
      </span>
    he 6</p>
  </div>
`;

const $ = cheerio.load(html);

// Sélectionner une balise (par exemple, la deuxième balise <p>)
const baliseSelectionnee = $('p').eq(4);
// const baliseSelectionnee2 = $('div:eq(1) p:eq(0)');
// console.log($(baliseSelectionnee2).text());
// const indiceH2Recherchee = baliseSelectionnee.index('p');
// console.log("ind ",indiceH2Recherchee);
// console.log("contenu ",baliseSelectionnee);

// Récupérer toutes les balises qui ont la même balise parente que la balise sélectionnée
//const balisesSoeurs = baliseSelectionnee.siblings('p');
const balisesP = baliseSelectionnee.parent();
const balisesSoeurs = balisesP.children();
console.log(balisesP.html());
const $2 = cheerio.load(balisesP.html());
console.log('html 111',baliseSelectionnee.text());
const truc =  $2(`p:contains('${baliseSelectionnee.text()}')`).last();
const indiceH2Recherchee = $2(truc).index('p');
console.log("contenu ",$2(truc).text());
console.log("ind ",indiceH2Recherchee);

// const ind = baliseSelectionnee.index(balisesSoeurs);
// console.log(ind);
//balisesSoeurs.each(el => console.log($(el)//.text()));

// Afficher le texte de chaque balise soeur
// balisesSoeurs.each(function() {
//   console.log($(this).text());
//   console.log(this === baliseSelectionnee);
// });
