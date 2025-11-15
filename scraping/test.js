// const moisDict = {
//   janvier: ["jan", "jan.", "janv", "janv.", "janvier"],
//   février: ["fév", "fév.", "fev", "fev.", "février"],
//   mars: ["mar", "mar.", "mars"],
//   avril: ["avr", "avr.", "avril"],
//   mai: ["mai"],
//   juin: ["juin"],
//   juillet: ["juil", "juil.", "juillet"],
//   août: ["aout", "août"],
//   septembre: ["sep", "sep.", "sept", "sept.", "septembre"],
//   octobre: ["oct", "oct.", "octobre"],
//   novembre: ["nov", "nov.", "novembre"],
//   décembre: ["déc", "dec", "déc.", "dec.", "décembre"]
// };
// const moisRegex = Object.values(moisDict).flat().map(m => m.replace('.', '\\.')).join('|');
// const currentYear = new Date().getFullYear();

// // ------------------------------
// // Normalisation d’heure robuste
// // ------------------------------
// function normalizeHour(h) {

//   if (!h) return null;
//   h = h.replace(/[hH]/, ':').trim();
//   const m = h.match(/\b(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?\b/i);
//   if (!m) return null;
//   let [_, hour, min, ampm] = m;
//   hour = parseInt(hour);
//   min = min ? parseInt(min) : 0;
//   if (/PM/i.test(ampm) && hour < 12) hour += 12;
//   if (/AM/i.test(ampm) && hour === 12) hour = 0;
//   return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
// }

// // ------------------------------
// // Extraction des dates
// // ------------------------------
// function extractDates(text) {
//   const results = [];

//   // 1️⃣ plage de dates "du ... au ..."
//   const rangeRe = /du\s+(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\s*(?:à\s*([0-9h:.APM\s]+))?\s+au\s+(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\s*(?:à\s*([0-9h:.APM\s]+))?/gi;
//   for (const m of text.matchAll(rangeRe)) {
//     const [, startDate, startHour] = m;
//     const [d, mo, y] = startDate.split(/[./]/);
//     const year = y ? (y.length === 2 ? `20${y}` : y) : currentYear;
//     const month = mo.padStart(2, '0');
//     const day = d.padStart(2, '0');
//     results.push({
//       raw: m[0],
//       pattern: "range",
//       date: `${year}-${month}-${day}`,
//       dateTime: startHour ? `${year}-${month}-${day} ${normalizeHour(startHour)}` : null
//     });
//   }

//   // 2️⃣ multi-dates "14, 15 & 16 novembre 2025 à 20h"
//   const multiDaysRe = new RegExp(
//     `(\\d{1,2}(?:\\s*(?:,|&|et)\\s*\\d{1,2})+)\\s*(${moisRegex})\\s*(\\d{4})?(?:\\s*(?:à)?\\s*([0-9h:.APM\\s]+))?`,
//     'gi'
//   );
//   for (const m of text.matchAll(multiDaysRe)) {
//     const [_, daysGroup, monthTxt, yearTxt, hourTxt] = m;
//     const days = daysGroup.match(/\d{1,2}/g) || [];
//     const month = Object.keys(moisDict).find(mo =>
//       moisDict[mo].some(v => new RegExp(`^${v}$`, 'i').test(monthTxt))
//     );
//     const monthNum = month ? (Object.keys(moisDict).indexOf(month) + 1).toString().padStart(2, '0') : '01';
//     const year = yearTxt || currentYear;
//     const normHour = normalizeHour(hourTxt);
//     for (const d of days) {
//       results.push({
//         raw: m[0],
//         pattern: "multi",
//         date: `${year}-${monthNum}-${d.padStart(2, '0')}`,
//         dateTime: normHour ? `${year}-${monthNum}-${d.padStart(2, '0')} ${normHour}` : null
//       });
//     }
//   }

//   // 3️⃣ dates individuelles "23 septembre 2026 à 18h", "05 déc. 2025 20:00"
//   const textDateRe = new RegExp(
//     `(?:\\b[a-zéèêàç]+\\b\\s*)?(\\d{1,2})\\s*(${moisRegex})\\s*(\\d{4})?(?:[ ,]*\\s*(?:à)?\\s*([0-9h:.APM\\s]+))?`,
//     'gi'
//   );
//   for (const m of text.matchAll(textDateRe)) {
//     const [, day, monthTxt, yearTxt, hourTxt] = m;
//     const month = Object.keys(moisDict).find(mo =>
//       moisDict[mo].some(v => new RegExp(`^${v}$`, 'i').test(monthTxt))
//     );
//     if (!month) continue; // éviter les faux positifs
//     const monthNum = (Object.keys(moisDict).indexOf(month) + 1).toString().padStart(2, '0');
//     const year = yearTxt || currentYear;
//     const normHour = normalizeHour(hourTxt);
//     results.push({
//       raw: m[0],
//       pattern: "text",
//       date: `${year}-${monthNum}-${day.padStart(2, '0')}`,
//       dateTime: normHour ? `${year}-${monthNum}-${day.padStart(2, '0')} ${normHour}` : null
//     });
//   }

//   // suppression des doublons (ex: text et multi se recoupent)
//   const unique = [];
//   for (const r of results) {
//     if (!unique.some(u => u.date === r.date && u.dateTime === r.dateTime)) unique.push(r);
//   }

//   return unique;
// }


// // --- Exemple d’utilisation ---
// const text1 = `
//   mardi 23 septembre 2026 à 18h
// `;

// const text1b = `
//   23.09.26 à 18h
// `;

// const text2 = `
//   du 17.02.26 à 20h au 18.02.26 à 4h
// `;

// const text3 = `
//   samedi 24 Jan, 2026, 07:30 PM-08:00 PM
// `;

// const text4 = `
//   14, 15 & 16 novembre 2025 à 20h
// `;

// const text5 = `
//   05 déc. 2025 20:00, 06 déc. 2025 20:00, 07 déc. 2025 15:00
// `;


// const text = `
//   mardi 23 septembre 2026 à 18h
//   du 17.02.26 à 20h au 18.02.26 à 4h
//   samedi 24 Jan, 2026, 07:30 PM-08:00 PM
//   14, 15 & 16 novembre 2025
//   2, 3 et 4 janvier, 2 février 2025
//   05 déc. 2025 | 20:00 06 déc. 2025 | 20:00 07 déc. 2025 | 15:00
//   5 janvier à 19h
// `;

// console.log("text1: ",extractDates(text1));
// console.log("text1b: ",extractDates(text1b));
// console.log("text2: ",extractDates(text2));
// console.log("text3: ",extractDates(text3));
// console.log("text4: ",extractDates(text4));
// console.log("text5: ",extractDates(text5));


import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
dayjs.extend(customParseFormat);

// ========== 1. Patterns génériques ==========
const datePatterns = [
  {
    name: "dmy_text",
    regex: /(\d{1,2})\s*(?:janv\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?)\s*(\d{2,4})/gi,
    format: "D MMM YYYY"
  },
  {
    name: "dmy_numeric",
    regex: /(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/g,
    format: "D.M.YYYY"
  },
  {
    name: "wdmy_text",
    regex: /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*(\d{1,2})\s*(?:janv\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?)\s*(\d{2,4})/gi,
    format: "D MMM YYYY"
  }
];

const hourPattern = /(\d{1,2})(?:[:hH](\d{2}))?\s*(?:AM|PM)?/gi;

// ========== 2. Fonction d’extraction ==========
function extractEventDates(rawText, siteName, sitePatterns = {}) {
  let text = rawText
    .toLowerCase()
    .replace(/du|au|à|de|le|et|–|—|,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const results = [];

  // Cherche chaque pattern connu
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const dateStr = match[0];
      const parsed = dayjs(dateStr, pattern.format, "fr", true);
      if (parsed.isValid()) {
        results.push({ date: parsed.format("YYYY-MM-DD"), hasHour: false, pattern: pattern.name });
      }
    }
  }

  // Recherche d'heures associées
  const hours = [...text.matchAll(hourPattern)].map(m => {
    let h = parseInt(m[1], 10);
    let min = m[2] ? parseInt(m[2], 10) : 0;
    return { hour: h, minute: min };
  });

  // ========== 3. Association dates ↔ heures (si même segment) ==========
  // Heuristique : si autant d'heures que de dates, on les associe
  if (hours.length && results.length && hours.length === results.length) {
    results.forEach((r, i) => {
      const h = hours[i];
      r.dateTime = dayjs(r.date)
        .hour(h.hour)
        .minute(h.minute)
        .format("YYYY-MM-DD HH:mm");
      r.hasHour = true;
    });
  }

  // ========== 4. Détection de listes de dates ==========
  // Ex: "14, 15 & 16 novembre 2025"
  const listMatch = text.match(/(\d{1,2}(?:[ ,&]+\d{1,2})+)\s*(?:janv\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?)\s*(\d{2,4})/i);
  if (listMatch) {
    const days = listMatch[1].split(/[ ,&]+/).map(d => d.trim()).filter(Boolean);
    const monthPart = listMatch[0].match(/(?:janv\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?)/i);
    const yearPart = listMatch[2];
    for (const d of days) {
      const composed = `${d} ${monthPart[0]} ${yearPart}`;
      const parsed = dayjs(composed, "D MMM YYYY", "fr", true);
      if (parsed.isValid()) {
        results.push({ date: parsed.format("YYYY-MM-DD"), hasHour: false, pattern: "list_dmy_text" });
      }
    }
  }

  // ========== 5. Nettoyage et sauvegarde du pattern ==========
  const uniqueResults = [];
  const seen = new Set();
  for (const r of results) {
    if (!seen.has(r.dateTime || r.date)) {
      seen.add(r.dateTime || r.date);
      uniqueResults.push(r);
    }
  }

  if (uniqueResults.length) {
    const usedPatterns = [...new Set(uniqueResults.map(r => r.pattern))];
    sitePatterns[siteName] = usedPatterns;
  }

  return { results: uniqueResults, sitePatterns };
}



let sitePatterns = {};

let tests = [
  ["site1", "mardi 23 septembre 2026 à 18h"],
  ["site2", "du 17.02.26 à 20h au 18.02.26 à 4h"],
  ["site3", "samedi 24 Jan, 2026, 07:30 PM-08:00 PM"],
  ["site4", "14, 15 & 16 novembre 2025"],
  ["site5", "05 déc. 2025 | 20:00 06 déc. 2025 | 20:00 07 déc. 2025 | 15:00"]
];

for (const [site, text] of tests) {
  const { results, sitePatterns: updated } = extractEventDates(text, site, sitePatterns);
  console.log(site, "→", results);
  sitePatterns = updated;
}

console.log("=== Patterns mémorisés ===");
console.log(sitePatterns);
