# Hero upgrade trees

**Status: reshaped 2026-11-03, except Tides.** The owner's rules are Decided: a tree for each hero,
gold plus four crystals, no upgrade that adds range, and every tier held back until the
headquarters reaches a level, so a hero is only as strong as the islands the crew can reach. Since
the reshape, the tree is one line until headquarters 5, splits in two, and splits again after
headquarters 12, so it's simpler for new players, and it isn't sorted by crystal. Since
2026-11-03's second pass, three minis sit between every two upgrades, the trunk's second upgrade
has two short side paths of its own, and the board has no labels, over a background that slides
along as it scrolls. Every name and number here is a draft to confirm. The two-week Tides abilities
aren't built yet.

The owner's reference art is `docs/concept/ui-upgrade-tree.webp` for the screen and
`docs/concept/crystals.png` for the crystals. They like the crystal design specifically.

## How a tree works

Every hero has the same shape, 24 upgrades in all, with three minis on each line between two of
them: 93 things to buy. Each needs the one before it on its line.

```
             ┌── Sapper ─ side upgrade                 ┌── last branch: 8 ─ 9 ─ capstone
             │                    ┌── Assault:  5 ─ 6 ─ 7┤
             │                    │                      └── last branch: 8 ─ 9 ─ capstone
   first ─ 2 ┼── 3 ─ 4 ───────────┤
             │  (the trunk,       │                      ┌── last branch: 8 ─ 9 ─ capstone
             │   Basics)          └── Survival: 5 ─ 6 ─ 7┤
             └── Scrapper ─ side upgrade                 └── last branch: 8 ─ 9 ─ capstone
```

- **The trunk** (Basics), up to headquarters 5: the hero's first upgrade, more health, more
  damage, then whatever makes the hero's own weapon quicker.
- **Two side paths** leave the trunk's second upgrade, at headquarters 3, and lead nowhere else:
  three minis then one of the hero's own. Sapper is for knocking things down (more damage to
  buildings or defenses, a wider burst, or a steadier gun), Scrapper for lasting (less from blasts,
  or healing whenever a building goes down).
- **Assault** and **Survival**, headquarters 7 to 11: Assault hits harder and fires faster, with a
  wider blast for heroes whose shots burst; Survival is health, less damage taken (stronger healing
  for the Medic) and move speed.
- **The four last branches**, headquarters 13 to 19, are the hero's own: Assault leads on to their
  fire and ice branches, Survival to their nature and dark ones. Each opens with a special, has a
  plain step, and ends in a capstone.

**Crystals:** an upgrade on the trunk or the first two branches is paid for in the crystal of what
it does: nature for health and healing, fire for damage and blasts, ice for speed and fire rate.
Each last branch is paid for in its own crystal. The first upgrade keeps the crystal it always had.
The Heavy's upgrades that make his gun stronger do 15% less, as since 2026-11-03.

| Tier | Gold   | Crystals | Each mini into it | Opens at headquarters |
| ---- | ------ | -------- | ----------------- | --------------------- |
| 1    | 150    | 1        | -                 | 1                     |
| 2    | 500    | 1        | 150               | 2                     |
| 3    | 900    | 2        | 250               | 3                     |
| 4    | 1,400  | 2        | 400               | 5                     |
| 5    | 2,200  | 3        | 550               | 7                     |
| 6    | 3,200  | 3        | 750               | 9                     |
| 7    | 4,400  | 4        | 1,000             | 11                    |
| 8    | 6,000  | 4        | 1,300             | 13                    |
| 9    | 8,000  | 5        | 1,700             | 16                    |
| 10   | 11,000 | 6        | 2,200             | 19                    |

A tree costs 124,350 gold for its upgrades and 80,100 for its minis.

**Minis:** three sit on each of the 23 lines between upgrades, bought with gold alone, in order,
and opening with the upgrade they lead to. Each gives 1.5% (on the trunk) to 3% (into a capstone)
of something, taken in turn along its stretch so neighbours differ: health, damage, move speed and
the hero's own weapon on the trunk; damage to buildings and defenses on Sapper; health, armor and
speed on Scrapper; damage, fire rate, damage to defenses and the weapon on Assault; health, speed,
armor and blasts on Survival; and on the last branches what that branch is about. Each kind has a
few names (Toughness, Stamina, Thick Skin...) used in turn. How fast a burst unloads, a minigun
spins up, a throw lands or a shell flies count double, because they do less.

**Fully upgraded,** a hero has about 2 to 2.4 times their health and about twice their damage,
takes 13 to 34% less damage, does 15 to 90% more to defenses, and fires 1.4 to 2.6 times as fast,
depending on the hero. Only at headquarters 19.

**Old saves:** everything bought on an older tree, the two-path trees, the four-branch trees or
the first trunk trees with one checkpoint a line, was given back when this one came in: the
crystals to the player, and the gold to the island, paid into its stock as there's room for it. An
upgrade a headquarters doesn't yet allow is given back the same way.

## Rifleman: Sgt. Steele

First: **Basic Training**, +10% health. Last on the trunk: **Smooth Action**, bullets leave a burst
20% quicker. Side paths: **Hollow Points**, +15% damage to buildings. **Scavenger**, destroying a
building heals 5%.

| Last branch      | Opens with (tier 8)                                                      | Capstone (tier 10)                                                                    |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Fire: Marksman   | **Deadeye**: +25% damage to defenses.                                    | **Steady Hands**: One more bullet in every burst.                                     |
| Ice: Skirmisher  | **Run and Gun**: Moves at 40% speed while firing, not 20%.               | **Fast Unload**: Bursts fire 40% quicker.                                             |
| Nature: Survivor | **Thick Vest**: Takes 15% less damage.                                   | **Last Stand**: Enrages below 30% health: fires 40% faster and takes 25% less damage. |
| Dark: Veteran    | **Field Dressing**: Heals 3% a second after 4 seconds without being hit. | **Ricochet**: Bullets bounce off a building into the next one.                        |

## Medic: Doc Penny

First: **Steady Hand**, +15% healing. Last on the trunk: **Flat Throw**, bottles land 15% sooner.
Midway up Survival: **Strong Brew**, +12% healing. Side paths: **Big Bottles**, bottles burst 0.5 m
wider. **Thick Gloves**, takes 20% less from blasts.

| Last branch            | Opens with (tier 8)                                                          | Capstone (tier 10)                                                              |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Fire: Alchemist        | **Wide Splash**: Bottles burst 1.5 m wider.                                  | **Miracle Bottle**: Every 5th bottle heals double, and bursts twice as wide.    |
| Ice: Combat Medic      | **Ice Pack**: Healed crewmates move 20% faster for 3 seconds.                | **Adrenaline**: Healed crewmates fire 20% faster for 3 seconds.                 |
| Nature: Field Hospital | **Lingering Dose**: Healing carries on for 3 seconds after the bottle lands. | **Overheal**: Healing past full health becomes a shield worth up to 20% health. |
| Dark: Guardian         | **Corrosive Acid**: +25% damage to defenses.                                 | **Guardian Angel**: Twice a raid, a fallen hero gets back up with 40% health.   |

## Tank: Tilly & Tank

First: **Extra Plating**, +15% health. Last on the trunk: **Hot Charge**, shells fly 20% faster.
Midway up Assault: **Bigger Bang**, +0.5 m splash. Side paths: **Dozer Blade**, +15% damage to
buildings. **Scrap Welder**, destroying a building heals 5%.

| Last branch        | Opens with (tier 8)                                        | Capstone (tier 10)                                                                          |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Fire: Wrecker      | **Bunker Buster**: +30% damage to buildings.               | **Twin Barrels**: Every 4th shot fires two shells.                                          |
| Ice: Panzer        | **Bulldozer**: Moves at 45% speed while firing.            | **Autoloader**: Fires 25% faster.                                                           |
| Nature: Fortress   | **Field Repairs**: Heals 2% a second while standing still. | **Siege Mode**: After 2 seconds standing still: fires 30% faster and takes 40% less damage. |
| Dark: Siege Engine | **Reactive Armor**: Takes 20% less from blasts.            | **Aftershock**: Whatever it destroys goes up in a shockwave that can set off the next.      |

## Heavy: Big Mo

First: **Warm Up**, minigun spins up 17% faster. Last on the trunk: **Greased Barrels**, spins up
17% faster. Side paths: **Steady Stance**, 25% less spread. **Flak Vest**, takes 20% less from
blasts.

| Last branch        | Opens with (tier 8)                                                                                | Capstone (tier 10)                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Fire: Gunner       | **Tight Barrels**: 40% less spread.                                                                | **Overdrive**: After 5 seconds of non-stop fire, fires 21% faster. |
| Ice: Rolling Fire  | **Rolling Thunder**: Moves at 45% speed while firing.                                              | **Hair Trigger**: Spins up 34% faster.                             |
| Nature: Juggernaut | **Harpoon Hide**: Harpoons lose their bonus damage against him.                                    | **Iron Gut**: Heals 2% a second while firing.                      |
| Dark: Berserker    | **Berserk**: Enrages after taking 500 damage: for 6 seconds, fires 43% faster and can't be slowed. | **Explosive Belt**: At full spin, every 6th round explodes.        |

## Bazooka: Ace

First: **Quick Loader**, reloads 10% faster. Last on the trunk: **Hot Motor**, rockets fly 20%
faster. Midway up Assault: **Bigger Bang**, +0.5 m splash. Side paths: **Shaped Charge**, +15%
damage to defenses. **Blast Goggles**, takes 20% less from blasts.

| Last branch       | Opens with (tier 8)                                  | Capstone (tier 10)                                                     |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Fire: Demolition  | **Napalm**: Blasts leave fire burning for 3 seconds. | **Cluster Warhead**: Rockets throw out 5 bomblets where they burst.    |
| Ice: Hit and Run  | **Fast Rockets**: Rockets fly 40% faster.            | **Getaway**: +30% move speed for 2 seconds after each shot.            |
| Nature: Daredevil | **Blast Shield**: Takes 25% less from blasts.        | **Second Wind**: Destroying a building heals 15%.                      |
| Dark: Trickshot   | **Double Tap**: Holds two rockets before reloading.  | **Guided Rocket**: Rockets curve round cover to reach a locked target. |

## Grenadier: Mr. Pemberton

First: **Bigger Charge**, +10% damage. Last on the trunk: **Light Grenades**, grenades land 15%
sooner. Midway up Assault: **Bigger Bang**, +0.5 m splash. Side paths: **Sticky Bombs**, +15% damage
to buildings. **Tin Helmet**, takes 20% less from blasts.

| Last branch            | Opens with (tier 8)                                                            | Capstone (tier 10)                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Fire: Ordnance         | **Twin Grenades**: Every 3rd throw is two grenades.                            | **Skipping Stone**: Grenades skip on for two more blasts.                                  |
| Ice: Quick March       | **Short Fuse**: Grenades land 40% sooner.                                      | **Rapid Lob**: Throws 30% faster.                                                          |
| Nature: Old Campaigner | **Tea Break**: Destroying a building heals 15%.                                | **Last Orders**: Enrages below 30% health: throws 40% faster and takes 25% less damage.    |
| Dark: Saboteur         | **Mine Sweeper**: Shows every mine, and blasts set them off from twice as far. | **Smoke Shell**: Every 5th grenade leaves smoke: defenses can't aim into it for 4 seconds. |

## Engineer: Gus

First: **Spare Parts**, fires 10% faster. Last on the trunk: **Oiled Gears**, shots fly 20% faster.
Side paths: **Scrap Rounds**, +15% damage to defenses. **Toolbelt**, destroying a building heals 5%.

| Last branch       | Opens with (tier 8)                                       | Capstone (tier 10)                                                                 |
| ----------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Fire: Salvager    | **Armor Piercing**: +25% damage to defenses.              | **Salvage**: Everything he destroys comes back as his turret for a while.          |
| Ice: Mechanic     | **Overclock**: His turrets fire 30% faster.               | **Rapid Fire**: Fires 25% faster.                                                  |
| Nature: Medic Bay | **Patch Up**: Destroying a building heals 10%.            | **Repair Beam**: Slowly repairs the Tank and turrets near him.                     |
| Dark: Gadgeteer   | **Pocket Turret**: Drops a small turret every 30 seconds. | **Decoy Drone**: Every 30 seconds, a drone draws the defenses' fire for 6 seconds. |

## The two-week reset: Tides

Past a hero's capstones lies their **Tide**: three upgrades that last two weeks, then lock again as
the next Tide rolls in. A hero's Tide opens once they own a capstone, so nobody has to finish a whole
tree first.

- Every hero gets the same Tide at the same time. It's worked out from the date, so it needs no
  server and works offline.
- The first two upgrades are shared by every hero. The third is that hero's own twist.
- Crystals spent on a Tide aren't refunded. That gives crystals a use once the trees are full.
- Tides work in raids, solo or with a crew, and never for night raiders.
- The six Tides come round in a shuffled order, and all six run before any repeats. New ones are
  just more rows of data.

| Upgrade      | Gold  | Crystals                         |
| ------------ | ----- | -------------------------------- |
| First        | 2,000 | 3 of the Tide's crystal          |
| Second       | 3,000 | 4 of the Tide's crystal + 1 dark |
| Hero's twist | 5,000 | 5 of the Tide's crystal + 3 dark |

### Storm Season (ice crystals)

1. Every 10th hit calls down lightning.
2. Lightning jumps to one more building.

| Hero      | Twist                                                               |
| --------- | ------------------------------------------------------------------- |
| Rifleman  | A burst that lands every bullet calls lightning.                    |
| Medic     | Bottles charge crewmates: their next 3 hits call lightning.         |
| Heavy     | At full spin, lightning strikes his target every 5 seconds.         |
| Tank      | Each shell calls lightning on every defense in its blast.           |
| Bazooka   | Rockets throw sparks at buildings they fly past.                    |
| Grenadier | Lightning jumps from a grenade to the nearest mine and sets it off. |
| Engineer  | His turrets fire bolts that jump between buildings.                 |

### Blood Tide (nature crystals)

1. Every hit heals 1%.
2. Destroying a building: fire 30% faster for 5 seconds.

| Hero      | Twist                                                   |
| --------- | ------------------------------------------------------- |
| Rifleman  | Under half health, bullets heal double.                 |
| Medic     | Bottles heal an extra 5% for every crewmate they reach. |
| Heavy     | Healing doubles at full spin.                           |
| Tank      | Destroying a building restores 10% health.              |
| Bazooka   | A direct hit on a defense heals 8%.                     |
| Grenadier | Each building a blast reaches heals 3%.                 |
| Engineer  | His turrets' hits heal him too.                         |

### Ghost Fleet (dark crystals)

1. Destroying a defense leaves a ghost of you fighting there for 5 seconds.
2. Ghosts last twice as long.

| Hero      | Twist                                                           |
| --------- | --------------------------------------------------------------- |
| Rifleman  | A ghost rifleman fires alongside every burst.                   |
| Medic     | A ghost medic follows the most hurt crewmate, throwing bottles. |
| Heavy     | His ghost walks ahead, drawing fire.                            |
| Tank      | A ghost tank charges the nearest defense, then bursts.          |
| Bazooka   | A ghost rocket follows each real one, 1 second behind.          |
| Grenadier | Every grenade lands a second time, 2 seconds later, as a ghost. |
| Engineer  | His turrets come back as ghosts once, after they're destroyed.  |

### Molten Core (fire crystals)

1. Shots leave burning ground for 2 seconds.
2. Destroyed buildings erupt, throwing fire around them.

| Hero      | Twist                                                                         |
| --------- | ----------------------------------------------------------------------------- |
| Rifleman  | The last bullet of each burst is molten: double damage and burning ground.    |
| Medic     | Bottles leave warm ground: crewmates standing on it heal and fire 15% faster. |
| Heavy     | Heat builds as he fires: up to +40% damage, and his path burns.               |
| Tank      | Its tracks leave a burning trail.                                             |
| Bazooka   | Rockets leave a line of fire behind them.                                     |
| Grenadier | Grenades roll on, burning, for 3 m.                                           |
| Engineer  | His turrets burn whatever they hit.                                           |

### Deep Freeze (ice crystals)

1. Hit defenses fire 20% slower for 3 seconds.
2. A defense hit 10 times freezes solid for 2 seconds.

| Hero      | Twist                                                         |
| --------- | ------------------------------------------------------------- |
| Rifleman  | Every 3rd burst freezes a defense's aim for 1 second.         |
| Medic     | Bottle bursts chill any defense they reach, and hurt nothing. |
| Heavy     | The longer he fires at one defense, the slower it gets.       |
| Tank      | Shell blasts chill everything inside them.                    |
| Bazooka   | A direct hit freezes a defense for 3 seconds.                 |
| Grenadier | Grenades leave ice: defenses inside it can't turn.            |
| Engineer  | His turrets' hits chill.                                      |

### Treasure Tide (nature crystals)

1. +30% gold and materials from raids.
2. Each mill or storage has a 1 in 4 chance of dropping a crystal, one a raid at most.

| Hero      | Twist                                                        |
| --------- | ------------------------------------------------------------ |
| Rifleman  | Breaking a defense also pays gold.                           |
| Medic     | Crewmates near her when a raid ends each get +10% gold.      |
| Heavy     | Every 100 rounds fired at a building shakes loose some gold. |
| Tank      | Shockwaves and blasts pay double loot on what they destroy.  |
| Bazooka   | A rocket that destroys a building pays +50% loot on it.      |
| Grenadier | Each mine set off safely pays gold.                          |
| Engineer  | Salvaged parts: each turret kill pays materials.             |

## What building it involves

- The save swaps hero levels for each hero's owned upgrades, and adds a crystal wallet. Gold already
  spent on levels is handed back when an old save loads.
- A raid seat carries the upgrades a player owns, so crewmates' heroes are right on the host's phone.
- Enrage, shields, ghosts, lightning and burning ground are new rules. Plain stat upgrades only need
  numbers.
