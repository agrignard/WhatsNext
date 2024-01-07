import * as cheerio from 'cheerio';

// Exemple de HTML
const html = '<div><p>Contenu 1</p><p>Contenu 2</p><div>Contenu 3<div> truc <p>truc2</p>/div></div></div>';

// Charger le HTML avec Cheerio
const $ = cheerio.load(html);

// Sélectionner le premier paragraphe
const premierParagraphe = $('p').first();

// Supprimer les nœuds frères et leurs descendants
premierParagraphe.nextAll().remove();

// Afficher le HTML mis à jour
console.log($.html());
