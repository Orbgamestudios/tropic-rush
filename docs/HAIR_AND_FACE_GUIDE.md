# Hair locks and face shapes in Blender: a step-by-step guide

For the owner (who hasn't modelled in Blender) or an artist, working from the brief in
`docs/CHARACTERS.md` ("The brief for the hair and faces"). Two jobs per character, each its own
sitting: **hair as separate locks on chains of bones** (so it can swing in the breeze without
tearing, which the sculpted hair couldn't), and **face shapes** (so the face itself smiles and
frowns, not only the painted features). Do the Captain first: he's seen most. Allow an evening for
his hair and another for his face; the others go quicker once you've done one.

Blender 5.x. Keys are for Windows. "Click" is the left button; the middle button (wheel) turns the
view, Shift + middle pans, the wheel zooms. **Ctrl+Z** undoes anything. Save often (**Ctrl+S**).

## Before you start (5 minutes)

1. Open Blender, **File → New → General**. Click the cube, press **X → Delete**.
2. **File → Import → glTF 2.0**, and pick the character's painted, rigged file:
   - the Captain: `new work/captain/captain-rigged.glb`
   - the others: `models-wip/heroes2/rifleman-rigged.glb`, `shaman-rigged.glb`, `terror-rigged.glb`
3. Press **Numpad 1** (front view), then **Numpad .** with the body selected to frame it. Press
   **Z → Material Preview** so you see the paint.
4. **File → Save As** into `models-wip/heroes2/` as `<name>-locks.blend`.

You now have two things in the Outliner (top right): the **Armature** (the skeleton) and the body
**mesh**. Don't rename, move or rotate either: the game's animations depend on them as they are.

---

## Part 1: hair as locks (one evening)

What you're making: **8 to 20 chunky locks** of hair, each its own piece, in the shape of the
character's hair in the concept art, sitting over a slimmed-down version of the sculpted hair (the
"cap"), each hanging from its own little chain of 3 or 4 bones.

### 1. Slim the sculpted hair into a cap (15 minutes)

The locks go _over_ the sculpted hair, so it has to sink in a little first or the locks will poke
through it when they swing.

1. Click the body. At the top left, switch **Object Mode → Sculpt Mode**.
2. In the toolbar on the left pick the **Inflate** brush. In the header set **Strength 0.3** and
   **Radius 40 px**.
3. Hold **Ctrl** (that makes Inflate shrink instead) and stroke over the hair only, a few passes,
   until it sits about 3 to 5 mm in from where it was. Keep off the forehead and ears.
4. Hold **Shift** while you stroke (that smooths) and give the hair one light pass.
5. Back to **Object Mode**.

Done when: the hair is a smooth cap close to the head, still in its colour, with no lumps.

### 2. Draw a lock (10 minutes for the first, 3 each after)

1. **Shift+A → Curve → Bezier**. A small curve appears at the 3D cursor.
2. Press **Tab** (Edit Mode). Move it to the scalp: press **G** and move it, **R** to turn it,
   viewing from front (**Numpad 1**) and side (**Numpad 3**). Put its first point where the lock
   grows from, its last where the lock ends.
3. Click the last point and press **E** to add points, following where the hair goes: back over the
   head for the Captain's swept quiff, down the back for the Shaman's long hair. Four or five
   points is plenty.
4. In the **Properties** panel (bottom right), click the green curve icon (**Object Data**). Open
   **Geometry → Bevel**: set **Depth 0.012** and **Resolution 2**. The curve becomes a tube.
5. Taper it: in Edit Mode click the tip point, press **Alt+S** and move the mouse in until the tube
   narrows to a point there. Make the root a little thinner too, so it doesn't jut out.
6. Flatten it into a chunk rather than a tube: in the same **Geometry** panel set **Extrude** to
   **0.01**; the tube widens into a flat lock with rounded edges. If its flat side faces the wrong
   way, in Edit Mode press **A** (all points), then **Ctrl+T** and move the mouse to twist it until
   it lies flat on the head.

Done when: one chunky, tapered lock lies on the head where the concept shows hair, its root tucked
into the cap.

### 3. Make the rest (30 to 60 minutes)

1. With the lock selected, **Shift+D** duplicates it; move it beside the first and reshape it in
   Edit Mode (G on single points). Vary each lock's length and curve a little: real hair isn't
   regular.
2. Build up the hairstyle from the hairline backwards, overlapping each lock a little on the one
   behind it, like roof tiles. **8 to 12 locks** for short hair (the Captain, the Rifleman), **14 to
   20** for long hair (the Shaman, Terror).
3. Look at it from every side (**Numpad 1, 3, 7**, and **Ctrl+Numpad 1/3** for the opposite
   sides). The cap should only show between locks, not as bald patches.

### 4. Turn the locks into meshes and colour them (10 minutes)

1. Select all the lock curves (click one, Shift+click the rest in the Outliner).
2. **Object → Convert → Mesh**.
3. With them all still selected, **Ctrl+J** joins them into one object. Rename it `Hair` (double
   click it in the Outliner).
4. Colour: in **Properties → Material** (red sphere icon), click **New**, name it `HairMat`, and set
   **Base Color** to the hair's colour (pick it with the eyedropper from the cap) and **Roughness
   0.6**. Strands in the paint can come later; a flat colour is fine for now.
5. Give it a UV map: **Tab**, press **A** (select all), **U → Smart UV Project**, **OK**, **Tab**.

### 5. A chain of bones for each lock (30 minutes)

1. Click the **Armature**, switch to **Edit Mode** (Tab).
2. Press **Shift+A** to add a bone. It appears at the 3D cursor: put the cursor at a lock's root
   first (in Object Mode, click the lock with the **cursor tool**, or Shift+right-click on its
   root).
3. Move the bone's tip (click its end ball, **G**) a third of the way along the lock. Press **E**
   and drag to grow the next bone along the lock; do it twice more, so **4 bones** follow the lock
   from root to tip (3 is fine for short locks).
4. Name them, root first: press **F2** on each and type `hair1_1`, `hair1_2`, `hair1_3`,
   `hair1_4`. The next lock's chain is `hair2_1` ... and so on. **The names matter**: the game finds
   the chains by them.
5. Parent each chain to the head: click its first bone (`hair1_1`), open **Properties → Bone**
   (the bone icon) → **Relations → Parent** and choose `CC_Base_Head`. Leave **Connected** off.
6. Repeat for every lock. Tab out to Object Mode.

### 6. Tie the locks to their bones (15 minutes)

1. Click the `Hair` mesh, then **Shift+click the Armature** (so the armature's selected last).
2. **Ctrl+P → With Automatic Weights**.
3. Check it: click the Armature, switch to **Pose Mode**, click a lock's tip bone and press **R** to
   turn it. Only that lock should bend, smoothly from root to tip; press **Esc** to put it back.
   If a neighbour bends with it, click the `Hair` mesh, **Weight Paint** mode, pick the wrong bone's
   group in **Properties → Object Data → Vertex Groups**, and paint it out with the **Subtract**
   brush.
4. **Alt+R** and **Alt+G** in Pose Mode put any bones you moved back. Return to Object Mode.

### 7. Hand it over

Select the Armature, the body and `Hair` (click one, Shift+click the others), then **File → Export
→ glTF 2.0**: in the panel on the right open **Include** and tick **Selected Objects**; under
**Data**, leave **Shape Keys** ticked; untick **Animation**. Save as
`models-wip/heroes2/<name>-locks.glb` and tell me. From there it's mine: the full and light game
copies, the face map, and the springs that swing the chains (`render/springBones.ts`) switched on,
since the owner set the breeze aside until the hair was made this way.

---

## Part 2: face shapes (one evening)

What you're making: **shape keys**, saved versions of the face pushed into an expression, that the
game blends between. The eyes, lids and brows stay painted (they're drawn in proportion now); the
shapes move the _skin_: cheeks lifting in a smile, the brow furrowing, the jaw dropping. Start with
these ten; each takes 5 to 10 minutes.

| Name (type it exactly) | What to push                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `jawOpen`              | the jaw and chin down, the lips parting (about a finger's width) |
| `mouthSmileLeft`       | his left mouth corner up and back, the cheek above it rounding   |
| `mouthSmileRight`      | the same on his right                                            |
| `mouthFrownLeft`       | his left mouth corner down                                       |
| `mouthFrownRight`      | the same on his right                                            |
| `browInnerUp`          | the skin over both inner brows up, the forehead creasing         |
| `browDownLeft`         | his left brow skin down and in, a furrow between the brows       |
| `browDownRight`        | the same on his right                                            |
| `cheekSquintLeft`      | his left cheek pushed up under the eye                           |
| `cheekSquintRight`     | the same on his right                                            |

(His left is on your right when you face him.)

### For each shape

1. Click the body. **Properties → Object Data** (green triangle) → **Shape Keys**. The first time,
   click **+** once to make `Basis` (the face at rest); never sculpt on Basis.
2. Click **+** again for a new key; double-click its name and type it from the table.
3. Make sure the new key is highlighted, then switch to **Sculpt Mode**.
4. Pick the **Grab** brush from the toolbar on the left: Radius about the size of the feature (a
   cheek, a brow), **Strength 0.5**. Drag the skin where it goes; small moves read big on a face.
   Hold **Shift** and stroke lightly to smooth after. Turn on **X symmetry** (the butterfly icon in the header) only for the
   shapes that move both sides (`jawOpen`, `browInnerUp`); turn it off for Left/Right ones.
5. Back to **Object Mode** and slide the key's **Value** from 0 to 1: the face should move between
   rest and the expression with nothing tearing or caving in. Leave the value at **0** when done.

Done when: every key is in the list with its exact name, each at 0, and sliding each looks like a
person making that face.

### Hand it over

Export as above, with **Shape Keys** ticked, as `models-wip/heroes2/<name>-face-shapes.glb`. The game
copy scripts (`game_copy.py`, `bake_game.py`) currently drop AccuRig's own face shapes; I'll change
them to keep these, and point the face rig (`render/face/`) at them alongside the painted eyes and
mouth.

## If something goes wrong

- **The model went see-through or vanished:** **Z → Material Preview**; or press **Home** to
  frame everything.
- **A bone moves the whole body:** it isn't parented to `CC_Base_Head` but to the root; fix it in
  **Bone → Relations → Parent**.
- **Hair pokes through the cap when a lock turns:** shrink the cap a little more there (Part 1,
  step 1), or lift the lock's root.
- **Stuck:** save, and send me a screenshot of the whole Blender window. I'll say exactly what to
  click.
