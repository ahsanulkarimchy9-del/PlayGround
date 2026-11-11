import { B, BLOCKS } from './blocks.js'
import { getTextures } from './textures.js'

const blockByName = {}
for (const b of BLOCKS) if (b && b.drop) blockByName[b.drop] = b.id

export const ITEMS = {
  hellstone: { name: 'Hellstone', icon: '▰', color: '#e06137', type: 'material', desc: 'Molten ore from the first layer. Still warm.' },
  obsidian: { name: 'Obsidian', icon: '◆', color: '#8d6de0', type: 'material', desc: 'Glass-hard volcanic rock.' },
  stone: { name: 'Stone', icon: '▩', color: '#8a8078', type: 'material', desc: 'The bones of the world.' },
  dirt: { name: 'Dirt', icon: '▦', color: '#7c5c40', type: 'material', desc: 'Humble, but it remembers roots.' },
  wood: { name: 'Wood', icon: '▥', color: '#a87c4d', type: 'material', desc: 'Cut from the surface. A rare luxury down here.' },
  gel: { name: 'Gel', icon: '●', color: '#a7ffcf', type: 'material', desc: 'Slime residue. Burns bright.' },
  demonite: { name: 'Demonite Ore', icon: '✦', color: '#7d86e9', type: 'material', desc: 'Corrupt metal that whispers in your pack.' },
  crimtane: { name: 'Crimtane Ore', icon: '✧', color: '#df6161', type: 'material', desc: 'A metal that bleeds when struck.' },
  gold: { name: 'Gold Ore', icon: '◈', color: '#ffd471', type: 'material', desc: 'Soft, bright, and stubbornly useful.' },
  glowshroom: { name: 'Glowshroom', icon: '☂', color: '#5ff5df', type: 'material', desc: 'Bioluminescent fungus. Tastes like lightning.' },
  'crystal shard': { name: 'Crystal Shard', icon: '❖', color: '#c58bff', type: 'material', desc: 'A splinter of the cave\'s dream.' },
  honey: { name: 'Honey', icon: '◍', color: '#ffc34f', type: 'material', desc: 'The hive\'s golden blood.' },
  ash: { name: 'Ash', icon: '▪', color: '#a08f84', type: 'material', desc: 'Everything the fire left behind.' },
  ebonstone: { name: 'Ebonstone', icon: '◼', color: '#7d5cb8', type: 'material', desc: 'Corruption given mineral form.' },
  crimstone: { name: 'Crimstone', icon: '◾', color: '#c25c5c', type: 'material', desc: 'Crimson stone, veined like meat.' },
  hive: { name: 'Hive', icon: '⬡', color: '#d9a33c', type: 'material', desc: 'Waxy architecture of the Not the Bees.' },
  sand: { name: 'Sand', icon: '∴', color: '#d8c08e', type: 'material', desc: 'Beach glass waiting to happen.' },
  'life crystal': { name: 'Life Crystal', icon: '❤', color: '#ff6fbf', type: 'material', desc: 'Pulsing vitality. Increases maximum health by 20.' },
  silk: { name: 'Silk', icon: '≈', color: '#e8d9c4', type: 'material', desc: 'Loom-woven thread from hive fibre.' },
  bone: { name: 'Bone', icon: '☠', color: '#e9e0ca', type: 'material', desc: 'The catacombs are generous.' },
  'rainbow shard': { name: 'Rainbow Shard', icon: '✺', color: '#ff8fd5', type: 'material', desc: 'Celebration made solid.' },
  'ember crystal': { name: 'Ember Crystal', icon: '❂', color: '#ff9a3d', type: 'material', desc: 'A shard of the Underworld\'s heart.' },

  'Ember Blade': { name: 'Ember Blade', icon: '🗡', color: '#ff9c5e', type: 'weapon', desc: 'A wide arcing sword. Sets the air itself alight. 34 dmg.' },
  'Demon Bow': { name: 'Demon Bow', icon: '🏹', color: '#a7b5ff', type: 'weapon', desc: 'Fires demonite arrows that punch through flesh. 26 dmg.' },
  'Starfall Staff': { name: 'Starfall Staff', icon: '✩', color: '#d29bff', type: 'weapon', desc: 'Homing starlight. Costs 10 mana. 22 dmg.' },
  'Hellforged Edge': { name: 'Hellforged Edge', icon: '⚔', color: '#ffd08c', type: 'weapon', desc: 'Forged at the anvil. 58 dmg, wider arc.' },
  'Storm Bow': { name: 'Storm Bow', icon: '➶', color: '#8dfff0', type: 'weapon', desc: 'Crimtane arrows that split on impact. 41 dmg.' },
  'Nova Staff': { name: 'Nova Staff', icon: '✵', color: '#ffb8f5', type: 'weapon', desc: 'Collapsing starlight. 38 dmg, 14 mana.' },
  'Pickaxe': { name: 'Cinder Pickaxe', icon: '⛏', color: '#e8c69b', type: 'tool', desc: 'Mines every layer. Hold to carve the world.' },

  'Torch': { name: 'Torch', icon: '🕯', color: '#ffc36e', type: 'placeable', desc: 'A stubborn little sun. Place with F.', placeable: true },
  'Bed': { name: 'Bed', icon: '🛏', color: '#ff8e8e', type: 'placeable', desc: 'Anchors your respawn point. Place with F.', placeable: true },
  'Obsidian Brick': { name: 'Obsidian Brick', icon: '▦', color: '#8e77c7', type: 'placeable', desc: 'Build a fortress above the lava.', placeable: true },
  'Ash Brick': { name: 'Ash Brick', icon: '▤', color: '#a89282', type: 'placeable', desc: 'Compact ash. Build with F.', placeable: true },
  Planks: { name: 'Planks', icon: '▥', color: '#c39a68', type: 'placeable', desc: 'Warm wooden platform. Build with F.', placeable: true },

  'Work Bench': { name: 'Work Bench', icon: '⚒', color: '#d0a878', type: 'gear', desc: 'Base station tier I. Unlocks weapon and bed recipes.' },
  Loom: { name: 'Loom', icon: '🧵', color: '#e9d7b4', type: 'gear', desc: 'Base station. Unlocks silk and cloth goods.' },
  Sawmill: { name: 'Sawmill', icon: '🪚', color: '#c49a6a', type: 'gear', desc: 'Base station. Unlocks advanced wooden structures.' },
  Anvil: { name: 'Anvil', icon: '⚙', color: '#c3c8d8', type: 'gear', desc: 'Base station tier III. Unlocks the hellforged arsenal.' },
  'Hellfire Wings': { name: 'Hellfire Wings', icon: '🪽', color: '#ff8d57', type: 'gear', desc: 'Increases flight energy and ascent speed.' },

  'Healing Potion': { name: 'Healing Potion', icon: '🧪', color: '#ff6b8b', type: 'consumable', desc: 'Restore 45 health. Use from slot 7.' },
  'Mana Potion': { name: 'Mana Potion', icon: '⚗', color: '#6fe9ff', type: 'consumable', desc: 'Restore 60 mana. Use from slot 7.' },
  'Greater Healing Potion': { name: 'Greater Healing Potion', icon: '⚱', color: '#ff9ab4', type: 'consumable', desc: 'Restore 110 health. Use from slot 7.' },
  'Royal Jelly': { name: 'Royal Jelly', icon: '🍯', color: '#ffd76e', type: 'consumable', desc: 'Restore health and grant brief regeneration.' }
}

export function itemDef(name) { return ITEMS[name] || { name, icon: '◈', color: '#cfc4b4', type: 'material', desc: '' } }

let tex = null
export function itemIconHTML(name, size = 22) {
  const def = itemDef(name)
  const bid = blockByName[name]
  if (bid && BLOCKS[bid]) {
    if (!tex) tex = getTextures()
    const tile = BLOCKS[bid].top ?? BLOCKS[bid].tile
    return `<img src="${tex.iconForTile(tile)}" width="${size}" height="${size}" style="image-rendering:pixelated;filter:drop-shadow(0 2px 4px #000)" alt="">`
  }
  return `<span style="color:${def.color};font-size:${size}px;line-height:1;text-shadow:0 0 10px ${def.color}55">${def.icon}</span>`
}

export const RECIPES = [
  // weapons
  { id: 'hellforged', tab: 'weapons', item: 'Hellforged Edge', icon: '⚔', cost: { hellstone: 18, obsidian: 6, 'ember crystal': 2 }, station: ['anvil'], desc: 'Tier III melee. 58 damage, wide molten arc.' },
  { id: 'stormbow', tab: 'weapons', item: 'Storm Bow', icon: '➶', cost: { crimtane: 14, wood: 8, 'crystal shard': 4 }, station: ['workbench'], desc: 'Tier II ranged. Splitting crimtane arrows. 41 dmg.' },
  { id: 'novastaff', tab: 'weapons', item: 'Nova Staff', icon: '✵', cost: { demonite: 12, 'crystal shard': 6, glowshroom: 4 }, station: ['anvil'], desc: 'Tier III magic. Collapsing starlight. 38 dmg.' },
  { id: 'demonbow', tab: 'weapons', item: 'Demon Bow', icon: '🏹', cost: { demonite: 10, wood: 6 }, station: ['workbench'], desc: 'A reliable demonite bow. 26 dmg.' },
  { id: 'starfall', tab: 'weapons', item: 'Starfall Staff', icon: '✩', cost: { crimtane: 8, 'crystal shard': 3, glowshroom: 2 }, station: ['workbench'], desc: 'Homing starlight. 22 dmg. 10 mana.' },
  // gear
  { id: 'workbench', tab: 'gear', item: 'Work Bench', icon: '⚒', cost: { wood: 12 }, station: [], desc: 'Base station tier I. Unlocks the first crafting tier.', stationBuild: true },
  { id: 'loom', tab: 'gear', item: 'Loom', icon: '🧵', cost: { wood: 10, hive: 4 }, station: ['workbench'], desc: 'Base station. Weave silk, cloth, and banners.', stationBuild: true },
  { id: 'sawmill', tab: 'gear', item: 'Sawmill', icon: '🪚', cost: { wood: 14, gold: 4, hive: 3 }, station: ['workbench'], desc: 'Base station. Unlocks advanced wooden structures.', stationBuild: true },
  { id: 'anvil', tab: 'gear', item: 'Anvil', icon: '⚙', cost: { gold: 8, demonite: 6, obsidian: 8 }, station: ['workbench'], desc: 'Base station tier III. Forge the endgame arsenal.', stationBuild: true },
  { id: 'wings', tab: 'gear', item: 'Hellfire Wings', icon: '🪽', cost: { hellstone: 10, 'ember crystal': 3, 'life crystal': 1 }, station: ['anvil'], desc: 'Permanent upgrade: more flight energy and lift.', effect: 'wings' },
  // base
  { id: 'bed', tab: 'base', item: 'Bed', icon: '🛏', cost: { wood: 12, honey: 4, silk: 2 }, station: ['workbench'], desc: 'Place to anchor your respawn point. Consumed on use.' },
  { id: 'torch', tab: 'base', item: 'Torch', icon: '🕯', cost: { wood: 1, gel: 1 }, count: 6, station: [], desc: 'Craft 6. A portable sun for the deep dark.' },
  { id: 'obsidianbrick', tab: 'base', item: 'Obsidian Brick', icon: '▦', cost: { obsidian: 4 }, count: 12, station: ['workbench'], desc: 'Craft 12. Lava-proof construction.' },
  { id: 'ashbrick', tab: 'base', item: 'Ash Brick', icon: '▤', cost: { ash: 4 }, count: 12, station: [], desc: 'Craft 12. Cheap, grim, reliable.' },
  { id: 'planks', tab: 'base', item: 'Planks', icon: '▥', cost: { wood: 3 }, count: 12, station: [], desc: 'Craft 12. Warm wooden platforms.' },
  // consumables
  { id: 'healing', tab: 'consumables', item: 'Healing Potion', icon: '🧪', cost: { glowshroom: 2, honey: 1 }, station: [], desc: 'Restore 45 health.' },
  { id: 'greaterhealing', tab: 'consumables', item: 'Greater Healing Potion', icon: '⚱', cost: { glowshroom: 4, honey: 3, 'life crystal': 1 }, station: ['anvil'], desc: 'Restore 110 health.' },
  { id: 'mana', tab: 'consumables', item: 'Mana Potion', icon: '⚗', cost: { glowshroom: 2, 'crystal shard': 1 }, station: ['workbench'], desc: 'Restore 60 mana.' },
  { id: 'jelly', tab: 'consumables', item: 'Royal Jelly', icon: '🍯', cost: { honey: 4, hive: 2 }, station: ['loom'], desc: 'Restore 60 health and regenerate briefly.' }
]

export const START_INVENTORY = {
  hellstone: 26, obsidian: 20, stone: 24, dirt: 18, wood: 26, gel: 10,
  demonite: 12, crimtane: 12, gold: 8, glowshroom: 6, 'crystal shard': 5,
  honey: 6, ash: 14, ebonstone: 8, crimstone: 8, hive: 6, sand: 4, bone: 5,
  'ember crystal': 3, 'rainbow shard': 2,
  'Healing Potion': 2, 'Mana Potion': 2, Torch: 8, Bed: 1,
  'Obsidian Brick': 12
}

export const HOTBAR = [
  { slot: 'weapon', name: 'Ember Blade', key: '1' },
  { slot: 'weapon', name: 'Demon Bow', key: '2' },
  { slot: 'weapon', name: 'Starfall Staff', key: '3' },
  { slot: 'tool', name: 'Pickaxe', key: '4' },
  { slot: 'placeable', name: 'Torch', key: '5' },
  { slot: 'placeable', name: 'Obsidian Brick', key: '6' },
  { slot: 'placeable', name: 'Bed', key: '7' },
  { slot: 'consumable', name: 'Healing Potion', key: '8' }
]
