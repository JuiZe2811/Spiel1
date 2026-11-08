# Die fünf Schlüssel

**Version 1.7.0 · made by Julian** — alle Änderungen stehen im Spiel unter *Patch Notes*.

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
| Kompass | Taste **Kompass** | H |
| Interagieren | Taste **INTERAGIEREN** / **VERSTECKEN** erscheint bei Türen, Verstecken, Ausgang | E |
| Pause | Pause-Knopf oben links | Esc |

Die Oberfläche wird automatisch gewählt: Touch-Geräte (auch iPads, die sich als Mac ausgeben) bekommen die Touch-Steuerung, unabhängig von der Bildschirmgröße. Wechselt man das Eingabegerät (z. B. Tablet mit Maus), schaltet die Oberfläche um.

Die Touch-Tasten liegen im Viertelkreis um den rechten Daumen: großer Sprint-Knopf in der Ecke, darum Licht, Kreuz, Bengalo und Kompass. Die Drehempfindlichkeit ist getrennt für Touch und Maus einstellbar (Einstellungen oder direkt im Pausenmenü).

## Spielmechanik

- **Schlüssel:** Fünf Schlüssel werden bei jedem Spielstart zufällig auf fünf verschiedene Räume verteilt (auf Tischen, Kisten oder in Ecken). Sie leuchten golden, damit sie auch auf kleinen Displays erkennbar sind.
- **Verstecke:** 13 Verstecke – Holzschränke (Büros, Halle), Metallspinde (Lager) und Mauerspalten zwischen Kisten (Keller). Hineinschlüpfen mit INTERAGIEREN/E, wieder heraus genauso. Drinnen schaust du durch Lüftungsschlitze bzw. den Spalt, die Taschenlampe bleibt aus. Der Geist sieht dich nicht, verliert deine Spur und läuft vorbei. Sieht er aus weniger als 7 m, wie du hineinschlüpfst, reißt er das Versteck auf (das Kruzifix rettet dich dann noch).
- **Automatisches Aufsammeln:** Schlüssel und Bengalos werden eingesammelt, sobald du sie berührst.
- **Kompass:** Alle 30 Sekunden kannst du einen Kompass für 3 Sekunden in die Hand nehmen (Taste **Kompass** bzw. **H**). Seine Nadel zeigt zum nächsten Schlüssel, nach dem fünften Schlüssel zum Ausgang. Ein Schlüssel in unmittelbarer Nähe (unter 5 m) klingelt leise.
- **Rote Bengalos:** 7 Stück liegen rot leuchtend im Gebäude. Man trägt bis zu 3, jeder kann einmal geworfen werden. Er fliegt in Blickrichtung, prallt von Wänden ab und leuchtet 30 Sekunden lang die Umgebung rot aus.
- **Die Welt lebt:** Etwa alle 5–10 Sekunden verändert sich etwas: blutige Schriften („ER SIEHT DICH“, „LAUF“ …) und Handabdrücke erscheinen an Wänden hinter dir, Türen öffnen sich langsam von selbst, Glühbirnen platzen, Stühle drehen sich zu dir oder kippen um, Schattengestalten stehen in der Ferne und verschwinden im Licht, eine Spieluhr spielt, Schritte über der Decke.
- **Fluchtphase:** Nach dem fünften Schlüssel wird der Ausgang entriegelt (Lampe an der Tür wird grün). Der Geist wird schneller und spürt regelmäßig, wo du ungefähr bist.
- **Kruzifix:** 4 Sekunden Schutz, danach 20 Sekunden Abklingzeit. Ist der Geist in der Nähe, wird er zurückgedrängt und verliert deine Spur.
- **Taschenlampe:** Ohne Batterie, flackert, wenn der echte Geist nahe ist. Eingeschaltet sieht der Geist dich aus größerer Entfernung.
- **Der Geist:** gebeugte, ausgemergelte Gestalt mit zerfetztem Gewand (Saum läuft durchsichtig in Fetzen aus), langen nassen Haarsträhnen und überlangen, knochigen Armen mit einzelnen Fingern. Gewand, Fetzen und Haare bewegen sich ständig; der Kopf knickt ruckartig ab, die Gestalt flackert kurz wie ein Bildaussetzer, Nebel steigt auf. Bei der Jagd glimmen die Augen, der Kopf reckt sich vor und die Hände krallen. Sein Gesicht ist das Standard- oder dein hochgeladenes Gesicht.
- **Geist-KI:** Zustände *Umherwandern*, *Geräusch untersuchen*, *Verfolgen*, *Letzte Position absuchen*, *Zurückweichen*. Er sieht nur mit Sichtlinie (keine Sicht durch Wände, geschlossene Türen oder hohe Regale), hört Schritte (Rennen ist laut) und Türen, öffnet Türen auf seinem Weg und navigiert per A*-Wegfindung um Hindernisse.
- **Harmlose Schreckmomente:** Etwa alle 10–26 Sekunden (zufällig, mit jedem Schlüssel häufiger, manchmal zwei direkt hintereinander). Der echte Geist jagt nur; die Schocks kommen von anderen Wesen und aus der Umgebung:
  - **Schattenmann** (2,7 m groß, weiß glühende Augen): lugt aus offenen Türen, geht durch Räume, steht nach einem Stromausfall vor dir
  - **Krabbler** (auf allen Vieren, rote Augen): rennt auf dich zu, huscht über den Boden oder kopfüber über die Decke
  - **Mädchen**: steht zur Wand gedreht, weint, dreht den Kopf ganz herum
  - **Porzellanpuppe**: sitzt plötzlich hinter dir, Spieluhr, dreht den Kopf
  - **Schaufensterpuppe**: rückt näher, sobald du wegsiehst
  - rote **Augen in der Dunkelheit**, schwarze **Arme aus der Wand**, **fliegende Kisten**, drei verrauschte **Fratzen** als Bildschirm-Schock (selten dein hochgeladenes Gesicht), Erscheinung im Taschenlampen-Flackern, Gestalt hinter dir
  - Umgebung: zuschlagende Türen und Türketten, Gesicht im Fenster, Flüstern, Schritte von hinten, Hämmern in der Wand, Telefon, Kichern, ferner Schrei, sich bewegende Stühle
  - Nur ganz selten ein kurzer Blick auf den echten Geist in der Ferne.

  Keines davon kann töten, etwas wegnehmen oder das Kruzifix verbrauchen.
- **Jagdphasen:** Etwa alle 1–1,5 Minuten (und direkt nach dem 2. und 4. Schlüssel) werden die Lichter rot und eine Sirene dröhnt. 14–21 Sekunden lang sucht der Geist gezielt in deiner ungefähren Nähe und ist schneller. Licht aus, langsam gehen und geschlossene Türen retten dich.
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

## Sound

Fünf aufgenommene Sounds liegen in `assets/audio/` und werden nach dem ersten Antippen geladen:

| Datei | Einsatz |
|---|---|
| `kreischen.mp3` | Kreischen bei Jumpscares, beim Entdecktwerden (tiefer abgespielt) und beim Tod |
| `maedchen-schrei.mp3` | Schrei beim Mädchen-Ereignis, ferne Schreie, Teil des Todesschreis |
| `geist-atem.mp3` | Atmen/Knurren des Geistes als räumliche Dauerschleife |
| `stimmen.mp3` | Zufällige Ausschnitte als ferne Stimmen |
| `musik.mp3` | Hintergrundmusik: im Menü lauter, im Spiel leise, bei Verfolgung fast aus |

Alles andere wird live im Browser synthetisiert: Hall eines großen, leeren Gebäudes, Klangfläche, Wind, Rohre, Metall, Donner, Weinen, Tropfen, Herzschlag und Trommeln bei Verfolgungen. Schocks laufen über einen eigenen lauten Kanal, Musik und Umgebung werden dabei kurz abgesenkt. Fehlt eine Datei, springt der synthetische Ersatz ein. Mit „Intensive Schreckeffekte reduzieren“ werden Schocks leiser.

Bei jedem Start erscheint kurz ein Fenster mit den Neuerungen der aktuellen Version (`js/version.js`).

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
