// Cover Forge's hand-in program (Node 22, standard library only). The app itself is the static web app in
// app/ beside this file: plain HTML, CSS and ES modules a desktop browser loads offline, with no build step.
// This program copies app/ and screenshots/ into the output directory and writes dossier.json there with the
// vendored make.fun library, which is the summary the judge reads.
//
// Try the app first with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (the kit's reference/gate.json): only text_max_bytes shapes the dossier's
// bytes; the rest make this program refuse exactly what the scorer would refuse — more than 4 screenshots or
// one over 256 KiB, more than 993 entries or 48 MiB under app/, or an app path over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

console.log(`Cover Forge handed in: ${join(out, 'app')} + dossier.json`);
