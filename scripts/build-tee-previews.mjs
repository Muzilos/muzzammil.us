import fs from 'node:fs';
import path from 'node:path';

// Viewport crops preserve the original pixels and color; no generative edits or upscaling.
const works = [
  { id: 'covenant', title: 'Covenant', source: 'covenant.jpg', sourceSize: [1866, 2334], crop: [290, 250, 1320, 1790] },
  { id: 'snake', title: 'Snake', source: 'snake.jpg', sourceSize: [1086, 1448], crop: [92, 91, 908, 1225] },
  { id: 'adam', title: 'Adam enjoying his apple', source: 'adam-enjoying-his-apple-v2.jpg', sourceSize: [648, 864], crop: [39, 32, 565, 779] },
  { id: 'insanity', title: 'Insanity', source: 'insanity-color-graded-v3.jpg', sourceSize: [1116, 1280], crop: [10, 12, 1094, 1256] },
  { id: 'runnin', title: "Runnin'", source: 'Runnin_2025_8 x 6in_Oil on canvas board-EDIT.jpg', sourceSize: [1921, 2400], crop: [228, 200, 1480, 2000] },
  { id: 'two-trees', title: 'Two Trees', source: 'tree.jpg', sourceSize: [2200, 1623], crop: [16, 22, 2160, 1580] }
];
const out = 'static/merch/tees';
fs.mkdirSync(out, { recursive: true });
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
for (const work of works) {
  const [x, y, width, height] = work.crop;
  const [sourceWidth, sourceHeight] = work.sourceSize;
  const data = fs.readFileSync(path.join('paintings/imported', work.source)).toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}"><title>${escape(work.title)} — clean artwork crop</title><image width="${sourceWidth}" height="${sourceHeight}" href="data:image/jpeg;base64,${data}"/></svg>\n`;
  fs.writeFileSync(path.join(out, `${work.id}-crop.svg`), svg);
}
fs.writeFileSync('production/tees/crop-manifest.json', JSON.stringify({
  note: 'Concept artwork crops at native source resolution. SVG wrapping does not add resolution. Obtain high-resolution captures before production.',
  works: works.map(work => ({ ...work, preview: `/${out}/${work.id}-crop.svg`, ppiAt12InchesWide: Math.round(work.crop[2] / 12) }))
}, null, 2) + '\n');
console.log(`Built ${works.length} native-resolution artwork crops.`);
