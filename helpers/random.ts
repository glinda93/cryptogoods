export const randomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const pickRandomly = <T>(items: T[]): T => {
  return items[Math.floor(Math.random() * items.length)];
};

export const pickByRarity = <T extends { rarity: number }>(items: T[]): T => {
  const totalRarity = items.reduce((total, item) => (total += item.rarity), 0);
  const rnd = Math.random() * totalRarity;
  let accumulator = 0;
  for (const item of items) {
    accumulator += item.rarity;
    if (rnd < accumulator) {
      return item;
    }
  }
  /**
   * Does not reach here
   */
  throw new Error();
};
