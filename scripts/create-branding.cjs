const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const directory = path.join(__dirname, '..', 'resources', 'branding');
  fs.mkdirSync(directory, { recursive: true });
  const strings = Array.from({ length: 17 }, (_, i) => {
    const y = 845 + i * 17;
    return `<path d="M-100 ${y} C440 ${y - 220},650 ${y + 240},1280 ${y - 65} S2100 ${y - 120},2660 ${y + 45}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1280" viewBox="0 0 2560 1280">
    <rect width="2560" height="1280" fill="#111111"/>
    <g fill="none" stroke="#292929" stroke-width="1.3" opacity=".55">${strings}</g>
    <g transform="translate(1152 244)"><path d="M40 141h19l23-68 46 112 46-112 23 68h19" fill="none" stroke="#d4d4d4" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/></g>
    <text x="1280" y="623" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="108" font-weight="600" letter-spacing="-4" fill="#e8e8e8">MultiMind</text>
    <text x="1280" y="702" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="29" letter-spacing="3" fill="#969696">YOUR IDEAS. YOUR MODELS. YOUR MACHINE.</text>
    <text x="1280" y="1150" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="22" letter-spacing="5" fill="#696969">LOCAL AI WORKSPACE</text>
  </svg>`;
  fs.writeFileSync(path.join(directory, 'multimind-banner.svg'), svg);
  await sharp(Buffer.from(svg)).png().toFile(path.join(directory, 'multimind-banner.png'));
  await sharp(Buffer.from(svg)).resize(1280, 640).png().toFile(path.join(directory, 'multimind-github.png'));
  const icon = fs.readFileSync(path.join(__dirname, '..', 'resources', 'multimind-logo.svg'), 'utf8');
  await sharp(Buffer.from(icon)).resize(1024,1024).png().toFile(path.join(directory, 'multimind-icon.png'));
  console.log('Created banner 2560x1280, GitHub image 1280x640, transparent icon 1024x1024');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
