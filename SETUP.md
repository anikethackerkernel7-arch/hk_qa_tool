# Argos Training — Setup Guide

A single-page transcription training tool for new hires. Bundled audio, saves to Google Sheets, no backend required.

---

## What's in this folder

```
training-tool/
├── index.html          ← The tool (open this in a browser)
├── audio/              ← Training clips
│   ├── clip_01.mp4     ← Your sample (2nd_Audio)
│   ├── clip_02.wav     ← Your sample (Clear_Intelligible)
│   └── clip_03.m4a     ← Your sample (Gandhi_Nagar)
├── apps-script.gs      ← Server code for Google Sheets
└── SETUP.md            ← This file
```

---

## Step 1 — Add more audio clips (to reach 8–10)

Drop your audio files into the `audio/` folder. Then open `index.html` and find the `AUDIO_QUEUE` array near the top of the `<script>` block:

```js
const AUDIO_QUEUE = [
  { id: "clip_01", file: "audio/clip_01.mp4", workitem: "trn-001-a4f2", locale: "en_US" },
  { id: "clip_02", file: "audio/clip_02.wav", workitem: "trn-002-b8e1", locale: "en_US" },
  { id: "clip_03", file: "audio/clip_03.m4a", workitem: "trn-003-c9d3", locale: "en_IN" },
  // Add clip_04 through clip_10 here:
  // { id: "clip_04", file: "audio/clip_04.mp3", workitem: "trn-004-xxxx", locale: "en_US" },
];
```

Supported formats: `.mp3`, `.wav`, `.m4a`, `.mp4`, `.ogg`.

---

## Step 2 — Set up Google Sheets

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank sheet. Name it anything (e.g., "Argos Training Submissions").
2. Click **Extensions → Apps Script**. A new tab opens.
3. Delete the default `Code.gs` content.
4. Copy the entire contents of `apps-script.gs` and paste it in.
5. Click the **Save** icon (💾).
6. Click **Deploy → New deployment**.
7. Click the ⚙️ gear next to "Select type" → choose **Web app**.
8. Fill in:
   - **Description:** `Argos Training receiver`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
9. Click **Deploy**. Authorize when prompted (Google will warn "unverified" — click Advanced → Go to project → Allow).
10. **Copy the Web app URL** (looks like `https://script.google.com/macros/s/AKfy.../exec`).

---

## Step 3 — Wire the URL into the tool

Open `index.html`. Near the top of the `<script>` block, find:

```js
const SHEETS_ENDPOINT = "PASTE_YOUR_APPS_SCRIPT_URL_HERE";
```

Replace the placeholder with the URL you copied. Save the file.

---

## Step 4 — Run the tool

### Option A — Open locally (simplest)
Double-click `index.html`. It opens in your default browser. Works fully.

### Option B — Host it (better for multiple trainees)
Upload the entire `training-tool/` folder to any static host:
- **GitHub Pages** (free)
- **Netlify** drag-and-drop (free)
- **Internal web server**

Everyone opens the same URL, submits with their email — all submissions land in one Sheet.

---

## What gets logged per submission

One row per clip, with columns:

| Timestamp | Email | Clip ID | Workitem | Locale | File | Spoken | Written | Speaker Count | S1 Gender | S1 Nativity | ... | Play Count | Time Spent (sec) | Skipped |

You can filter the sheet by email to review any trainee's session.

---

## Common customizations

**Change speaker nativity options** — edit the `NATIVITY_OPTIONS` array in `index.html`.

**Change the header colors** — edit the `--primary` variable in the CSS `:root` block.

**Change the tool name** — search `Argos Training` in `index.html` and replace.

**Remove the skip button** — delete the `<button class="btn btn-secondary" onclick="skipClip()">` line.

---

## Troubleshooting

**Submissions aren't reaching the Sheet.**
Open browser DevTools (F12) → Console. If you see "Sheets endpoint not configured", you missed Step 3. If you see network errors, re-check your deployment is set to "Anyone" access.

**Audio doesn't play.**
Confirm the file path in `AUDIO_QUEUE` matches the actual filename in `/audio` (case-sensitive on some hosts).

**"Skipped" rows are showing up unexpectedly.**
The skip button intentionally logs a row so trainers can see when a trainee bailed. Remove the button (see above) if you don't want this.
