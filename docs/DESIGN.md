# Tropic Rush: game design

Working design for the game, from the planning sessions on 2026-10-29. Nothing here is built yet;
the code is still the "Tap Rush" placeholder demo.

Each point is marked:

- **Decided:** the owner chose it.
- **Proposed:** a default that hasn't been confirmed. Check with the owner before building on it.
- **Open:** still to decide.

Tropic Rush is an original game in the island-raid genre: base building on tiles, HQ-gated
upgrades, beach landings and a support gunboat are shared genre conventions. Boom Beach is a
reference for feel, not something to copy. Don't reuse its names, characters, unit roster, art,
or UI.

## Pitch

Crews of up to 5 friends share one tropical island and build it up together. They raid nearby
enemy islands together in real time. Each player steers one hero on the beach, Brawl Stars style,
and one player at a time can run back to the gunboat to fire its weapons from a targeting view.

## Out of scope for version 1

These were explicitly left out to keep the first version to a basic structure:

- Statues or idols, and other boost items.
- Prototype or "landmark" signature defenses.
- Respawning during a raid.
- A minimap.
- PvP. This one is a proposal, not decided.
- AI troop squads following heroes. Also a proposal, not decided.

## Raids (the core of the game)

Raids are what matter most. If a co-op raid is fun, everything else builds on it.

1. The crew picks an enemy island and lands together at its beach. **Decided**
2. Each player controls one hero. Left thumb moves, right thumb aims and shoots, and dealing damage
   charges a super ability. **Proposed**
3. **Gunboat.** **Decided:**
   - It pulls up next to the beach where the crew landed.
   - It has one seat, so only one player can use it at a time.
   - To use it, a player walks their hero back to the boat and boards. The view switches to a
     targeting camera where they can aim anywhere on the island and fire abilities. They step out to
     rejoin the fight.
4. Gunboat energy is shared by the crew and earned by destroying buildings. Each ability costs
   energy. **Proposed**
5. Starter abilities: Artillery (one heavy shot), Barrage (several shots over an area), and Heal
   (heals heroes in a circle). **Proposed**
6. Death is final for the raid: a hero who dies doesn't respawn and watches the rest. **Decided**
7. The raid is won by destroying the headquarters. It's lost when every hero is down or time runs
   out (about 5 minutes). Loot scales with how much was destroyed. **Proposed**

The core team decision is who goes back to the gunboat, and when. Every trip takes a hero out of
the fight and costs walking time. A solo player is always choosing between fighting and firing.

**Proposed** details:

- Defenses can't damage the gunboat in version 1.
- There's no cooldown on re-boarding for now; the no-respawn rule may be enough to stop players
  camping in the boat.

**Open:**

- Does a hero at zero health have a short "downed" state the Medic can revive from, or is death
  instant?
- Can two players pick the same hero in one raid? The proposal is one of each.

### Camera and screen

**Decided:**

- A MOBA-style camera: angled top-down (about 50°), following your hero, showing part of a much
  larger island. Third person was considered and rejected. Compared with it, the MOBA camera:
  - plays better with two thumbs
  - shows incoming mortar fire and teammates without a minimap
  - matches the gunboat's targeting view
  - leaves more of the phone's power for graphics, because the view distance is bounded
- Landscape. The code is still portrait (720x1280) and changes when the 3D build starts.
- No minimap.

**Proposed:**

- Dynamic zoom: a bit closer while running, wider in big fights, a quick close-up on supers, and a
  pinch to zoom within limits.
- Off-screen teammates and the gunboat are shown by small arrows at the screen edge. The gunboat's
  targeting view is the big-picture view.

## Heroes

Seven heroes. **Decided:** the roster and every look below. A crew of 5 picks from them.

| Hero      | Look (**Decided**)                                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rifleman  | Stocky man with a square jaw, blue safari suit (short-sleeve belted jacket with chest pockets, shorts, knee socks), blue pith helmet, wooden rifle                                              |
| Medic     | Girl, blonde high ponytail, no hat, round glasses, blue safari suit with long pants, boxy green med backpack with a white plus                                                                  |
| Tank      | A vehicle: chunky sand-colored tank with blue trim and an oversized barrel, driven by a girl in a blue sailor hat, a blue short-sleeve uniform shirt, a blue skirt, white socks and black boots |
| Heavy     | Huge black man, buzz cut, full neat beard, blue tank top, brown pants, ammo belt over the shoulder, minigun                                                                                     |
| Bazooka   | Lean girl, black bob under a backwards cap, aviator sunglasses, blue tank top, khaki pants tucked into boots, a classic olive bazooka tube                                                      |
| Grenadier | Neat and put together: trimmed beard, tidy tucked-in short-sleeve shirt, orange neckerchief, straw panama hat, grenades hanging from a belt at the waist                                        |
| Engineer  | Big bushy moustache, goggles on his forehead, short-sleeve tropical flower-print shirt, tool belt, red pipe wrench, folded turret on his backpack                                               |

References:

- [concept/cast-lineup.jpeg](concept/cast-lineup.jpeg): all 7 heroes together.
- [concept/tpose/](concept/tpose/): a front T-pose of each character and the tank, ready for
  image-to-3D.
- One image per held item, cut from `props-sheet-v2.jpeg`. Weapons and backpacks are modeled
  separately and attached to the hand or back:
  - `prop-rifle`
  - `prop-medic-backpack`
  - `prop-minigun`
  - `prop-bazooka`
  - `prop-grenade`
  - `prop-wrench`
  - `prop-engineer-backpack`
  - `prop-turret-deployed` (the Engineer's super)
- The Engineer's backpack is still the simple version; the owner wants a more detailed one.
- `props-sheet-v1.jpeg` is an earlier attempt with an RPG-style launcher and an odd wrench, kept
  for reference only.

Gameplay is a first pass that hasn't been reviewed with the owner yet. **Proposed:**

| Hero      | Health    | Speed   | Range          | Attack                                   | Super                                  | Job                                               |
| --------- | --------- | ------- | -------------- | ---------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| Rifleman  | Medium    | Fast    | Medium         | 3-shot burst                             | Sprint, taking less damage             | All-rounder; best at running back to the boat     |
| Heavy     | High      | Slow    | Short          | Minigun, more damage the longer it fires | Drops a sandbag wall that blocks shots | Soaks fire up front                               |
| Tank      | Very high | Slowest | Medium-long    | Cannon shell, splash, bonus vs buildings | Ram                                    | Breaks buildings; only the Engineer can repair it |
| Bazooka   | Low       | Medium  | Long           | One rocket, huge damage, slow reload     | Three-rocket volley                    | Kills key defenses from behind the Heavy          |
| Grenadier | Med-low   | Medium  | Medium, lobbed | Grenade that arcs over cover             | Smoke: defenses can't target inside it | Hits defenses behind walls; sets off beach mines  |
| Medic     | Med-low   | Medium  | Short          | Healing spray, light damage to buildings | Area heal over time                    | Keeps the crew alive (heals people, not the Tank) |
| Engineer  | Medium    | Medium  | Medium         | Rivet gun                                | Builds an auto-turret                  | Damage without standing in fire; repairs the Tank |

**Proposed:**

- Start with Rifleman, Heavy and Medic; unlock the others at a Barracks on the home island as the
  HQ levels up.
- Hero levels are personal to each player.
- As heroes level up, their outfits gain pieces, but silhouettes and headgear stay the same.

## Islands

**Decided:**

- At a given HQ level, every enemy island has the same required buildings, and they scale with the
  HQ level. What differs is the layout and the beach design. One "HQ level → buildings and max
  levels" table drives both enemy islands and the crew's own island.
- Islands are scaled in difficulty: some can be beaten by one player, while others need all 5 and
  real strategy.
- Islands are much larger than the camera view, but buildings within the base sit close together,
  a short walk apart.
- There's a moderate amount of palm clusters, bushes and boulders, which act as cover. Not dense
  forest, and not empty.
- Buildings are big relative to heroes.
- Every island starts from the crew island's shape: a rounded diamond with one landing beach on
  the south-west. The base sits on flat ground beyond the beach, with hills rising behind it.
  The crew lands on that beach, and the gunboat waits in its shallows.

Starting size ratios, in hero heights:

| Object          | Size                      |
| --------------- | ------------------------- |
| Gun turret      | 2.5×                      |
| Mortar, harpoon | 2×                        |
| Watchtower      | 5×                        |
| Headquarters    | about 8× tall and as wide |

**Proposed:**

- Each island shows 1–5 crew icons. Loot is split among the attackers, so bringing 5 players to an
  easy island isn't worth it.
- Beach types:
  - a wide sandy cove
  - cliffs with one narrow beach
  - a reef whose channels block boats
  - a mangrove maze
  - a black-sand volcano island
- Defeated islands come back later with a new layout and a higher level.
- Defenses for version 1:
  - an all-round gun turret
  - a mortar (splash damage, blind spot up close)
  - a harpoon launcher (slow, extra damage to Heavy and Tank)
  - a flamethrower tower (short range)
  - hidden beach mines
  - sandbag walls

## Home island and crew

### Crew island draft (2026-10-30)

**Decided:**

- Crew members build on their island together in real time.
- The island is 3D and tile-based, so buildings can be placed and moved around.
- The island follows [concept/crew-island-base.webp](concept/crew-island-base.webp), about twice as
  large, with **one** beach, on the bottom-left (south-west), shallowing out into the water.
- Buildings all stand on one flat level. Around it the landscape is organic and rises and falls.
- Grass fades smoothly into sand.
- This is also the shape every enemy island starts from.
- Progression: a new island starts with only its headquarters and some resources. Producers
  (mills and the like) make resources passively. At the start you can also build a gun turret and
  a mortar.
  - One of each producer.
  - Storages unlock at HQ 3: one per resource at HQ 3, two each at HQ 7, three each at HQ 20.
  - Storages upgrade to level 8 at most.
  - Every building's level is capped by the headquarters' level.

**Built:**

- **Island:** a wide, rounded diamond. The flat grass build plateau in the middle has an organic
  outline. Grass hills rise around it, tallest to the north and east, and drop as sandy cliffs
  into the sea. A long beach on the south-west slopes gently into shallow water. The water is
  animated, with a wider band of shallows off the beach.
- **Zones:** the plateau is split into 4 sections of about 270+ tiles each (2 m tiles), with
  wavy borders. Zone 1 is the Landing, by the beach; then the West, East and North fields. The
  next one shows an Unlock button. Locked zones show a striped haze.
- **Progression** (`src/game/logic/economy.ts`):
  - Resources are Gold, Timber, Stone and Scrap.
  - Producers: Gold mine, Lumber mill and Stone quarry from HQ 1, and the Scrap yard from HQ 2.
  - Storages: the Gold vault, Timber shed, Stone yard and Scrap bin.
  - Defenses start with one gun turret and one mortar. More of them, and the harpoon, flamethrower
    and watchtower, unlock at higher HQ levels.
  - The HQ goes up to level 20. A building's level cap is HQ level minus its unlock level plus 1,
    up to its maximum.
  - Resources build up over time, from the server's clock, up to what the HQ and storages hold.
  - Building and upgrading are instant and cost resources.
- **Sync:** each crew has its own server on Cloudflare. It checks every change, costs included,
  with the same rules as the phone, saves the island, and sends the whole island to every
  crewmate. A building someone is moving is locked to them, with a name tag.
- **Offline:** the island keeps working on the phone, and the server's copy wins on reconnect.

**Proposed** (defaults, not yet confirmed by the owner):

- Joining uses a nickname and a 6-character crew code, with no accounts or passwords. On iPhone,
  Safari and the Home Screen app keep separate storage, so they count as two players.
- Crewmates show only as name tags on the buildings they're moving, not as walking characters.
- Unlocking zones is free for now, in order. It could be tied to HQ level.
- The progression numbers (costs, production, capacity, which HQ level unlocks what) are a first
  draft, not balanced.
  - Starting stock: 600 gold, 600 timber, 300 stone, 100 scrap.
  - Producers make 900 per hour at level 1, and 30% more each level.
- Removing a building gives nothing back.
- Footprints in tiles:
  - headquarters 6×6
  - defenses 2×2
  - producers and the refinery 3×3
  - storages 3×2

**Not built yet:**

- the world map with other crews' islands
- leaving or switching crews
- build timers
- the refinery's processed materials

**Decided** (from the original brief):

- Up to 5 players per island.
- Tile-based building.
- Defenses, resources, processing, a headquarters, and ships.

**Proposed:**

- The home island is fully shared: one resource pool, and any member can build. The alternative
  is a personal plot for each player with a shared HQ.
- Resources: Gold, Timber, Stone and Scrap, each from its own producer, plus storehouses.
- A Refinery turns raw resources into planks, bricks and steel, which higher upgrades need.
- Other buildings:
  - a Harbor that upgrades the gunboat's energy and abilities
  - a Lookout Tower that sets how far you can see on the map
  - a Barracks for heroes
- Short build timers, since friends play together.
- An idea: AI raider fleets sometimes attack the home island, and whoever is online defends it
  together.

## UI and menus

**Decided:** the whole UI was redone (2026-10-30), taking direct inspiration from the owner's
mockups. The aim is to be better than them, not an exact copy:

- [concept/ui-hero-select.jpg](concept/ui-hero-select.jpg)
- [concept/ui-raid-hud.jpg](concept/ui-raid-hud.jpg)
- [concept/ui-raid-jungle.jpg](concept/ui-raid-jungle.jpg)
- [concept/ui-raid-beach.jpg](concept/ui-raid-beach.jpg)

The look:

- **Frames and panels:** chunky beveled steel frames, steel name plates over dark panels, and tan
  cards for stats.
- **Buttons:** glossy blue, steel, gold, green and red buttons that sink when pressed. Each has an
  icon and a word.
- **Text:** bold outlined lettering.
- **Currency:** pills with a big icon on the end.

**Built:**

- **Title:** the logo on rotating sun rays over the orbiting home island, a RAID button and a
  CREW ISLAND button.
- **Hero select:**
  - a roster of 3D-rendered portraits with gear-shaped level badges and medal locks
  - the hero on a stone-and-steel pedestal: drag to spin it, and it drops in when chosen
  - a stats card with HP, Attack, Speed and Range bars (a ghost bar previews the next level)
  - the super ability
  - a target-island picker
  - LEVEL UP (gold) or UNLOCK (medals), and RAID!
- **Raid HUD:**
  - a portrait card with health and super bars
  - a timer and destruction plate
  - pause, a live minimap, and energy and loot pills
  - a MOVE stick and a FIRE pad resting in the corners
  - Super and gunboat buttons
  - a gunboat ability tray
  - damage numbers over hits
- **Pause and results:** a pause menu (resume, sound, retreat). The results show a
  VICTORY/DEFEAT banner, stars that stamp in, stats, and loot counting up.
- **Crew island:** the same style, with:
  - resource pills that fill to capacity
  - building cards with 3D icons, costs, counts and HQ locks
  - an info panel with LEVEL UP
  - buildings shown as their 3D models in crew colors
- **Feel:** synthesized UI sounds, sparkles, and a wipe between screens.

**Proposed:**

- Players earn gold from raids: destruction × 2 × island level, plus 150 × level for a win.
- Medals come from wins: one per island level.
- Gold levels heroes up, from 1 to 10. Each level adds 8% health and damage.
- Medals unlock the heroes beyond the starting three:
  - Grenadier: 2
  - Bazooka: 3
  - Engineer: 4
  - Tank: 6
- Hero levels and both currencies are personal, not shared with the crew.
- Hero names on the cards:
  - Sgt. Steele (Rifleman)
  - Doc Penny (Medic)
  - Tilly & Tank (Tank)
  - Big Mo (Heavy)
  - Ace (Bazooka)
  - Mr. Pemberton (Grenadier)
  - Gus (Engineer)
- Stars: 1 for 50% destroyed, 1 for the HQ (the win), and 1 for 100%.

## World map

**Decided:** the crew's island sits in the middle, nearby islands are visible, and clouds cover
everything beyond. **Proposed:** the Lookout Tower's level sets how far the clouds are pushed back,
and tapping an island shows its rating, beaches and loot.

## Art direction

**Decided** (refined over many image rounds):

- **Rendering:** polished stylized 3D in the style of a mobile game, with smooth surfaces, crisp
  clean edges, simple painted shading and sunny lighting. Not low poly, not toy-like, not clay,
  and not realistic.
- **Textures:** simple, mostly smooth solid colors with soft gradients. No grit, noise, cracks or
  fine patterns.
- **Ground:**
  - Grass and sand are each a smooth, simple color.
  - Where they meet, the transition is soft: grass thins out into sand, with an irregular edge and
    a few tufts. It isn't a hard line.
  - Natural variety comes from objects on the ground (palms, bushes, boulders, ledges), not from
    texture.
- **Characters:**
  - Stocky and heroic, about 3.5 heads tall, with big hands.
  - Simple small dark eyes with thick brows.
  - Simple clothing in solid colors, without wrinkles.
  - Clothing is never ripped or frayed.
- **Tropical theme:** no metal helmets.
- **Crew color:** blue, the safari uniform and tank tops. Enemies never use blue.
- **Enemy faction:** a scrap-built mercenary army painted charcoal and rust-orange. Write "painted"
  in image prompts, or image generators add realistic rust. Sandbags, bamboo watchtowers and tin
  roofs.
- **Medic symbol:** a white plus on green, never a red cross, because the red cross is a protected
  emblem.

When prompting image generators, strong style words overshoot. "Low poly," "toy" and "clay" each
took the look too far. Attach `concept/cast-lineup.jpeg` as the reference, and use mild wording
plus a short "not X" list.

Reference images in [concept/](concept/):

| File                          | Use it for                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `cast-lineup.jpeg`            | The main character reference: all 7 heroes                                             |
| `style-uniform-trio.webp`     | The style of eyes and clothing the owner liked                                         |
| `raid-topdown-crew.jpeg`      | Best gameplay composition: a compact base, a heal circle, the walk back to the gunboat |
| `raid-topdown-simple.jpeg`    | The right texture simplicity; but the grass-to-sand edge is too abrupt                 |
| `raid-key-art.jpeg`           | Poster mood. In game, the gunboat has one seat, not a crew                             |
| `raid-third-person-wide.jpeg` | Rejected direction: too much distance and forest. The Tank girl holds the wrong weapon |
| `tpose/`                      | T-poses and single props for making 3D models (see Heroes)                             |

## Tech plan

**Decided:**

- **Quality bar:** high-quality 3D close to the concept art, with animations and smooth shading,
  not flat vector or simple graphics. The owner left the engine choice to us.
- **Engine:** Three.js replaces Phaser (2D). Reasons:
  - It stays a web app: native Unity/Godot/Unreal iPhone builds need a Mac with Xcode, and the
    owner is on ChromeOS Linux, while those engines' web exports are heavy on iPhone Safari.
  - It uses WebGPU on current iPhones with a WebGL fallback.
  - It blends skeletal animations and loads standard glTF/GLB models.
  - It supports soft shadows and post-processing such as bloom and color grading.

  Keep the Vite, PWA and Cloudflare setup.

**Proposed:**

- **Art pipeline:** quality comes mostly from assets, not the engine.
  1. Turn concept images into draft models with AI image-to-3D (Tripo or Meshy).
  2. Clean them up in Blender, which runs on the owner's Linux.
  3. Animate humanoid heroes with Mixamo (run, shoot, throw, die). The Tank gets a simple rig for
     its treads, turret and hatch.
  4. Export to GLB.

  Check each tool's license before relying on it; free tiers sometimes limit commercial use.
- **Models:** the smooth, painted style means characters and key buildings need custom models
  with simple textures. Free low-poly packs won't match.
- **What to expect:** in game, the look can get close to the top-down concept images. Poster-level
  cinematic lighting is beyond real time on a phone.
- **Multiplayer:** Cloudflare Durable Objects:
  - One per raid. It runs the authoritative simulation at 15–20 ticks per second over WebSockets.
  - One per crew island. It saves the base and its timers.
- **Shared rules:** game rules stay pure functions (as in `src/game/logic/`) shared by the server
  and the client.
- **Offline:** raids need a connection; the home island can still open offline.

## Build order

Each step should be playable on the owner's iPhone before the next one starts.

1. **Look test:** in Three.js, landscape, with the MOBA camera, one 3D island in this art style
   and one animated hero, running smoothly on an iPhone.
2. **Solo raid:** one hero against a small island, ending in a win or a loss.
3. **Gunboat:** walking back, boarding, the targeting camera, the three abilities, and energy.
4. **Co-op raid:** a game server, 2–5 players joining by invite code, and no respawns.
5. **Home island:** building on tiles, resources, the refinery, HQ limits, and a shared save.
6. **World map:** clouds, island ratings, and rewards.
7. **Content and polish:** balance, events, and sound.

### Draft status (2026-10-29)

Steps 1–3 exist as a first playable draft with placeholder models, at the owner's request
("T-pose models first, rough draft of the game before animating"). The draft has:

- **Look:** Three.js in landscape with the MOBA camera.
- **Islands:** generated islands, with the same buildings per HQ level and different layouts.
- **Heroes:** all 7 heroes, with their attacks and supers from the Proposed table.
- **Enemies:** defenses that shoot back (gun turret, mortar with its blind spot, harpoon,
  flamethrower) and hidden beach mines.
- **Gunboat:** walking back to the boat, boarding, the targeting view, the three abilities and
  escalating energy costs.
- **Raid rules:** no respawns, a 5-minute timer, and results.

Heroes are simple primitives with a procedural walk, not rigged models yet. The menus show the
Rifleman's TRELLIS model (arms lowered from its T-pose by a script) on the hero-select pedestal.

Choices made while building the draft. All are **Proposed**:

- **Island difficulty:** the hero-select screen offers HQ levels 1–3, named Outpost, Fort and
  Stronghold, shown with 1–3 stars. Rifleman, Heavy and Medic are open from the start; the others
  unlock with medals (see UI and menus).
- **Cover:** rocks and sandbags block shots both ways. Short sandbag walls stand in front of gun
  turrets and harpoons, facing the beach, so attackers have to flank them.
- **Non-attacking buildings:** the watchtower doesn't attack, and neither does the headquarters.
- **Gunboat boarding:** a hero can board from up to 6.5 m away (the boat is about 6.5 m long).
- **Starting energy:** the crew starts with 10 gunboat energy. Defenses give 4–5 when destroyed,
  other buildings 3.
- **Firing:** holding the aim fires continuously, and a quick tap fires at the nearest building
  for a moment.
- **Medic playing solo:** the Medic heals teammates in a cone and herself a little, so a solo
  Medic isn't helpless.
- **Balance check:** a unit test makes sure a bot rifleman can beat a level-1 island solo. Nothing
  else is balanced yet.
