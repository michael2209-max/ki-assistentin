/**
 * responder.js – Antwort-Logik der Assistentin.
 *
 * Aktuell: einfacher, lokaler, regelbasierter Responder auf Deutsch (offline).
 * Jede Antwort ist ein Objekt { text, emotion }, emotion ∈ neutral|happy|thinking|surprised.
 *
 * © 2026 Michael Sedlazek
 */

export const ASSISTANT_NAME = 'Ava'; // Platzhalter-Name
const USER_NAME = 'Michael';

/**
 * >>> HIER EIN ECHTES LLM ANSCHLIESSEN <<<
 *
 * getReply(text) ist die einzige Schnittstelle, die die Oberfläche benutzt.
 * Für ein LLM einfach den Inhalt ersetzen, z. B.:
 *
 *   const res = await fetch('https://dein-server/api/chat', {
 *     method: 'POST', headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ messages: history.concat({ role: 'user', content: text }) }),
 *   });
 *   const data = await res.json();
 *   return { text: data.reply, emotion: data.emotion || guessEmotion(data.reply) };
 *
 * (API-Schlüssel nie im Frontend speichern – immer über einen eigenen Server/Proxy.)
 * Bei Netzwerkfehlern kann auf localReply(text) zurückgefallen werden.
 *
 * @param {string} text  Nachricht des Nutzers
 * @returns {Promise<{text: string, emotion: string}>}
 */
export async function getReply(text) {
  // kleine künstliche "Denkpause", damit die Animation 'thinking' sichtbar wird
  await new Promise((r) => setTimeout(r, 450 + Math.random() * 450));
  return localReply(text);
}

/** Emotion grob aus einem Antworttext ableiten (nützlich auch für LLM-Antworten). */
export function guessEmotion(reply) {
  const r = reply.toLowerCase();
  if (/(wow|oh!|echt\?|wirklich\?|überrasch)/.test(r)) return 'surprised';
  if (/(hmm|ich überlege|gute frage|weiß nicht)/.test(r)) return 'thinking';
  if (/(😊|😄|freut|gern|super|toll|haha)/.test(r)) return 'happy';
  return 'neutral';
}

const JOKES = [
  'Warum können Geister so schlecht lügen? Weil man durch sie hindurchsieht!',
  'Was macht ein Pirat am Computer? Er drückt die Enter-Taste.',
  'Treffen sich zwei Magneten. Sagt der eine: „Was soll ich heute bloß anziehen?"',
  'Warum ging der Pilz auf die Party? Weil er ein Champignon war!',
  'Wie nennt man einen Bumerang, der nicht zurückkommt? Einen Stock.',
  'Was ist orange und läuft durch den Wald? Eine Wanderine.',
  'Ich wollte einen Witz über UDP erzählen – aber ich weiß nicht, ob er ankommt.',
];
let jokeIdx = Math.floor(Math.random() * JOKES.length);

const FALLBACKS = [
  'Hmm, darauf habe ich noch keine gute Antwort. Ich bin im Moment nur ein Prototyp – frag mich nach der Uhrzeit oder einem Witz!',
  'Interessant! Leider verstehe ich das noch nicht ganz. Später kann hier ein echtes Sprachmodell antworten.',
  'Gute Frage … da muss ich passen. Versuch es mal mit „Was kannst du?"',
];
let fbIdx = 0;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Regelbasierte Offline-Antworten. */
export function localReply(input) {
  const t = input.toLowerCase().normalize('NFC').trim();
  const has = (re) => re.test(t);
  const now = new Date();

  if (!t) return { text: 'Du hast nichts geschrieben – ich höre zu!', emotion: 'neutral' };

  // Emotionen direkt anfordern (Demo)
  if (has(/(sei|schau|zeig).*(fröhlich|glücklich|happy)|lächel/)) return { text: 'So? Das fällt mir leicht! 😊', emotion: 'happy' };
  if (has(/(sei|schau|zeig).*(überrascht|erstaunt)/)) return { text: 'Oh! Damit habe ich jetzt nicht gerechnet!', emotion: 'surprised' };
  if (has(/(denk|überleg).*nach|(sei|schau|zeig).*nachdenklich/)) return { text: 'Hmm … lass mich kurz darüber nachdenken.', emotion: 'thinking' };

  if (has(/wie hei(ß|ss)t du|wer bist du|dein name|wie ist dein name/))
    return { text: `Ich bin ${ASSISTANT_NAME}, deine persönliche KI-Assistentin. Noch ein Prototyp, aber mit viel Charme!`, emotion: 'happy' };
  if (has(/wie hei(ß|ss)e ich|wer bin ich|mein name/))
    return { text: `Du bist ${USER_NAME} – mein Entwickler!`, emotion: 'happy' };
  if (has(/\b(hallo|hi|hey|servus|grüß (dich|gott)|moin|guten (morgen|tag|abend)|griaß di|hallöchen)\b/)) {
    const h = now.getHours();
    const tz = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
    return { text: `${tz}, ${USER_NAME}! Schön, dich zu sehen. Wie kann ich dir helfen?`, emotion: 'happy' };
  }
  if (has(/wie geht('?s| es) (dir|ihnen)|alles (gut|klar)\?|wie läuft/))
    return { text: pick(['Mir geht es prima, danke! Und dir?', 'Bestens – meine Polygone sind heute besonders gut gelaunt.']), emotion: 'happy' };
  if (has(/wie spät|uhrzeit|wieviel uhr|wie viel uhr/)) {
    const hh = now.getHours(), mm = String(now.getMinutes()).padStart(2, '0');
    return { text: `Es ist jetzt ${hh}:${mm} Uhr.`, emotion: 'neutral' };
  }
  if (has(/datum|welcher tag|welches datum|heute ist/)) {
    const d = now.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return { text: `Heute ist ${d}.`, emotion: 'neutral' };
  }
  if (has(/witz|lustig|bring mich zum lachen|joke/)) {
    jokeIdx = (jokeIdx + 1) % JOKES.length;
    return { text: JOKES[jokeIdx] + ' 😄', emotion: 'happy' };
  }
  if (has(/was kannst du|hilfe|help|funktionen/))
    return { text: 'Ich kann dich begrüßen, dir die Uhrzeit und das Datum sagen, Witze erzählen und Gefühle zeigen – sag z. B. „Sei überrascht" oder „Denk nach". Ein echtes Sprachmodell kann später angeschlossen werden.', emotion: 'neutral' };
  if (has(/wetter/))
    return { text: 'Fürs Wetter bräuchte ich eine Internet-Verbindung zu einem Wetterdienst – das kommt in einer späteren Version.', emotion: 'thinking' };
  if (has(/danke|merci|vielen dank/)) return { text: 'Sehr gerne! 😊', emotion: 'happy' };
  if (has(/hübsch|schön|toll|super|klasse|großartig|genial|ich mag dich|liebe dich/))
    return { text: 'Oh, wie nett von dir! Das freut mich wirklich.', emotion: 'surprised' };
  if (has(/wow|krass|echt\?|wirklich\?|unglaublich/)) return { text: 'Wirklich? Das ist ja spannend!', emotion: 'surprised' };
  if (has(/tschüss|ciao|bis bald|auf wiedersehen|baba|servas|gute nacht/))
    return { text: `Bis bald, ${USER_NAME}! Ich bin da, wenn du mich brauchst.`, emotion: 'happy' };
  if (has(/\?$/) && has(/warum|wieso|weshalb|was ist|wer ist|wie funktioniert/))
    return { text: 'Hmm, gute Frage! Dafür bräuchte ich ein echtes Sprachmodell – das kann in getReply() angeschlossen werden.', emotion: 'thinking' };

  fbIdx = (fbIdx + 1) % FALLBACKS.length;
  return { text: FALLBACKS[fbIdx], emotion: 'thinking' };
}
