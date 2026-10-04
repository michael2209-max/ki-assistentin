/**
 * avatar.js – Lädt die 3D-Figur und steuert alle Animationen.
 *
 * Modell: Microsoft Rocketbox (MIT-Lizenz), aus zwei Avataren mit identischem Biped-Skelett (Bip01_*)
 * zusammengesetzt:
 *   - ava.fbx        = "Female_Party_01_facial" → Kopf, blonde Haare, blaue Augen,
 *                       ARKit-/FACS-/Visem-Blendshapes + Skelett (führend)
 *   - ava_outfit.fbx = "Female_Party_02"        → Outfit: gemustertes Shirt mit Gürtel, schwarzer Minirock,
 *                       Riemchensandalen (Arme/Beine) – wird an das Skelett von ava.fbx gebunden
 *
 * Animationsebenen (werden pro Frame addiert):
 *   1. Grundpose      – T-Pose wird beim Laden in eine entspannte Haltung gebracht
 *   2. Idle           – Atmung, leichtes Schwanken, Mikro-Kopfbewegung, Blinzeln
 *   3. Blick          – Kopf + Augen folgen Touch/Maus (sonst zufällige Sakkaden)
 *   4. Emotion        – neutral | happy | thinking | surprised (Morphs + Kopfhaltung)
 *   5. Sprechen       – Viseme (Mundformen) aus dem gesprochenen Text
 *
 * © 2026 Michael Sedlazek
 */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const MODEL_DIR = './assets/model/';

/** Texturen (aus den Original-TGA mit tools/prep_textures.py umgewandelt, angepasst und für Handys verkleinert). */
const TEXTURES = {
  headColor: 'head_color.jpg', headNormal: 'head_normal.jpg', headSpec: 'head_spec.jpg',
  bodyColor: 'body_color.jpg', bodyNormal: 'body_normal.jpg', bodySpec: 'body_spec.jpg',
  opacity: 'opacity_color.png', // Haare, Wimpern, Brauen (mit Alpha)
};

// 1×1 transparentes PNG – ersetzt die im FBX referenzierten .tga-Texturen,
// damit keine 404-Fehler entstehen (wir setzen eigene, komprimierte Texturen).
const EMPTY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Nur diese Blendshapes werden behalten (das Modell hat ~170!).
 * Spart auf dem Handy viel GPU-Speicher (Morph-Texturen).
 * Schlüssel = Kurzname im Code, Wert = Suffix des Original-Morphnamens.
 */
const MORPHS = {
  blinkL: 'AK_09_EyeBlinkLeft', blinkR: 'AK_10_EyeBlinkRight',
  lookDownL: 'AK_11_EyeLookDownLeft', lookDownR: 'AK_12_EyeLookDownRight',
  lookInL: 'AK_13_EyeLookInLeft', lookInR: 'AK_14_EyeLookInRight',
  lookOutL: 'AK_15_EyeLookOutLeft', lookOutR: 'AK_16_EyeLookOutRight',
  lookUpL: 'AK_17_EyeLookUpLeft', lookUpR: 'AK_18_EyeLookUpRight',
  squintL: 'AK_19_EyeSquintLeft', squintR: 'AK_20_EyeSquintRight',
  wideL: 'AK_21_EyeWideLeft', wideR: 'AK_22_EyeWideRight',
  browDownL: 'AK_01_BrowDownLeft', browDownR: 'AK_02_BrowDownRight',
  browInnerUp: 'AK_03_BrowInnerUp',
  browOuterUpL: 'AK_04_BrowOuterUpLeft', browOuterUpR: 'AK_05_BrowOuterUpRight',
  cheekSquintL: 'AK_07_CheekSquintLeft', cheekSquintR: 'AK_08_CheekSquintRight',
  jawOpen: 'AK_25_JawOpen',
  mouthFunnel: 'AK_32_MouthFunnel', mouthLeft: 'AK_33_MouthLeft',
  mouthPressL: 'AK_36_MouthPressLeft', mouthPressR: 'AK_37_MouthPressRight',
  mouthPucker: 'AK_38_MouthPucker',
  smileL: 'AK_44_MouthSmileLeft', smileR: 'AK_45_MouthSmileRight',
  smileFull: 'HB_07_MouthSmile', lipCornerPull: 'AU_12_LipCornerPuller', cheekRaise: 'AU_06_CheekRaiser',
  dimpleL: 'AK_28_MouthDimpleLeft', dimpleR: 'AK_29_MouthDimpleRight',
  // Viseme (Mundformen für Laute)
  v_sil: 'AA_VI_00_Sil', v_PP: 'AA_VI_01_PP', v_FF: 'AA_VI_02_FF', v_TH: 'AA_VI_03_TH',
  v_DD: 'AA_VI_04_DD', v_KK: 'AA_VI_05_KK', v_CH: 'AA_VI_06_CH', v_SS: 'AA_VI_07_SS',
  v_nn: 'AA_VI_08_nn', v_RR: 'AA_VI_09_RR', v_aa: 'AA_VI_10_aa', v_E: 'AA_VI_11_E',
  v_I: 'AA_VI_12_I', v_O: 'AA_VI_13_O', v_U: 'AA_VI_14_U',
};

/** Gesichtsausdrücke: Morph-Gewichte + Kopfhaltung (Neigung/Drehung in Radiant). */
const EMOTIONS = {
  neutral: { morphs: { smileL: 0.08, smileR: 0.08 }, head: { tilt: 0, pitch: 0, yaw: 0 }, eyes: null },
  happy: {
    morphs: { smileL: 0.8, smileR: 0.8, smileFull: 0.55, lipCornerPull: 0.35, cheekRaise: 0.4,
      cheekSquintL: 0.3, cheekSquintR: 0.3, squintL: 0.15, squintR: 0.15, browInnerUp: 0.12 },
    head: { tilt: 0.07, pitch: -0.03, yaw: 0 }, eyes: null,
  },
  thinking: {
    morphs: { browDownR: 0.45, browOuterUpL: 0.55, mouthPressL: 0.35, mouthPressR: 0.35,
      mouthLeft: 0.35, squintR: 0.2 },
    head: { tilt: -0.08, pitch: -0.05, yaw: 0.05 }, eyes: { x: 0.4, y: 0.6 }, // Blick nach oben-seitlich
  },
  surprised: {
    morphs: { browInnerUp: 0.9, browOuterUpL: 0.85, browOuterUpR: 0.85, wideL: 0.7, wideR: 0.7,
      jawOpen: 0.22, mouthFunnel: 0.25 },
    head: { tilt: 0, pitch: -0.07, yaw: 0 }, eyes: null,
  },
};

/** Grobe Buchstabe→Visem-Zuordnung fürs Deutsche (für Lippen-Animation). */
function charToViseme(text, i) {
  const c = text[i].toLowerCase();
  const next = (text[i + 1] || '').toLowerCase();
  if ('aä'.includes(c)) return 'v_aa';
  if ('e'.includes(c)) return 'v_E';
  if ('iy'.includes(c)) return 'v_I';
  if ('oö'.includes(c)) return 'v_O';
  if ('uü'.includes(c)) return 'v_U';
  if ('bmp'.includes(c)) return 'v_PP';
  if ('fvw'.includes(c)) return 'v_FF';
  if (c === 'c' && next === 'h') return 'v_CH';
  if ('jß'.includes(c)) return c === 'j' ? 'v_CH' : 'v_SS';
  if ('szxc'.includes(c)) return 'v_SS';
  if ('dt'.includes(c)) return 'v_DD';
  if ('nl'.includes(c)) return 'v_nn';
  if ('kgq'.includes(c)) return 'v_KK';
  if (c === 'r') return 'v_RR';
  if (c === 'h') return 'v_E';
  return null; // Leerzeichen/Satzzeichen → Mund schließt sich
}

const damp = (cur, target, lambda, dt) => THREE.MathUtils.damp(cur, target, lambda, dt);

export class Avatar {
  constructor(scene) {
    this.scene = scene;
    this.root = null;
    this.mesh = null;
    this.bones = {};
    this.base = {};          // Grundpose (Quaternionen) je Knochen
    this.morphIndex = {};    // Kurzname → Index
    this.weights = {};       // aktuelle (geglättete) Morph-Gewichte
    this.emotion = 'neutral';
    this.emotionTimer = 0;
    this.lookTarget = new THREE.Vector2(0, 0);  // -1..1 (x: rechts aus Sicht Betrachter, y: oben)
    this.look = new THREE.Vector2(0, 0);
    this.lastPointer = -10;
    this.saccadeTimer = 0;
    this.blinkTimer = 2;
    this.blinkPhase = -1;
    this.talking = false;
    this.speech = null;      // { text, pos, rate }
    this.time = 0;
    this.headPose = { tilt: 0, pitch: 0, yaw: 0 };
    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._v = new THREE.Vector3();
  }

  /** Modell laden. onProgress(0..1) */
  async load(onProgress = () => {}) {
    const manager = new THREE.LoadingManager();
    // Alle im FBX eingebetteten Texturpfade (.tga) auf ein leeres PNG umleiten
    manager.setURLModifier((url) => (/\.tga$/i.test(url) ? EMPTY_PNG : url));
    const loader = new FBXLoader(manager);
    const prog = { head: 0, outfit: 0 };
    const report = () => onProgress(0.7 * (prog.head * 0.8 + prog.outfit * 0.2));
    const [fbx, outfitFbx] = await Promise.all([
      loader.loadAsync(MODEL_DIR + 'ava.fbx', (e) => { if (e.total) { prog.head = e.loaded / e.total; report(); } }),
      loader.loadAsync(MODEL_DIR + 'ava_outfit.fbx', (e) => { if (e.total) { prog.outfit = e.loaded / e.total; report(); } }),
    ]);

    const tex = await this._loadTextures((p) => onProgress(0.7 + 0.3 * p));

    fbx.traverse((o) => {
      if (o.isBone) this.bones[o.name.replace('Bip01_', '')] = o;
      if (o.isSkinnedMesh && !this.mesh) this.mesh = o;
    });
    fbx.animations = []; // nur eine Dummy-"Take 001"
    this.root = fbx;

    this._composeOutfit(fbx, outfitFbx);
    this._setupMaterials(tex);
    this._pruneMorphs();
    this._relaxPose();

    this.mesh.frustumCulled = false; // Skinned Mesh: Bounding-Box passt nach Pose nicht mehr
    this.outfit.frustumCulled = false;
    this.scene.add(fbx);
    onProgress(1);
    return this;
  }

  async _loadTextures(onProgress) {
    const tl = new THREE.TextureLoader();
    const files = TEXTURES;
    const out = {};
    let done = 0;
    const keys = Object.keys(files);
    await Promise.all(keys.map(async (k) => {
      const t = await tl.loadAsync(MODEL_DIR + files[k]);
      t.anisotropy = 4;
      if (/Color|opacity|glasses|Spec/.test(k)) t.colorSpace = THREE.SRGBColorSpace;
      out[k] = t;
      onProgress(++done / keys.length);
    }));
    return out;
  }

  /**
   * Kopf-Modell (Party_01) + Outfit-Modell (Party_02) zu einer Figur zusammensetzen.
   *  - Vom Kopf-Modell nur Kopf/Hals/Haare behalten (dessen Körper mit Shorts wird verworfen).
   *  - Haut-Dreiecke des Kopf-Modells, die unter dem Shirt liegen (Schultern/Brust), entfernen –
   *    sonst stechen sie am Kragen durch den Stoff.
   *  - Vom Outfit-Modell nur den Körper (Shirt, Rock, Arme, Beine) behalten und an das Skelett
   *    des Kopf-Modells binden (beide Skelette haben identische Bind-Posen → kein Versatz).
   */
  _composeOutfit(fbx, outfitFbx) {
    fbx.updateMatrixWorld(true);
    outfitFbx.updateMatrixWorld(true);
    const isPart = (m, part) => m.name.toLowerCase().includes(part);
    const neckY = this.bones.Neck.getWorldPosition(new THREE.Vector3()).y;
    const v = new THREE.Vector3();

    // Dreiecke einer Geometrie gefiltert neu indizieren (Gruppen je Material bleiben erhalten)
    const filter = (mesh, keepTri) => {
      const g = mesh.geometry, mats = [].concat(mesh.material);
      const pos = g.attributes.position;
      const at = (i) => (g.index ? g.index.getX(i) : i);
      const idx = [], groups = [];
      for (let mi = 0; mi < mats.length; mi++) {
        const start = idx.length;
        for (const gr of g.groups) {
          if (gr.materialIndex !== mi) continue;
          for (let i = gr.start; i < gr.start + gr.count; i += 3) {
            const tri = [at(i), at(i + 1), at(i + 2)];
            if (keepTri(mats[mi], tri, pos)) idx.push(...tri);
          }
        }
        if (idx.length > start) groups.push({ start, count: idx.length - start, materialIndex: mi });
      }
      g.setIndex(idx);
      g.clearGroups();
      for (const gr of groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    };

    // Kopf-Modell: Körper weg, Haut unter dem Kragen weg
    filter(this.mesh, (mat, tri, pos) => {
      if (isPart(mat, 'body')) return false;
      if (!isPart(mat, 'head')) return true; // Haare/Wimpern
      let maxY = -Infinity, minAbsX = Infinity;
      for (const i of tri) {
        v.fromBufferAttribute(pos, i).applyMatrix4(this.mesh.matrixWorld);
        maxY = Math.max(maxY, v.y); minAbsX = Math.min(minAbsX, Math.abs(v.x));
      }
      return !(maxY < neckY - 6 || (maxY < neckY + 1 && minAbsX > 5));
    });

    // Outfit-Modell: nur Körper behalten, an Avas Skelett binden
    let outfit = null;
    outfitFbx.traverse((o) => { if (o.isSkinnedMesh && !outfit) outfit = o; });
    filter(outfit, (mat) => isPart(mat, 'body'));
    const byName = {};
    fbx.traverse((o) => { if (o.isBone) byName[o.name] = o; });
    const bones = outfit.skeleton.bones.map((b) => byName[b.name]);
    if (bones.some((b) => !b)) throw new Error('Outfit-Skelett passt nicht zum Kopf-Modell');
    outfit.bind(new THREE.Skeleton(bones, outfit.skeleton.boneInverses), outfit.bindMatrix);
    outfit.name = 'outfit';
    fbx.add(outfit); // gleiche lokale Transformation wie im eigenen FBX (beide Wurzeln identisch)
    this.outfit = outfit;
  }

  /** Phong-Materialien aus dem FBX durch physikalisch basierte Materialien ersetzen. */
  _setupMaterials(t) {
    const nScale = new THREE.Vector2(1, -1); // Normalmaps im DirectX-Format (Grün invertiert)
    // Haut: Physical-Material mit warmem Sheen (Streulicht an Kanten) und einem Hauch
    // Eigenleuchten aus der Farbtextur → wirkt wie leichte Subsurface-Streuung (weichere, wärmere Schatten).
    const skin = (map, normalMap, spec) => new THREE.MeshPhysicalMaterial({
      map, normalMap, normalScale: nScale.clone().multiplyScalar(0.75),
      roughness: 0.58, metalness: 0,
      specularColorMap: spec, specularIntensity: 0.5, specularColor: new THREE.Color(0xfff0ea),
      sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xff9c80),
      emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.04,
    });
    const convert = (m) => {
      let nm;
      if (m.name.toLowerCase().includes('head')) nm = skin(t.headColor, t.headNormal, t.headSpec);
      else if (m.name.toLowerCase().includes('body')) {
        // Körper = Stoff (Shirt/Rock) + Haut (Arme/Beine): etwas rauer, Sheen gibt Stoff-Glanz
        nm = skin(t.bodyColor, t.bodyNormal, t.bodySpec);
        nm.roughness = 0.7; nm.sheen = 0.45; nm.sheenRoughness = 0.5; nm.sheenColor.set(0xffc4b0);
        nm.emissiveIntensity = 0.035;
      } else {
        // Haare, Wimpern – Alpha-Textur; alphaToCoverage = weiche Kanten mit MSAA; Sheen = seidiger Glanz
        nm = new THREE.MeshPhysicalMaterial({ map: t.opacity, alphaTest: 0.35, alphaToCoverage: true,
          side: THREE.DoubleSide, roughness: 0.55, metalness: 0, specularIntensity: 0.3,
          sheen: 0.3, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffe6b8) });
      }
      nm.name = m.name;
      m.dispose();
      return nm;
    };
    this.mesh.material = [].concat(this.mesh.material).map(convert);
    this.outfit.material = [].concat(this.outfit.material).map(convert);
  }

  /** Nicht benötigte Blendshapes entfernen (spart GPU-Speicher und Shader-Arbeit). */
  _pruneMorphs() {
    const geo = this.mesh.geometry;
    const dict = this.mesh.morphTargetDictionary;
    const names = Object.keys(dict);
    const pos = [];
    this.morphIndex = {};
    for (const [key, suffix] of Object.entries(MORPHS)) {
      const full = names.find((n) => n.endsWith(suffix));
      if (full === undefined) continue;
      this.morphIndex[key] = pos.length;
      pos.push(geo.morphAttributes.position[dict[full]]);
    }
    geo.morphAttributes = { position: pos }; // Normalen-Morphs weglassen → halber Speicher
    this.mesh.updateMorphTargets();
    this.mesh.morphTargetDictionary = { ...this.morphIndex };
    this.mesh.morphTargetInfluences = new Array(pos.length).fill(0);
    for (const k of Object.keys(this.morphIndex)) this.weights[k] = 0;
  }

  /** Dreht einen Knochen um eine Welt-Achse (unabhängig von seiner lokalen Achsenlage). */
  _rotateWorld(bone, axis, angle) {
    bone.parent.getWorldQuaternion(this._q);              // P
    this._q2.setFromAxisAngle(axis, angle);              // R
    // L' = P⁻¹ · R · P · L
    const pInv = this._q.clone().invert();
    bone.quaternion.premultiply(this._q).premultiply(this._q2).premultiply(pInv);
  }

  /** Richtet einen Knochen so aus, dass er (zum Kind hin) in Richtung dirWorld zeigt. */
  _aimWorld(bone, child, dirWorld) {
    const a = bone.getWorldPosition(new THREE.Vector3());
    const b = child.getWorldPosition(new THREE.Vector3());
    const cur = b.sub(a).normalize();
    const rot = new THREE.Quaternion().setFromUnitVectors(cur, dirWorld.clone().normalize());
    bone.parent.getWorldQuaternion(this._q);
    bone.quaternion.premultiply(this._q).premultiply(rot).premultiply(this._q.clone().invert());
    bone.updateMatrixWorld(true);
  }

  /** T-Pose → natürliche, entspannte Standpose (Arme unten, Ellbogen leicht gebeugt). */
  _relaxPose() {
    const B = this.bones;
    this.root.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const s = B[`${side}_UpperArm`].getWorldPosition(new THREE.Vector3()).x > 0 ? 1 : -1;
      this._aimWorld(B[`${side}_UpperArm`], B[`${side}_Forearm`], new THREE.Vector3(0.1 * s, -1, -0.03));
      this._aimWorld(B[`${side}_Forearm`], B[`${side}_Hand`], new THREE.Vector3(0.0 * s, -1, 0.38));
      this._aimWorld(B[`${side}_Hand`], B[`${side}_Finger2`], new THREE.Vector3(0.05 * s, -1, 0.25));
      // Finger leicht krümmen (sieht entspannter aus als flache T-Pose-Hand)
      for (const f of ['1', '2', '3', '4']) {
        for (const seg of ['', '1', '2']) {
          const bone = B[`${side}_Finger${f}${seg}`];
          if (!bone) continue;
          this._rotateWorld(bone, new THREE.Vector3(1, 0, 0), -0.18);
          bone.updateMatrixWorld(true);
        }
      }
    }
    // Grundpose merken – alle Animationen werden relativ dazu berechnet
    for (const [name, bone] of Object.entries(B)) this.base[name] = bone.quaternion.clone();
  }

  /* ------------------------------------------------------------------ */
  /* Öffentliche Steuerung                                               */
  /* ------------------------------------------------------------------ */

  /** Blickziel setzen (normiert -1..1, z. B. aus Touch-Position). */
  lookAt(x, y) {
    this.lookTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
    this.lastPointer = this.time;
  }

  /** Emotion setzen; nach `holdSec` Sekunden zurück zu neutral (0 = dauerhaft). */
  setEmotion(name, holdSec = 5) {
    if (!EMOTIONS[name]) name = 'neutral';
    this.emotion = name;
    this.emotionTimer = holdSec;
  }

  /** Sprechen beginnen: Lippen-Animation anhand des Textes. rate = Zeichen/Sekunde. */
  startTalking(text, rate = 14) {
    this.talking = true;
    this.speech = { text, pos: 0, rate };
  }

  /** Synchronisation mit TTS-Wortgrenzen (SpeechSynthesis 'boundary'-Event). */
  syncSpeech(charIndex) {
    if (this.speech) this.speech.pos = Math.max(this.speech.pos, charIndex);
  }

  stopTalking() {
    this.talking = false;
    this.speech = null;
  }

  /* ------------------------------------------------------------------ */
  /* Animation pro Frame                                                 */
  /* ------------------------------------------------------------------ */

  update(dt) {
    if (!this.root) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const t = this.time;
    const target = {}; // Ziel-Morphgewichte dieses Frames
    const add = (k, v) => { target[k] = (target[k] || 0) + v; };

    // --- Emotion ----------------------------------------------------------
    if (this.emotionTimer > 0) {
      this.emotionTimer -= dt;
      if (this.emotionTimer <= 0) this.emotion = 'neutral';
    }
    const emo = EMOTIONS[this.emotion];
    for (const [k, v] of Object.entries(emo.morphs)) add(k, v);
    for (const k of ['tilt', 'pitch', 'yaw']) this.headPose[k] = damp(this.headPose[k], emo.head[k], 4, dt);

    // --- Blick: Touch folgen oder zufällige Sakkaden ------------------------
    const idleLook = t - this.lastPointer > 2.5;
    if (idleLook) {
      this.saccadeTimer -= dt;
      if (this.saccadeTimer <= 0) {
        this.saccadeTimer = 1.2 + Math.random() * 2.5;
        this.lookTarget.set((Math.random() - 0.5) * 0.35, (Math.random() - 0.4) * 0.25);
      }
    }
    if (emo.eyes) this.lookTarget.set(emo.eyes.x, emo.eyes.y);
    this.look.x = damp(this.look.x, this.lookTarget.x, 6, dt);
    this.look.y = damp(this.look.y, this.lookTarget.y, 6, dt);
    // Augen (Morphs) – x>0: Betrachter-rechts = Figur-links
    const lx = this.look.x, ly = this.look.y;
    if (lx > 0) { add('lookOutL', lx * 0.8); add('lookInR', lx * 0.8); }
    else { add('lookInL', -lx * 0.8); add('lookOutR', -lx * 0.8); }
    if (ly > 0) { add('lookUpL', ly * 0.6); add('lookUpR', ly * 0.6); }
    else { add('lookDownL', -ly * 0.7); add('lookDownR', -ly * 0.7); }

    // --- Blinzeln ------------------------------------------------------
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkTimer = 2 + Math.random() * 4 + (Math.random() < 0.15 ? -1.8 : 0); // ab und zu Doppelblinzeln
    }
    let blink = 0;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.16;
      blink = Math.sin(Math.min(this.blinkPhase, 1) * Math.PI);
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }
    const blinkW = Math.max(blink, ly < 0 ? -ly * 0.25 : 0); // beim Runterschauen Lider etwas tiefer
    add('blinkL', blinkW); add('blinkR', blinkW);

    // --- Sprechen: Viseme --------------------------------------------------
    let talkEnergy = 0;
    if (this.talking && this.speech) {
      const sp = this.speech;
      sp.pos += sp.rate * dt;
      const idx = Math.floor(sp.pos);
      if (idx < sp.text.length) {
        const vis = charToViseme(sp.text, idx);
        const frac = sp.pos - idx;
        const amp = 0.55 + 0.35 * Math.sin(frac * Math.PI);
        if (vis) { add(vis, amp); talkEnergy = 1; }
        if (vis && 'v_aa v_E v_O v_I v_U'.includes(vis)) add('jawOpen', 0.12 * amp);
      } else {
        // Text "durch", TTS spricht evtl. noch: weiche Zufallsbewegung
        const j = 0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 7.3);
        add('v_aa', j * 0.35); add('v_E', (1 - j) * 0.25);
        talkEnergy = 0.7;
      }
    }

    // --- Gewichte glätten + anwenden ---------------------------------------
    const infl = this.mesh.morphTargetInfluences;
    for (const k of Object.keys(this.morphIndex)) {
      const goal = Math.min(1, target[k] || 0);
      const speed = k.startsWith('v_') || k === 'jawOpen' ? 22 : k.startsWith('blink') ? 60 : 7;
      this.weights[k] = damp(this.weights[k], goal, speed, dt);
      infl[this.morphIndex[k]] = this.weights[k];
    }

    // --- Knochen: Grundpose + Idle + Kopf ------------------------------------
    const B = this.bones;
    for (const [name, q] of Object.entries(this.base)) B[name].quaternion.copy(q);
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

    const breath = Math.sin(t * (Math.PI * 2) / 4.2);          // ~14 Atemzüge/Minute
    const sway = Math.sin(t * 0.55) * 0.6 + Math.sin(t * 0.23) * 0.4;
    this._rotateWorld(B.Pelvis, Z, sway * 0.012);
    this._rotateWorld(B.Spine, Z, -sway * 0.01);
    this._rotateWorld(B.Spine1, X, -breath * 0.012);
    this._rotateWorld(B.Spine2, X, -breath * 0.01);
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? 1 : -1;
      this._rotateWorld(B[`${side}_Clavicle`], Z, s * breath * 0.012); // Schultern heben sich beim Einatmen
      this._rotateWorld(B[`${side}_UpperArm`], Z, s * (0.015 * Math.sin(t * 0.7 + s)));
    }

    // Kopf: Blick + Emotion + Mikrobewegung + Nicken beim Sprechen
    const nod = talkEnergy * (Math.sin(t * 5.1) * 0.025 + Math.sin(t * 2.3) * 0.02);
    const yaw = lx * 0.38 + this.headPose.yaw + Math.sin(t * 0.37) * 0.02;
    const pitch = -ly * 0.22 + this.headPose.pitch + Math.sin(t * 0.51) * 0.012 + nod;
    const tilt = this.headPose.tilt + Math.sin(t * 0.29) * 0.015 + talkEnergy * Math.sin(t * 1.7) * 0.02;
    this._rotateWorld(B.Neck, Y, yaw * 0.4);
    this._rotateWorld(B.Neck, X, pitch * 0.4);
    // Im Biped-Skelett hängen die Schlüsselbeine am Hals → Halsdrehung für die Schultern
    // rückgängig machen, sonst würden Arme beim Kopfdrehen mitschwingen.
    for (const side of ['L', 'R']) {
      this._rotateWorld(B[`${side}_Clavicle`], X, -pitch * 0.4);
      this._rotateWorld(B[`${side}_Clavicle`], Y, -yaw * 0.4);
    }
    this._rotateWorld(B.Head, Y, yaw * 0.6);
    this._rotateWorld(B.Head, X, pitch * 0.6);
    this._rotateWorld(B.Head, Z, tilt);
  }

  /** Welt-Position des Kopfes (für Kamera-Ausrichtung). */
  headPosition(target = new THREE.Vector3()) {
    return this.bones.Head.getWorldPosition(target);
  }
}
