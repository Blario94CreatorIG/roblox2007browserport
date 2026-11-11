/* MiiEngine GLB avatar bridge.
 * Imports a self-contained GLB exported by MiiEngine. The original R6 rig
 * remains active for collision, physics and legacy scripts; its visible
 * meshes are hidden and the imported Mii is attached to the same root.
 * GLB is treated strictly as data: external buffer/image URLs are ignored.
 */
(function () {
  "use strict";

  const MAX_BYTES = 2.5 * 1024 * 1024;
  const GLB_MAGIC = 0x46546c67;
  const JSON_CHUNK = 0x4e4f534a;
  const BIN_CHUNK = 0x004e4942;

  function decodeDataUrl(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:model/gltf-binary;base64,")) {
      throw new Error("Choose a binary .glb exported from MiiEngine.");
    }
    const raw = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
    if (raw.length > MAX_BYTES) throw new Error("The Mii model is too large (maximum 2.5 MB).");
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  function parseGlb(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== 2) {
      throw new Error("This is not a valid glTF 2.0 binary (.glb) file.");
    }
    const declaredLength = view.getUint32(8, true);
    if (declaredLength !== bytes.byteLength) throw new Error("The GLB file is incomplete or invalid.");
    let offset = 12, json = null, bin = null;
    while (offset + 8 <= declaredLength) {
      const length = view.getUint32(offset, true);
      const type = view.getUint32(offset + 4, true);
      offset += 8;
      if (length > declaredLength - offset) throw new Error("The GLB contains an invalid chunk.");
      if (type === JSON_CHUNK) {
        const text = new TextDecoder().decode(bytes.subarray(offset, offset + length));
        json = JSON.parse(text.replace(/\0+$/g, "").trim());
      } else if (type === BIN_CHUNK) {
        bin = bytes.subarray(offset, offset + length);
      }
      offset += length;
    }
    if (!json || !bin || !json.meshes || !json.accessors || !json.bufferViews) {
      throw new Error("The GLB does not contain a supported 3D model.");
    }
    return { json, bin };
  }

  function componentInfo(type) {
    const map = {
      5120: [Int8Array, 1], 5121: [Uint8Array, 1],
      5122: [Int16Array, 2], 5123: [Uint16Array, 2],
      5125: [Uint32Array, 4], 5126: [Float32Array, 4]
    };
    if (!map[type]) throw new Error("Unsupported GLB accessor component type.");
    return map[type];
  }

  function readAccessor(gltf, bin, accessorIndex) {
    const accessor = gltf.accessors[accessorIndex];
    if (!accessor || accessor.sparse || accessor.bufferView == null) {
      throw new Error("This Mii model uses an unsupported sparse accessor.");
    }
    const view = gltf.bufferViews[accessor.bufferView];
    if (!view || (view.buffer || 0) !== 0) throw new Error("Unsupported GLB buffer layout.");
    const dims = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type];
    if (!dims) throw new Error("Unsupported GLB accessor shape.");
    const [Ctor, bytesPer] = componentInfo(accessor.componentType);
    const stride = view.byteStride || dims * bytesPer;
    const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
    if (stride < dims * bytesPer || start < 0 || start + Math.max(0, accessor.count - 1) * stride + dims * bytesPer > bin.byteLength) {
      throw new Error("The GLB accessor is outside its data buffer.");
    }
    const result = new Ctor(accessor.count * dims);
    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const getters = {
      5120: "getInt8", 5121: "getUint8", 5122: "getInt16",
      5123: "getUint16", 5125: "getUint32", 5126: "getFloat32"
    };
    const getter = getters[accessor.componentType];
    for (let i = 0; i < accessor.count; i++) {
      for (let j = 0; j < dims; j++) {
        result[i * dims + j] = dv[getter](start + i * stride + j * bytesPer, true);
      }
    }
    return { array: result, itemSize: dims, normalized: !!accessor.normalized };
  }

  function imageSource(gltf, bin, textureIndex) {
    const texture = gltf.textures && gltf.textures[textureIndex];
    const image = texture && gltf.images && gltf.images[texture.source];
    if (!image) return null;
    if (image.uri && image.uri.startsWith("data:")) return image.uri;
    if (image.bufferView != null) {
      const v = gltf.bufferViews[image.bufferView];
      if (!v) return null;
      const mime = image.mimeType || "image/png";
      const slice = bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
      let binary = "";
      for (let i = 0; i < slice.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, slice.subarray(i, Math.min(i + 0x8000, slice.length)));
      }
      return "data:" + mime + ";base64," + btoa(binary);
    }
    return null; // Never fetch external URLs from an imported model.
  }

  function buildMaterial(gltf, bin, index) {
    const def = (gltf.materials || [])[index] || {};
    const pbr = def.pbrMetallicRoughness || {};
    const factor = pbr.baseColorFactor || [1, 1, 1, 1];
    const options = {
      color: new THREE.Color(factor[0], factor[1], factor[2]),
      opacity: factor[3],
      transparent: factor[3] < 0.999 || def.alphaMode === "BLEND",
      roughness: pbr.roughnessFactor == null ? 1 : pbr.roughnessFactor,
      metalness: pbr.metallicFactor == null ? 0 : pbr.metallicFactor,
      side: def.doubleSided ? THREE.DoubleSide : THREE.FrontSide
    };
    if (pbr.baseColorTexture) {
      const src = imageSource(gltf, bin, pbr.baseColorTexture.index);
      if (src) {
        const tex = new THREE.TextureLoader().load(src);
        if (THREE.sRGBEncoding != null) tex.encoding = THREE.sRGBEncoding;
        options.map = tex;
      }
    }
    const mat = new THREE.MeshStandardMaterial(options);
    if (def.emissiveFactor) mat.emissive.setRGB(def.emissiveFactor[0], def.emissiveFactor[1], def.emissiveFactor[2]);
    if (def.alphaMode === "MASK") {
      mat.alphaTest = def.alphaCutoff == null ? 0.5 : def.alphaCutoff;
      mat.transparent = false;
    }
    return mat;
  }

  function makePrimitive(gltf, bin, primitive) {
    if (primitive.mode != null && primitive.mode !== 4) return null; // triangles only
    const attrs = primitive.attributes || {};
    if (attrs.POSITION == null) return null;
    const geometry = new THREE.BufferGeometry();
    const pos = readAccessor(gltf, bin, attrs.POSITION);
    geometry.setAttribute("position", new THREE.BufferAttribute(pos.array, pos.itemSize, pos.normalized));
    if (attrs.NORMAL != null) {
      const normal = readAccessor(gltf, bin, attrs.NORMAL);
      geometry.setAttribute("normal", new THREE.BufferAttribute(normal.array, normal.itemSize, normal.normalized));
    }
    if (attrs.TEXCOORD_0 != null) {
      const uv = readAccessor(gltf, bin, attrs.TEXCOORD_0);
      geometry.setAttribute("uv", new THREE.BufferAttribute(uv.array, uv.itemSize, uv.normalized));
    }
    if (primitive.indices != null) {
      const idx = readAccessor(gltf, bin, primitive.indices);
      geometry.setIndex(new THREE.BufferAttribute(idx.array, 1));
    }
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return new THREE.Mesh(geometry, buildMaterial(gltf, bin, primitive.material));
  }

  function makeNode(gltf, bin, index, seen) {
    if (seen.has(index)) throw new Error("The GLB contains a cyclic node hierarchy.");
    const node = gltf.nodes[index];
    if (!node) return new THREE.Group();
    const group = new THREE.Group();
    group.name = node.name || ("MiiPart" + index);
    if (node.matrix && node.matrix.length === 16) {
      const matrix = new THREE.Matrix4().fromArray(node.matrix);
      matrix.decompose(group.position, group.quaternion, group.scale);
    } else {
      if (node.translation) group.position.fromArray(node.translation);
      if (node.rotation) group.quaternion.fromArray(node.rotation);
      if (node.scale) group.scale.fromArray(node.scale);
    }
    if (node.mesh != null) {
      const mesh = gltf.meshes[node.mesh];
      for (const primitive of (mesh && mesh.primitives) || []) {
        const child = makePrimitive(gltf, bin, primitive);
        if (child) group.add(child);
      }
    }
    const next = new Set(seen); next.add(index);
    for (const childIndex of node.children || []) group.add(makeNode(gltf, bin, childIndex, next));
    return group;
  }

  function buildModel(gltf, bin) {
    const root = new THREE.Group();
    const sceneDef = (gltf.scenes || [])[gltf.scene || 0];
    const roots = sceneDef && sceneDef.nodes;
    if (roots && roots.length) {
      for (const index of roots) root.add(makeNode(gltf, bin, index, new Set()));
    } else {
      const childSet = new Set();
      for (const n of gltf.nodes || []) for (const c of n.children || []) childSet.add(c);
      (gltf.nodes || []).forEach((n, i) => { if (!childSet.has(i)) root.add(makeNode(gltf, bin, i, new Set())); });
    }
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    if (bounds.isEmpty()) throw new Error("The imported Mii model has no visible geometry.");
    const size = new THREE.Vector3(); bounds.getSize(size);
    if (!isFinite(size.y) || size.y < 0.001) throw new Error("The imported Mii model has invalid dimensions.");
    const center = new THREE.Vector3(); bounds.getCenter(center);
    const scale = 5.4 / size.y;
    root.scale.setScalar(scale);
    root.position.set(-center.x * scale, -3 - bounds.min.y * scale, -center.z * scale);
    return root;
  }

  async function attach(character, dataUrl) {
    if (!dataUrl) return;
    try {
      const parsed = parseGlb(decodeDataUrl(dataUrl));
      const model = buildModel(parsed.json, parsed.bin);
      model.name = "MiiEngineAvatar";
      character.group.add(model);
      character.miiAvatar = model;
      // Preserve the invisible legacy rig for collision, scripts and respawn.
      for (const key of Object.keys(character.parts || {})) {
        const part = character.parts[key];
        if (part && part.mesh) part.mesh.visible = false;
      }
      if (character.nameTag) character.nameTag.position.y = 3.65;
    } catch (error) {
      console.warn("[MiiEngine avatar]", error);
      if (window.RBLXui_instance_open) {
        window.RBLXui_instance_open.notify("Mii avatar could not load: " + error.message);
      }
    }
  }

  window.RBLXmiiAvatar = { attach };
  // Wrap the existing load path so respawns restore the selected Mii too.
  const Character = window.RBLXcharacter && window.RBLXcharacter.Character;
  if (Character && Character.prototype && !Character.prototype.__miiBridgeInstalled) {
    const originalLoad = Character.prototype.load;
    Character.prototype.load = async function () {
      await originalLoad.call(this);
      const selected = window.RBLXplayer && window.RBLXplayer.miiGlb;
      if (selected) await attach(this, selected);
    };
    Character.prototype.__miiBridgeInstalled = true;
  }
})();