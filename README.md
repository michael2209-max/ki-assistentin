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
| 3D-Figur | Microsoft Rocketbox „Business_Female_04" (realistisch, Business-Outfit), three.js r186 lokal in `vendor/` |
| Idle | Atmung (Brustkorb/Schultern), leichtes Gewichts-Schwanken, Mikro-Kopfbewegungen, zufällige Blicksprünge |
| Blinzeln | ARKit-Blendshapes `EyeBlinkLeft/Right`, zufällige Intervalle inkl. Doppelblinzeln |
| Blick folgt Touch | Kopf (Hals + Kopf-Knochen) und Augen (EyeLook-Blendshapes) folgen Finger/Maus |
| Sprechen | 15 Viseme-Blendshapes (`AA_VI_*`), aus dem Text abgeleitet (dt. Buchstabe→Mundform), synchronisiert mit TTS-Wortgrenzen; dazu Kopfnicken |
| Emotionen | fröhlich, nachdenklich, überrascht (+ neutral) – Blendshapes + Kopfhaltung + Blickrichtung; Buttons rechts oder per Chat („Sei überrascht", „Denk nach", „Lächle") |
| Chat | Textfeld, Nachrichtenblasen, Schnellantwort-Chips |
| Antworten | lokaler regelbasierter Responder (Begrüßung, Name „Ava", Uhrzeit, Datum, Witze, Befinden, Danke, Abschied, Hilfe, Fallback) |
| Sprachausgabe | Web Speech API, `de-DE`, bevorzugt weibliche Stimme, Ein/Aus-Schalter (🔊/🔇, gespeichert) |
| PWA | `manifest.webmanifest` + `sw.js` (Cache-first, alle Dateien vorab gecacht) |
| Performance | Blendshapes von ~170 auf 49 reduziert (ohne Normalen-Morphs), Texturen auf 2048/1024/512 px verkleinert, Pixel-Ratio ≤ 2 und adaptiv (sinkt bei < 40 FPS) |

## Echtes LLM anschließen

In `js/responder.js` gibt es genau **eine** Schnittstelle: `async getReply(text) → { text, emotion }`.
Dort steht ein kommentiertes Beispiel für einen `fetch` auf einen eigenen Server/Proxy
(API-Schlüssel nie im Frontend!). `guessEmotion(reply)` leitet eine Emotion aus beliebigem Text ab.

## Projektstruktur

```
index.html              Oberfläche (Deutsch), Importmap für three.js
css/style.css           Mobile-first Layout (Safe-Areas, 100dvh, Glas-Optik)
js/main.js              Szene, Licht, Kamera, Touch, Chat-Ablauf, Render-Schleife, SW-Registrierung
js/avatar.js            Modell laden, Materialien, Pose, alle Animationen (Idle/Blick/Emotion/Viseme)
js/responder.js         getReply() + lokale Regeln  ← hier LLM einbauen
js/speech.js            Text-to-Speech (de-DE)
sw.js                   Service Worker (Offline-Cache, Version in CACHE erhöhen bei Änderungen)
manifest.webmanifest    PWA-Manifest
vendor/three/           three.js r186 (MIT) + FBXLoader, fflate, NURBS, RoomEnvironment
assets/model/           ava.fbx + Texturen (JPG/PNG), Lizenzdatei
assets/icons/           App-Icons (aus dem Modell gerendert)
screenshot.png          Test-Screenshot (390×844, DPR 2, Headless-Chrome)
```

## Lizenzen / Quellen

- **3D-Modell:** Microsoft Rocketbox Avatar Library – `Assets/Avatars/Professions/Business_Female_04`
  (Variante `Export/Business_Female_04_facial.fbx` mit Gesichts-Blendshapes)
  Quelle: https://github.com/microsoft/Microsoft-Rocketbox
  Lizenz: **MIT License**, Copyright (c) 2020 Microsoft – siehe `assets/model/LICENSE-Rocketbox.md`.
  Änderungen: Texturen von TGA nach JPG/PNG konvertiert und verkleinert; zur Laufzeit T-Pose → Standpose,
  Materialien ersetzt, Blendshapes reduziert.
- **three.js** r186 – MIT License, © 2010–2026 three.js authors – siehe `vendor/three/LICENSE`.

## Grenzen des Prototyps

- Lippen-Synchronisation ist text-basiert (Schätzung, ~14 Zeichen/s, nachjustiert über TTS-`boundary`-Events,
  die nicht jeder Browser/jede Stimme liefert) – keine echte Phonem-Analyse des Audios.
- Stimmenqualität und -geschlecht hängen vom Gerät ab (iOS: „Anna"/„Helena", Android: Google-Stimmen).
  Ohne deutsche Stimme bewegt sich nur der Mund (stumm). Sprachausgabe startet erst nach der ersten Berührung (Browser-Regel).
- Keine Körper-Animationsclips (Gesten, Gehen) – nur prozedurale Idle-/Kopf-/Gesichtsanimation.
- Haare/Wimpern nutzen Alpha-Test; auf sehr schwachen GPUs evtl. leicht pixelige Haarkanten.
- Rocketbox-Modelle sind „realistisch" auf Spiele-Niveau (ca. 26 000 Vertices), nicht fotorealistisch.
- Download beim ersten Start ca. 8 MB (Modell + Texturen), danach aus dem Cache.
