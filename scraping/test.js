import * as cheerio from 'cheerio';

// Exemple de HTML
const html = '<div><p>Contenu 1</p><p>Contenu 2<br> truc </p><div>Contenu 3<div> ';

// Charger le HTML avec Cheerio
const $ = cheerio.load(html);

function removeBRTags(content){
  return content.replace(/<br>([^]*?)</gi, (_,p) => '<p class="addedTag">'+p+'<');// remove scripts
}

// Afficher le HTML mis à jour
console.log(removeBRTags(html));
