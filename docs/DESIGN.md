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
and one player at a time can call in the gunboat to fire its weapons from a targeting view.

## Out of scope for version 1

These were explicitly left out to keep the first version to a basic structure:

- Prototype or "landmark" signature defenses.
- Respawning during a raid.
- A minimap.
- AI troop squads following heroes. Also a proposal, not decided.

## Added 2026-11-02 (owner's requests)

**Decided** unless a line says otherwise. The numbers are first passes.

- **Hero trees** replace hero levels and perks: see `docs/HERO_TREES.md`. Small checkpoints sit
  on each line between two upgrades, bought with gold, in order (one a line since 2026-11-03).
- **Crystals:** nature, fire, ice and dark, won from enemy headquarters.
- **Enemy islands** have their own shapes, not the crew island's: cove, hook, keyhole, twin, volcano,
  atoll, ridge and chain, each with its own way in. Bases are laid out on tiles. Tree cover grows
  with headquarters level, and first islands sit close to the beach.
- **Player islands:** two in each region, nearest home, belong to other crews, or stand-ins until
  a real one moves in. Holding one pays a little gold a day. Lose it and another crew can take it.
  Raiding a real crew's island steals at most 10% of what they hold, then shields them for 12 hours.
- **Night raids** carry off loot from broken stores, and an island that holds gets gold for it.
- **Blueprints:** every defense but the gun turret has to be found by raiding non-player bases.
- **Storage:** a new crew has only the headquarters to store things, and it doesn't hold much.
- **Ancient statues** are hidden in the crew island's forest and rocks, found in order: nature, ice,
  fire, dark. Each takes 10 of its crystal, 5,000 stone and two days to restore.
  Nature gives buildings health, fire gives them damage, ice gives production and plunder, and dark
  improves the odds of crystals, blueprints and chests.
- **Teaming up:** crewmates get a notification when someone's picking a hero, and can see it on the
  map. The lobby shows who's come as 2/2. A team can't charge straight in: everyone scouts the
  island and readies up, and the raid starts when the whole team is ready, with at least two on it.
- **Crew screen:** Tools and Statues live in the Build drawer, a Heroes button sits by the Map
  button, and the cleared bar has gone.
- **Accounts:** logging out takes the game off the phone, so nothing carries into the next account.
  A phone can stay signed in to several accounts and switch between them from the profile.
- **One gold:** there's only the island's gold. Raids and chests pay into it, and it pays for hero
  upgrades, so every screen shows the same number. Crystals are still each player's own.
- **Shared heroes:** a crew shares its hero upgrades. One person buys, everyone has it, and upgrades
  a player already owned join the crew's when they do.
- **Heroes go by the headquarters:** a hero is available only once the crew's headquarters has
  reached their level, whatever an old save says.
- **Starting strength:** every hero starts at 85% of the old health and damage, so first islands
  take some care. The upgrades and checkpoints earn it back.
- **Hero models:** all seven heroes use real TRELLIS.2 models, in menus and in raids: about 32,000
  triangles on the hero screen, the full source model, and about 15,000 in a raid, nearly half of
  them on the head, with a normal map baked from the full model. The six on foot have skeletons. The
  Tank is one solid piece. Hands close on what they hold, each weapon is one mesh, and a hero costs
  two draw calls however detailed their gear.
- **Grass:** big swathes of light and deep green, shared by the ground and the plants on it, with
  fine blades in a small texture. The swathes are baked when an island is built.
- **Bases on the crew island's shape** grow the way a crew's does: a small camp in the first clearing
  near the beach, with forest standing everywhere else, working further inland as the headquarters
  levels up. It reaches its deepest spot by headquarters 16.
- **Map:** every island to raid just says Raid, the map doesn't say which crystal an island holds,
  and the crew's own island has a Home tag.

## Added 2026-11-07, second batch (owner's requests)

**Decided** unless a line says otherwise. The numbers are first passes.

- **Headquarters to 50:** the headquarters goes up to level 50, from 20, and every other building
  reaches its top level exactly at headquarters 50. Up to headquarters 20 a building's levels come
  as they always did; the rest are spread evenly over the climb from there to 50, a level every one
  and a half to four headquarters levels depending on the building. So not every headquarters level adds a
  level to every building, and different buildings gain at different ones.
- **Top levels:** gun turret 50 (30 by headquarters 20); gold mine, lumber mill, quarry and scrap
  yard 25 (10 by headquarters 10); mortar, harpoon and flamethrower 25; storages 20 (8 by
  headquarters 10); watchtower 15; refinery 15. Land mines and the laboratory stay at 1.
- **More of them:** a 7th gun turret at headquarters 26 and an 8th at 38; mortars 5 at 30 and 6
  at 44; harpoons 4 at 28 and 5 at 42; flamethrowers 4 at 30 and 5 at 45; watchtowers 3 at 24 and
  4 at 40; a 4th of each storage at 35; a second refinery at 32; 14, 16 and 18 land mines at 26,
  34 and 44.
- **Late levels grow gently:** past a building's early levels each costs 8% more than the one
  before (45% before that), takes an hour longer (a level 25 mortar takes 27 hours), a mill makes
  8% more an hour (30% before) and a storage holds 10% more (50% before). Past headquarters 20,
  each headquarters level costs 7% more than the last and takes 3.2 hours longer, to a week for
  level 50. A test checks a full set of storages can always pay for the next headquarters level.
  What a raid takes from a broken mill or storage follows its production.
- **What the headquarters asks:** a mill, turret or storage at most one level short of the most it
  could have, and hero upgrades two a level to headquarters 20, then one a level: 66 at 50. The hero
  trees still open their last tier at headquarters 19.
- **Tools to 40:** levels 1 to 5 come at the same headquarters levels as before and still open the
  patches; levels 6 to 40 spread out to headquarters 50. Each late level costs 10% more, takes an
  hour longer, up to two days, and clears 2% faster. With every tool at 40 and 4 workers, clearing
  the whole island still takes about 44 days (70 with tools at 5).
- **Buildings grow with their level:** on top of the ten looks (every fifth level on a 50-level
  building), each level stands a building a little bigger: 90% of its full size at level 1, full
  size at its top level. **Changed (owner):** not defenses. A gun turret, mortar, harpoon,
  flamethrower or watchtower stands full size from its first level, and every one of its ten looks
  is its last look's size: only what it's made of moves on. The mortar's tube no longer fattens
  at looks 4 and 8. The concrete pad still comes at the sixth look.
- **Enemy bases** follow the same table, so a headquarters 50 base has headquarters 50's buildings
  and levels, rather than headquarters 20's with levels piled on.
- **Every building modeled:** the flamethrower, watchtower, gold mine, lumber mill, quarry, scrap
  yard, the four storages, the refinery and the laboratory get their ten Blender looks in the game,
  blue for the crew and red for raiders, like the headquarters and the other defenses. Only the
  land mine is still a plain disc.
- **Lights after dark, from the buildings themselves:** no more glowing balls hanging in front of
  every building. The lamps on a model light up as the sky darkens, and its windows glow dimly
  like lit rooms. A building with lamps is floodlit from where they are, each with a small point of
  glare; one whose model has none yet is lit by a lantern out of sight on the side facing the
  camera, flickering. Light falls away the way a real lamp's does, bright close by and gone a few
  meters on, so there's dark ground between buildings.
- **Real light colors:** a lantern's flame (about 1900 K, amber), a warm floodlight (3000 K), the
  lab's tubes (cool white) and the refinery's furnace (deep orange); raiders' lamps are the same
  lamps as the crew's, no longer tinted red. Lamplight is added to the blue moonlight rather than
  multiplied into it, so a lamp turns grass olive and a path amber instead of a brighter green.
  **Changed (owner):** brighter than the first pass, lanterns most of all.
- **Sand under every building:** each building stands in a patch of trodden sand with rounded
  corners, stopping about a third of a meter short of the edge of its tiles, on the crew's island
  and on raider bases alike, faintly mottled, with a fine grain and the odd pebble close up and a
  touch darker where it meets the grass. Land mines get none, so they stay hidden.
- **Swapping buildings:** on the crew island, dragging a building on top of another makes them
  trade places, each set down in the middle of where the other stood and turned as it was. Not if
  either won't fit in the other's place, or a crewmate is moving one of them.
- **No light round the hero** at night: the glow that went everywhere with them is gone.
- **Shots from the gun:** a defense's bullets and harpoons leave its muzzle up on the building and
  come down to whoever they're aimed at, rather than flying low from its base.
- **Buildings sharp at night:** a building's light falls round it and leaves the building itself out,
  so it isn't washed over and stays easy to make out, with only its own lamps and windows lit.
- **Flat small plants, and an Ultra setting:** ferns, grass tufts and flowers are flat cards turned to
  the camera, swaying, two triangles each instead of dozens, which takes a fifth off what the home
  island draws. Graphics: ultra is the best the game looks: solid small plants at any distance, up
  to twice the screen's resolution, and a bigger shadow map redrawn every frame.
- **Shorter shadows:** shadows are cast as if the sun or moon were never lower than 38 degrees, so a
  palm's shadow keeps its crown near it instead of being a long bar of trunk across the island.
- **Headquarters set back:** a raider base's headquarters stands 10 meters back from the middle of the
  base (less on small camps), away from the landing, so most of its defenses stand between it and
  whoever comes ashore. A puzzle base lays itself out round wherever the headquarters ends up.
- **Fewer stalls:** a new screen builds its shaders in the background before drawing (on phones that
  can, as iPhones can) instead of freezing while it does; building icons are drawn one a frame after
  a screen opens; and landing on the island just scouted doesn't lay it out again.
- **Music carries on between screens:** the crew island, map, scouting and raid tracks are all one
  song, so going from one to another picks it up at the bar it had got to instead of starting it
  over with its opening every time. The song waits where it was while anything else plays.
- **Winning:** a drum riff (a fill down the toms into a groove, a roll, one big hit left to ring)
  instead of the bugle fanfare, and each star locks into its slot with a whoosh, a thud and the ring
  of struck metal, higher for each one, instead of a beep.

## Added 2026-11-07 (owner's requests)

**Decided** unless a line says otherwise. The numbers are first passes.

- **No sprint:** the sprint button and Shift are gone: running made dodging too easy.
- **No faster feet from the trees:** nothing in the hero trees adds move speed any more. Survival's
  third upgrade is Iron Will (+12% health) instead of Swift, speed minis became armor and blast
  minis, and five specials were swapped: Snap Shot (Rifleman, reloads 15% faster) for Run and Gun,
  Quick Hands (Medic, throws 15% faster) for Ice Pack, Belt Feed (Heavy, fires 12% faster) for
  Rolling Thunder, Quick Breech (Tank, reloads 15% faster) for Bulldozer, and Salvo (Bazooka, every
  4th shot fires two rockets) for Getaway. Whatever was bought of them was given back.
- **Grenadier:** a 30% wider blast, 3.9 m from 3 m. (Read as the blast's spread: a grenade lands
  exactly where it's aimed while standing still.)
- **Islands taken back:** a fifth of what a crew holds each night, from about a quarter.
- **Difficulty:** five bands, Easy (green), Medium (yellow), Hard (orange), Extreme (red) and
  Impossible (purple), by how far a headquarters stands above the crew's: Easy is 1 to 3 below,
  Medium level to 1 above, Hard 2 to 3, Extreme 4 to 6, Impossible 7 to 12. Shared by islands and
  raider ships.
- **Enemy headquarters follow the crew's:** a raider island's headquarters is rolled in a band
  against the crew's own, so islands keep pace as the crew grows, up to headquarters 50, and the
  further from home the likelier a hard one. A win's crystals go by the band; an Impossible island
  gives at least two.
- **Raider ships replace the nightly raid's clock:** each morning (5 am, local time) a raider ship
  turns up somewhere in the open water of the crew's map, and that night, between 9 pm and 5 am,
  it lands on their island. Tapping it says when it's likely to strike (a two-hour window), its
  difficulty, its crew and plan (Tank wall, Heavy, medic and bazooka, Grenade rain, Rifle squad,
  Rocket battery, Engineers' fort, Mixed crew), who's aboard, and what holding it off pays: a
  crystal on an Easy ship up to four on an Impossible one, and gold, timber and stone that grow
  with it. Raiders number 2 plus one for every 4 headquarters levels, up to 8. The Night raid and
  Raid now buttons are gone: a raid can't be called in early. Its report opens on its own.
- **Strike back:** a raid that gets through can be answered: Strike back raids the base the ship
  sailed from, at its headquarters, and winning there wins back what was taken. It can't be held.
- **Night replays:** no more tint over the island; the sky is the sky as it was when the raiders
  came.
- **Smarter raiders (from raider ships):** they circle a defense instead of standing in its sights,
  go for buildings that pay the gunboat's energy while they're short of it, and one of them works
  the gunboat: a shock grenade on a nest of defenses, then a barrage while it's stunned, a shell on
  the toughest defense in reach, or a medkit on hurt raiders bunched together. Crews that bombard
  save up for the big strikes. Their gunboat grows with the ship: shells and medkits from the
  start, shock grenades from headquarters 6, barrages from 10. Raids from before the ships replay
  as they ran.
- **Producers hold their output:** a mill no longer pours straight into storage. It fills up to a
  day's work at level 1, three days by level 10 (24 hours plus 5⅓ a level), and waits. Once it
  holds 5% of that, a tab with its resource bobs over it; tap it and the resources fly up into the
  bar at the top. A full one glows: it has stopped. What storage can't take stays in the mill.
- **The supply ship:** what the crew's islands turn out no longer just appears. Each morning the
  supply ship brings a day's cargo for each day since it last called, up to a week: tribute gold
  from player islands, and gold, timber, stone and scrap from raider islands, by their
  headquarters. It waits at the beach, with a Supplies tab (at the edge of the screen if the beach
  isn't in view); tap it to unload, and whatever storage can't take stays aboard.

## Added 2026-11-03 (owner's requests)

- **Puzzle islands (Decided):** about one island in five from headquarters 3 has its defenses laid
  out by design instead of in rings, each layout with its own way in. **Changed 2026-11-03:** they
  look like any other island on the map, the card and the scout, with no tag or hint: the layout is
  the surprise. The seed picks which islands and which layout, so every phone sees the same.
- **Thirty layouts,** made from shapes filled with different defenses: a checkerboard (of mortars;
  guns and flamethrowers in turn; harpoons in, mortars out), a U open to the beach (of sniper towers
  with fire round the headquarters on a strong base; guns with mortars outside; harpoons and
  towers), rows lining the way in (a flame gauntlet backed by mortars and guns; guns with mortars
  outside; harpoons and towers in turn), rings round the headquarters (harpoons; flamethrowers
  hugging it with guns round them; guns and mortars in turn), a picket wall of guns and storages
  with towers behind, a crossfire between two batteries, a honey pot of storages ringed by mortars,
  spirals (fire at the heart; guns and harpoons), crosses (guns with mortars at the tips; fire in
  close with harpoons at the tips), five spokes of five kinds, a V pointing at the beach (guns with
  mortars at its point; sniper towers with fire at its point), diamonds (towers and harpoons;
  mortars with guns outside), three little forts (one kind each; towers and fire), rings in rings
  (fire, guns, mortars; guns with towers outside), a bowtie (mortars in front, guns behind), and the
  walls of a square (towers on the corners, guns along the walls; mortars and flamethrowers).
- **Fit:** each layout only goes on the kinds of island it fits, and only between the headquarters
  levels it's meant for: a small shape runs out of room on a strong base. Anything the island has no
  room for goes as near its spot as there's ground.
- **Fair fights:** a layout carries 0.85 to 1.4 times the firepower of an ordinary base of its
  level, counting each defense's level. This breaks "as many of each as the headquarters allows" on
  purpose: ten mortars can stand on a headquarters 6 island. Storages and mills are as usual.
- **Islands taken back:** about a quarter of what a crew holds goes back each day, up from 10 to
  15%, and a retaken island looks like any other: no tag, no note on its card, no smoke over it.
- **Gun turret: 30 levels.** It reaches all thirty only at headquarters 20, a level and a half for
  each headquarters level, and changes its look every third level. Each level adds 6%, half the
  usual step, so by level 15 (headquarters 10) it's about where a level 10 turret was, and the
  twenty levels after keep it growing. Costs and build times are spread the same way: level 30
  costs and takes what level 10 did. It fires 30% faster, every 0.23 s, for 32 a bullet, about 10%
  more damage a second at the same level; 32 rather than 38 keeps the first islands winnable.
  Turrets on islands from before moved up to where their level now sits. (Since 2026-11-07: 50
  levels, the last twenty spread over headquarters 21 to 50.)
- **Hero trees rebuilt:** twice as long, branching four ways from the first upgrade, one branch
  for each crystal, and no upgrade adds range any more. Each tier opens at a headquarters level, so
  a hero is only as strong as the islands the crew can reach. Everything bought on the old trees
  was given back, the crystals to the player and the gold to the island. See
  `docs/HERO_TREES.md`.
- **Gun turret's top:** the trim round the top of the drum no longer lies level with the drum's own
  top, which made the two flicker against each other.
- **Mortar modeled:** ten looks like the turret's, from a pipe on a forked log in sandbags to a
  polished emplacement with a radar dish. Its tube turns to its target, tipped up, and when it
  fires it slams back down along itself with a big flash and a puff of smoke over the muzzle.
  The tube gets fatter twice on the way up, at looks 4 and 8, so a strong mortar shows from afar.
  (Since 2026-11-07 the tube is full width at every look.)
- **Harpoon launcher modeled:** a great crossbow on a turning mount, ten looks from log limbs and
  a log harpoon in sandbags to polished steel with lights and a radar dish. When it fires, the
  bowstring snaps forward and the harpoon on the stock goes; a second later the next one slides on,
  and the string draws back, ready by the end of its reload.
- **Headquarters modeled:** ten looks, a new one every second level of its twenty. **Changed
  2026-11-03:** no rust, no shiny metal and no towers on the corners. A plank shack under a flat
  sheet-metal roof, then a lean-to and a radio mast, then a log cabin; from the fourth look a
  two-storey block with a flat roof inside a parapet, a deck in front of the upper floor, wings down
  its sides from the fifth and a lookout room on top from the sixth, glass from the seventh, and a
  radar dish on the last. Roofs, parapets, doors, banners and the flag are painted, so a crew's
  headquarters is blue and a raider's red. The world map keeps its tiny plain headquarters, baked
  into the map's islands.
- **Defenses tidied (2026-11-03):** the gun turret, mortar and harpoon launcher lose their rusty
  and corrugated metal for flat plate, and their sandbags, which were most of what a model cost to
  draw: the first five looks stand on the bare ground and the sixth on a concrete pad. All three
  are 15% bigger, on pads the same size as before, so they still fit their tiles.
- **More minis and side paths (2026-11-03, second pass):** three minis between every two
  upgrades, each a little of something and named in turn (Toughness, Stamina, Weak Spot, Wrecker,
  Light Feet...), and two side paths off the trunk's second upgrade: Sapper ends in an upgrade for
  knocking things down, Scrapper in one for lasting, each the hero's own. The board lost its branch
  names, and sits over crystal glows, crystal clusters, a faint grid and sparks that slide along at
  different speeds as it scrolls. Minis bought on the first trunk trees were given back.
- **Hero trees reshaped (2026-11-03):** one line, Basics, up to headquarters 5; then two branches,
  Assault and Survival, to headquarters 11; then each splits into two of the hero's four last
  branches, with the same specials and capstones as before. 22 upgrades and 21 checkpoints a hero,
  down from 37 and 72, each worth more, so a hero ends about as strong as before. Upgrades cost the
  crystal of what they do, not of their branch, except on the last four. Everything bought on the
  four-branch trees was given back. See `docs/HERO_TREES.md`.

## Added 2026-11-02, seventh batch (owner's requests)

- **Heavy:** base speed 4.3, down 12% from 4.9.
- **Map clouds:** soft cumulus made of real stacked puffs, not noise. The edge thins to wisps and
  wanders in and out rather than following a line.
- **Circles on the ground:** nothing flat is cut off by a hill now. Hero rings lean with the slope,
  and mines, blast rings and scorch marks draw straight after the ground, so the ground can't slice
  them and anyone standing on them stays in front.
- **Building models (Decided, owner's plan):** every building gets ten looks modeled in Blender, from
  a janky setup of scrap wood, rope and tin to polished steel with lights. Defenses sit in sandbags
  for their first few looks; nothing else has sandbags. The design never changes from one look to the
  next: the same footprint and shape, only better made. A building shows the look for its share of
  its top level, so a ten-level building changes every level and a 50-level headquarters every five.
  The gun turret is the first, for the owner to judge before the rest.
- **Turrets move:** a turret's barrels kick back in turn as it fires, the flash comes from the muzzle,
  and the last look's radar dish turns.
- **Gunboat:** modeled in Blender with the same kit: a lofted hull, wheelhouse, mast, rails, tyre
  fenders and a bow gun that turns to its target and kicks back when it fires. It fires a pointed
  shell, or a striped canister for shock and a grey one for smoke, and each flies nose first along
  its arc.
- **Gun turret:** fires every 0.3 s for 38 damage, from every 0.42 s for 50: faster, each hit
  smaller, and about 6% more damage a second.
- **Flamethrower:** reaches 11.5 m, a tile further.
- **Mortar:** reaches 26 m, four tiles shorter, its blast is 9 m across, a tile less, and it reloads
  in 4.32 s, 20% slower.
- **Heavy:** range 7 m, two tiles shorter.
- **Heavy, again:** 15% less damage and 15% slower fire: 16 a round, from 19. His upgrades that make
  his gun stronger do 15% less too: Warm Up 17%, Hot Barrels 13%, Heavy Rounds +17%, Overdrive 21%,
  Berserk 43%, and his damage, fire rate and spin-up checkpoints 2.6% or 3.4% instead of 3% or 4%.

## Added 2026-11-02, sixth batch (owner's requests)

- **Watchtowers lead their target:** the sights slide ahead of a moving hero to where they'll be when
  the shot lands. They're smooth rather than instant, and still hold for a quarter of a second
  before firing, so running in a straight line gets you hit and changing direction dodges it.
- **The map:** held islands have no tag at all now, and island cards no longer say what holding one
  pays or that a base belongs to a rival crew. The clouds are a baked tile of lit cumulus, breaking up into puffs at their edges and throwing a shadow on
  the sea, in place of plain noise.
- **Losing islands:** 10 to 15% of what's held goes back each day, over time, to raiders or to other
  crews. With only a few islands that's a chance of losing one, not a fraction of one.
- **Heavy:** 3,150 health, up from 2,380, with a quicker spin-up, more damage and a little more
  range and speed, since he started a long way behind the Rifleman.
- **Medic:** she can take an island alone now. Locked onto a building she throws an acid bottle, from
  12 meters at most, for about 100 damage a second. Crewmates come first: with one in her sights she
  heals them.
- **Buildings:** everything that doesn't shoot back has half the health it did, and the
  headquarters a third less, 3,350 at level 1.
- **Volume:** the settings have a slider each for music and sound, on top of the on and off buttons.
- **Music:** the map's breakdown is half time now, the theme at half speed with almost no drums, and
  its verses are barely more than a pulse. Scouting's drums are quieter and slower with no press
  rolls, and the raid's and the victory fanfare's are quieter too.

## Added 2026-11-02, fifth batch (owner's requests)

- **Hero models:** the owner found them too undetailed, with features broken by too few triangles.
  Raid copies went from 5,400 to 15,000 triangles, 512 to 1024 textures, and gained a normal map.
- **Gunboat upgrades:** every weapon goes from level 1 to 6 at the laboratory, for gold, at
  headquarters 4, 8, 11, 15 and 18, so 3 or 4 headquarters levels apart. Artillery, Medkit and
  Barrage gain 15% a level, the Shock Grenade half a second of stun and the Smokescreen a second and
  a half of cover. The prices are Claude's choice, from 400 gold up to 4,000.
- **Panels:** everything that isn't a full screen change eases in and out: the laboratory, tools,
  statues, night raid, trade, pause, profile and lobby panels, the selection, clearing and island
  cards, and the build menu. Only opacity and movement, for a fifth of a second or so.

## Added 2026-11-02, fourth batch (owner's requests)

- **Clearing:** a patch can only be cleared if it touches open ground: the first clearing, the trail,
  or something already cleared. The shore doesn't count. Everything on the island can still be
  reached this way, and a test holds that to it.
- **Gunboat weapons:** five. Artillery and the Medkit come with every gunboat, then the Shock
  Grenade, Barrage and Smokescreen turn up in that order, each from a blueprint on a raider base. Only the next one in line
  can turn up. The Shock Grenade stuns every defense in a circle for 4 seconds, and the Smokescreen
  hides heroes in one for 10. Both circles are 6 tiles across. Friendly heroes aren't stunned: that
  was Claude's call, since a crewmate could otherwise lock up the team.
- **Laboratory:** a 3 x 3 building, one per crew, from headquarters 1. Blueprints won on raids now
  need a little gold there before they do anything, whether defense or gunboat weapon, and it opens
  every hero's upgrade tree. Older crews keep every defense they already knew, but gunboat weapons
  go back to the two everyone starts with, and the rest have to be found again. Raiders don't build laboratories.
- **Upgrade tree:** the board scrolls sideways, opening on the next thing to buy. It's 2,200
  wide since the trees got three minis a line on 2026-11-03.
- **Night:** brighter all round, and building lamps reach 40% further and shine 20% brighter.
- **The beach:** what's lying on it comes and goes with the tide: three lots on a beach, each
  swapped every 12 hours, four hours apart, so nothing stays much longer and the whole beach never
  changes at once. Coconuts, seaweed, bottles and crates join the driftwood, starfish and shells.

## Added 2026-11-02, third batch (owner's requests)

- **Sprint (removed 2026-11-07):** hold to sprint: 30% faster for as long as it's held, up to 2.5 seconds, and whatever's
  left stays for next time. An empty tank takes 20 seconds to fill and needs half a second in it
  before it'll go again. It's allowed while shooting, but with four times the wobble of walking and
  firing, which is why the aim cone blows wide open.
- **Reach in a fight:** each defense draws its own thin line along the ground again, the stretch near
  the hero, in amber for snipers, with a second line round a mortar's blind spot. Nothing's
  filled in, so overlapping guns stay readable.
- **Gunboat:** every damaged building on screen shows its health bar from the boat.
- **Falling:** nobody lies down. A fallen hero, the Tank included, goes up in a puff of smoke shaped
  like a skull, which rises for about a second and a half and fades.
- **Attacking:** Attack on an island or a scout opens the hero screen, with the button now saying
  Attack, to confirm who's going. A Medic on her own gets Needs a crew there instead.
- **The hero screen:** each hero cheers as they land, then aims and fires, or checks their weapon,
  every few seconds. A hero always shows at once: the detailed copy takes over when it arrives.
- **Running:** weight rolls from foot to foot, the pelvis tilts, the chest leans off the mark and
  rocks back at the stop, heroes bank into turns, and what they carry swings with the stride.
- **Music:** the world map is now a riff on the theme too, with an eight-bar double-time breakdown in
  the middle, since replaced by a half-time one. The raid track's hi-hat is
  mostly gone.

## Added 2026-11-02, second batch (owner's requests)

- **Aiming:** letting go with nothing in the arc now does nothing, instead of firing a volley. A
  Medic can still throw a bottle at the ground, since that's how she heals herself.
- **Sprint:** a button above and to the right of the fire pad, or Shift. See the third batch.
- **Gunboat:** a hero keeps firing at what they're locked onto while their player is on the boat.
- **Danger on the ground:** while scouting, every defense's reach is merged into one shape with one
  outline, red for guns and amber for snipers, so a big base no longer disappears under rings.
  Tapping a defense still shows its own reach. Health bars only show on what's been hit nearby,
  what the hero's firing at, and the headquarters. In a fight, see the third batch.
- **Taking a base:** each building that falls takes 4% off the headquarters, but never below 10% of
  its health, so the last blow is the player's. When the headquarters falls the base is taken: the
  guns stop, the crew can't be hurt or lose, and every building left explodes one at a time outward
  from it in about 7 seconds, paying its loot. So every win ends at 100% and three stars. Night
  raids keep the old rules: raiders grab what they can and leave the rest standing.
- **Production:** down from 900 to 150 an hour at level 1, so raids are the main income.
- **Headquarters requirements:** each level asks for the mine, camp, quarry and gun turret two
  levels behind it, the scrap yard three, the storages five, and two hero upgrades a level across
  the crew. The panel on the headquarters lists what's missing. Nothing asked for needs a blueprint.
- **Crystal trade:** three of one crystal and 1,000 of the island's gold buy one of another, from a
  Trade button on the hero and upgrade screens.
- **Checkpoints:** see "Checkpoints" in `docs/HERO_TREES.md`.
- **Music:** the crew island and the hero screens share the old hero screen song, which the owner
  likes best, and it carries on without restarting between them. The map, scouting and raids are riffs on
  it: the map plays it up front, scouting has it muffled under a field drum corps, and a raid has it sped up to 120 over the
  old scouting drum loop. That loop used to run 18 ms over, into the next bar's first kick, which
  sounded as a stutter every seven seconds; it's now a true four bars. Winning is bugles and drums.
  All of them are made by `scripts/make-music.mjs`, and nobody has listened to them yet but the
  owner: Claude can only measure them.

## Raids (the core of the game)

Raids are what matter most. If a co-op raid is fun, everything else builds on it.

1. The crew picks an enemy island and lands together at its beach. **Decided**
2. Each player controls one hero. Left thumb moves, right thumb aims and shoots. **Proposed**
   - **Aiming (Decided 2026-10-30):** dragging the aim stick shows a single cone as wide as the
     hero's shot spread and as long as their range, with a crosshair on the tower it will lock
     onto. It doesn't fire yet. Letting go locks on, and the hero keeps firing at that tower
     until it's destroyed or the hero walks out of range. Dragging to another tower retargets.
     A quick tap locks onto the nearest tower in range; tapping again stops. Heroes slow to 20%
     speed while aiming or shooting (**Decided 2026-11-01**, owner's request).
     Moving also costs accuracy (**Decided 2026-11-01**, owner's request): a hero's shot cone eases
     66% wider as they move and back as they stop. Throwers instead scatter longer and wider.
3. **Gunboat.** **Decided (changed 2026-11-01, owner's request):**
   - It pulls up next to the beach where the crew landed.
   - Only one player can use it at a time.
   - A player opens its view from wherever they are, with no walk back. The view switches to a
     targeting camera where they can aim anywhere on the island and fire abilities. Their hero
     stands still where they left them, and can still be shot and killed. They close the view to
     rejoin the fight.
4. Gunboat energy is shared by the crew and earned by destroying buildings. Each ability costs
   energy. **Proposed**
5. Starter abilities: Artillery (one heavy shot), Barrage (several shots over an area), and Heal
   (heals heroes in a circle). **Proposed**
6. Death is final for the raid: a hero who dies doesn't respawn and watches the rest. **Decided**
7. The raid is won by destroying the headquarters. It's lost when every hero is down or time runs
   out (about 5 minutes). Loot scales with how much was destroyed. **Proposed**

The core team decision is who works the gunboat, and when. It leaves a hero standing helpless
in the line of fire. A solo player is always choosing between fighting and firing.

**Proposed** details:

- Defenses can't damage the gunboat in version 1.
- There's no cooldown on reopening the view for now.

**Open:**

- Does a hero at zero health have a short "downed" state the Medic can revive from, or is death
  instant?
- Can two players pick the same hero in one raid? The proposal is one of each.

### Camera and screen

**Decided:**

- A MOBA-style camera: angled top-down (about 50°), following your hero, showing part of a much
  larger island. Every camera looks north-east from over the beach, so buildings sit on a diamond
  rather than square on (Decided 2026-10-30). Third person was considered and rejected as the main view; the owner has since
  asked for it as an option (below). Compared with it, the MOBA camera:
  - plays better with two thumbs
  - shows incoming mortar fire and teammates without a minimap
  - matches the gunboat's targeting view
  - leaves more of the phone's power for graphics, because the view distance is bounded
- Landscape. The code is still portrait (720x1280) and changes when the 3D build starts.
- No minimap.

**Proposed:**

- Dynamic zoom: a bit closer while running, wider in big fights, and a pinch to zoom within limits.
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
  - `prop-turret-deployed` (the Engineer's Salvage turret)
- The Engineer's backpack is still the simple version; the owner wants a more detailed one.
- `props-sheet-v1.jpeg` is an earlier attempt with an RPG-style launcher and an odd wrench, kept
  for reference only.

Gameplay is a first pass that hasn't been reviewed with the owner yet. **Proposed:**

**Supers removed (Decided 2026-11-01, the owner's request, for now):** no hero has a super, a super
meter or a Super button. The Super column below is kept as a record of what they were. The code
was last in commit `9727b4e`, if they come back. Each hero's signature move (below) is now what
sets them apart, and the Tank's Aftershock moved from the end of a ram to whatever they destroy.

| Hero      | Health    | Speed   | Range          | Attack                                                                      | Super                                  | Job                                               |
| --------- | --------- | ------- | -------------- | --------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| Rifleman  | Medium    | Fast    | Medium         | 3-shot burst                                                                | Sprint, taking less damage             | All-rounder; best at running back to the boat     |
| Heavy     | High      | Slow    | Short          | Minigun, more damage the longer it fires                                    | (supers removed)                       | Soaks fire up front                               |
| Tank      | Very high | Slowest | Medium-long    | Cannon shell, splash, bonus vs buildings                                    | Ram                                    | Breaks buildings; only the Engineer can repair it |
| Bazooka   | Low       | Medium  | Long           | One rocket, huge damage, slow reload                                        | Three-rocket volley                    | Kills key defenses from behind the Heavy          |
| Grenadier | Med-low   | Medium  | Medium, lobbed | Grenade that arcs over cover                                                | Smoke: defenses can't target inside it | Hits defenses behind walls; sets off beach mines  |
| Medic     | Med-low   | Medium  | Long, lobbed   | Throws healing bottles at allies; can't hurt buildings (Decided 2026-11-01) | Area heal over time                    | Keeps the crew alive (heals people, not the Tank) |
| Engineer  | Medium    | Medium  | Medium         | Rivet gun                                                                   | Builds an auto-turret                  | Damage without standing in fire; repairs the Tank |

**Proposed:**

- **Unlocks (Decided 2026-11-01, for now, until a story arc brings heroes in):** everyone starts
  with the Rifleman alone. A new hero joins every three HQ levels: Heavy at 3, Medic at 6, Grenadier
  at 9, Bazooka at 12, Engineer at 15 and Tank at 18. Medals are gone from the game.
- Hero upgrades are shared by the crew (see "Added 2026-11-02").
- As heroes level up, their outfits gain pieces, but silhouettes and headgear stay the same.
- **Perks (Decided 2026-10-30):** levelling a hero is an event, not just bigger numbers. Each hero
  has four perks of their own, earned at levels 3, 5, 7 and 10, shown as a locked track on the
  stats card, and revealed one at a time on a full-screen level-up.
- **Signature moves (Proposed, 2026-10-30):** level 5 gives each hero a move no one else has, and
  level 10 strengthens it. The numbers are in `SIGNATURE` in `src/game/logic/raid.ts`.
  - Sgt. Steele, Ricochet: bullets bounce into the next building (twice at level 10).
  - Doc Penny, Guardian angel: a hero who falls gets back up at 40% health, once a raid (twice).
  - Big Mo, Explosive belt: at full spin every 8th round explodes (every 5th).
  - Ace, Cluster warhead: rockets throw out 3 bomblets (5).
  - Mr. Pemberton, Skipping stone: grenades skip on for a second blast (a third).
  - Gus, Salvage: every building they destroy comes back as their turret for a while (full time).
  - Tilly & Tank, Aftershock: whatever they destroy goes up in a shockwave that can set off the
    next (far bigger).

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
- The crew island's shape (enemy islands now have their own, see above): a rounded diamond with one landing beach on
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

## Home island and crew

### Crew island draft (2026-10-30)

**Decided:**

- Crew members build on their island together in real time.
- The island is 3D and tile-based, so buildings can be placed and moved around.
- **The crew island and raid islands are the same island (Decided 2026-10-30):** one coastline,
  one landing beach on the bottom-left (south-west) shallowing out into the water, the same
  ground, sea, plants and mist. The owner preferred how the raid island feels, so the crew island
  became that, replacing its separate, larger plateau island.
- Forests run out to the island's edges, and all the grass can be built on, down to the top of
  the beach. The ground rolls gently where buildings go, and hills rise near the far shores.
- Grass fades smoothly into sand.
- Progression: a new island starts with only its headquarters and some resources. Producers
  (mills and the like) make resources passively. At the start you can also build a gun turret and
  a mortar.
  - One of each producer.
  - Storages unlock at HQ 3: one per resource at HQ 3, two each at HQ 7, three each at HQ 20,
    four each at HQ 35.
  - Storages upgrade to level 20 at most, 8 of them by HQ 10.
  - Every building's level is capped by the headquarters' level.

**Built:**

- **Island:** the shared rounded diamond, with the raid islands' terrain, shader sea, shore
  dressing and mist, a dirt trail from the landing beach to the HQ, and the gunboat moored off
  the beach. The building grid only shows while placing or moving a building.
- **Clearing (Decided 2026-10-30, replacing the 4 unlockable zones):** clearing the whole island
  is the work of months. A new island is overgrown. Only an 18 m clearing round the HQ and the
  trail are open; the rest of the grass is covered in patches the crew clears to make room:
  - Four tools come with HQ levels and each upgrades through 40 levels: Axe (HQ 1), Pickaxe (HQ 2),
    Chainsaw (HQ 3) and Dynamite (HQ 5). The Tools button buys and upgrades them. The first 5
    levels open patches; the rest only work a little faster.
  - Brush, thickets and palm groves take the Axe, rocks the Pickaxe, dense jungle the Chainsaw and
    boulders Dynamite.
  - Each patch has a tier from 1 to 5 by its distance from the HQ, and a tool must reach that
    tier's level, so the far edges wait for the best tools.
  - The patches round the base take 1 to 5 minutes, more the further out they lie (Decided
    2026-11-01, owner's request). The rest take hours.
  - Clearing takes real time, on the server's clock. A worker starts the job, it keeps going with
    the app closed, and a countdown pin stands over it. Better tools work faster.
  - Workers limit how many jobs run at once: 1, and 1 more every 4 HQ levels, up to 4.
  - Tap a patch to see its tool, tier, time, cost and what it gives back (timber or stone). Loose
    brush touching a cleared patch goes with it.
  - The layout is the same on every island (fixed seed); the server stores which patches are
    cleared and checks every clearing with the same rules. Islands from before this change keep
    their buildings: the ground under them counts as cleared.
- **Progression** (`src/game/logic/economy.ts`):
  - Resources are Gold, Timber, Stone and Scrap.
  - Producers: Gold mine, Lumber mill and Stone quarry from HQ 1, and the Scrap yard from HQ 2.
  - Storages: the Gold vault, Timber shed, Stone yard and Scrap bin.
  - Defenses start with one gun turret and one mortar. More of them, and the harpoon, flamethrower
    and watchtower, unlock at higher HQ levels.
  - The HQ goes up to level 50. A building's early levels come one an HQ level from the one it
    unlocks at; the rest spread out to HQ 50.
  - Resources build up over time, from the server's clock, up to what the HQ and storages hold.
  - Building and upgrading are instant and cost resources.
- **Sync:** each crew has its own server on Cloudflare. It checks every change, costs included,
  with the same rules as the phone, saves the island, and sends the whole island to every
  crewmate. A building someone is moving is locked to them, with a name tag.
- **Offline:** the island keeps working on the phone, and the server's copy wins on reconnect.

**Proposed** (defaults, not yet confirmed by the owner):

- Joining uses a nickname and a 6-character crew code. Accounts are optional (see below). On iPhone,
  Safari and the Home Screen app keep separate storage, so they count as two players.
- Crewmates show only as name tags on the buildings they're moving, not as walking characters.
- Clearing numbers are a first draft (`src/game/logic/crewIsland.ts`): costs from brush 15 gold to
  boulder 700 + 60 scrap; base times from 6 minutes (brush) to 18 hours (boulder); tier 1 to 5
  takes 1, 2.5, 6, 12 and 20 times as long. A unit test holds the whole island above 90 days of
  work with every tool maxed and 4 workers.
- The progression numbers (costs, production, capacity, which HQ level unlocks what) are a first
  draft, not balanced.
  - Starting stock: 600 gold, 600 timber, 300 stone, 100 scrap.
  - Producers make 150 per hour at level 1, and 30% more each level.
- Removing a building gives nothing back.
- Footprints in tiles:
  - headquarters 6×6
  - defenses 2×2
  - producers and the refinery 3×3
  - storages 3×2

**Not built yet:**

- the world map with other crews' islands
- leaving or switching crews
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
- **Build timers (Decided 2026-11-01, owner's request, shortened the same day):** building and
  upgrading take real time, but early levels are a matter of minutes. A new building takes 30
  seconds. Upgrades take 1, 2, 3 and 5 minutes, then 15 minutes, then 1, 4, 8 and 12 hours. The
  headquarters takes 2, 5, 10, 20 and 30 minutes for levels 2 to 6, then climbs to 3 days.
  **Proposed:** tools take 2 minutes to a day, and builders (2, and 1 more every 5 HQ levels, up to
  5) limit how much runs at once, apart from the workers clearing ground. Hero levels stay instant.
  A building goes on working while it's upgraded, at its old level; a new one does nothing until
  it's up.
- **Building sizes (Decided 2026-11-01, owner's request):** the headquarters is 5x5 tiles and about
  4 heroes tall, the refinery and mines 4x4 (**Proposed:** the lumber mill, quarry and scrap yard
  too), and defenses and storages 3x3. Buildings already on an island move to the nearest free spot
  if they no longer fit.
- **Land mines (Decided 2026-11-01, owner's request):** a crew can buy mines, 1x1 and hidden.
  **Proposed:** from HQ 2, 2 at first and up to 12, at 80 gold and 30 stone each. They can't be
  upgraded, are set again after a night raid, and enemy bases have as many as their HQ allows.
  A raider only sees one when almost on top of it.
- **Buildings stand on the grass (Decided 2026-11-01, owner's request):** no pad or dirt under them,
  on the crew's island or an enemy's.
- **Showing range (Decided 2026-11-01, owner's request):** tapping a defense on your island shows
  its range. In a raid, a thin line fades in for the stretch of a defense's range near your hero,
  so it warns without covering the base.
- **Upgrade signs (Decided 2026-11-01, owner's request):** anything that can be upgraded right now
  has a tiny 3D signboard with a green up arrow at its near corner.
- An idea: AI raider fleets sometimes attack the home island, and whoever is online defends it
  together.

## UI and menus

**Decided:** the whole UI was redone (2026-10-30), taking direct inspiration from the owner's
mockups. The aim is to be better than them, not an exact copy:

- [concept/ui-hero-select.jpg](concept/ui-hero-select.jpg)
- [concept/ui-raid-hud.jpg](concept/ui-raid-hud.jpg)
- [concept/ui-raid-jungle.jpg](concept/ui-raid-jungle.jpg)
- [concept/ui-raid-beach.jpg](concept/ui-raid-beach.jpg)

The look (**Decided 2026-10-30**, the navy theme from the owner's second set of mockups:
[ui-navy-kit](concept/ui-navy-kit.jpg), [ui-navy-crew](concept/ui-navy-crew.jpg),
[ui-navy-raid](concept/ui-navy-raid.jpg), [ui-navy-heroes](concept/ui-navy-heroes.jpg); "navy
like theme but polished and simple"):

- **Frames and panels:** deep navy steel panels in a steel-blue frame, brass L-brackets on the
  corners and rivets; name plates are navy in a brass frame with cut corners.
- **Buttons:** navy faces in a brass frame with cut corners and gold lettering, sinking when
  pressed; dark navy for secondary, brass for gold, green and red for go and danger. Round
  buttons and the sticks are navy discs in a thick brass ring (anchor knob to move, a bullet
  sight to fire).
- **Insignia:** brass rank chevrons, anchors and shield-shaped rank badges for levels.
- **Bars:** segmented gauges (HP orange, attack green, speed yellow, range blue on hero select).
- **Hero select:** "Personnel" roster, a radar sweeping behind the hero on a navy steel pedestal
  with a grated top, "Technical specs" on cream paper, the signature move in a hazard-striped plate, and
  SELECT.
- **Raid HUD:** a navy hero card, crewmates in a column down the left, a PAUSE plate and a
  brass-rimmed minimap.
- **Text:** bold outlined lettering, gold or cream.
- **Currency:** navy wells in a brass rim with a big icon on the end.

**Built:**

- **Home (Decided 2026-10-30):** there's no title screen. The game opens on the crew island,
  with a pause button (top-left) for the menu and settings, a round Build button (bottom-left)
  that opens the build drawer, and a big RAID button (bottom-right). Starting or joining a crew
  is from the crew button; until then the island is the phone's own.
- **Settings** (pause menu, on the island and in raids): raid camera tilt and zoom, UI size and
  sound, saved on the phone. Defaults are tilt 0.00 and UI 0.70 (**Decided**), and both go above
  and below those.
- **Behind-the-hero camera** (Settings → Camera, **Decided** as an option): lower and closer,
  swinging round to follow the hero's heading, with a small push-in while firing. Sticks turn
  with the view, so pushing up always goes forward.
- **Finishing effects:** a gentle vignette and softer shadows. Bloom was taken out to save battery.
  Sharpness and then shadows step down on devices that can't keep up in a fight.
- **Controls editor** (Settings → Controls, **Decided**): drag the move stick and fire stick
  anywhere and resize each one. x and y are shares of the screen (0 to 1). Settings
  shows every value, so the owner can send them to become the defaults.
- **Hero select:**
  - a roster of 3D-rendered portraits with gear-shaped level badges, and a lock showing the
    headquarters level that brings each hero in
  - the hero on a stone-and-steel pedestal: drag to spin it, and it drops in when chosen
  - a stats card with HP, Attack, Speed and Range bars (a ghost bar previews the next level)
  - the hero's signature move
  - the hero's perk track
  - LEVEL UP (gold), and RAID, which opens the world map
- **Raid HUD:**
  - a portrait card with a health bar
  - crewmates' portraits under it, with health bars and a KO mark when one falls
  - a timer and destruction plate
  - pause, a live minimap, and energy and loot pills
  - a move stick and a FIRE pad, resting where the controls editor puts them
  - the gunboat button, always there, which opens and closes its view
  - the gunboat ability tray, only in that view
  - damage numbers over hits
  - a glowing ring under your hero (green) and each crewmate (blue)
- **Raid scenery:** the island looks like the jungle and beach mockups:
  - a dirt trail from the landing beach up to the HQ
  - dense jungle (broadleaf trees, palms, elephant-ear plants) crowding in around the base's
    clearing, kept clear of the trail and the landing area so the crew can see where it's going
  - ferns, flowers and grass across the open ground, bare rock on steep slopes
  - driftwood, starfish and shells on the beach
  - a shader sea with clear turquoise shallows, ripples, glints and rolling foam
  - plants sway in the wind
    The jungle is scenery only: heroes walk through it, and it never blocks shots.
- **Heroes:** each hero is now a detailed toy-style model (face, hair and headgear, jointed arms
  holding their own weapon, belts, backpacks). The Rifleman also has a real GLB model on the
  hero-select pedestal. All of them still wait for final art.
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
- Gold levels heroes up, from 1 to 10. Each level adds 8% health and damage.
- Hero upgrades and gold are shared by the crew; only crystals are personal.
- Hero names on the cards:
  - Sgt. Steele (Rifleman)
  - Doc Penny (Medic)
  - Tilly & Tank (Tank)
  - Big Mo (Heavy)
  - Ace (Bazooka)
  - Mr. Pemberton (Grenadier)
  - Gus (Engineer)
- Stars: 1 for 50% destroyed, 1 for the HQ (the win), and 1 for 100%.
- **Crewmates are real people (Decided 2026-11-01, owner's request):** there are no AI allies. The
  AI squad that was drafted on 2026-10-30 is gone; the only allies on a raid are other players.
  - Tap an island on the map and choose Team up. Crewmates who are online get a banner wherever they
    are in the game, join with the hero they used last, and wait in a lobby until the host attacks.
  - **Proposed:** one phone, the host, runs the rules and the others follow it (see Multiplayer).
    Only one crew's members can team up, so a raid is up to 5 people. Everyone gets the win, the
    island and the loot on their own phone.
  - A Medic can't take an island alone, so Attack waits for a teammate who can hurt buildings.

## Hero upgrade trees

**Proposed, planned 2026-11-01, not built yet:** a tree for each hero, paid in gold and four
crystals, with a reward that changes every two weeks beyond it. The full plan is in
`docs/HERO_TREES.md`.

## Accounts and profiles

**Decided 2026-11-01 (owner's request):** players can create an account and a profile.

- The profile opens from the crew bar: a player icon (14 to choose from), a name, stats, the crew
  and its invite code, and the account.
- Settings has Reset account (Reset game without an account). It asks for the account's password,
  then asks once more. It wipes progress and the player's own island and leaves their crew, since
  a crew's island is shared. The account, name, icon and settings stay.
- The crew bar only shows everyone's pictures. A picture's border glows green while they're online.

**Proposed:** an account is a username and password with no email, so a lost password can't be
recovered. It's optional, and it holds the player's save, so logging in on another phone brings
their progress with them. If one account is used on two phones at once, the last to save wins.

## World map

**Decided:** the crew's island sits in the middle, nearby islands are visible, and clouds cover
everything beyond. **Proposed:** the Lookout Tower's level sets how far the clouds are pushed back.

**Decided 2026-10-30:**

- The way in is on foot: unlocked heroes stroll slowly and at random round the base. Tap one to
  open their upgrades and RAID, which opens the map. There's no separate raid button on the island.
- The map is a deep blue sea with small 3D islands, framed by thick cloud at the screen's edges.
  Every island has a plate with its headquarters level and difficulty (Easy, Fair, Hard, Deadly,
  relative to your HQ). Tapping one shows its defenses and loot, with Attack. The only other
  control is Return to island.
- Islands lie organically, in loose chains and open water, not in a ring. Their coasts and sizes
  vary.
- **Scouting:** the island card also has Scout, a free look over the real base before attacking,
  and free of charge. Drag and pinch round it. Every defense is listed with how many and its
  highest level, red ground shows what's in range, and tapping a building gives its level and
  numbers. From there it's Attack or Back to map. Mines stay hidden, as they do in a raid.

**Decided 2026-11-01 (owner's request): the world never ends.**

- It's one fixed sea of islands, and you drag and pinch round it. Only a splotch of sky round home
  starts clear, and everything else lies under cloud. The map always says how many more islands
  it'll take to lift the next splotch.
- One small splotch of cloud lifts for good every 3 islands won (**changed 2026-11-02**, owner's
  request). Splotches are irregular, not a grid, and each clears the nearest hidden island to home,
  leaning away from whichever side has seen the most, so the map grows evenly wherever the fighting
  is. Half the charted islands are left out as open sea, the map opens more slowly than a crew
  conquers it, and more cloud only lifts early if they'd have fewer than two islands to raid.
  Islands a crew holds keep a small clearing each. Older maps shrink to match when they load: each
  region they'd opened becomes one splotch. Clear sky is drawn as one joined stretch with a smooth
  shore, so no strands of cloud are left between islands, and the shallows of islands close together
  run into each other.
- Islands get harder with distance, up to headquarters 50. (Before 2026-11-07, beyond HQ 20 a base
  couldn't grow, so its buildings kept gaining levels instead.)
- A beaten island is yours until raiders retake it. Each night they retake 0, 1 or 2 of your
  islands. It comes back stronger than it was and at least as strong as your own HQ, with every
  building its headquarters allows, all at full level.

**Proposed:** one world for every crew, islands charted in regions of 6 to 8, roughly one more HQ level every
34 map units from home, and progress kept on each phone, not on the crew server. A lost raid can
be tried again as often as you like, and materials are kept win or lose.

## Day and night

**Decided 2026-11-01:**

- The game's time of day follows the real sun where the player is. The whole game follows it: the
  crew island, raids, scouting, replays and the world map, but not the hero pedestal, which stays
  in steady daylight so heroes are easy to look at.
- The game asks once, in its own small card, to use the phone's location. It's rounded to about
  10 km, stays on the phone, and never goes in the save or to the server. Saying no gives a sky
  worked out from the phone's time zone, and Settings can change that answer later.
- Mornings are pinker and evenings more orange.
- The moon is real too: it's where the real moon is, in its real phase, and its light and shadows
  come and go with both. A full moon gives a blue light and soft shadows. A new moon gives no moon
  light and no shadows, only lamps and starlight, and stars show more. When the moon is below the
  horizon, it's dark the same way.
- The jungle goes darker than the open ground at night, so clearings and lit bases stand out.
- A few fireflies blink over the land after dark.
- From dusk, buildings keep lamps, heroes carry a soft light, and guns, rockets, fires and
  explosions throw light on the ground. Storages and land mines stay dark.
- Battery comes first. The sky updates every few seconds, not every frame. Lamps, flashes and
  fireflies are small instanced quads, not real lights, and aren't drawn by day. Moon shadows
  redraw at half the sun's rate, and on moonless nights shadows aren't drawn at all.

## Art direction

**Decided** (refined over many image rounds):

- **Effects (Decided 2026-11-01):** no plain spheres. Blasts are a flash, flame rolling up into
  soot, thrown dust, sparks, tumbling debris, a shockwave and a scorch mark that stays a while.
  Hurt buildings burn, and destroyed ones come down into their rubble rather than vanishing.
- **The Rifleman's animation (Proposed):** procedural, not clips. He runs with the rifle across
  his chest, shoulders it to aim, strafes with his legs while his chest stays on target, kicks
  with each shot, works the bolt between bursts, flinches, falls and cheers. Other heroes keep
  their simple walk until the owner has seen this one.

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
  - One per crew island. It saves the base and its timers, and passes raid messages between phones.
  - **Proposed (built 2026-11-01):** the host's phone runs a raid's rules. Guests send controls 20
    times a second and get snapshots 12 times a second, moving their own hero at once. The original
    plan was a raid server of its own, which is still the way to stop a host cheating or a raid
    ending when the host's phone drops out.
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

**Sound (Decided 2026-11-01, owner's request):** recorded effects and a different track for home,
heroes, the map, scouting, raids and night raids, all CC0 (`public/audio/CREDITS.md`). Haptics are
on where the phone allows: see `src/game/audio/haptics.ts`.

### Draft status (2026-10-29)

Steps 1–3 exist as a first playable draft with placeholder models, at the owner's request
("T-pose models first, rough draft of the game before animating"). The draft has:

- **Look:** Three.js in landscape with the MOBA camera.
- **Islands:** generated islands, with the same buildings per HQ level and different layouts.
- **Heroes:** all 7 heroes, with their attacks from the Proposed table.
- **Enemies:** defenses that shoot back (gun turret, mortar with its blind spot, harpoon,
  flamethrower) and hidden beach mines.
- **Gunboat:** walking back to the boat, boarding, the targeting view, the three abilities and
  escalating energy costs.
- **Raid rules:** no respawns, a 5-minute timer, and results.

Heroes are simple primitives with a procedural walk, not rigged models yet. The menus show the
Rifleman's TRELLIS model (arms lowered from its T-pose by a script) on the hero-select pedestal.

Choices made while building the draft. All are **Proposed**:

- **Island difficulty:** the hero-select screen offers HQ levels 1–3, named Outpost, Fort and
  Stronghold, shown with 1–3 stars.
- **Cover:** rocks block shots both ways. Sandbags are gone from the game (Decided 2026-11-01).
- **Non-attacking buildings:** the headquarters doesn't attack. The watchtower is a sniper (**Decided 2026-11-02**, owner's request): the longest reach of any direct-fire defense, one hard shot at a time, after holding its aim for a moment with a red beam and a ring on the ground that anyone can see. Stepping aside once the beam stops moving dodges it.
- **Starting energy:** the crew starts with 10 gunboat energy. Defenses give 4–5 when destroyed,
  other buildings 3.
- **Firing:** holding the aim fires continuously, and a quick tap fires at the nearest building
  for a moment.
- **The Medic's bottles (Decided 2026-11-01):** she locks onto crewmates, not buildings: drag to
  pick one, or tap for whoever's worst hurt. A bottle heals everyone where it lands, herself too.
- **Enemy bases are crew bases (Decided 2026-10-30, puzzle islands excepted since 2026-11-03):** an enemy base is generated by the crew
  island's own rules: buildings on 2 m tiles, as many of each as its headquarters level allows,
  upgraded within the same level caps. Outpost is HQ 1, Fort HQ 6, Stronghold HQ 12. Each level
  adds 12% health and damage in a raid (**Proposed**). A crew's island and an enemy's are the
  same kind of thing.
- **Nightly raid (Decided 2026-10-30, reworked 2026-11-07 round raider ships, see there):** once a day (3:00 local time) AI raiders land on the crew's
  island. It's an ordinary raid with the crew's buildings as the target, simulated from a seed,
  so the replay is the same raid run again. The Night raid button shows the next raid and the
  last result, with Raid now to trigger one and Watch replay.
  - **Proposed:** raiders are 1 + HQ/3 heroes at 0.3 + 0.055 × HQ strength; there's no penalty
    for losing yet; each phone runs its own raid, not the crew server.
- **Defense reach (raised 2026-11-01, owner's request):** gun turret 21 m, harpoon 25 m, mortar 34 m
  with a 5.5 m blast, flamethrower 9.5 m. Most heroes are now outranged. Since 2026-11-02: mortar
  26 m with a 4.5 m blast, flamethrower 11.5 m.
- **Base layout (Decided 2026-11-01, owner's request):** the headquarters stands in the middle with
  defenses in rings all round it, so every way in is under fire. Mills and storages lie outside.
- **Loot (Decided 2026-11-01, owner's request):** breaking a mill or a storage pays out that
  material, on top of a raid's gold. **Proposed:** a storage pays 2.5 times a mill, and both rise
  30% a level.
- **Defense strength (raised 2026-10-30, owner's request, for more strategy):** gun turret 50
  damage every 0.42 s, mortar 220 every 3.6 s, harpoon 230 every 2.6 s, flamethrower 28 every 0.13
  s. That's about 65% more damage per second than the first draft. Since 2026-11-02: gun turret 38
  every 0.3 s, mortar 220 every 4.32 s.
- **Balance check:** a unit test makes sure a bot rifleman can usually beat a level-1 island solo
  (in tuning it won 4 of 8). Nothing else is balanced yet.
