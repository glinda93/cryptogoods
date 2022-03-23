import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { CryptoGoodsMetadata } from "../../types/CryptoGoodsAttribute";
import { pickByRarity } from "./utils/random";
import names from "./fixtures/name.json";
import sizes from "./fixtures/size.json";
import colors from "./fixtures/color.json";
import genders from "./fixtures/gender.json";
import levels from "./fixtures/level.json";
import { isEqual } from "lodash";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const OUTPUT_DIR = path.join(__dirname, "output");
const FILENAME = "metadata.json";
const OUTPUT_FILE = path.join(OUTPUT_DIR, FILENAME);

function alreadyGenerated() {
  return fs.existsSync(OUTPUT_FILE);
}

(async function () {
  const argv = await yargs(hideBin(process.argv)).argv;

  if (!Object.keys(argv).includes("forceClean") && alreadyGenerated()) {
    throw new Error(`File already exists: ${OUTPUT_FILE}`);
  }

  const capStr = (argv as any).cap || process.env.NFT_MARKET_CAP;
  const cap = Number(capStr);

  if (isNaN(cap)) {
    throw new Error(`Invalid value given for market cap: ${capStr}`);
  }

  const metadataArr: CryptoGoodsMetadata[] = [];

  for (const name of names) {
    for (const size of sizes) {
      for (const color of colors) {
        for (const gender of genders) {
          const level = pickByRarity(levels).value;
          const newMetadata: CryptoGoodsMetadata = {
            name: name.value,
            size: size.value,
            color: color.value,
            ldevc_mintable: false,
            gender: gender.value,
            level: level,
          };
          const duplicated = metadataArr.some((item) =>
            isEqual(newMetadata, item)
          );
          if (!duplicated) {
            metadataArr.push(newMetadata);
            if (metadataArr.length && metadataArr.length % 100 === 0) {
              console.log(`Generated ${metadataArr.length} metadata in memory`);
            }
            if (metadataArr.length >= cap) {
              fs.writeFileSync(OUTPUT_FILE, JSON.stringify(metadataArr));
              console.log(`Metadata has been written to ${OUTPUT_FILE}`);

              return;
            }
          }
        }
      }
    }
  }
})();
