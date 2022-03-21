import { CryptoGoodsAttribute } from "../../../types/CryptoGoodsAttribute";

export const randomPick = <T>(items: T[]): T => {
  return items[Math.floor(Math.random() * items.length)];
};

export const rarityPick = (
  items: CryptoGoodsAttribute[]
): CryptoGoodsAttribute => {};
