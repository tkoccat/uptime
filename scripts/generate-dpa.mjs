// DPA PDF üretici: lib/legal/dpa.json + lib/company.json -> public/legal/dpa.pdf
// Çalıştırma: npm run legal:dpa  (şirket bilgileri veya metin değişince tekrar çalıştırın)
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const company = JSON.parse(readFileSync("lib/company.json", "utf8"));
const dpa = JSON.parse(readFileSync("lib/legal/dpa.json", "utf8"));

// {{alan}} yer tutucularını şirket bilgileriyle doldurur
const fill = (text) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => company[key] ?? `{{${key}}}`);

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

const PAGE = { w: 595, h: 842 };
const MARGIN = 56;
const maxWidth = PAGE.w - MARGIN * 2;

let page = pdf.addPage([PAGE.w, PAGE.h]);
let y = PAGE.h - MARGIN;

function newPage() {
  page = pdf.addPage([PAGE.w, PAGE.h]);
  y = PAGE.h - MARGIN;
}

// Kelime bazlı satır kaydırma
function wrap(text, f, size) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function write(text, { f = font, size = 10.5, gap = 6, color = rgb(0.1, 0.1, 0.15) } = {}) {
  for (const line of wrap(text, f, size)) {
    if (y < MARGIN) newPage();
    page.drawText(line, { x: MARGIN, y, size, font: f, color });
    y -= size * 1.45;
  }
  y -= gap;
}

write("DRAFT - not yet reviewed by a solicitor. Replace all [bracketed] details before use.", {
  f: bold,
  size: 9,
  color: rgb(0.7, 0.4, 0),
});
write(dpa.title, { f: bold, size: 20, gap: 10 });
write(fill(dpa.intro));
for (const section of dpa.sections) {
  write(fill(section.heading), { f: bold, size: 12, gap: 3 });
  for (const p of section.paragraphs) write(fill(p));
}

mkdirSync("public/legal", { recursive: true });
writeFileSync("public/legal/dpa.pdf", await pdf.save());
console.log("public/legal/dpa.pdf oluşturuldu");
