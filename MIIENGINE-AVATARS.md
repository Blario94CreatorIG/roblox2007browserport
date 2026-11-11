# MiiEngine avatar integration

This branch adds a first-pass bridge between the 2007 browser port and MiiEngine.

## Use a Mii as your player

1. Open [MiiEngine](https://mii.nxw.pw) and create or open a Mii.
2. Open the 3D model export dialog.
3. Choose **Whole body** as the model type.
4. Choose a shader/material style you like and export the binary **.glb** file.
5. Return to the 2007 browser port start page and choose **Import Mii (.glb)**.
6. Join a place. The imported Mii is used as the visible local avatar.

The selected model is stored in this browser's local storage. Choose **Use Classic Avatar** to switch back. The selected Mii is restored on respawn.

## What is connected

- The original R6 character remains active as the physics/collision and legacy-script rig.
- Its visible body meshes are hidden when a Mii GLB is selected.
- The Mii model is attached to the character root, so it follows movement, teleporting, camera tracking and respawning.
- The original maps, tools, place scripts, chat, hotbar and movement controller remain in place.
- GLB parsing is local and does not fetch external model resources.

## Current limitations

- The imported GLB is a static visual model. It follows the player root but does not yet use the 2007 arm/leg animation joints.
- Import is limited to binary glTF 2.0 (.glb), up to 2.5 MB.
- Embedded geometry and embedded/data-URI textures are supported. External texture or buffer URLs are intentionally ignored.
- The original rig remains in use for physics and place scripts. This avoids breaking legacy places that expect R6 body parts.

## Project references

- [MiiEngine](https://github.com/Blario94CreatorIG/MiiEngine) — Mii editor and 3D model exporter.
- [Roblox 2007 browser port](https://github.com/Blario94CreatorIG/roblox2007browserport) — original WebGL game and R6 simulation.
