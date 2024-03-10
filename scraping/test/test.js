// Chaîne de texte avec les occurrences de "<br>xxxx" suivies de '<'
let texte = 'oigrapevinecomwpcontentuploads202402ofscentedreverieposter293x366jpg 293w httpshanoigrapevinecomwpcontentuploads202402ofscentedreverieposter386x483jpg 386w\" sizes=\"maxwidth 700px 100vw 700px\"></p><h4>Opening: 06:30 pm, Fri 01 Mar 2024<br> Exhibition: 09:00 am &#8211; 08:00 pm, 02 &#8211; 31 Mar 2024<br> Annam Gallery<br> 371/4 Hai Bà Trưng, Võ Thị Sáu ward, D.3, HCMC<br> Entrance fee: 70.000VNĐ/person</h4><p><em>From the organizer:</em></p><p>Annam Gallery and Lân Tinh Foundation cordially invite the audience to explore the retrospective exhibition of the late artist Tú Duyên (1915-2012) – <strong>“Of Scented Reverie”</strong>. The exhibition showcases 18 artworks, including creations on silk alongside a series of paintings employing the renowned <em>“Thủ Ấn Họa”</em> technique (hand-stamped print) of the late artist Tú Du';

//'Texte <div> avec des <br>paragraphes <br>suivis <br>de texte< et <br>du caractère </div>';

// Expression régulière pour rechercher les occurrences de "<br>xxxx" suivies de '<'
let regex = /<br>([^<]*)(?=<)/g;

// Remplacer les occurrences trouvées par "<p>xxxx"
// let resultat = texte.replace(/(?<!br)>([^]*?)<br>/gi, '><p class="addedTag">$1</p><br>').replace(regex, '<p>$1</p>');

let resultat = texte.replace(/(?<!br)>([^>]*?)<br>/gi, '><p class="addedTag">$1</p><br>');


console.log(resultat);
