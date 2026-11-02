# Asset prompts: environment, buildings and the gunboat

Gemini prompts for every non-character model in the game, written to feed an image-to-3D tool
(Tripo, Meshy) the same way as the hero T-poses in [concept/tpose/](concept/tpose/).

## How to use these

- **One object per image.** Each prompt asks for a single object on a plain white background,
  because image-to-3D tools model one thing at a time.
- **Attach the reference image named in each section.** Gemini copies a style much more
  faithfully from an attached image than from words.
- **For a family of variants:** once the first one looks right, attach it too and say "same
  style as the second image". For example, attach `palm-1` when making `palm-2` to `palm-5`.
  That keeps every tree and rock looking like part of one set.
- **Get more angles:** after a front three-quarter view comes out well, follow up with "Now show
  exactly the same object from the back, same background and lighting". Image-to-3D builds a
  better model from several views.
- **Save with the file name given** (for example `palm-2.png`) in the project folder. I'll file
  them and the finished `.glb` models.
- **What Gemini overdid last time:** "low poly", "toy" and "clay" each took the look too far, and
  "rust" brought back realistic rust. The prompts below avoid those words or rule them out. If an
  image comes out too detailed, a follow-up edit like "simpler: fewer, bigger shapes, remove small
  details" works better than rewriting the prompt.

### Real sizes

For scaling the models in game. A hero is about 1.8 m tall.

| Object             | Size                         |
| ------------------ | ---------------------------- |
| Palm tree          | 6–9 m tall                   |
| Bush               | 1–1.6 m                      |
| Boulder (cover)    | 1.5–3.5 m across             |
| Gun turret         | 4.5 m tall                   |
| Mortar, harpoon    | 3.6 m tall                   |
| Flamethrower tower | 4 m tall                     |
| Watchtower         | 9 m tall                     |
| Resource buildings | about 3–4 m tall, 6 m across |
| Refinery           | 6.5 m tall (chimney)         |
| Headquarters       | about 14 m tall, 12 m across |
| Beach mine         | 0.9 m across                 |
| Gunboat            | about 6.5 m long             |

## Nature

**Attach:** `docs/concept/raid-topdown-crew.jpeg` (its palms, bushes and rocks are the target).

### palm-1: classic palm

```text
Use the palm trees in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors with soft gradients, no grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a tall tropical palm tree with a gently curving trunk made of a few chunky segments, a crown of seven big glossy green leaves, and a small cluster of brown coconuts under the leaves. Three-quarter view from slightly above, centered, the whole tree in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### palm-2: leaning beach palm

```text
Use the palm trees in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors with soft gradients, no grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a beach palm tree whose chunky segmented trunk leans and curves strongly to one side, with a crown of big drooping green leaves and three coconuts. Three-quarter view from slightly above, centered, the whole tree in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### palm-3: young palm

```text
Use the palm trees in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors with soft gradients, no grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a short young palm, about half the height of a grown palm, with a thick short trunk and a full bushy crown of big green leaves reaching almost to the ground. Three-quarter view from slightly above, centered, the whole tree in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### palm-4: twin palm

```text
Use the palm trees in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors with soft gradients, no grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: two palm trees growing from one shared base, their chunky segmented trunks curving gently apart, one taller than the other, each with a crown of big green leaves. Three-quarter view from slightly above, centered, the whole object in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### palm-5: tall straight palm

```text
Use the palm trees in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors with soft gradients, no grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a very tall, almost straight palm tree with a slim chunky segmented trunk and a compact crown of big green leaves at the top, with a few coconuts. Three-quarter view from slightly above, centered, the whole tree in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### bush-1: round leafy bush

```text
Use the bushes in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors with soft gradients, no grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a round tropical bush made of a few big rounded clumps of glossy green leaves in two shades of green. Three-quarter view from slightly above, centered, the whole bush in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### bush-2: fern

```text
Use the bushes in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors with soft gradients, no grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a tropical fern plant with long arching green fronds spreading out from the center like a fountain. Three-quarter view from slightly above, centered, the whole plant in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### bush-3: flowering bush

```text
Use the bushes in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors with soft gradients, no grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a rounded tropical bush of big glossy green leaves with five or six simple bright pink and orange hibiscus flowers. Three-quarter view from slightly above, centered, the whole bush in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### grass-1: grass tuft

```text
Use the grass in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors, no fine patterns. Not clay, not low poly, not realistic. One single object: a small tuft of six or seven thick, smooth, pointed grass blades in fresh green, fanning out from one spot. Three-quarter view from slightly above, centered, plain white background, even flat lighting, no shadows, no text.
```

### rock-1: big boulder

```text
Use the rocks in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid warm grey color with soft gradients, no cracks, grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a big rounded boulder with a few broad flat faces, wider than it is tall, the kind a soldier could crouch behind. Three-quarter view from slightly above, centered, the whole rock in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### rock-2: flat rock

```text
Use the rocks in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid warm grey color with soft gradients, no cracks, grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a wide, low, flat-topped rock slab with softly rounded edges. Three-quarter view from slightly above, centered, the whole rock in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### rock-3: boulder cluster

```text
Use the rocks in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid warm grey colors with soft gradients, no cracks, grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a group of three rounded boulders of different sizes leaning together, with one small tuft of green grass at the base. Three-quarter view from slightly above, centered, the whole group in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### rock-4: standing rock

```text
Use the rocks in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid warm grey color with soft gradients, no cracks, grit, noise or fine patterns. Not clay, not low poly, not realistic. One single object: a tall standing rock, taller than it is wide, with a few broad smooth faces and a rounded top. Three-quarter view from slightly above, centered, the whole rock in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### rock-5: small stones

```text
Use the rocks in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid warm grey and sandy colors, no cracks, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a small scattered group of five smooth rounded stones of different sizes, like on a beach. Three-quarter view from slightly above, centered, the whole group in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### rock-6: grassy rock ledge

```text
Use the rocky ledges in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid warm grey rock and smooth solid green grass, no cracks, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a chunk of low rocky ledge, about three times as wide as it is tall, with a smooth cap of green grass on top hanging slightly over the edge. Three-quarter view from slightly above, centered, the whole piece in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### driftwood-1: driftwood log

```text
Use the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth pale grey-brown wood color with a few simple lines, no grit or fine patterns. Not clay, not low poly, not realistic. One single object: a smooth bleached driftwood log lying on its side with one short stubby branch. Three-quarter view from slightly above, centered, the whole log in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

## Cover and small props

**Attach:** `docs/concept/raid-topdown-crew.jpeg` (its sandbag walls, crates and barrels).



### crates-1: crate stack

```text
Use the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid wood colors with a few simple plank lines, no grit or fine patterns. Not clay, not low poly, not realistic. One single object: a stack of three chunky wooden supply crates with rounded edges, two on the bottom and one on top, painted charcoal and orange bands on the corners. Three-quarter view from slightly above, centered, the whole stack in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### barrels-1: oil drums

```text
Use the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no rust, dents, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a group of three chunky oil drums with rounded rims, two standing and one lying on its side, painted charcoal and burnt-orange. Three-quarter view from slightly above, centered, the whole group in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

## Enemy buildings

**Attach:** `docs/concept/raid-topdown-crew.jpeg` and `docs/concept/raid-topdown-simple.jpeg`.
Between them they show the turret, mortar, watchtower, storehouse and fort.

Every enemy building uses the same color rule: painted charcoal and burnt-orange, plus sandbags,
bamboo and tin roofs, and never blue. That's why each prompt repeats "painted" and "no blue".

### hq: headquarters fort

```text
Use the enemy fort in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors with soft gradients, no rust spots, cracks, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a big chunky military headquarters fort painted charcoal with burnt-orange trim and no blue: a square two-level keep with a wide wooden gate, four round corner towers with burnt-orange roofs, a ladder on one side, and a flagpole with a plain burnt-orange flag on top. It should look like the most important building on the island. Three-quarter view from slightly above, centered, the whole fort in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### gun-turret: gun turret

```text
Use the gun turrets in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no rust spots, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a chunky gun turret with a twin-barrel gun on a rotating housing, mounted on a round metal base, painted charcoal and burnt-orange with no blue. Three-quarter view from slightly above, centered, the whole turret in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### mortar: mortar pit

```text
Use the mortars in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no rust spots, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a mortar pit: a short fat mortar tube angled up at the sky on a sturdy base, with a small ammo crate beside it, painted charcoal and burnt-orange with no blue. Three-quarter view from slightly above, centered, the whole pit in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### harpoon: harpoon launcher

```text
Use the defenses in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no rust spots, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a big harpoon launcher like a giant mounted crossbow: a wide bow arm and a long harpoon with a metal tip, on a rotating post over a square base, painted charcoal and burnt-orange with no blue. Three-quarter view from slightly above, centered, the whole launcher in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### flamethrower: flamethrower tower

```text
Use the defenses in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no rust spots, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a short round flamethrower tower with a big round fuel tank on top and a short nozzle pointing out on a swivel, with two small pipes, painted charcoal and burnt-orange with no blue, not firing. Three-quarter view from slightly above, centered, the whole tower in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### watchtower: bamboo watchtower

```text
Use the bamboo watchtowers in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors, bamboo with simple ring lines, no grit or fine patterns. Not clay, not low poly, not realistic. One single object: a tall bamboo watchtower on four slightly splayed legs with cross braces, a square wooden platform with a bamboo railing near the top, and a pointed grey tin roof. Three-quarter view from slightly above, centered, the whole tower in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### gold-mine: gold mine

```text
Use the enemy buildings in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors with soft gradients, no grit or fine patterns. Not clay, not low poly, not realistic. One single object: a gold mine: a rounded grey rock mound with a wooden mine entrance framed by beams, a small mine cart painted burnt-orange, and a little pile of shiny gold nuggets. No blue. Three-quarter view from slightly above, centered, the whole mine in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### lumber-camp: lumber camp

```text
Use the enemy buildings in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors, wood with a few simple lines, no grit or fine patterns. Not clay, not low poly, not realistic. One single object: a lumber camp: a small charcoal-painted shed with a sloped tin roof, a neat stack of big round logs beside it, and a chopping stump with an axe. No blue. Three-quarter view from slightly above, centered, the whole camp in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### quarry: stone quarry

```text
Use the enemy buildings in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors, no cracks, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a stone quarry: a neat pile of chunky cut grey stone blocks with rounded edges and a small charcoal-and-burnt-orange crane arm lifting one block. No blue. Three-quarter view from slightly above, centered, the whole quarry in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### scrap-yard: scrap yard

```text
Use the enemy buildings in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no rust spots, dents, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a tidy scrap yard: a pile of chunky metal sheets, pipes, an old wheel and a barrel, painted charcoal, grey and burnt-orange, inside a short wooden fence. No blue. Three-quarter view from slightly above, centered, the whole yard in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### storehouse: storehouse

```text
Use the storehouse in the attached images (the charcoal box with orange straps) as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no rust spots, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a chunky storehouse shaped like a big rounded strongbox, painted charcoal, wrapped by two wide burnt-orange straps, with a burnt-orange roll-up door at the front, on a low concrete base. No blue. Three-quarter view from slightly above, centered, the whole building in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### refinery: refinery

```text
Use the enemy buildings in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no rust spots, grit or fine patterns. Not clay, not low poly, not realistic. One single object: a small refinery: two round storage tanks with burnt-orange bands, connected by chunky pipes to a tall charcoal chimney with a burnt-orange top, on a concrete base. No blue. Three-quarter view from slightly above, centered, the whole refinery in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### mine: beach mine

```text
Use the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no grit or fine patterns. Not clay, not low poly, not realistic. One single object: a round flat beach mine painted dark charcoal, half buried in a small mound of smooth sand, with a small burnt-orange trigger button on top. Three-quarter view from slightly above, centered, plain white background, even flat lighting, no shadows, no text.
```

### rubble-small and rubble-large: destroyed building

Shown where a building was destroyed. Make two sizes.

```text
Use the enemy buildings in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid painted colors, no grit or fine patterns. Not clay, not low poly, not realistic. One single object: a low pile of rubble from a destroyed military building: a few chunky charcoal and burnt-orange broken panels, a bent pipe and some scattered blocks, mostly flat on the ground, with a thin wisp of grey smoke. No blue, no fire. Three-quarter view from slightly above, centered, the whole pile in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

For the large version, add: "a bigger, wider pile, as left by the headquarters fort".

## The gunboat

**Attach:** `docs/concept/raid-topdown-simple.jpeg` (its gunboat is the closest to the design) and
`docs/concept/raid-topdown-crew.jpeg`.

### gunboat: the crew's gunboat

```text
Use the gunboat in the attached images as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors, wood with a few simple plank lines, no grit or fine patterns. Not clay, not low poly, not realistic. One single object: a sturdy little wooden gunboat with a rounded bow, grey metal trim along the rim, black tire fenders hanging on the sides, one big dark cannon on a swivel mount in the middle, and a single seat behind the cannon. The boat is empty, with no people. Three-quarter view from slightly above, centered, the whole boat in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```

### gunboat-cannon: the cannon alone

So the cannon can turn separately from the boat when it aims.

```text
Use the gunboat's cannon in the attached image as the style reference. Polished stylized 3D mobile-game render: smooth surfaces with crisp, clean edges, simple painted shading, soft even lighting. Simple textures: smooth solid colors, no grit or fine patterns. Not clay, not low poly, not realistic. One single object: only the big dark cannon from the gunboat, on its round swivel mount, with no boat. Side view, centered, the whole cannon in frame with space around it, plain white background, even flat lighting, no shadows, no text.
```
