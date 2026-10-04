/**
 * speech.js – Sprachausgabe (Text-to-Speech) über die Web Speech API, Deutsch (de-DE).
 * Funktioniert ohne Server; Stimmen hängen vom Gerät/Browser ab.
 *
 * © 2026 Michael Sedlazek
 */

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;

/** Beste verfügbare deutsche (möglichst weibliche) Stimme wählen. */
function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices().filter((v) => /^de(-|_|$)/i.test(v.lang));
  if (!voices.length) return null;
  const female = /(anna|helena|katja|hedda|marlene|vicki|petra|yannick?|google deutsch|female|frau|amala|seraphina|elke|zira)/i;
  const prefer = voices.find((v) => /de-DE/i.test(v.lang) && female.test(v.name) && !/yannick/i.test(v.name))
    || voices.find((v) => /de-DE/i.test(v.lang)) || voices[0];
  return prefer;
}
if (synth) {
  voice = pickVoice();
  synth.addEventListener?.('voiceschanged', () => { voice = pickVoice(); });
}

export const ttsSupported = !!synth;

/** Emojis & Sonderzeichen entfernen, die sonst vorgelesen würden. */
export function cleanForSpeech(text) {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/[„"“]/g, '').trim();
}

/**
 * Text vorlesen.
 * @param {string} text
 * @param {{onStart?:Function, onBoundary?:(charIndex:number)=>void, onEnd?:(ok:boolean)=>void}} cb
 *        onEnd(ok): ok=false, wenn die Ausgabe nie gestartet ist (keine Stimme, Fehler, blockiert)
 */
export function speak(text, { onStart, onBoundary, onEnd } = {}) {
  if (!synth) { onEnd?.(false); return; }
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  if (voice) u.voice = voice;
  u.rate = 1.0;
  u.pitch = 1.08;
  let ended = false, started = false;
  const finish = () => { if (!ended) { ended = true; clearTimeout(guard); onEnd?.(started); } };
  u.onstart = () => { started = true; onStart?.(); };
  u.onboundary = (e) => onBoundary?.(e.charIndex);
  u.onend = finish;
  u.onerror = finish;
  // Sicherheitsnetz: manche Browser feuern 'end' nicht zuverlässig
  const guard = setTimeout(finish, 2500 + text.length * 120);
  synth.speak(u);
}

export function stopSpeaking() { synth?.cancel(); }
