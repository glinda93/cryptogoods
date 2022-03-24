import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { CryptoGoodsMetadata } from "../../../types/CryptoGoodsAttribute";
import text2png from "text2png";

dotenv.config();

const ATTRIBUTE_FILE_PATH = path.join(
  __dirname,
  "../attributes/output/metadata.json"
);

const OUTPUT_DIR = path.join(__dirname, "output");

function readAttributes() {
  if (!fs.existsSync(ATTRIBUTE_FILE_PATH)) {
    throw new Error(`Metadata not found in ${ATTRIBUTE_FILE_PATH}`);
  }
  const attributes = JSON.parse(
    fs.readFileSync(ATTRIBUTE_FILE_PATH).toString()
  );
  return attributes as CryptoGoodsMetadata[];
}

function generateImage(id: number, attribute: CryptoGoodsMetadata) {
  const imagePath = path.join(OUTPUT_DIR, `${id}.png`);
  const text = [
    attribute.name,
    `Size: ${attribute.size}`,
    `Gender: ${attribute.gender}`,
    `Color: ${attribute.color}`,
    `Level: ${attribute.level}`,
  ].join("\n");
  fs.writeFileSync(
    imagePath,
    text2png(text, {
      color: attribute.color,
      lineSpacing: 10,
      padding: 20,
    })
  );
}

(async function () {
  const attributes = readAttributes();
  let count = 0;
  for (const attribute of attributes) {
    await generateImage(count, attribute);
    count += 1;
    if (count && count % 100 === 0) {
      console.log(`Generated ${count} images`);
    }
  }
  console.info(`Generated ${count} images`);
})();
