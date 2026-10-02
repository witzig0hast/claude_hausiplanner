# Hausaufgabenplaner

Hausaufgaben-Planer mit Klassen-Sharing, KI-Zusammenfassung (Ollama) und sanften Push-Erinnerungen.
Self-hosted auf deinem eigenen Server, erreichbar über deine Domain.

## Was du am Ende betreiben musst (Übersicht)

Fünf Dienste, die dauerhaft laufen müssen, plus zwei einmalige Einrichtungsschritte:

| Dienst | Was er tut | Wo er läuft |
|---|---|---|
| **Postgres** | Datenbank | Docker-Container (in `docker-compose.yml`) |
| **API** (FastAPI) | Backend, das Web + Mobile ansprechen | Docker-Container |
| **Web** (Next.js) | Die Website (öffentliche Ansicht + Login) | Docker-Container |
| **Ollama** | KI-Modelle lokal (Zusammenfassung, Chat, Foto-/Sprach-Erkennung) | Direkt auf deinem Host (kein Container nötig, muss aber laufen: `ollama serve`) |
| **Wyoming-ASR** (z.B. `wyoming-whisper`) | Spracherkennung für die Einsprech-Funktion | Optional, eigener Dienst auf deinem Host/Netzwerk (z.B. Port 10300) |
| **Reverse Proxy** (Caddy/Traefik) | HTTPS-Zertifikat + Domain-Routing zu Web/API | Auf deinem Host, vor allem anderen |

Einmalig: **Domain + DNS** auf deinen Server zeigen lassen, und den **Superadmin-Schlüssel**
erzeugen (siehe unten). Danach läuft alles automatisch weiter - die Mobile-Apps und die
Web-UI reden nur noch mit deiner API-Domain.

## Struktur

```
apps/
  api/     FastAPI backend (Auth, Klassen, Hausaufgaben, Admin-Kalender, Ollama-Agent, Push)
  web/     Next.js Web-UI (öffentliche Klassenansicht + Login + Dashboard)
  mobile/  Expo React Native App (iOS, iPad, Android)
```

## Backend lokal starten

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Secrets anpassen
alembic upgrade head   # Datenbankschema anlegen/aktualisieren
uvicorn app.main:app --reload
```

Schemaänderungen an den Modellen (`app/models/`) landen als neue Migration:

```bash
alembic revision --autogenerate -m "kurze beschreibung"
alembic upgrade head
```

Läuft auf http://localhost:8000, Swagger-Doku unter `/docs`.

## Web-UI lokal starten

```bash
cd apps/web
npm install
npm run dev
```

Läuft auf http://localhost:3000. Öffentliche Klassenansicht: `/class/<school_class_id>`.
Die `school_class_id` bekommst du z.B. über `/classes/me` (eingeloggt) oder direkt aus der Datenbank.

## Mobile App lokal starten

```bash
cd apps/mobile
npm install
npx expo start
```

Dann mit Expo Go auf iPhone/iPad/Android scannen, oder `npm run ios` / `npm run android`
für den Simulator/Emulator. `extra.apiBaseUrl` in `app.json` auf deine echte Domain setzen,
bevor du einen Standalone-Build machst.

### Sideload statt Store: Android-APK direkt installieren

Kein Play-Store-Account nötig, komplett kostenlos:

```bash
npm install -g eas-cli
eas login                  # kostenloser Expo-Account reicht
eas init                   # verknüpft das Projekt, schreibt projectId in app.json
eas build --platform android --profile android-apk
```

Der Build läuft auf Expos Servern (dauert ein paar Minuten), am Ende bekommst du einen
Download-Link zu einer `.apk`-Datei. Die lädst du aufs Handy (z.B. per Link, USB oder
Cloud-Speicher), tippst sie an und erlaubst einmalig "Installation aus unbekannten
Quellen" - fertig, kein Play Store nötig. `eas.json` hat dafür schon das Profil
`android-apk` (baut eine `.apk` statt eines Play-Store-`.aab`).

**Getestet:** Ich habe versucht, die APK direkt in dieser Entwicklungsumgebung lokal zu
bauen (`expo prebuild` + Gradle, ganz ohne Expo-Account) - das native Android-Projekt
generiert sich einwandfrei, aber der eigentliche Build scheitert hier daran, dass diese
Sandbox den Zugriff auf `dl.google.com` (Googles Maven-Repo, von dem das Android-Gradle-Plugin
kommt) aus Sicherheitsgründen blockiert. Das ist eine Einschränkung dieser Entwicklungsumgebung,
keine deines Rechners: auf deinem eigenen PC/Mac/Linux-Server mit normalem Internetzugang
funktioniert `./gradlew assembleDebug` im generierten `android/`-Ordner, und `eas build`
(läuft ohnehin auf Expos eigenen Servern, nicht bei dir) ist davon komplett unberührt.

### Sideload bei iOS/iPadOS: AltStore PAL (EU, kostenlos)

Wichtig zu verstehen: Apple erlaubt seit dem EU Digital Markets Act zwar alternative
App-Stores, aber jede App muss trotzdem von Apple bzw. deinem Apple-Account signiert
werden - eine "APK für iOS" ohne jede Apple-Beteiligung gibt es nicht. AltStore PAL ist
genau der Weg, das kostenlos (mit deiner normalen, kostenlosen Apple-ID statt einem
99€/Jahr-Account) zu machen:

1. **AltStore PAL auf dem iPhone/iPad installieren** (einmalig, direkt über
   [altstore.io](https://altstore.io) - in der EU ohne Computer möglich, da es als
   alternativer Marktplatz zugelassen ist).
2. **Ein AltServer auf einem Rechner** (z.B. dein Heimserver oder ein Windows/Mac/Linux-PC)
   einrichten - der übernimmt die eigentliche Signierung mit deiner Apple-ID und muss
   ca. alle 7 Tage einmal erreichbar sein, damit die App sich automatisch "auffrischt"
   (das ist Apples Limit für kostenlose Signaturen, kein AltStore-Bug).
3. **iOS-Build erzeugen:**
   ```bash
   eas build --platform ios --profile ios-altstore
   ```
   Das baut auf Expos macOS-Cloud-Servern (du brauchst also keinen eigenen Mac). Für den
   allerersten iOS-Build fragt `eas build` nach Apple-ID-Zugangsdaten, um ein Provisioning
   Profile zu erzeugen - eine kostenlose Apple-ID reicht für diesen Schritt.
4. Die fertige `.ipa`-Datei über AltStore PAL auf dem Gerät installieren (per AirDrop,
   Dateien-App oder direktem Download-Link zur `.ipa`).

**Ehrlicher Hinweis:** Der AltStore-/DMA-Bereich ändert sich immer wieder (Apple und die
EU verhandeln laufend nach), und ich kann den Ablauf hier nicht selbst End-to-End testen
(kein iPhone, kein Mac in dieser Umgebung). Prüf vor dem Loslegen kurz die aktuelle
Anleitung auf altstore.io, falls sich Details geändert haben.

Falls dir das zu wackelig ist: die Alternative mit **Apple Developer Account (99€/Jahr)**
+ `eas build --platform ios --profile production` + `eas submit` läuft stabiler übers
ganze Jahr (kein wöchentliches Auffrischen), kostet aber eben Geld.

Die Platzhalter-Icons/Splash in `assets/` sind einfache generierte Grafiken - für den
"echten" Gebrauch kannst du sie so lassen oder durch eigenes Design ersetzen.

## Deployment auf deinem Heimserver

1. `.env` im Projekt-Root anlegen mit `JWT_SECRET` (langer Zufallsstring), `PUBLIC_API_URL`
   (z.B. `https://homework-api.deinedomain.de`) und `PUBLIC_WEB_URL` (z.B.
   `https://homework.deinedomain.de`) - letzteres bestimmt, welche Domain in
   Einladungslinks/Sharelinks landet (`.../login?invite=...`, `.../class/<id>`) statt
   des Platzhalters `localhost:3000`.
2. Ollama muss auf dem Host laufen (`ollama serve`, Modell z.B. mit `ollama pull llama3.1`
   vorher ziehen) - der Container erreicht es über `host.docker.internal`.
3. `docker compose up -d --build`
4. Reverse Proxy vor `api` (Port 8000) und `web` (Port 3000) einrichten - fertige, minimale
   Caddy-Konfiguration liegt als `Caddyfile` im Projekt-Root (Domains darin anpassen, dann
   `sudo caddy run --config Caddyfile`). Caddy holt sich das Let's-Encrypt-Zertifikat
   automatisch, sobald die Domain per DNS auf den Server zeigt.

## Kernkonzepte

- **Klassen statt Einzelnutzer:** Der erste Nutzer ohne Einladungscode gründet automatisch
  eine neue Klasse und wird Admin. Weitere Nutzer treten per Einladungscode/Sharelink bei.
- **Admin-Kalender statt WebUntis-Sync:** Da die WebUntis-API der Schule gesperrt ist, pflegt
  der Klassen-Admin den Stundenplan/Kalender manuell über `/calendar`.
- **Erledigt ist persönlich:** `POST/DELETE /homework/{id}/complete` betrifft nur den
  eingeloggten Nutzer, nie die ganze Klasse.
- **Öffentliche Ansicht:** `GET /public/classes/{id}/homework` erfordert keinen Login - die
  Web-UI zeigt darüber allen (auch ohne Konto) an, was gerade ansteht.
- **Sanfte Reminder:** Der Scheduler (`app/services/scheduler.py`) sendet pro fälliger,
  nicht erledigter Hausaufgabe genau eine ruhige Push-Nachricht (keine Eskalation, kein Alarm)
  sowie täglich einen von Ollama zusammengefassten Abend-Digest.

## Hausaufgaben einsprechen (Spracherkennung)

Statt Formular ausfüllen: Mikrofon-Knopf im Dashboard drücken, Hausaufgabe diktieren ("Mathe,
Seite 42 Aufgabe 3, bis morgen") - das Audio wird an einen lokalen
[Wyoming](https://github.com/rhasspy/wyoming)-ASR-Dienst (z.B. `wyoming-whisper`) zur
Transkription geschickt, danach an Ollama zur Strukturierung (Fach/Titel/Deadline).

- **Setup:** `HOMEWORK_WHISPER_HOST`/`HOMEWORK_WHISPER_PORT` auf deinen Wyoming-ASR-Dienst
  zeigen lassen (im Docker-Setup per `.env`: `WHISPER_PORT=10300` falls abweichend vom
  Standard). `HOMEWORK_OLLAMA_MODEL` kannst du auf ein Modell setzen, das du bereits lokal
  laufen hast (z.B. `hermes3:8b`) - es wird für Zusammenfassung und Chat verwendet.
- **Geschwindigkeit:** Die Strukturierung des Transkripts (Fach/Titel/Deadline erkennen) ist
  eine kleine, einfache Aufgabe - dafür muss es nicht dasselbe große Modell wie für Chat/
  Zusammenfassung sein. Per `.env`: `VOICE_MODEL=llama3.2:1b` (Docker-Setup) bzw.
  `HOMEWORK_OLLAMA_VOICE_MODEL=llama3.2:1b` (lokal) ein kleineres, schnelleres Modell
  speziell dafür setzen - vorher einmal mit `ollama pull llama3.2:1b` (oder z.B.
  `qwen2.5:1.5b`) ziehen. Ohne diese Variable läuft weiterhin `HOMEWORK_OLLAMA_MODEL`.
  Die Anfrage selbst ist zusätzlich auf JSON-Antwort und max. 250 Tokens begrenzt, damit das
  Modell nicht unnötig weiterredet. Für spürbar schnellere Transkription selbst (statt nur
  der Strukturierung danach) hilft zusätzlich ein kleineres Whisper-Modell in deinem
  `wyoming-whisper`-Dienst (z.B. `tiny`/`base` statt `medium`/`large`) - das stellst du direkt
  in dessen eigener Konfiguration um, nicht hier.
- **Account-bezogen, nicht Tab-bezogen:** Der Vorschlag wird serverseitig pro Nutzer
  zwischengespeichert (`pending_homework_suggestions`), nicht nur im Browser. Schließt du die
  Seite direkt nach dem Einsprechen und öffnest sie Stunden später auf einem anderen Gerät,
  taucht derselbe Vorschlag als Bestätigungs-Popup wieder auf - bis du ihn übernimmst oder
  verwirfst.
- Erstellt **nichts automatisch** - wie bei der Foto-Erkennung bestätigst/bearbeitest du den
  Vorschlag, bevor er als echte Hausaufgabe gespeichert wird.
- Ohne erreichbaren Whisper- oder Ollama-Dienst liefert `/voice/capture` einen sauberen `503`
  statt eines Absturzes.

## Weitere Endpoints

- `GET /classes/me/invite` - Sharelink + Invite-Code für Mitschüler
- `GET /planning?days_ahead=7` - freie Zeitfenster zwischen Kalendereinträgen +
  Vorschlag, wann welche offene Hausaufgabe reinpasst (früheste Deadline zuerst)
- `POST /homework/extract-from-image` - Foto der Tafel/eines Aufgabenblatts an ein
  Ollama-Vision-Modell (Standard: `llava`, per `HOMEWORK_OLLAMA_VISION_MODEL` änderbar)
  schicken; liefert einen Vorschlag (Fach/Titel/Deadline), erstellt aber nichts automatisch
- `POST /calendar/extract-from-image` (nur Admin) - gleiche Idee für den Stundenplan; in der
  Web-UI unter Einstellungen → Stundenplan/Kalender als Foto-Upload mit editierbarer Vorschau
  (Fach/Wochentag/Zeit pro erkannter Stunde, vor dem Anlegen noch korrigierbar)
- `POST /homework/{id}/postpone-to-next-lesson` (nur Admin) - verschiebt die Deadline auf die
  nächste wiederkehrende Stunde dieses Fachs laut Stundenplan (z.B. wenn eine Stunde ausfällt);
  `422` falls für das Fach kein wiederkehrender Stundenplan-Eintrag hinterlegt ist
- `POST /voice/capture` - Audio-Datei einer eingesprochenen Hausaufgabe; liefert einen
  Vorschlag und legt ihn pro Nutzer als "offen" ab
- `GET /voice/pending-suggestion` - der aktuell offene Sprach-Vorschlag des Nutzers (falls
  vorhanden), fürs Bestätigungs-Popup beim nächsten Besuch
- `POST /voice/pending-suggestion/apply` / `DELETE /voice/pending-suggestion` - Vorschlag
  übernehmen (legt die Hausaufgabe an) bzw. verwerfen
- `POST /agent/chat` - freie Frage an den Agenten, mit Kontext aus offenen Hausaufgaben +
  Kalender (z.B. "Wie viel Zeit brauche ich noch für Mathe?")
- `GET /agent/workload` - Ampel (grün/gelb/rot), wie viel Zeit die fälligen Hausaufgaben
  der nächsten 48h im Verhältnis zur tatsächlich freien Zeit brauchen
- `PUT /auth/me/tone` - Tonfall des Agenten umstellen (`"locker"` oder `"streng"`)

Alle KI-Endpoints (`summary`, `chat`, `workload`, Sprach-/Foto-Erkennung) sind so gebaut,
dass ein nicht erreichbares Ollama nie zu einem Server-Absturz führt: `summary`/`chat` fallen
auf eine reine Auflistung zurück, die anderen liefern einen sauberen `503`.

## Der versteckte Superadmin-Zugang

Du wolltest einen Account, der klassenübergreifend alles sehen/löschen kann, aber komplett
unsichtbar für normale Nutzer ist - technisch so gelöst:

- Es ist **kein** normaler `User` - eine eigene Tabelle (`super_admins`), die nirgendwo in
  Klassen, Mitgliederlisten oder API-Antworten auftaucht.
- **Kein Passwort.** Authentifizierung über ein Ed25519-Schlüsselpaar (asymmetrische
  Kryptografie, das Prinzip hinter Client-Zertifikaten): Server schickt eine zufällige,
  einmal gültige Zahl ("Challenge"), du signierst sie mit deinem privaten Schlüssel, der
  nie den eigenen Rechner verlässt. Passt die Signatur zum hinterlegten öffentlichen
  Schlüssel, gibt's ein 15 Minuten gültiges Token mit eigenem Signier-Geheimnis (komplett
  getrennt vom normalen Nutzer-Login - ein geleaktes Nutzer-Secret hilft dort nichts).
- Die Routen liegen alle unter `/__sys/...` und sind mit `include_in_schema=False` aus der
  Swagger-Doku (`/docs`) ausgeblendet. Jede Ablehnung (falsches Signatur, falscher Token,
  unbekannte Route) antwortet mit `404`, nicht `401`/`403` - ein Angreifer bekommt nicht
  mal bestätigt, dass es diesen Bereich überhaupt gibt.
- Jede Challenge ist genau einmal verwendbar (Replay-Schutz), unabhängig vom Ergebnis.

**Einmalige Einrichtung**, direkt auf deinem Server, niemals über HTTP:

```bash
cd apps/api
python -m scripts.create_superadmin "DeinName"
```

Das legt den öffentlichen Schlüssel in der Datenbank ab und schreibt den privaten Schlüssel
in eine lokale `.pem`-Datei. **Diese Datei sofort sicher verwahren** (Passwortmanager, offline
USB-Stick) **und danach vom Server löschen** - wer sie hat, hat vollen Zugriff auf alles.

**Benutzung** (von deinem eigenen Rechner aus, mit der verwahrten `.pem`-Datei):

```bash
python -m scripts.superadmin_login ./superadmin_DeinName_private.pem https://homework-api.deinedomain.de
```

Gibt dir ein Token und eine Systemübersicht (Anzahl Klassen/Nutzer/Hausaufgaben). Mit dem
Token dann z.B. `curl -H "Authorization: Bearer <token>" .../__sys/users` für die volle
Nutzerliste über alle Klassen hinweg, oder `.../__sys/classes`, `.../__sys/homework` -
jeweils mit `DELETE` auf die `{id}`-Route zum Entfernen.

## Noch offen / nächste Schritte

- App-Icons/Splash-Assets sind aktuell Platzhalter - für den Store durch echtes Design ersetzen
- Web-Push für Desktop-Browser (aktuell nur native Mobile-Push via Expo)
- App Store/Play Store Signierung & Veröffentlichung erfordert deinen eigenen
  Apple- und Google-Play-Developer-Account (`eas build`/`eas submit`)
- Nicht umgesetzt (bewusst außerhalb des Kern-KI-Funktionsumfangs): Gamification/Streaks,
  Mitschüler-Vergleich, Siri-Shortcuts, Web-Push für Desktop

## Was durchgetestet wurde

Vor dem letzten Commit lief das komplette System einmal echt durch (nicht nur die
automatisierten Tests): Backend live gestartet und per curl durch jeden Flow geklickt
(Registrierung, Klassenbeitritt, Hausaufgaben, Kalender, Planung, Workload, Chat,
Flashcards, Foto-Erkennung, kompletter Superadmin-Login inkl. Replay-Schutz-Check),
die Next.js-Web-UI mit einem echten Browser (Playwright) durch Registrierung → Dashboard
→ Chat → Karteikarten → Einstellungen → öffentliche Ansicht geklickt, und die Mobile-App
testweise im Browser (`expo start --web`) ebenso durchgeklickt - dabei kam ein echter Bug
zum Vorschein und wurde gefixt (`expo-secure-store` hat kein Web-Backend und crashte die
App im Browser; `lib/storage.ts` fällt jetzt auf `localStorage` zurück, wenn `Platform.OS
=== "web"` - für den eigentlichen Einsatz auf iOS/Android ändert das nichts, dort lief es
schon vorher über den nativen sicheren Speicher). 20 Backend-Pytests, TypeScript-Checks
für Web und Mobile sowie der Next.js-Produktionsbuild laufen alle grün.
