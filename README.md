# Die fünf Schlüssel

**Version 1.2.0 · made by Julian** — alle Änderungen stehen im Spiel unter *Patch Notes*.

3D-Survival-Horror direkt im Browser – für Smartphone, Tablet und PC. Keine Installation, kein Plugin, kein Server-Backend.

Du bist in einem verlassenen Gebäude eingeschlossen. Finde fünf versteckte Schlüssel, entriegle die Ausgangstür in der Eingangshalle und entkomme – während ein Geist dich durch Flure, Büros, Lager und den Keller jagt. Du hast nur eine Taschenlampe und ein Kruzifix.

## Spielen

Die Seite muss über **HTTP(S)** ausgeliefert werden (ES-Module funktionieren nicht per `file://`).

Lokal testen:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen (Smartphone im selben WLAN: http://<IP-des-PCs>:8000)
```

### Veröffentlichen (statisch, ohne Build-Schritt)

Alle Dateien im Repository-Wurzelverzeichnis sind die fertige Website.

- **GitHub Pages:** Repository → *Settings* → *Pages* → *Deploy from a branch* → Branch wählen, Ordner `/ (root)`. Die Datei `.nojekyll` ist bereits vorhanden.
- **Netlify:** „Add new site“ → Repository verbinden, Build-Befehl leer lassen, Publish-Verzeichnis `.`
- **Cloudflare Pages:** Projekt verbinden, Framework „None“, Build-Befehl leer, Ausgabeverzeichnis `/`

Alle Ressourcen (Three.js, Schriften, Texturen, Klänge) liegen im Repository oder werden zur Laufzeit erzeugt. Es gibt keine externen Abhängigkeiten und damit keine CORS-Probleme.

## Steuerung

| Aktion | Smartphone / Tablet | PC |
|---|---|---|
| Bewegen | Virtueller Joystick (linke Bildschirmhälfte, erscheint unter dem Daumen) | W A S D |
| Umsehen | Rechte Bildschirmhälfte wischen | Maus (ins Bild klicken für Pointer Lock) |
| Rennen | Großer Knopf **Sprint** unten rechts (umschaltbar) | Shift halten |
| Taschenlampe | Taste **Licht** | F |
| Kruzifix | Taste **Kreuz** (Abklingzeit als Ring) | Q |
| Bengalo werfen | Taste **Bengalo** (Zähler am Knopf) | G |
| Schlüssel-Hinweis | Taste **Hinweis** | H |
| Interagieren | Taste **INTERAGIEREN** / **AUFNEHMEN** erscheint bei Türen, Schlüsseln, Ausgang | E |
| Pause | Pause-Knopf oben links | Esc |

Die Oberfläche wird automatisch gewählt: Touch-Geräte (auch iPads, die sich als Mac ausgeben) bekommen die Touch-Steuerung, unabhängig von der Bildschirmgröße. Wechselt man das Eingabegerät (z. B. Tablet mit Maus), schaltet die Oberfläche um.

Die Touch-Tasten liegen im Viertelkreis um den rechten Daumen: großer Sprint-Knopf in der Ecke, darum Licht, Kreuz, Bengalo und Hinweis. Die Drehempfindlichkeit ist getrennt für Touch und Maus einstellbar (Einstellungen oder direkt im Pausenmenü).

## Spielmechanik

- **Schlüssel:** Fünf Schlüssel werden bei jedem Spielstart zufällig auf fünf verschiedene Räume verteilt (auf Tischen, Kisten oder in Ecken). Sie leuchten golden, damit sie auch auf kleinen Displays erkennbar sind.
- **Schlüssel-Hinweis:** Die Hinweis-Taste zeigt 8 Sekunden lang einen Pfeil mit Entfernung und eine goldene Lichtsäule (durch Wände sichtbar) zum nächsten Schlüssel, danach 30 Sekunden Abklingzeit. Schlüssel in der Nähe (unter 9 m) klingeln leise.
- **Rote Bengalos:** 7 Stück liegen rot leuchtend im Gebäude. Man trägt bis zu 3, jeder kann einmal geworfen werden. Er fliegt in Blickrichtung, prallt von Wänden ab und leuchtet 30 Sekunden lang die Umgebung rot aus.
- **Die Welt lebt:** Etwa alle 5–10 Sekunden verändert sich etwas: blutige Schriften („ER SIEHT DICH“, „LAUF“ …) und Handabdrücke erscheinen an Wänden hinter dir, Türen öffnen sich langsam von selbst, Glühbirnen platzen, Stühle drehen sich zu dir oder kippen um, Schattengestalten stehen in der Ferne und verschwinden im Licht, eine Spieluhr spielt, Schritte über der Decke.
- **Fluchtphase:** Nach dem fünften Schlüssel wird der Ausgang entriegelt (Lampe an der Tür wird grün). Der Geist wird schneller und spürt regelmäßig, wo du ungefähr bist.
- **Kruzifix:** 4 Sekunden Schutz, danach 20 Sekunden Abklingzeit. Ist der Geist in der Nähe, wird er zurückgedrängt und verliert deine Spur.
- **Taschenlampe:** Ohne Batterie, flackert, wenn der echte Geist nahe ist. Eingeschaltet sieht der Geist dich aus größerer Entfernung.
- **Geist-KI:** Zustände *Umherwandern*, *Geräusch untersuchen*, *Verfolgen*, *Letzte Position absuchen*, *Zurückweichen*. Er sieht nur mit Sichtlinie (keine Sicht durch Wände, geschlossene Türen oder hohe Regale), hört Schritte (Rennen laut, Ducken leise) und Türen, öffnet Türen auf seinem Weg und navigiert per A*-Wegfindung um Hindernisse.
- **Harmlose Schreckmomente:** Etwa alle 10–26 Sekunden (zufällig, mit jedem Schlüssel häufiger, manchmal zwei direkt hintereinander) eines von zwanzig Ereignissen: Gesicht vor der Kamera, Gestalt hinter einer offenen Tür, Schatten im Flur, Erscheinung im Taschenlampen-Flackern, zuschlagende Tür, heranstürmender Geist, Gesicht im Fenster, Flüstern hinter dir, schwebende Erscheinung, sich bewegender Stuhl, Stromausfall mit Gestalt direkt vor dir, Schritte, die sich von hinten nähern, Gestalt, die hinter dir steht, Geist kopfüber an der Decke, Hämmern in der Wand, klingelndes Telefon (lockt auch den Geist an), Kichern, unterschwellige Gesichtsblitze, Kette zuschlagender Türen, ferner Schrei. Sie benutzen dasselbe Modell und Gesicht wie der echte Geist, können aber niemals töten, nichts wegnehmen und das Kruzifix nicht verbrauchen.
- **Jagdphasen:** Etwa alle 1–1,5 Minuten (und direkt nach dem 2. und 4. Schlüssel) werden die Lichter rot und eine Sirene dröhnt. 14–21 Sekunden lang sucht der Geist gezielt in deiner ungefähren Nähe und ist schneller. Ducken, Licht aus und geschlossene Türen retten dich.
- **Eskalation:** Mit jedem Schlüssel wird der Geist etwas schneller und sieht weiter.

## Eigenes Geistergesicht

Hauptmenü → **GEISTERGESICHT HOCHLADEN** → **FOTO AUSWÄHLEN** öffnet die Fotomediathek bzw. Dateiauswahl (JPG, PNG, WEBP; iPhones wandeln HEIC automatisch um). Das Foto lässt sich verschieben (Ziehen) und zoomen (Regler, zwei Finger oder Mausrad). Nach **ÜBERNEHMEN** wird es entsättigt, bleich eingefärbt und als Gesichtstextur auf den Kopf des Geistes gelegt – auch für die Erscheinungen und Jumpscares.

Das Bild wird **ausschließlich lokal im Browser** verarbeitet und nur im `localStorage` dieses Geräts gespeichert. Es wird nirgendwohin hochgeladen.

## Mobile Besonderheiten

- **Querformat:** Im Hochformat erscheint „Bitte drehe dein Smartphone ins Querformat.“ und das Spiel pausiert.
- **Vollbild:** Wird auf unterstützten Geräten (z. B. Android Chrome) beim Start versucht (abschaltbar) und ist im Menü verfügbar. iPhone-Safari unterstützt kein Element-Vollbild; das Spiel funktioniert dort vollständig ohne. Über *Teilen → Zum Home-Bildschirm* startet es als Web-App ohne Browserleisten (Manifest ist vorhanden).
- **Safe Areas:** Alle Bedienelemente halten Abstand zu Notch, Dynamic Island, abgerundeten Ecken und Systemleisten (`env(safe-area-inset-*)`).
- **Audio:** Der Audio-Kontext startet erst nach dem Antippen eines Menüknopfs. Beim App-/Tab-Wechsel wird Audio angehalten und beim Weiterspielen fortgesetzt.
- **Unterbrechungen:** Wechsel in den Hintergrund, Anruf, Bildschirmsperre oder Fokusverlust pausieren das Spiel sofort (inkl. Geist und Spielzeit). Es geht erst nach Tippen auf **WEITERSPIELEN** weiter, mit kurzer Schonfrist gegen sofortigen Tod. Der Spielstand wird alle 5 Sekunden und bei jeder Pause lokal gespeichert; im Hauptmenü erscheint dann **WEITERSPIELEN**.

## Grafik & Leistung

- Grafikstufen **Niedrig / Mittel / Hoch** plus **Auto** (Startwert je nach Gerät).
- Dynamische Renderauflösung: Fällt die Bildrate unter das Ziel (≈30 FPS mobil, ≈50 FPS PC), sinkt die interne Auflösung; bei Auto notfalls auch die Stufe.
- Begrenzte Lichtquellen (1/2/4 Deckenlampen), Schatten nur auf „Hoch“ und nur von der Taschenlampe, exponentieller Nebel, zusammengeführte Geometrie (wenige Draw Calls), prozedurale Canvas-Texturen.
- Spiellogik läuft in festen Teilschritten und ist unabhängig von der Bildrate. Taschenlampe, KI und Jumpscares funktionieren auf allen Stufen identisch.

## Einstellungen

Grafikqualität, Lautstärke, Kamera-Empfindlichkeit, **intensive Schreckeffekte reduzieren** (kleinere, leisere, seltenere Schocks), vertikale Kamera umkehren, Vollbild beim Start, Bildratenanzeige.

## Projektstruktur

```
index.html              Seite & Oberfläche
css/style.css           Gestaltung, responsive Touch-Layout, Safe Areas
js/main.js              Spielablauf, Hauptschleife, Speichern, Pausen, Qualität
js/world.js             Gebäude: Geometrie, Kollision, Türen, Sichtlinien, A*-Wegfindung
js/map.js               Grundriss als Zeichenraster
js/ghost.js             Geistermodell und KI
js/player.js            Bewegung, Taschenlampe, Kruzifix
js/scares.js            Zehn harmlose Schreckmomente
js/audio.js             Komplett synthetisierter Sound (Web Audio API)
js/input.js             Tastatur, Maus/Pointer Lock, Multitouch-Joystick
js/face.js              Standardgesicht, Foto-Verarbeitung, Zuschneide-Editor
js/textures.js          Prozedurale Texturen
js/ui.js, settings.js, util.js
vendor/three.module.min.js   Three.js r160 (MIT, lokal eingebunden)
fonts/                  IM Fell English (SIL OFL, lokal eingebunden)
tools/build-artifact.mjs     Erzeugt eine Ein-Datei-Vorschau für Claude Artifacts (optional)
```

## Teststatus

Geprüft in **Headless-Chromium (Linux, Software-WebGL)**:

- Desktop: Menü, Spielstart, WASD-Bewegung, Schlüssel aufnehmen (alle 5), Entriegeln des Ausgangs, Entdeckung → Verfolgung → Game Over, Kruzifix drängt Geist zurück, Flucht/Sieg, alle 10 Schreckmomente ohne Fehler, automatische Pause bei verstecktem Tab, Speichern und Fortsetzen.
- Emuliertes iPhone 13 (Querformat, Touch): gleichzeitige Mehrfingerbedienung (Joystick + Umsehen), alle Touch-Tasten, INTERAGIEREN an Türen, Pause/Weiter, Hochformat-Hinweis mit Auto-Pause, Foto-Upload mit Zuschneiden und Übernahme.

**Noch ausstehend (keine echten Geräte verfügbar):**

- [ ] iPhone: Safari und Chrome – 3D, Touch, Foto aus Mediathek, Audio (auch mit Stummschalter), App-Wechsel
- [ ] iPad (Safari) und Android-Tablets
- [ ] Android: Chrome und Samsung Internet – Multitouch, Leistung, Vollbild, Foto-Upload
- [ ] Windows: Chrome, Firefox, Edge – Pointer Lock, Maus, Tastatur
- [ ] macOS: Safari und Chrome
- [ ] Bildraten auf echten durchschnittlichen Smartphones (Ziel ≈30 FPS)

## Lizenzen

- Three.js: MIT (`vendor/three.LICENSE`)
- IM Fell English / SC: SIL Open Font License 1.1 (`fonts/OFL.txt`)
