# 3. Frontend-Technologie-Stack (React 19, Vite 8, Tailwind v4, Vitest)

* Status: accepted
* Datum: 2026-08-21

## Kontext und Problemstellung

Die Anwendung erfordert eine performante, visuell ansprechende ("Mario-Kart-Feel") und wissenschaftlich präzise Weboberfläche für Kinder sowie ein übersichtliches Dashboard für Betreuer.

## In Betracht gezogene Optionen

1. Plain HTML/JS Canvas App
2. Next.js App Router (SSR)
3. SPA mit React 19, Vite 8, Tailwind CSS v4 und Vitest

## Entscheidung

Wir entscheiden uns für **Option 3: React 19 + Vite 8 SPA + Vitest**.

### Key Drivers & Konventionen:
* **React 19 & Vite 8**: Snappy DX, schnelle HMR-Zyklen und schlankes Client-side Rendering für flüssige Animationen und Canvas-Renderings.
* **Tailwind CSS v4**: Deklaratives Styling für Benutzeroberfläche und Dashboard.
* **Vitest**: Extrem schnelle Ausführung von Unit- und Integrationstests (Pflicht für wissenschaftliche Logik).
* **Timing-Genauigkeit**: Reaktionszeiten (RTs) werden mit `performance.now()` gemessen. Visuelle Cues nutzen `requestAnimationFrame` für Frame-Präzision.

### Konsequenzen

* Schnelles Deployment via Firebase Hosting.
* Reproduzierbarkeit von Tests durch deterministische Seeds (Seeded RNG) in Vitest abgesichert.
