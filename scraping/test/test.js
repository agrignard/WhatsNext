const url = 'https://www.truc.com/Rep/page.html';

// Créer un objet URL
const objetURL = new URL(url);

// Obtenir le chemin (pathname) sans le nom du fichier
const cheminSansPage = objetURL.origin + objetURL.pathname.replace(/\/[^\/]+$/, '/');

console.log('Chemin sans la page :', cheminSansPage);
