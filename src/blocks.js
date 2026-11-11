// Shared voxel palette. IDs are stable and used by the mesher, worldgen, and UI.
export const B = {
  AIR: 0, ASH: 1, HELLSTONE: 2, OBSIDIAN: 3, STONE: 4, DIRT: 5, GRASS: 6,
  EBONSTONE: 7, CRIMSTONE: 8, FLESH: 9, MUD: 10, HIVE: 11, SAND: 12,
  WOOD: 13, PLANKS: 14, LEAVES: 15, GLOWSHROOM: 16, CRYSTAL: 17, LAVA: 18,
  WATER: 19, DEMONITE: 20, CRIMTANE: 21, GOLD: 22, LIFECRYSTAL: 23,
  HONEY: 24, RAINBOW: 25, ASHBRICK: 26, MOSSSTONE: 27, OBSIDIANBRICK: 28,
  HIVEWALL: 29, FLESHWALL: 30, EMBERCRYSTAL: 31, CLOUD: 32, CORRUPTGRASS: 33,
  CRIMSONGRASS: 34, BONE: 35, ASHBRICK2: 36
}

// tile indices map into the 8x8 procedural atlas
export const TILE = {
  ASH: 0, HELLSTONE: 1, OBSIDIAN: 2, STONE: 3, DIRT: 4, GRASS_TOP: 5, GRASS_SIDE: 6,
  EBONSTONE: 7, CRIMSTONE: 8, FLESH: 9, MUD: 10, HIVE: 11, SAND: 12, WOOD: 13,
  PLANKS: 14, LEAVES: 15, GLOWSHROOM: 16, CRYSTAL: 17, LAVA: 18, WATER: 19,
  DEMONITE: 20, CRIMTANE: 21, GOLD: 22, LIFECRYSTAL: 23, HONEY: 24, RAINBOW: 25,
  ASHBRICK: 26, MOSSSTONE: 27, OBSIDIANBRICK: 28, HIVEWALL: 29, FLESHWALL: 30,
  EMBERCRYSTAL: 31, CLOUD: 32, CORRUPTGRASS: 33, CRIMSONGRASS: 34, BONE: 35, ASHBRICK2: 36
}

const def = (id, name, o = {}) => ({
  id, name, solid: true, opaque: true, hardness: 0.45, light: 0, emissive: null,
  tint: 0xffffff, drop: name.toLowerCase(), tile: TILE.STONE, top: null, side: null, bottom: null,
  ...o
})

export const BLOCKS = []
BLOCKS[B.AIR] = def(B.AIR, 'Air', { solid: false, opaque: false, hardness: 0, tile: -1, drop: null })
BLOCKS[B.ASH] = def(B.ASH, 'Ash', { hardness: 0.28, tile: TILE.ASH, tint: 0xb8a79c })
BLOCKS[B.HELLSTONE] = def(B.HELLSTONE, 'Hellstone', { hardness: 0.95, tile: TILE.HELLSTONE, emissive: [0.055, 0.008, 0.001], tint: 0xffb08f })
BLOCKS[B.OBSIDIAN] = def(B.OBSIDIAN, 'Obsidian', { hardness: 1.25, tile: TILE.OBSIDIAN, tint: 0xbba9e6 })
BLOCKS[B.STONE] = def(B.STONE, 'Stone', { hardness: 0.55, tile: TILE.STONE, tint: 0xd7d1c8 })
BLOCKS[B.DIRT] = def(B.DIRT, 'Dirt', { hardness: 0.38, tile: TILE.DIRT, tint: 0xc9b398 })
BLOCKS[B.GRASS] = def(B.GRASS, 'Grass', { hardness: 0.38, tile: TILE.DIRT, top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, tint: 0xcfe0b8 })
BLOCKS[B.EBONSTONE] = def(B.EBONSTONE, 'Ebonstone', { hardness: 0.68, tile: TILE.EBONSTONE, tint: 0xcfb7f2 })
BLOCKS[B.CRIMSTONE] = def(B.CRIMSTONE, 'Crimstone', { hardness: 0.68, tile: TILE.CRIMSTONE, tint: 0xf0b4ad })
BLOCKS[B.FLESH] = def(B.FLESH, 'Flesh', { hardness: 0.5, tile: TILE.FLESH, tint: 0xf3b6a9 })
BLOCKS[B.MUD] = def(B.MUD, 'Jungle Mud', { hardness: 0.42, tile: TILE.MUD, tint: 0xc9c59c })
BLOCKS[B.HIVE] = def(B.HIVE, 'Hive', { hardness: 0.72, tile: TILE.HIVE, tint: 0xffd58a, emissive: [0.012, 0.008, 0.001] })
BLOCKS[B.SAND] = def(B.SAND, 'Sand', { hardness: 0.3, tile: TILE.SAND, tint: 0xf4e3c0 })
BLOCKS[B.WOOD] = def(B.WOOD, 'Wood', { hardness: 0.4, tile: TILE.WOOD, tint: 0xd5b190 })
BLOCKS[B.PLANKS] = def(B.PLANKS, 'Planks', { hardness: 0.4, tile: TILE.PLANKS, tint: 0xdcc2a0 })
BLOCKS[B.LEAVES] = def(B.LEAVES, 'Leaves', { hardness: 0.2, tile: TILE.LEAVES, tint: 0xbcdfae })
BLOCKS[B.GLOWSHROOM] = def(B.GLOWSHROOM, 'Glowing Mushroom', { hardness: 0.2, solid: false, opaque: false, tile: TILE.GLOWSHROOM, tint: 0xb8fff0, emissive: [0.06, 0.55, 0.68] })
BLOCKS[B.CRYSTAL] = def(B.CRYSTAL, 'Crystal Shard', { hardness: 0.55, opaque: false, tile: TILE.CRYSTAL, tint: 0xe3b8ff, emissive: [0.16, 0.03, 0.34] })
BLOCKS[B.LAVA] = def(B.LAVA, 'Lava', { solid: false, opaque: false, hardness: 99, tile: TILE.LAVA, drop: null, tint: 0xffb36a, emissive: [3.5, 0.55, 0.05] })
BLOCKS[B.WATER] = def(B.WATER, 'Water', { solid: false, opaque: false, hardness: 99, tile: TILE.WATER, drop: null, tint: 0x8ac6d8 })
BLOCKS[B.DEMONITE] = def(B.DEMONITE, 'Demonite Ore', { hardness: 1.1, tile: TILE.DEMONITE, tint: 0xa9b9ff, emissive: [0.02, 0.018, 0.09] })
BLOCKS[B.CRIMTANE] = def(B.CRIMTANE, 'Crimtane Ore', { hardness: 1.1, tile: TILE.CRIMTANE, tint: 0xffaaa4, emissive: [0.09, 0.01, 0.012] })
BLOCKS[B.GOLD] = def(B.GOLD, 'Gold Ore', { hardness: 0.9, tile: TILE.GOLD, tint: 0xffe4a1 })
BLOCKS[B.LIFECRYSTAL] = def(B.LIFECRYSTAL, 'Life Crystal', { hardness: 0.6, opaque: false, tile: TILE.LIFECRYSTAL, tint: 0xffb7d9, emissive: [0.3, 0.02, 0.12], drop: 'life crystal' })
BLOCKS[B.HONEY] = def(B.HONEY, 'Honey', { solid: false, opaque: false, hardness: 99, tile: TILE.HONEY, drop: null, tint: 0xffcf7e })
BLOCKS[B.RAINBOW] = def(B.RAINBOW, 'Celebration Stone', { hardness: 0.6, tile: TILE.RAINBOW, tint: 0xffffff, emissive: [0.05, 0.02, 0.05] })
BLOCKS[B.ASHBRICK] = def(B.ASHBRICK, 'Ash Brick', { hardness: 0.6, tile: TILE.ASHBRICK, tint: 0xcbb8a9 })
BLOCKS[B.MOSSSTONE] = def(B.MOSSSTONE, 'Moss Stone', { hardness: 0.55, tile: TILE.MOSSSTONE, tint: 0xc6d8c0 })
BLOCKS[B.OBSIDIANBRICK] = def(B.OBSIDIANBRICK, 'Obsidian Brick', { hardness: 1.35, tile: TILE.OBSIDIANBRICK, tint: 0xcabce8 })
BLOCKS[B.HIVEWALL] = def(B.HIVEWALL, 'Hive Wall', { hardness: 0.7, tile: TILE.HIVEWALL, tint: 0xe8c98e })
BLOCKS[B.FLESHWALL] = def(B.FLESHWALL, 'Flesh Wall', { hardness: 0.55, tile: TILE.FLESHWALL, tint: 0xe9a89c })
BLOCKS[B.EMBERCRYSTAL] = def(B.EMBERCRYSTAL, 'Ember Crystal', { hardness: 0.8, opaque: false, tile: TILE.EMBERCRYSTAL, tint: 0xffd1a1, emissive: [0.3, 0.05, 0.004] })
BLOCKS[B.CLOUD] = def(B.CLOUD, 'Cloud', { hardness: 0.1, opaque: false, solid: false, tile: TILE.CLOUD, tint: 0xf3eef7 })
BLOCKS[B.CORRUPTGRASS] = def(B.CORRUPTGRASS, 'Corrupt Grass', { hardness: 0.38, tile: TILE.DIRT, top: TILE.CORRUPTGRASS, side: TILE.GRASS_SIDE, tint: 0xd0bde9 })
BLOCKS[B.CRIMSONGRASS] = def(B.CRIMSONGRASS, 'Crimson Grass', { hardness: 0.38, tile: TILE.DIRT, top: TILE.CRIMSONGRASS, side: TILE.GRASS_SIDE, tint: 0xf1c1b4 })
BLOCKS[B.BONE] = def(B.BONE, 'Bone', { hardness: 0.5, tile: TILE.BONE, tint: 0xf1e7cd })
BLOCKS[B.ASHBRICK2] = def(B.ASHBRICK2, 'Cracked Ash Brick', { hardness: 0.55, tile: TILE.ASHBRICK2, tint: 0xc4b1a2 })

export const isSolid = id => BLOCKS[id]?.solid === true
export const isOpaque = id => BLOCKS[id]?.opaque === true
export const isLiquid = id => id === B.LAVA || id === B.WATER || id === B.HONEY
export const isEmissive = id => Array.isArray(BLOCKS[id]?.emissive)

export function tileFor(id, face) {
  const b = BLOCKS[id]
  if (!b || b.tile < 0) return 0
  if (face === 3 && b.top != null) return b.top
  if (face === 2 && b.bottom != null) return b.bottom
  if (b.side != null && face !== 3 && face !== 2) return b.side
  return b.tile
}
