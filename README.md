# Ava – animierte 3D-KI-Assistentin (Prototyp)

© 2026 Michael Sedlazek. Alle Rechte am eigenen Code vorbehalten. Drittanbieter-Bestandteile siehe „Lizenzen".

Mobile-first Web-App (Hochformat) mit einer realistischen, animierten 3D-Assistentin,
Chat-Oberfläche, deutscher Sprachausgabe und Offline-Fähigkeit (PWA).

## Starten

Die App muss über HTTP(S) ausgeliefert werden (ES-Module + Service Worker funktionieren nicht per `file://`):

```bash
cd ki-assistentin
python3 -m http.server 8080
# Browser: http://localhost:8080
```

Auf dem Handy: Server im LAN starten und `http://<PC-IP>:8080` öffnen. Für **Installation als App
(PWA) und Offline-Betrieb** verlangen Browser **HTTPS** (Ausnahme: `localhost`) – z. B. auf
GitHub Pages, Netlify oder hinter einem HTTPS-Reverse-Proxy hosten. Danach im Browser-Menü
„Zum Startbildschirm hinzufügen" / „App installieren". Nach dem ersten Laden läuft alles offline.

## Funktionen

| Funktion | Umsetzung |
|---|---|
| 3D-Figur | Microsoft Rocketbox, zusammengesetzt: Kopf/Haare von „Female_Party_01" (natürlich blond, blaue Augen, Gesichts-Blendshapes) + Outfit von „Female_Party_02" (Shirt mit Gürtel, schwarzer Minirock, Sandalen); three.js r186 lokal in `vendor/` |
| Idle | Atmung (Brustkorb/Schultern), leichtes Gewichts-Schwanken, Mikro-Kopfbewegungen, zufällige Blicksprünge |
| Blinzeln | ARKit-Blendshapes `EyeBlinkLeft/Right`, zufällige Intervalle inkl. Doppelblinzeln |
| Blick folgt Touch | Kopf (Hals + Kopf-Knochen) und Augen (EyeLook-Blendshapes) folgen Finger/Maus |
| Sprechen | 15 Viseme-Blendshapes (`AA_VI_*`), aus dem Text abgeleitet (dt. Buchstabe→Mundform), synchronisiert mit TTS-Wortgrenzen; dazu Kopfnicken |
| Emotionen | fröhlich, nachdenklich, überrascht (+ neutral) – Blendshapes + Kopfhaltung + Blickrichtung; Buttons rechts oder per Chat („Sei überrascht", „Denk nach", „Lächle") |
| Chat | Textfeld, Nachrichtenblasen, Schnellantwort-Chips |
| Antworten | lokaler regelbasierter Responder (Begrüßung, Name „Ava", Uhrzeit, Datum, Witze, Befinden, Danke, Abschied, Hilfe, Fallback) |
| Sprachausgabe | Web Speech API, `de-DE`, bevorzugt weibliche Stimme, Ein/Aus-Schalter (🔊/🔇, gespeichert) |
| PWA | `manifest.webmanifest` + `sw.js` (Cache-first, alle Dateien vorab gecacht) |
| Look | weiches 3-Punkt-Licht (warmes Key, kühles Fill, zwei dezente Rim-Lichter, Catchlight an der Kamera), ACES-Tonemapping, Haut als `MeshPhysicalMaterial` mit warmem Sheen + leichtem Eigenleuchten (Subsurface-Anmutung), seidiger Haar-Sheen, Studio-Verlauf im Hintergrund |
| Ansicht | Standard: Porträt (Kopf + Oberkörper); Ganzkörper mit `?view=full` oder in der Konsole `ava.setView('full')` |
| Performance | Blendshapes von ~170 auf 49 reduziert (ohne Normalen-Morphs), unsichtbare Körperteile beider Modelle werden beim Laden entfernt, Texturen 2048/1024/512 px, Haar-PNG mit 256 Farben (~280 KB), Pixel-Ratio ≤ 2 und adaptiv (sinkt bei < 40 FPS) |

## Echtes LLM anschließen

In `js/responder.js` gibt es genau **eine** Schnittstelle: `async getReply(text) → { text, emotion }`.
Dort steht ein kommentiertes Beispiel für einen `fetch` auf einen eigenen Server/Proxy
(API-Schlüssel nie im Frontend!). `guessEmotion(reply)` leitet eine Emotion aus beliebigem Text ab.

## Projektstruktur

```
index.html              Oberfläche (Deutsch), Importmap für three.js
css/style.css           Mobile-first Layout (Safe-Areas, 100dvh, Glas-Optik)
js/main.js              Szene, Licht, Kamera, Touch, Chat-Ablauf, Render-Schleife, SW-Registrierung
js/avatar.js            Modelle laden + zusammensetzen, Materialien, Pose, alle Animationen (Idle/Blick/Emotion/Viseme)
js/responder.js         getReply() + lokale Regeln  ← hier LLM einbauen
js/speech.js            Text-to-Speech (de-DE)
sw.js                   Service Worker (Offline-Cache, Version in CACHE erhöhen bei Änderungen)
manifest.webmanifest    PWA-Manifest
vendor/three/           three.js r186 (MIT) + FBXLoader, fflate, NURBS, RoomEnvironment
assets/model/           ava.fbx (Kopf/Haare/Skelett), ava_outfit.fbx (Outfit) + Texturen (JPG/PNG), Lizenzdatei
tools/prep_textures.py  erzeugt die Texturen aus den Rocketbox-TGAs (Umfärbungen, Hautton-Angleich, Verkleinerung)
assets/icons/           App-Icons (aus dem Modell gerendert)
screenshot2.png         Test-Screenshot (390×844, DPR 2, Headless-Chrome), screenshot2_full.png = Ganzkörper
screenshot.png          alter Screenshot (vorheriges Modell)
```

## Lizenzen / Quellen

- **3D-Modell:** Microsoft Rocketbox Avatar Library – Quelle: https://github.com/microsoft/Microsoft-Rocketbox
  Lizenz: **MIT License**, Copyright (c) 2020 Microsoft – siehe `assets/model/LICENSE-Rocketbox.md`.
  Verwendet:
  - `Assets/Avatars/Adults/Female_Party_01` – `Export/Female_Party_01_facial.fbx` (→ `ava.fbx`: Kopf, Haare,
    Gesichts-Blendshapes, Skelett) + Texturen `f010_head_*`, `f010_opacity_color`
  - `Assets/Avatars/Adults/Female_Party_02` – `Export/Female_Party_02.fbx` (→ `ava_outfit.fbx`: Körper/Outfit)
    + Texturen `f022_body_*`
  Änderungen: Modelle zur Laufzeit kombiniert (Outfit an das Skelett von Party_01 gebunden, verdeckte/unbenutzte
  Teile entfernt), T-Pose → Standpose, Materialien ersetzt, Blendshapes reduziert; Texturen von TGA nach JPG/PNG
  konvertiert und verkleinert, Körper-Hautton an das Gesicht angeglichen, Shirt Braun → Beere/Rosé, Ohrringe
  Türkis → Gold, Haar wärmer (Goldblond) – reproduzierbar mit `tools/prep_textures.py`.
  (Bis v1 wurde `Assets/Avatars/Professions/Business_Female_04` verwendet.)
- **three.js** r186 – MIT License, © 2010–2026 three.js authors – siehe `vendor/three/LICENSE`.

## Grenzen des Prototyps

- Lippen-Synchronisation ist text-basiert (Schätzung, ~14 Zeichen/s, nachjustiert über TTS-`boundary`-Events,
  die nicht jeder Browser/jede Stimme liefert) – keine echte Phonem-Analyse des Audios.
- Stimmenqualität und -geschlecht hängen vom Gerät ab (iOS: „Anna"/„Helena", Android: Google-Stimmen).
  Ohne deutsche Stimme bewegt sich nur der Mund (stumm). Sprachausgabe startet erst nach der ersten Berührung (Browser-Regel).
- Keine Körper-Animationsclips (Gesten, Gehen) – nur prozedurale Idle-/Kopf-/Gesichtsanimation.
- Haare/Wimpern nutzen Alpha-Test; auf sehr schwachen GPUs evtl. leicht pixelige Haarkanten.
- Rocketbox-Modelle sind „realistisch" auf Spiele-Niveau (ca. 30 000 Vertices), nicht fotorealistisch.
- Zwei FBX-Dateien (~3,4 MB zusammen statt 2,1 MB), dafür blondes Haar + Minirock ohne eigene 3D-Modellierung.
- Download beim ersten Start ca. 8 MB (Modell + Texturen), danach aus dem Cache.
