/**
 * main.js – Einstiegspunkt: 3D-Szene, Kamera, Licht, Chat-Oberfläche, Sprachausgabe.
 * © 2026 Michael Sedlazek
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Avatar } from './avatar.js';
import { getReply, ASSISTANT_NAME } from './responder.js';
import { speak, stopSpeaking, ttsSupported, cleanForSpeech } from './speech.js';

/* ---------------------------------------------------------------------- */
/* Renderer & Szene                                                        */
/* ---------------------------------------------------------------------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // Handy: max. 2× für flüssige FPS
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // weiche, realistische Umgebungsreflexe
scene.environmentIntensity = 0.45;
scene.environmentRotation = new THREE.Euler(0, 0.6, 0);

// Weiches, schmeichelndes 3-Punkt-Licht (Beauty-/Porträt-Setup):
//  Key  – warm, leicht seitlich von oben vorne (modelliert Wangenknochen, Schatten bleiben sanft)
//  Fill – kühl-neutral von der anderen Seite, hellt Schatten auf (Verhältnis ~1:3)
//  Rim  – zwei dezente Kantenlichter von hinten, lösen Haare/Schultern vom Hintergrund
//  Hemi + Front-Glow – Grundhelligkeit, Lichtreflex in den Augen, gleichmäßiger Teint
const key = new THREE.DirectionalLight(0xffeee0, 1.85); key.position.set(110, 240, 190); scene.add(key);
const fill = new THREE.DirectionalLight(0xe4e8ff, 0.75); fill.position.set(-170, 150, 120); scene.add(fill);
const rim = new THREE.DirectionalLight(0xf4dcff, 1.1); rim.position.set(-110, 210, -190); scene.add(rim);
const rim2 = new THREE.DirectionalLight(0xffe2cc, 0.8); rim2.position.set(130, 190, -170); scene.add(rim2);
const front = new THREE.PointLight(0xfff4ec, 0.35, 0, 0); scene.add(front); // folgt der Kamera (Catchlight)
scene.add(new THREE.HemisphereLight(0xf2ecff, 0x3a2e48, 0.45));

const camera = new THREE.PerspectiveCamera(26, 1, 5, 2000);
const camLook = new THREE.Vector3(0, 130, 0);
const headPos = new THREE.Vector3(0, 160, 0);

/** Ansicht: 'portrait' (Kopf + Oberkörper, Standard) oder 'full' (ganze Figur). URL: ?view=full */
let view = new URLSearchParams(location.search).get('view') === 'full' ? 'full' : 'portrait';

/** Kamera so setzen, dass der Kopf im oberen Drittel ist und der Chat den Oberkörper nicht verdeckt. */
function frameCamera() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (view === 'full') {
    // ganze Figur (Kopf ~ 165 cm, Füße bei 0): sichtbare Höhe abhängig vom Seitenverhältnis
    const visible = Math.max(215, 100 / camera.aspect);
    const dist = visible / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camLook.set(0, headPos.y * 0.57, 0);              // Figur (Füße 0 … Scheitel ~170 cm) mittig
    camera.position.set(0, camLook.y + 8, dist);
  } else {
    // Sichtbare Höhe (cm) – im Querformat etwas mehr Abstand
    const visible = camera.aspect < 1 ? 94 : 76;
    const dist = visible / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camLook.set(0, headPos.y + 26 - visible / 2, 0);
    camera.position.set(0, camLook.y + 6, dist);
  }
  camera.lookAt(camLook);
  camera.updateProjectionMatrix();
  front.position.copy(camera.position).add(new THREE.Vector3(0, 30, 0));
}
window.addEventListener('resize', frameCamera);
frameCamera();

function setView(v) { view = v === 'full' ? 'full' : 'portrait'; frameCamera(); }

/* ---------------------------------------------------------------------- */
/* Avatar laden                                                            */
/* ---------------------------------------------------------------------- */
const avatar = new Avatar(scene);
const loaderEl = document.getElementById('loader');
const pctEl = document.getElementById('pct');

avatar.load((p) => { pctEl.textContent = Math.round(p * 100); })
  .then(() => {
    avatar.root.updateMatrixWorld(true);
    avatar.headPosition(headPos);
    frameCamera();
    renderer.compile(scene, camera);
    loaderEl.classList.add('hidden');
    setStatus('ready');
    // Begrüßung (ohne Ton – Browser erlauben Sprache erst nach einer Nutzeraktion)
    const h = new Date().getHours();
    const greet = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
    setTimeout(() => respond({ text: `${greet}, Michael! Ich bin ${ASSISTANT_NAME}. Schreib mir etwas – oder tippe auf mich, ich schaue dir zu.`, emotion: 'happy' }, false), 600);
  })
  .catch((err) => {
    console.error(err);
    loaderEl.classList.add('error');
    loaderEl.querySelector('p').textContent = 'Das 3D-Modell konnte nicht geladen werden.';
  });

/* ---------------------------------------------------------------------- */
/* Touch / Maus: Kopf und Augen folgen dem Finger                          */
/* ---------------------------------------------------------------------- */
const headScreen = new THREE.Vector3();
function onPointer(e) {
  if (!avatar.root) return;
  headScreen.copy(headPos).project(camera);
  const sx = (headScreen.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-headScreen.y * 0.5 + 0.5) * window.innerHeight;
  const x = (e.clientX - sx) / (window.innerWidth * 0.5);
  const y = (sy - e.clientY) / (window.innerHeight * 0.4);
  avatar.lookAt(x, y);
}
window.addEventListener('pointermove', onPointer, { passive: true });
window.addEventListener('pointerdown', onPointer, { passive: true });
// Antippen der Figur → kurzes Lächeln
canvas.addEventListener('click', () => { if (!avatar.talking && avatar.emotion === 'neutral') avatar.setEmotion('happy', 2.5); });

/* ---------------------------------------------------------------------- */
/* Chat                                                                    */
/* ---------------------------------------------------------------------- */
const msgs = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const statusEl = document.getElementById('status');
const dotEl = document.getElementById('statusDot');
const voiceBtn = document.getElementById('voiceBtn');

let voiceOn = ttsSupported && localStorage.getItem('ava.voice') !== 'off';
function renderVoiceBtn() {
  voiceBtn.textContent = voiceOn ? '🔊' : '🔇';
  voiceBtn.setAttribute('aria-pressed', String(voiceOn));
  voiceBtn.disabled = !ttsSupported;
  voiceBtn.title = ttsSupported ? (voiceOn ? 'Sprachausgabe aus' : 'Sprachausgabe ein') : 'Sprachausgabe wird nicht unterstützt';
}
voiceBtn.addEventListener('click', () => {
  voiceOn = !voiceOn;
  localStorage.setItem('ava.voice', voiceOn ? 'on' : 'off');
  if (!voiceOn) stopSpeaking();
  renderVoiceBtn();
});
renderVoiceBtn();

const STATUS = { ready: 'bereit', thinking: 'denkt nach …', talking: 'spricht …' };
function setStatus(s) {
  statusEl.textContent = STATUS[s] || s;
  dotEl.className = 'dot ' + s;
}

function addMessage(text, who) {
  const el = document.createElement('div');
  el.className = `msg ${who}`;
  el.textContent = text;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

let talkTimer = 0;
/** Antwort anzeigen, Emotion setzen und (optional) vorlesen + Lippen bewegen. */
function respond(reply, withVoice = voiceOn) {
  addMessage(reply.text, 'bot');
  avatar.setEmotion(reply.emotion || 'neutral', 6);
  const spoken = cleanForSpeech(reply.text);
  clearTimeout(talkTimer);
  setStatus('talking');
  avatar.startTalking(spoken);
  const done = () => { avatar.stopTalking(); setStatus('ready'); };
  // ohne Ton: Lippen-Animation entsprechend der Textlänge (~14 Zeichen/s)
  const silentTalk = () => { talkTimer = setTimeout(done, (spoken.length / 14) * 1000 + 300); };
  if (withVoice && ttsSupported) {
    speak(spoken, {
      onStart: () => avatar.startTalking(spoken),   // neu synchronisieren, sobald der Ton wirklich startet
      onBoundary: (i) => avatar.syncSpeech(i),
      onEnd: (ok) => (ok ? done() : silentTalk()),  // TTS nicht verfügbar/blockiert → stumm weiter animieren
    });
  } else {
    silentTalk();
  }
}

let busy = false;
async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true; sendBtn.disabled = true;
  stopSpeaking(); avatar.stopTalking();
  addMessage(text, 'user');
  input.value = '';
  setStatus('thinking');
  avatar.setEmotion('thinking', 0);
  const typing = addMessage('• • •', 'bot typing');
  try {
    const reply = await getReply(text);
    typing.remove();
    respond(reply);
  } catch (err) {
    console.error(err);
    typing.remove();
    respond({ text: 'Entschuldige, da ist etwas schiefgelaufen.', emotion: 'surprised' });
  } finally {
    busy = false; sendBtn.disabled = false;
  }
}

form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
document.getElementById('chips').addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') send(e.target.textContent);
});
document.querySelectorAll('.emotions button').forEach((b) =>
  b.addEventListener('click', () => avatar.setEmotion(b.dataset.emotion, 4)));

// iOS/Safari: Sprachausgabe einmalig bei der ersten Berührung "freischalten"
window.addEventListener('pointerdown', function unlock() {
  window.removeEventListener('pointerdown', unlock);
  if (ttsSupported && voiceOn) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}, { once: true });

/* ---------------------------------------------------------------------- */
/* Render-Schleife                                                         */
/* ---------------------------------------------------------------------- */
const timer = new THREE.Timer();
// Adaptive Qualität: bei dauerhaft < 40 FPS Pixel-Ratio schrittweise senken (bis 1.0)
let frames = 0, acc = 0;
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = timer.getDelta();
  avatar.update(dt);
  renderer.render(scene, camera);
  frames++; acc += dt;
  if (acc > 2) {
    const fps = frames / acc;
    const pr = renderer.getPixelRatio();
    if (fps < 40 && pr > 1 && !document.hidden) {
      renderer.setPixelRatio(Math.max(1, pr - 0.25));
      frameCamera();
    }
    frames = 0; acc = 0;
  }
});

/* ---------------------------------------------------------------------- */
/* PWA: Service Worker (Offline-Cache)                                     */
/* ---------------------------------------------------------------------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Neue Version aktiv -> einmal neu laden
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch((e) => console.warn('SW:', e)));
}

// Für Tests / Konsole
window.ava = { avatar, camera, send, respond, setView, setEmotion: (e, s) => avatar.setEmotion(e, s) };
