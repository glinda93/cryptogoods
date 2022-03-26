import * as IPFS from "ipfs-core";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { CryptoGoodsMetadata } from "../../../types/CryptoGoodsAttribute";
import _ from "lodash";

dotenv.config();

const ATTRIBUTES_FILE = path.join(
  __dirname,
  "../attributes/output/metadata.json"
);

const IMAGES_DIR = path.join(__dirname, "../images/output/");
const OUTPUT_DIR = path.join(__dirname, "output");

const IPFS_ROOT_PATH = `/CryptoGoods/${new Date().getTime()}`;
const IPFS_IMAGE_PATH = `${IPFS_ROOT_PATH}/images`;
const IPFS_METADATA_PATH = `${IPFS_ROOT_PATH}/metadata`;

if (!process.env.NFT_MARKET_CAP) {
  throw new Error("NFT_MARKET_CAP env variable is not set");
}

(async function () {
  const argv = await yargs(hideBin(process.argv)).argv;
  let s: number;
  let e: number;
  ({ s, e } = argv as any);
  s = Number(s);
  e = Number(e);
  if (!s || Number.isNaN(s)) {
    s = 0;
  }
  if (!e || Number.isNaN(e)) {
    e = parseInt(process.env.NFT_MARKET_CAP!);
  }

  if (e < s) {
    throw new Error(`End index ${e} must not be lower than start index ${s}`);
  }

  console.log(`Processing from ${s} to ${e}`);

  if (!fs.existsSync(ATTRIBUTES_FILE)) {
    throw new Error(
      "Attributes are not generated. Use 'npm run tool:attr' to generate"
    );
  }

  let attributes: CryptoGoodsMetadata[] = JSON.parse(
    fs.readFileSync(ATTRIBUTES_FILE).toString()
  );

  const totalCount = attributes?.length;

  if (!totalCount) {
    throw new Error("No metadata found");
  }

  attributes = attributes.slice(s, e);

  const ipfs = await IPFS.create();

  await ipfs.files.mkdir(IPFS_ROOT_PATH, {
    parents: true,
  });
  await ipfs.files.mkdir(IPFS_IMAGE_PATH);
  await ipfs.files.mkdir(IPFS_METADATA_PATH);

  let count = 0;
  for (const attribute of attributes) {
    const tokenId = s + count + 1;
    const imagePath = path.join(IMAGES_DIR, `${tokenId}.png`);
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image not found: ${imagePath}`);
    }
    const imageIPFSPath = `${IPFS_IMAGE_PATH}/${tokenId}.png`;
    const imageFile = await ipfs.add(
      {
        path: imageIPFSPath,
        content: fs.readFileSync(imagePath),
      },
      {
        wrapWithDirectory: true,
        pin: true,
      }
    );

    const imageUrl = `https://ipfs.io/ipfs/${imageFile.cid}${imageIPFSPath}`;

    const json = JSON.stringify({
      name: "CryptoGoods",
      image: imageUrl,
      attributes: [
        {
          trait_type: "Name",
          value: attribute.name,
        },
        {
          trait_type: "Color",
          value: attribute.color,
        },
        {
          trait_type: "Size",
          value: attribute.size,
        },
        {
          trait_type: "Gender",
          value: attribute.gender,
        },
        {
          trait_type: "Level",
          value: attribute.level,
        },
      ],
    });

    await ipfs.files.write(`${IPFS_METADATA_PATH}/${tokenId}.json`, json, {
      create: true,
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, `${tokenId}.json`), json);

    count++;
    if (count && count % 10 === 0) {
      console.log(`Processed ${count} attributes`);
    }
  }

  const stat = await ipfs.files.stat(IPFS_METADATA_PATH);
  const uris = _.range(0, count).map((_val, idx) => {
    const tokenId = s + idx + 1;
    return `https://ipfs.io/ipfs/${stat.cid}${IPFS_METADATA_PATH}/${tokenId}.json`;
  });

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `tokenURIs_${s}_${e}.txt`),
    uris.join("\n")
  );

  // eslint-disable-next-line no-process-exit
  process.exit(0);
})();
