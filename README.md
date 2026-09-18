# Hausiplanner

Hausaufgaben-Planer mit Klassen-Sharing, KI-Zusammenfassung (Ollama) und sanften Push-Erinnerungen.
Self-hosted auf deinem eigenen Server, erreichbar über deine Domain.

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

### Store-Build (App Store / Play Store)

Dafür brauchst du deinen eigenen Apple-Developer-Account (99$/Jahr) und einen
Google-Play-Console-Account (einmalig 25$) - das kann ich nicht für dich einrichten.
Sobald du die hast:

```bash
npm install -g eas-cli
eas login
eas init                 # verknüpft das Projekt mit deinem Expo-Account, schreibt projectId in app.json
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

`eas.json` (Build-Profile: development/preview/production) liegt schon bereit.
Die Platzhalter-Icons/Splash in `assets/` sind einfache generierte Grafiken -
für den Store solltest du die durch echtes Design ersetzen.

## Deployment auf deinem Heimserver

1. `.env` im Projekt-Root anlegen mit `JWT_SECRET` (langer Zufallsstring) und `PUBLIC_API_URL`
   (z.B. `https://homework-api.deinedomain.de`).
2. Ollama muss auf dem Host laufen (`ollama serve`, Modell z.B. mit `ollama pull llama3.1`
   vorher ziehen) - der Container erreicht es über `host.docker.internal`.
3. `docker compose up -d --build`
4. Reverse Proxy (z.B. Caddy oder Traefik) vor `api` (Port 8000) und `web` (Port 3000) mit
   Let's Encrypt-Zertifikat für deine Domain(s) einrichten.

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

## Weitere Endpoints

- `GET /classes/me/invite` - Sharelink + Invite-Code für Mitschüler
- `GET /planning?days_ahead=7` - freie Zeitfenster zwischen Kalendereinträgen +
  Vorschlag, wann welche offene Hausaufgabe reinpasst (früheste Deadline zuerst)
- `POST /homework/extract-from-image` - Foto der Tafel/eines Aufgabenblatts an ein
  Ollama-Vision-Modell (Standard: `llava`, per `HOMEWORK_OLLAMA_VISION_MODEL` änderbar)
  schicken; liefert einen Vorschlag (Fach/Titel/Deadline), erstellt aber nichts automatisch
- `POST /calendar/extract-from-image` (nur Admin) - gleiche Idee für den Stundenplan

## Noch offen / nächste Schritte

- App-Icons/Splash-Assets sind aktuell Platzhalter - für den Store durch echtes Design ersetzen
- Web-Push für Desktop-Browser (aktuell nur native Mobile-Push via Expo)
- App Store/Play Store Signierung & Veröffentlichung erfordert deinen eigenen
  Apple- und Google-Play-Developer-Account (`eas build`/`eas submit`)
