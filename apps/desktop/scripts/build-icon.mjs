import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(scriptDir, '..', 'build');
const source = path.join(buildDir, 'icon-source.png');

const buf = await pngToIco(source);
await fs.writeFile(path.join(buildDir, 'icon.ico'), buf);
console.log('كُتب build/icon.ico من', source);
