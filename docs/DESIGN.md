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
