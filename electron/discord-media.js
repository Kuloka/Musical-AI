const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

async function prepareMedia(input, directory) {
  if ((await fs.stat(input)).size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
  const source = await fs.readFile(input);
  const options = { animated: true, limitInputPixels: 100000000 };
  const metadata = await sharp(source, options).metadata();
  if (!['png', 'jpeg', 'webp', 'gif'].includes(metadata.format)) throw new Error('Choose PNG, JPG, WebP or GIF.');
  const width = metadata.width, height = metadata.pageHeight || metadata.height;
  const animated = (metadata.pages || 1) > 1;
  const resized = width > 1024 || height > 1024;
  const ratio = Math.min(1, 1024 / width, 1024 / height);
  let pipeline = sharp(source, options).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true });
  const output = await (animated ? pipeline.gif() : pipeline.png()).toBuffer();
  await fs.mkdir(directory, { recursive: true });
  const extension = animated ? 'gif' : 'png';
  await fs.writeFile(path.join(directory, `activity.${extension}`), output);
  const result = { width: Math.round(width * ratio), height: Math.round(height * ratio), originalWidth: width, originalHeight: height, animated, resized, small: Math.min(width, height) < 256, filename: `activity.${extension}`, preview: `data:image/${extension};base64,${output.toString('base64')}` };
  const { preview, ...stored } = result;
  await fs.writeFile(path.join(directory, 'metadata.json'), JSON.stringify(stored));
  return result;
}
async function readMedia(directory) {
  try {
    const metadata = JSON.parse(await fs.readFile(path.join(directory, 'metadata.json'), 'utf8'));
    if (!['activity.gif', 'activity.png'].includes(metadata.filename)) return null;
    const bytes = await fs.readFile(path.join(directory, metadata.filename));
    return { ...metadata, preview: `data:image/${metadata.animated ? 'gif' : 'png'};base64,${bytes.toString('base64')}` };
  } catch { return null; }
}
module.exports = { prepareMedia, readMedia };
