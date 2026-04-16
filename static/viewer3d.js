// BL2 Save Editor — Three.js 3D Model Viewer
// Renders BL2 character/weapon/item models with stylized materials
// Supports equipment preview, accent rim lighting, and live material updates

const CHARACTER_MODELS = {
    "Axton":    { body: "/static/models/characters/Axton/Skel_SoldierBody.gltf",    head: "/static/models/characters/Axton/head.gltf" },
    "Zer0":     { body: "/static/models/characters/Zer0/Skel_AssassinBody.gltf",    head: "/static/models/characters/Zer0/head.gltf" },
    "Maya":     { body: "/static/models/characters/Maya/Skel_SirenBody.gltf",       head: "/static/models/characters/Maya/head.gltf" },
    "Salvador": { body: "/static/models/characters/Salvador/Char_MercBody.gltf",     head: "/static/models/characters/Salvador/head.gltf" },
    "Gaige":    { body: "/static/models/characters/Gaige/Skel_MechromancerBody.gltf",head: "/static/models/characters/Gaige/head.gltf" },
    "Krieg":    { body: "/static/models/characters/Krieg/Skel_PsychoBody.gltf",     head: "/static/models/characters/Krieg/head.gltf" },
};

const WEAPON_MODELS = {
    "Pistol":          "/static/models/weapons/Pistol/model.gltf",
    "Assault Rifle":   "/static/models/weapons/Assault_Rifle/model.gltf",
    "SMG":             "/static/models/weapons/SMG/model.gltf",
    "Shotgun":         "/static/models/weapons/Shotgun/model.gltf",
    "Sniper Rifle":    "/static/models/weapons/Sniper_Rifle/model.gltf",
    "Rocket Launcher": "/static/models/weapons/Rocket_Launcher/model.gltf",
};

const ITEM_MODELS = {
    "Shield":      "/static/models/items/Shield/model.gltf",
    "Grenade Mod": "/static/models/items/Grenade_Mod/model.gltf",
    "Relic":       "/static/models/items/Relic/model.gltf",
    "Class Mod":   null,
};

const CLASSMOD_MODELS = {
    "Axton":    "/static/models/items/classmods/ClassMod_Soldier/model.gltf",
    "Zer0":     "/static/models/items/classmods/ClassMod_Assassin/model.gltf",
    "Maya":     "/static/models/items/classmods/ClassMod_Siren/model.gltf",
    "Salvador": "/static/models/items/classmods/ClassMod_Merc/model.gltf",
    "Gaige":    "/static/models/items/classmods/ClassMod_Merc/model.gltf",
    "Krieg":    "/static/models/items/classmods/ClassMod_Merc/model.gltf",
};

// ─── Weapon Texture Paths ────────────────────────────────
// comp = zone mask (p_Masks: R=A, G=B, B=C), nrm = normal map (p_NormalScopesEmissive),
// dif = diffuse detail base (p_Diffuse) — extracted from BL2 MaterialInstanceConstants
const WEAPON_TEXTURES = {
    "Pistol":          { comp: "/static/textures/weapons/Weap_Pistols_Comp.png",      nrm: "/static/textures/weapons/Weap_Pistols_Nrm.png",      dif: "/static/textures/weapons/Weap_LauncherShotgunPistol_Comp.png" },
    "Assault Rifle":   { comp: "/static/textures/weapons/Weap_AssaultRifle_Comp.png",  nrm: "/static/textures/weapons/Weap_AssaultRifle_Nrm.png",  dif: "/static/textures/weapons/Weap_AssaultSubSniper_Comp.png" },
    "SMG":             { comp: "/static/textures/weapons/Weap_SMG_Comp.png",           nrm: "/static/textures/weapons/Weap_SMG_Nrm.png",           dif: "/static/textures/weapons/Weap_AssaultSubSniper_Comp.png" },
    "Shotgun":         { comp: "/static/textures/weapons/Weap_Shotgun_Comp.png",       nrm: "/static/textures/weapons/Weap_Shotgun_Nor.png",       dif: "/static/textures/weapons/Weap_LauncherShotgunPistol_Comp.png" },
    "Sniper Rifle":    { comp: "/static/textures/weapons/Weap_SniperRifle_Comp.png",   nrm: "/static/textures/weapons/Weap_SniperRifle_Nrm.png",   dif: "/static/textures/weapons/Weap_AssaultSubSniper_Comp.png" },
    "Rocket Launcher": { comp: "/static/textures/weapons/Weap_Launchers_Comp.png",     nrm: "/static/textures/weapons/Weap_Launchers_Nrm.png",     dif: "/static/textures/weapons/Weap_LauncherShotgunPistol_Comp.png" },
};

// ─── Item Texture Paths ──────────────────────────────────
const ITEM_TEXTURES = {
    "Shield":      { dif: "/static/textures/items/Shield_Dif.png",      nrm: "/static/textures/items/Shield_Nrm.png" },
    "Grenade Mod": { dif: "/static/textures/items/Grenades_Dif.png",    nrm: "/static/textures/items/Grenades_Nrm.png" },
    "Relic":       { dif: "/static/textures/items/ItemArtifacts_Comp.png" },
};

const CLASSMOD_TEXTURES = {
    "Axton":    { dif: "/static/textures/items/SoldierClassMod01_Diff.png",  nrm: "/static/textures/items/SoldierClassMod01_Norm.png" },
    "Zer0":     { dif: "/static/textures/items/AssassinClassMod01_Dif.png",  nrm: "/static/textures/items/AssassinClassMod01_Nrm.png" },
    "Maya":     { dif: "/static/textures/items/SirenClassMod01_Dif.png",     nrm: "/static/textures/items/SirenClassMod01_Nrm.png" },
    "Salvador": { dif: "/static/textures/items/MercClassMod01_Dif.png",      nrm: "/static/textures/items/MercClassMod01_Nrm.png" },
    "Gaige":    { dif: "/static/textures/items/MercClassMod01_Dif.png",      nrm: "/static/textures/items/MercClassMod01_Nrm.png" },
    "Krieg":    { dif: "/static/textures/items/MercClassMod01_Dif.png",      nrm: "/static/textures/items/MercClassMod01_Nrm.png" },
};

// BL2 manufacturer color palettes — exact game values from MasterMati_*Common MaterialInstanceConstants
// Each zone (A/B/C) has Hilight/Midtone/Shadow colors (HDR linear, values > 1.0 are valid)
const MANUFACTURER_COLORS = {
    "Bandit": {
        aH: [0.3109, 0.3755, 0.3923], aM: [0.2431, 0.0624, 0.0336], aS: [0.1271, 0.1115, 0.0892],
        bH: [0.1713, 0.0484, 0.0208], bM: [0.4653, 0.4806, 0.4500], bS: [0.5735, 0.5724, 0.5746],
        cH: [0.2376, 0.1798, 0.1526], cM: [0.2486, 0.1904, 0.1093], cS: [0.0773, 0.0606, 0.0470]
    },
    "Dahl": {
        aH: [1.4958, 1.1993, 0.6942], aM: [1.0, 1.0, 1.0], aS: [0.4473, 0.5028, 0.6298],
        bH: [1.0, 1.0, 1.0], bM: [1.7403, 1.7328, 1.4716], bS: [1.0, 1.0, 1.0],
        cH: [1.0, 1.0, 1.0], cM: [0.2376, 0.1750, 0.1317], cS: [1.0, 1.0, 1.0]
    },
    "Hyperion": {
        aH: [1.2734, 1.3718, 1.4140], aM: [1.7156, 1.2595, 0.0963], aS: [1.1242, 0.9707, 0.4394],
        bH: [1.0, 0.9702, 0.7813], bM: [0.8961, 0.9580, 1.1753], bS: [0.5635, 0.4534, 0.3425],
        cH: [1.8469, 1.8469, 1.8469], cM: [1.4252, 1.4252, 1.4252], cS: [1.0, 1.0, 1.0]
    },
    "Jakobs": {
        aH: [0.3650, 0.3688, 0.3702], aM: [0.6298, 0.5557, 0.5334], aS: [0.2941, 0.3421, 0.6022],
        bH: [0.6298, 0.5557, 0.5334], bM: [0.6298, 0.5557, 0.5334], bS: [0.2941, 0.3421, 0.6022],
        cH: [0.3650, 0.3688, 0.3702], cM: [0.6298, 0.5557, 0.5334], cS: [0.2941, 0.3421, 0.6022]
    },
    "Maliwan": {
        aH: [1.9052, 1.7935, 1.2947], aM: [3.6453, 3.5430, 3.4070], aS: [1.0, 1.0, 1.0],
        bH: [0.4212, 0.4390, 0.6630], bM: [0.0488, 0.0531, 0.0884], bS: [0.6776, 0.7387, 0.9668],
        cH: [1.3049, 1.4140, 0.8993], cM: [0.8807, 0.8896, 1.0], cS: [0.4696, 0.1492, 0.0519]
    },
    "Tediore": {
        aH: [1.3820, 1.2501, 0.8178], aM: [1.0, 0.8911, 0.7584], aS: [0.7795, 0.7712, 0.9005],
        bH: [1.7572, 1.7572, 1.7572], bM: [1.1308, 1.3423, 1.3923], bS: [0.6298, 0.5672, 0.4087],
        cH: [0.9779, 0.4300, 0.3782], cM: [0.7348, 0.4822, 0.4506], cS: [0.3536, 0.1215, 0.2070]
    },
    "Torgue": {
        aH: [0.2762, 0.2022, 0.1364], aM: [1.3507, 1.2273, 1.1791], aS: [1.0, 0.6526, 0.3812],
        bH: [0.0829, 0.0712, 0.0615], bM: [0.2460, 0.2834, 0.3591], bS: [0.9825, 0.4909, 0.2487],
        cH: [0.8011, 0.6724, 0.5754], cM: [0.1857, 0.2445, 0.4102], cS: [0.7679, 0.3943, 0.1735]
    },
    "Vladof": {
        aH: [0.7458, 0.5036, 0.4244], aM: [1.3309, 1.2661, 1.1471], aS: [1.2063, 1.2657, 1.1469],
        bH: [0.5799, 0.6326, 0.6906], bM: [0.6984, 0.7768, 0.8618], bS: [0.9116, 0.6544, 0.5238],
        cH: [0.9713, 1.0, 0.9905], cM: [1.0, 0.7843, 0.6077], cS: [0.6243, 0.5006, 0.4173]
    },
    "default": {
        aH: [1.0, 1.0, 1.0], aM: [0.7, 0.7, 0.7], aS: [0.4, 0.4, 0.4],
        bH: [1.0, 1.0, 1.0], bM: [0.7, 0.7, 0.7], bS: [0.4, 0.4, 0.4],
        cH: [1.0, 1.0, 1.0], cM: [0.7, 0.7, 0.7], cS: [0.4, 0.4, 0.4]
    },
};

// Per-manufacturer PBR surface properties — matches each manufacturer's visual identity in BL2
const MANUFACTURER_PBR = {
    "Bandit":    { metalness: 0.40, roughness: 0.55 },  // scrap metal, rough welds
    "Dahl":      { metalness: 0.60, roughness: 0.30 },  // military precision finish
    "Hyperion":  { metalness: 0.75, roughness: 0.20 },  // sleek corporate polymer
    "Jakobs":    { metalness: 0.35, roughness: 0.60 },  // wood and aged iron
    "Maliwan":   { metalness: 0.70, roughness: 0.25 },  // high-tech smooth composite
    "Tediore":   { metalness: 0.45, roughness: 0.45 },  // cheap stamped metal
    "Torgue":    { metalness: 0.55, roughness: 0.40 },  // heavy ordnance steel
    "Vladof":    { metalness: 0.50, roughness: 0.35 },  // industrial machined
    "default":   { metalness: 0.55, roughness: 0.38 },
};

// ─── BL2 MaterialInstanceConstant data — extracted from Startup.upk ─────
// weapon_materials.json: per-manufacturer per-rarity MasterMati_* MICs
//   { Bandit: { Common: { textures, scalars, vectors }, Uncommon: ..., ... }, ... }
// head_materials.json: per-head Mati_* MICs
//   { "GD_<Class>_Items.<Class>.Head_<Name>": { textures, scalars, vectors } }
var _weaponMatDB = null;
var _headMatDB = null;

(function() {
    var xhr1 = new XMLHttpRequest();
    xhr1.open("GET", "/static/weapon_materials.json", true);
    xhr1.onload = function() {
        if (xhr1.status === 200) {
            try { _weaponMatDB = JSON.parse(xhr1.responseText); }
            catch (e) { console.warn("weapon_materials.json parse error", e); }
        }
    };
    xhr1.send();

    var xhr2 = new XMLHttpRequest();
    xhr2.open("GET", "/static/head_materials.json", true);
    xhr2.onload = function() {
        if (xhr2.status === 200) {
            try { _headMatDB = JSON.parse(xhr2.responseText); }
            catch (e) { console.warn("head_materials.json parse error", e); }
        }
    };
    xhr2.send();
})();

// ─── Gestalt Section Visibility ─────────────────────────
// BL2 weapons use combined "gestalt" SkeletalMeshes containing ALL manufacturer
// parts in a single mesh. The game shows specific parts by rendering only their
// triangle ranges from the index buffer, using GestaltMeshMap data.
// We replicate this with THREE.js geometry groups: only active parts' face ranges
// are added as draw groups, making the rest invisible.

var _gestaltMap = null;      // { weaponType: [{ name, materialIndex, firstIndex, numTriangles }] }
var _partMeshNames = null;   // { partPath: { mesh: fragmentName, additional?: [fragmentName] } }
var _gestaltDataLoading = false;

function _loadGestaltData(callback) {
    if (_gestaltMap && _partMeshNames) { if (callback) callback(); return; }
    if (_gestaltDataLoading) return;
    _gestaltDataLoading = true;

    var loaded = 0;
    function check() { if (++loaded >= 2 && callback) callback(); }

    var xhr1 = new XMLHttpRequest();
    xhr1.open("GET", "/static/gestalt_map.json");
    xhr1.onload = function() { _gestaltMap = JSON.parse(xhr1.responseText); check(); };
    xhr1.onerror = function() { console.warn("Failed to load gestalt_map.json"); check(); };
    xhr1.send();

    var xhr2 = new XMLHttpRequest();
    xhr2.open("GET", "/static/part_mesh_names.json");
    xhr2.onload = function() { _partMeshNames = JSON.parse(xhr2.responseText); check(); };
    xhr2.onerror = function() { console.warn("Failed to load part_mesh_names.json"); check(); };
    xhr2.send();
}

// Preload gestalt data on script load
_loadGestaltData();

function applyGestaltSectionVisibility(group, weaponType, partPaths) {
    if (!group || !_gestaltMap || !_partMeshNames) return;
    if (!partPaths || !partPaths.length) return;

    // Map category name to gestalt key
    var gestaltKey = weaponType.replace(/ /g, "_");
    // Category "Grenade Mod" maps to gestalt key "Grenade"
    if (gestaltKey === "Grenade_Mod") gestaltKey = "Grenade";
    var sections = _gestaltMap[gestaltKey];
    if (!sections) {
        console.warn("No gestalt data for:", gestaltKey);
        return;
    }

    // Collect active fragment names from weapon part paths
    var activeFragments = {};
    for (var i = 0; i < partPaths.length; i++) {
        var info = _partMeshNames[partPaths[i]];
        if (!info) continue;
        activeFragments[info.mesh] = true;
        if (info.additional) {
            for (var j = 0; j < info.additional.length; j++) {
                activeFragments[info.additional[j]] = true;
            }
        }
    }

    // If no part paths resolved to fragments, skip (show full mesh as fallback)
    if (Object.keys(activeFragments).length === 0) {
        console.log("Gestalt: no fragment matches for", weaponType, "- showing full mesh");
        return;
    }

    // Compute base index offset per materialIndex (for multi-primitive meshes)
    var matBases = {};
    for (var i = 0; i < sections.length; i++) {
        var mi = sections[i].materialIndex;
        if (matBases[mi] === undefined || sections[i].firstIndex < matBases[mi]) {
            matBases[mi] = sections[i].firstIndex;
        }
    }

    // Collect meshes from the loaded model, ordered by primitive index
    var meshes = [];
    group.traverse(function(node) {
        if (node.isMesh && node.geometry && node.geometry.index) {
            meshes.push(node);
        }
    });
    if (!meshes.length) return;

    // Match each mesh to a materialIndex by comparing index count
    var matTotals = {};
    for (var i = 0; i < sections.length; i++) {
        var mi = sections[i].materialIndex;
        matTotals[mi] = (matTotals[mi] || 0) + sections[i].numTriangles * 3;
    }

    var shown = 0, hidden = 0;
    for (var m = 0; m < meshes.length; m++) {
        var mesh = meshes[m];
        var geo = mesh.geometry;
        var idxCount = geo.index.count;

        // Determine which materialIndex this mesh represents
        var meshMatIdx = m; // default: assume order matches
        for (var mi in matTotals) {
            if (matTotals[mi] === idxCount) {
                meshMatIdx = parseInt(mi);
                break;
            }
        }

        var base = matBases[meshMatIdx] || 0;

        // Clear existing groups and add only active parts
        geo.groups = [];
        for (var i = 0; i < sections.length; i++) {
            var s = sections[i];
            if (s.materialIndex !== meshMatIdx) continue;
            if (activeFragments[s.name]) {
                var localStart = s.firstIndex - base;
                geo.addGroup(localStart, s.numTriangles * 3, 0);
                shown++;
            } else {
                hidden++;
            }
        }

        // If no groups added, add empty group to hide the mesh entirely
        if (geo.groups.length === 0) {
            geo.addGroup(0, 0, 0);
        }

        // THREE.js r128 ONLY uses geometry groups when mesh.material is an array.
        // With a single material, groups are silently ignored and the full mesh renders.
        // Wrap the material in an array so the renderer respects our groups.
        if (!Array.isArray(mesh.material)) {
            mesh.material = [mesh.material];
        }
    }

    console.log("Gestalt section visibility [" + weaponType + "]: " +
        shown + " sections visible, " + hidden + " hidden, " +
        Object.keys(activeFragments).length + " active fragments");
}

// Per-weapon-type gestalt slot definitions — matches actual gestalt section naming from BL2
var _GESTALT_SLOTS = {
    "Pistol":          { prefix: "Pistol", slots: ["Body", "Grip", "Barrel", "Scope"] },
    "Assault Rifle":   { prefix: "AR",     slots: ["Body", "Grip", "Barrel", "Scope", "Stock"] },
    "SMG":             { prefix: "SMG",    slots: ["Body", "Grip", "Barrel", "Scope", "Stock"] },
    "Shotgun":         { prefix: "SG",     slots: ["Body", "FrontGrip", "Barrel", "Scope", "Stock"] },
    "Sniper Rifle":    { prefix: "SR",     slots: ["Body", "Grip", "Barrel", "Scope", "Stock"] },
    "Rocket Launcher": { prefix: "L",      slots: ["Body", "Grip", "Barrel", "Scope", "Exhaust"] },
};

function applyGestaltManufacturerFallback(group, weaponType, manufacturer) {
    if (!group || !_gestaltMap || !manufacturer) return;
    var gestaltKey = weaponType.replace(/ /g, "_");
    if (gestaltKey === "Grenade_Mod") gestaltKey = "Grenade";
    var sections = _gestaltMap[gestaltKey];
    if (!sections) return;

    var slotInfo = _GESTALT_SLOTS[weaponType];
    if (!slotInfo) return;

    // Build a lookup set of valid section names for fast matching
    var sectionNames = {};
    for (var j = 0; j < sections.length; j++) sectionNames[sections[j].name] = true;

    // Build default fragment names for this manufacturer
    var activeFragments = {};
    for (var i = 0; i < slotInfo.slots.length; i++) {
        var fragName = slotInfo.prefix + "_" + slotInfo.slots[i] + "_" + manufacturer;
        if (sectionNames[fragName]) {
            activeFragments[fragName] = true;
        }
    }
    // Also add the default elemental (no-element placeholder) if it exists
    if (sectionNames["Acc_Barrel_Elemental3"]) activeFragments["Acc_Barrel_Elemental3"] = true;

    if (Object.keys(activeFragments).length === 0) return;

    // Apply section visibility using the constructed fragments
    var matBases = {};
    for (var i = 0; i < sections.length; i++) {
        var mi = sections[i].materialIndex;
        if (matBases[mi] === undefined || sections[i].firstIndex < matBases[mi]) {
            matBases[mi] = sections[i].firstIndex;
        }
    }
    var matTotals = {};
    for (var i = 0; i < sections.length; i++) {
        var mi = sections[i].materialIndex;
        matTotals[mi] = (matTotals[mi] || 0) + sections[i].numTriangles * 3;
    }

    var meshes = [];
    group.traverse(function(node) {
        if (node.isMesh && node.geometry && node.geometry.index) meshes.push(node);
    });

    for (var m = 0; m < meshes.length; m++) {
        var mesh = meshes[m];
        var geo = mesh.geometry;
        var idxCount = geo.index.count;
        var meshMatIdx = m;
        for (var mi in matTotals) {
            if (matTotals[mi] === idxCount) { meshMatIdx = parseInt(mi); break; }
        }
        var base = matBases[meshMatIdx] || 0;
        geo.groups = [];
        for (var i = 0; i < sections.length; i++) {
            var s = sections[i];
            if (s.materialIndex !== meshMatIdx) continue;
            if (activeFragments[s.name]) {
                geo.addGroup(s.firstIndex - base, s.numTriangles * 3, 0);
            }
        }
        if (geo.groups.length === 0) geo.addGroup(0, 0, 0);
        if (!Array.isArray(mesh.material)) mesh.material = [mesh.material];
    }

    console.log("Gestalt manufacturer fallback [" + weaponType + " " + manufacturer + "]: " +
        Object.keys(activeFragments).length + " default fragments");
}

// Texture cache to avoid reloading
var _textureCache = {};

// Load texture with caching. opts: { flipY: bool, linear: bool }
function _loadTexture(url, opts) {
    if (typeof opts === "boolean") opts = { flipY: opts }; // legacy compat
    opts = opts || {};
    var key = url + (opts.flipY ? "_flip" : "") + (opts.linear ? "_lin" : "");
    if (_textureCache[key]) return _textureCache[key];
    var loader = new THREE.TextureLoader();
    var tex = loader.load(url,
        function(t) {
            console.log("Texture loaded:", url, t.image.width + "x" + t.image.height);
            t.needsUpdate = true;
        },
        undefined,
        function(err) {
            console.error("Texture FAILED:", url, err);
        }
    );
    if (opts.flipY === false) tex.flipY = false;
    // Bug 27: match UE3 Wrap mode — extracted mesh UVs exceed [0,1]
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // sRGB for color textures displayed via standard materials, linear for shader inputs
    if (!opts.linear) {
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        else if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    } else {
        if (THREE.LinearSRGBColorSpace) tex.colorSpace = THREE.LinearSRGBColorSpace;
        else if (tex.encoding !== undefined) tex.encoding = THREE.LinearEncoding;
    }
    _textureCache[key] = tex;
    return tex;
}

// ─── Rarity & Element Color Palettes ─────────────────────
const RARITY_MATERIALS = {
    "Common":       { base: 0x9a9a9a, accent: 0xcccccc },
    "Uncommon":     { base: 0x2a7a1e, accent: 0x3ec427 },
    "Rare":         { base: 0x2a6094, accent: 0x4fa1d9 },
    "Very Rare":    { base: 0x7a2fa0, accent: 0xae4fce },
    "Unique":       { base: 0x7a2fa0, accent: 0xae4fce },  // BUG-P58: same as Very Rare (purple)
    "Legendary":    { base: 0xc48800, accent: 0xfcb100 },
    "Pearlescent":  { base: 0x009999, accent: 0x00ffff },
    "Seraph":       { base: 0xcc2090, accent: 0xff3cb4 },
    "Effervescent": { base: 0xcc4ea0, accent: 0xff6ed4 },
};

const ELEMENT_COLORS = {
    "Fire":       0xff6600,
    "Incendiary": 0xff6600,
    "Shock":      0x3399ff,
    "Corrosive":  0x00cc00,
    "Slag":       0x9b59b6,
    "Explosive":  0xffcc00,
};

// Rarity rank for accent lighting intensity
// BUG-P58: added "Unique" (maps to same rank as Very Rare, matches BL2 game behavior)
const RARITY_RANK = {
    "Common": 0, "Uncommon": 1, "Rare": 2, "Very Rare": 3, "Unique": 3,
    "Legendary": 4, "Pearlescent": 5, "Seraph": 5, "Effervescent": 5,
};

// ─── Material Factory ─────────────────────────────────────
function createWeaponMaterial(rarityName, elementName) {
    var pal = RARITY_MATERIALS[rarityName] || RARITY_MATERIALS["Common"];
    var baseColor = new THREE.Color(pal.base);
    var accentColor = new THREE.Color(pal.accent);

    if (elementName && ELEMENT_COLORS[elementName]) {
        var elemColor = new THREE.Color(ELEMENT_COLORS[elementName]);
        baseColor.lerp(elemColor, 0.25);
    }

    return new THREE.MeshStandardMaterial({
        color: baseColor,
        metalness: 0.7,
        roughness: 0.35,
        emissive: accentColor,
        emissiveIntensity: 0.08,
    });
}

// BL2 weapon texture compositing — matches the actual game's Master_Gun shader pipeline:
// 1. p_Masks (zone mask RGB) selects zone A/B/C per pixel (dominant channel wins)
// 2. Zone colors (shadow/midtone/highlight) are interpolated per zone based on mask intensity
//    Modulated by p_ShadowsIntensity / p_HighlightsIntensity scalars (default 2 for heads, 4 for guns)
// 3. The zone color overlay is multiply-sqrt blended onto p_Diffuse (the detail base texture)
// 4. p_Pattern is overlaid additively, scaled by p_PatternIntensity, tinted by p_PatternColor
//    UV scale/position from p_PatternScalePosition (R=scaleU, G=scaleV, B=offU, A=offV)
// 5. p_Decal overlaid at fixed position (p_DecalScalePosition), tinted by p_DecalColor
// Formula: result = sqrt(zoneOverlay * diffuseBase) — from BL2_skingen's multiply_sqrt.pyx
var _bl2CompositeCache = {};

function _sampleImage(srcCanvas, srcPx, sw, sh, u, v) {
    // Bilinear sample at (u, v) in [0, 1] — wrapping
    u = u - Math.floor(u);
    v = v - Math.floor(v);
    var fx = u * (sw - 1);
    var fy = v * (sh - 1);
    var x0 = fx | 0, y0 = fy | 0;
    var i = (y0 * sw + x0) * 4;
    return [srcPx[i], srcPx[i + 1], srcPx[i + 2], srcPx[i + 3]];
}

function _imageToData(img, w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var cx = c.getContext("2d");
    cx.drawImage(img, 0, 0, w, h);
    return cx.getImageData(0, 0, w, h).data;
}

function _compositeBL2Texture(maskImg, difImg, colors, cacheKey, params) {
    if (_bl2CompositeCache[cacheKey]) return _bl2CompositeCache[cacheKey];
    params = params || {};

    var w = maskImg.width, h = maskImg.height;
    var canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d");

    // Read mask pixels
    ctx.drawImage(maskImg, 0, 0, w, h);
    var maskData = ctx.getImageData(0, 0, w, h);
    var maskPx = maskData.data;

    // Read diffuse pixels (scale to mask size if needed)
    var difPx = _imageToData(difImg, w, h);

    // Optional pattern/decal overlays — pre-sample buffers at full mask resolution
    var pattern = params.pattern;
    var decal = params.decal;
    var patPx = null, patW = 0, patH = 0;
    var dclPx = null, dclW = 0, dclH = 0;
    if (pattern && pattern.img && pattern.intensity > 0.001) {
        patW = pattern.img.width; patH = pattern.img.height;
        patPx = _imageToData(pattern.img, patW, patH);
    }
    if (decal && decal.img && decal.intensity > 0.001) {
        dclW = decal.img.width; dclH = decal.img.height;
        dclPx = _imageToData(decal.img, dclW, dclH);
    }

    // Intensity scalars — defaults match Master_Player (heads). MasterMati (guns) default to 4.
    var shI = (params.shadowsIntensity != null) ? params.shadowsIntensity : 2.0;
    var hiI = (params.highlightsIntensity != null) ? params.highlightsIntensity : 2.0;
    // Normalize so default 2 = neutral (multiplier 1.0); 4 doubles the contribution
    var shadowsMul = shI * 0.5;
    var hilightsMul = hiI * 0.5;

    var patIntensity = pattern ? pattern.intensity : 0;
    var patCol = pattern ? pattern.color : null;
    var patChan = pattern ? pattern.channelScale : null;
    var patScaleU = 1, patScaleV = 1, patOffU = 0, patOffV = 0, patRot = 0;
    if (pattern && pattern.scalePos) {
        patScaleU = pattern.scalePos[0] || 1;
        patScaleV = pattern.scalePos[1] || 1;
        patOffU = pattern.scalePos[2] || 0;
        patOffV = pattern.scalePos[3] || 0;
        patRot = pattern.rotation || 0;
    }
    var patCos = Math.cos(patRot), patSin = Math.sin(patRot);

    var dclIntensity = decal ? decal.intensity : 0;
    var dclCol = decal ? decal.color : null;
    var dclScaleU = 1, dclScaleV = 1, dclOffU = 0, dclOffV = 0;
    if (decal && decal.scalePos) {
        dclScaleU = decal.scalePos[0] || 1;
        dclScaleV = decal.scalePos[1] || 1;
        dclOffU = decal.scalePos[2] || 0;
        dclOffV = decal.scalePos[3] || 0;
    }
    var dclUseFullColor = decal ? !!decal.useFullColor : false;

    // Output buffer
    var outData = ctx.createImageData(w, h);
    var out = outData.data;

    for (var i = 0; i < maskPx.length; i += 4) {
        var mr = maskPx[i] / 255;       // zone A intensity
        var mg = maskPx[i + 1] / 255;   // zone B intensity
        var mb = maskPx[i + 2] / 255;   // zone C intensity

        // Diffuse base pixel (linear 0-1)
        var dr = difPx[i] / 255;
        var dg = difPx[i + 1] / 255;
        var db = difPx[i + 2] / 255;

        // Determine dominant zone (BL2 ue_color_diff: highest channel wins, threshold 40/255)
        var zoneThreshold = 40 / 255;
        var zone = -1; // -1 = no zone (transparent/neutral)
        var zoneIntensity = 0;
        if (mr >= mg && mr >= mb && mr > zoneThreshold) {
            zone = 0; zoneIntensity = mr;
        } else if (mg >= mr && mg >= mb && mg > zoneThreshold) {
            zone = 1; zoneIntensity = mg;
        } else if (mb >= mr && mb >= mg && mb > zoneThreshold) {
            zone = 2; zoneIntensity = mb;
        }

        var cr, cg, cb;
        if (zone === -1) {
            // No zone — use diffuse directly with neutral tint
            cr = dr * 0.7;
            cg = dg * 0.7;
            cb = db * 0.7;
        } else {
            // Select zone colors
            var zH, zM, zS;
            if (zone === 0) { zH = colors.aH; zM = colors.aM; zS = colors.aS; }
            else if (zone === 1) { zH = colors.bH; zM = colors.bM; zS = colors.bS; }
            else { zH = colors.cH; zM = colors.cM; zS = colors.cS; }

            // Interpolate shadow→midtone→highlight based on zone intensity
            // Low intensity = shadow, mid = midtone, high = highlight
            // Apply shadowsMul/hilightsMul to bias the contribution
            var t = zoneIntensity;
            var oR, oG, oB;
            if (t < 0.5) {
                var st = t * 2.0; // 0→1 over shadow→midtone range
                // Lerp shadow→mid; shadowsMul increases the "darkness" pull of the shadow
                var sR = zS[0] * shadowsMul, sG = zS[1] * shadowsMul, sB = zS[2] * shadowsMul;
                oR = sR + (zM[0] - sR) * st;
                oG = sG + (zM[1] - sG) * st;
                oB = sB + (zM[2] - sB) * st;
            } else {
                var ht = (t - 0.5) * 2.0; // 0→1 over midtone→highlight range
                // Lerp mid→hilight; hilightsMul boosts the highlight pull
                var hR = zH[0] * hilightsMul, hG = zH[1] * hilightsMul, hB = zH[2] * hilightsMul;
                oR = zM[0] + (hR - zM[0]) * ht;
                oG = zM[1] + (hG - zM[1]) * ht;
                oB = zM[2] + (hB - zM[2]) * ht;
            }

            // Multiply-sqrt blend: result = sqrt(overlay * diffuse)
            // This is brighter than pure multiply, matches BL2's actual blending
            cr = Math.sqrt(Math.max(0, oR * dr));
            cg = Math.sqrt(Math.max(0, oG * dg));
            cb = Math.sqrt(Math.max(0, oB * db));
        }

        // Compute UV from pixel position for pattern/decal sampling
        var px = (i / 4) % w;
        var py = (i / 4 / w) | 0;
        var u = px / w;
        var v = py / h;

        // Pattern overlay — additive multiply with channel-scale weights
        if (patPx && patIntensity > 0.001) {
            // Apply rotation around (0.5, 0.5), then scale, then offset
            var pu = u - 0.5, pv = v - 0.5;
            var ru = pu * patCos - pv * patSin;
            var rv = pu * patSin + pv * patCos;
            ru = ru * patScaleU + 0.5 + patOffU;
            rv = rv * patScaleV + 0.5 + patOffV;
            var ps = _sampleImage(null, patPx, patW, patH, ru, rv);
            var pR = (ps[0] / 255) * patCol[0];
            var pG = (ps[1] / 255) * patCol[1];
            var pB = (ps[2] / 255) * patCol[2];
            // Channel scale gates which mask zone the pattern shows on (R/G/B/A multipliers)
            var pMask = 1.0;
            if (patChan) {
                pMask = mr * (patChan[0] || 0) + mg * (patChan[1] || 0) + mb * (patChan[2] || 0);
                pMask = Math.max(0, Math.min(1, pMask));
            }
            var k = patIntensity * pMask;
            cr = cr + pR * k;
            cg = cg + pG * k;
            cb = cb + pB * k;
        }

        // Decal overlay — fixed-position, alpha-driven, full-color or tint
        if (dclPx && dclIntensity > 0.001) {
            var du = (u - 0.5) * dclScaleU + 0.5 + dclOffU;
            var dv = (v - 0.5) * dclScaleV + 0.5 + dclOffV;
            // Decals don't tile — clamp to [0,1] and skip if outside
            if (du >= 0 && du <= 1 && dv >= 0 && dv <= 1) {
                var ds = _sampleImage(null, dclPx, dclW, dclH, du, dv);
                var alpha = (ds[3] / 255);
                if (alpha > 0.001) {
                    var k2 = dclIntensity * alpha;
                    if (dclUseFullColor) {
                        cr = cr * (1 - k2) + (ds[0] / 255) * dclCol[0] * k2;
                        cg = cg * (1 - k2) + (ds[1] / 255) * dclCol[1] * k2;
                        cb = cb * (1 - k2) + (ds[2] / 255) * dclCol[2] * k2;
                    } else {
                        // Decal acts as a darkening/branding stamp (luminance modulated tint)
                        var dl = (ds[0] + ds[1] + ds[2]) / (3 * 255);
                        cr = cr * (1 - k2) + dl * dclCol[0] * k2;
                        cg = cg * (1 - k2) + dl * dclCol[1] * k2;
                        cb = cb * (1 - k2) + dl * dclCol[2] * k2;
                    }
                }
            }
        }

        // Reinhard tonemap for HDR values
        cr = cr / (cr + 1.0);
        cg = cg / (cg + 1.0);
        cb = cb / (cb + 1.0);

        // Contrast boost — soft curve that tapers near 1.0 to avoid clipping highlights
        var _gain = 0.35;
        cr = cr * (1.0 + _gain * (1.0 - cr));
        cg = cg * (1.0 + _gain * (1.0 - cg));
        cb = cb * (1.0 + _gain * (1.0 - cb));

        // Linear to sRGB gamma
        out[i]     = Math.min(255, Math.pow(Math.max(cr, 0), 1.0 / 2.2) * 255 + 0.5) | 0;
        out[i + 1] = Math.min(255, Math.pow(Math.max(cg, 0), 1.0 / 2.2) * 255 + 0.5) | 0;
        out[i + 2] = Math.min(255, Math.pow(Math.max(cb, 0), 1.0 / 2.2) * 255 + 0.5) | 0;
        out[i + 3] = 255;
    }

    ctx.putImageData(outData, 0, 0);
    var tex = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    else if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    _bl2CompositeCache[cacheKey] = tex;
    return tex;
}

// Convert a MIC vectors block (R/G/B arrays) into the legacy colors object that
// _compositeBL2Texture expects. If a zone color is missing (e.g. some Hyperion
// MICs), fall back to the manufacturer's hard-coded palette.
function _micVectorsToColors(vectors, mfr) {
    var fallback = MANUFACTURER_COLORS[mfr] || MANUFACTURER_COLORS["default"];
    function pick(name, fb) { return vectors[name] || fb; }
    return {
        aH: pick("p_AColorHilight", fallback.aH),
        aM: pick("p_AColorMidtone", fallback.aM),
        aS: pick("p_AColorShadow",  fallback.aS),
        bH: pick("p_BColorHilight", fallback.bH),
        bM: pick("p_BColorMidtone", fallback.bM),
        bS: pick("p_BColorShadow",  fallback.bS),
        cH: pick("p_CColorHilight", fallback.cH),
        cM: pick("p_CColorMidtone", fallback.cM),
        cS: pick("p_CColorShadow",  fallback.cS),
    };
}

// Cache for raw HTMLImage loads keyed by URL so we don't re-fetch overlays
var _imageCache = {};
function _loadImage(url, cb) {
    if (_imageCache[url]) {
        var im = _imageCache[url];
        if (im.complete && im.naturalWidth) { cb(im); return; }
    }
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() { _imageCache[url] = img; cb(img); };
    img.onerror = function() { console.warn("Image load failed:", url); cb(null); };
    img.src = url;
    _imageCache[url] = img;
}

// Create weapon material using BL2's actual Master_Gun pipeline:
// 1. Load zone mask (p_Masks) + diffuse detail (p_Diffuse)
// 2. Pull per-rarity MIC params from weapon_materials.json (zone colors, decal/pattern,
//    intensity scalars, decal/pattern colors and positions)
// 3. Composite via _compositeBL2Texture with all overlays
// 4. Apply normal map + PBR + reflect (envMap) + rarity emissive
function createTexturedWeaponMaterial(category, rarityName, elementName, manufacturer) {
    var texInfo = WEAPON_TEXTURES[category];
    if (!texInfo) return createWeaponMaterial(rarityName, elementName);

    var mfr = manufacturer || "default";
    var knownMfrs = ["Bandit","Dahl","Hyperion","Jakobs","Maliwan","Tediore","Torgue","Vladof"];
    if (knownMfrs.indexOf(mfr) === -1) mfr = "default";

    // Per-rarity MIC data — falls back to defaults if DB not loaded yet or rarity missing
    var mfrDB = (_weaponMatDB && _weaponMatDB[mfr]) ? _weaponMatDB[mfr] : null;
    var mic = mfrDB ? (mfrDB[rarityName] || mfrDB["Common"]) : null;
    var colors = mic ? _micVectorsToColors(mic.vectors, mfr)
                     : (MANUFACTURER_COLORS[mfr] || MANUFACTURER_COLORS["default"]);

    var nrmTex = _loadTexture(texInfo.nrm);
    var cacheKey = category + "_" + mfr + "_" + (rarityName || "Common");
    var pbr = MANUFACTURER_PBR[mfr] || MANUFACTURER_PBR["default"];

    // Rarity/element emissive — subtle glow matching the item's rarity color
    var pal = RARITY_MATERIALS[rarityName] || RARITY_MATERIALS["Common"];
    var emissiveColor = new THREE.Color(pal.accent);
    var emissiveStr = 0.05;
    if (elementName && ELEMENT_COLORS[elementName]) {
        emissiveColor.lerp(new THREE.Color(ELEMENT_COLORS[elementName]), 0.4);
        emissiveStr = 0.08;
    }

    // Return cached result if available
    if (_bl2CompositeCache[cacheKey]) {
        return new THREE.MeshStandardMaterial({
            map: _bl2CompositeCache[cacheKey],
            normalMap: nrmTex,
            normalScale: new THREE.Vector2(1.5, 1.5),
            metalness: pbr.metalness,
            roughness: pbr.roughness,
            emissive: emissiveColor,
            emissiveIntensity: emissiveStr,
        });
    }

    // Create material with placeholder color — will update once textures load
    var mat = new THREE.MeshStandardMaterial({
        color: 0x444444,
        normalMap: nrmTex,
        normalScale: new THREE.Vector2(1.5, 1.5),
        metalness: pbr.metalness,
        roughness: pbr.roughness,
        emissive: emissiveColor,
        emissiveIntensity: emissiveStr,
    });

    // Load mask + diffuse + (optional) pattern + decal in parallel; composite when ready.
    var pendingLoads = 2;
    var maskImg = null, difImg = null, patImg = null, dclImg = null;

    var patUrl = mic && mic.textures && mic.textures.p_Pattern;
    var dclUrl = mic && mic.textures && mic.textures.p_Decal;
    var patIntensity = (mic && mic.scalars && mic.scalars.p_PatternIntensity != null)
        ? mic.scalars.p_PatternIntensity : 0.55; // weapons enable pattern by default
    var dclIntensity = (mic && mic.scalars && mic.scalars.p_DecalIntensity != null)
        ? mic.scalars.p_DecalIntensity : 0.7;
    if (patUrl) pendingLoads++;
    if (dclUrl) pendingLoads++;

    function tryComposite() {
        if (--pendingLoads > 0) return;
        if (!maskImg || !difImg) {
            // Fallback to diffuse-only with tint
            var difTex = _loadTexture(texInfo.dif);
            var zM = colors.aM || [0.7, 0.7, 0.7];
            mat.map = difTex;
            mat.color.setRGB(zM[0], zM[1], zM[2]);
            mat.needsUpdate = true;
            return;
        }
        var params = {};
        if (mic && mic.scalars) {
            params.shadowsIntensity = mic.scalars.p_ShadowsIntensity;
            params.highlightsIntensity = mic.scalars.p_HighlightsIntensity;
        }
        if (patImg && mic && mic.vectors) {
            params.pattern = {
                img: patImg,
                color: mic.vectors.p_PatternColor || [1,1,1],
                channelScale: mic.vectors.p_PatternChannelScale || [1,0,0],
                scalePos: mic.vectors.p_PatternScalePosition || [1,1,0,0],
                rotation: (mic.scalars && mic.scalars.p_PatternRotation) || 0,
                intensity: patIntensity,
            };
        }
        if (dclImg && mic && mic.vectors) {
            params.decal = {
                img: dclImg,
                color: mic.vectors.p_DecalColor || [1,1,1],
                scalePos: mic.vectors.p_DecalScalePosition || [1,1,0,0],
                useFullColor: !!(mic.scalars && mic.scalars.p_UseFullColorDecal),
                intensity: dclIntensity,
            };
        }
        console.log("BL2 compositing:", cacheKey,
            maskImg.width + "x" + maskImg.height,
            patImg ? "+pattern" : "", dclImg ? "+decal" : "");
        var compositeTex = _compositeBL2Texture(maskImg, difImg, colors, cacheKey, params);
        mat.map = compositeTex;
        mat.color.setRGB(1, 1, 1);
        mat.needsUpdate = true;
    }

    _loadImage(texInfo.comp, function(im) { maskImg = im; tryComposite(); });
    _loadImage(texInfo.dif,  function(im) { difImg = im;  tryComposite(); });
    if (patUrl) _loadImage(patUrl, function(im) { patImg = im; tryComposite(); });
    if (dclUrl) _loadImage(dclUrl, function(im) { dclImg = im; tryComposite(); });

    return mat;
}

function createItemMaterial(rarityName) {
    var pal = RARITY_MATERIALS[rarityName] || RARITY_MATERIALS["Common"];
    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(pal.base),
        metalness: 0.5,
        roughness: 0.45,
        emissive: new THREE.Color(pal.accent),
        emissiveIntensity: 0.06,
    });
}

// Create a textured item material using extracted game diffuse + normal maps
function createTexturedItemMaterial(category, rarityName, charClass) {
    var texInfo = null;
    if (category === "Class Mod" && charClass) {
        texInfo = CLASSMOD_TEXTURES[charClass];
    } else {
        texInfo = ITEM_TEXTURES[category];
    }
    if (!texInfo) return createItemMaterial(rarityName);

    var pal = RARITY_MATERIALS[rarityName] || RARITY_MATERIALS["Common"];
    var rarityColor = new THREE.Color(pal.base);
    // Lighten the tint so it doesn't overpower the diffuse texture
    var tint = rarityColor.clone().lerp(new THREE.Color(0.7, 0.7, 0.7), 0.5);

    var opts = {
        map: _loadTexture(texInfo.dif),
        color: tint,
        metalness: 0.3,
        roughness: 0.50,
        emissive: new THREE.Color(pal.accent),
        emissiveIntensity: 0.04,
    };

    if (texInfo.nrm) {
        opts.normalMap = _loadTexture(texInfo.nrm);
        opts.normalScale = new THREE.Vector2(0.7, 0.7);
    }

    return new THREE.MeshStandardMaterial(opts);
}

// Dispose all textures on a material (skip cached textures from _textureCache)
var _texProps = ['map','normalMap','roughnessMap','metalnessMap','emissiveMap',
                'aoMap','lightMap','bumpMap','displacementMap','alphaMap',
                'envMap','specularMap'];
function _disposeMaterialTextures(m) {
    if (!m) return;
    // Build a Set of cached texture references for O(1) lookup
    var cachedSet = new Set();
    for (var k in _textureCache) cachedSet.add(_textureCache[k]);
    for (var k2 in _bl2CompositeCache) cachedSet.add(_bl2CompositeCache[k2]);
    for (var k3 in _skinCompositeCache) cachedSet.add(_skinCompositeCache[k3]);
    for (var i = 0; i < _texProps.length; i++) {
        var tex = m[_texProps[i]];
        if (tex) {
            if (!cachedSet.has(tex)) tex.dispose();
            m[_texProps[i]] = null;
        }
    }
}

function applyMaterialOverride(group, material) {
    if (!group || !material) return;
    group.traverse(function(child) {
        if (child.isMesh) {
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(function(m) {
                        _disposeMaterialTextures(m);
                        m.dispose();
                    });
                } else {
                    _disposeMaterialTextures(child.material);
                    child.material.dispose();
                }
            }
            child.material = material;
        }
    });
}

// Apply a color tint to character model — applies to both body and head
function applyCharacterTint(group, r, g, b) {
    if (!group) return;
    var tint = new THREE.Color(r / 255, g / 255, b / 255);
    // Traverse ALL children (body group + head group), but skip head if MIC material is applied
    group.traverse(function(child) {
        // Walk up to find an ancestor with the MIC flag
        var p = child;
        while (p) {
            if (p.userData && p.userData._micHeadApplied) return;
            p = p.parent;
        }
        if (child.isMesh && child.material) {
            var mats = Array.isArray(child.material) ? child.material : [child.material];
            for (var i = 0; i < mats.length; i++) {
                if (!mats[i]._tintCloned) {
                    mats[i] = mats[i].clone();
                    mats[i]._tintCloned = true;
                    mats[i]._origColor = mats[i].color.clone();
                    if (Array.isArray(child.material)) child.material[i] = mats[i];
                    else child.material = mats[i];
                }
                if (mats[i]._origColor) mats[i].color.copy(mats[i]._origColor);
                mats[i].color.lerp(tint, 0.4);
                mats[i].emissive.copy(tint);
                mats[i].emissiveIntensity = 0.2;
                mats[i].needsUpdate = true;
            }
        }
    });
}

// Skin color database (loaded from skin_colors.json)
var _skinColorsDB = null;

(function() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/static/skin_colors.json", true);
    xhr.onload = function() {
        if (xhr.status === 200) {
            try {
                _skinColorsDB = JSON.parse(xhr.responseText);
                console.log("Loaded " + Object.keys(_skinColorsDB).length + " skin color entries");
            } catch(e) { console.warn("Failed to parse skin_colors.json"); }
        }
    };
    xhr.send();
})();

// ─── BL2 Skin Zone Compositing ───────────────────────────
// Extracted zone mask textures (R=zone A, G=zone B, B=zone C) from the actual game.
// These define exactly which parts of each character's body get which skin color zone.
var BODY_MASK_PATHS = {
    "Axton":    "/static/models/characters/Axton/body_mask.png",
    "Zer0":     "/static/models/characters/Zer0/body_mask.png",
    "Maya":     "/static/models/characters/Maya/body_mask.png",
    "Salvador": "/static/models/characters/Salvador/body_mask.png",
    "Gaige":    "/static/models/characters/Gaige/body_mask.png",
    "Krieg":    "/static/models/characters/Krieg/body_mask.png",
};

var _bodyMaskImages = {};   // charName -> HTMLImageElement (loaded zone mask)
var _skinCompositeCache = {};

// Pre-load all body zone masks
(function() {
    for (var name in BODY_MASK_PATHS) {
        (function(charName, url) {
            var img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = function() {
                _bodyMaskImages[charName] = img;
                console.log("Body mask loaded:", charName, img.width + "x" + img.height);
            };
            img.onerror = function() { console.warn("Body mask failed:", charName); };
            img.src = url;
        })(name, BODY_MASK_PATHS[name]);
    }
})();

// Composite a texture using the zone mask + skin zone colors.
// maskImg: HTMLImageElement of the zone mask (R=A, G=B, B=C)
// difImg:  HTMLImageElement of the base diffuse texture
// zones:   { a: [r,g,b], b: [r,g,b], c: [r,g,b] } in linear color space
function _compositeSkinWithMask(maskImg, difImg, zones, cacheKey) {
    if (_skinCompositeCache[cacheKey]) return _skinCompositeCache[cacheKey];

    // Use the diffuse texture dimensions (mask may differ)
    var w = difImg.width, h = difImg.height;
    var canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d");

    // Read diffuse pixels
    ctx.drawImage(difImg, 0, 0, w, h);
    var difData = ctx.getImageData(0, 0, w, h);
    var difPx = difData.data;

    // Read mask pixels (scale to same size as diffuse)
    var maskCanvas = document.createElement("canvas");
    maskCanvas.width = w; maskCanvas.height = h;
    var mctx = maskCanvas.getContext("2d");
    mctx.drawImage(maskImg, 0, 0, w, h);
    var maskData = mctx.getImageData(0, 0, w, h);
    var mPx = maskData.data;

    var zA = zones.a || [0.1, 0.1, 0.1];
    var zB = zones.b || zA;
    var zC = zones.c || zA;

    for (var i = 0; i < difPx.length; i += 4) {
        // Zone weights from mask texture R/G/B channels
        var wA = mPx[i] / 255;       // Red = zone A
        var wB = mPx[i + 1] / 255;   // Green = zone B
        var wC = mPx[i + 2] / 255;   // Blue = zone C
        var total = wA + wB + wC;

        // Original diffuse in linear space
        var sR = Math.pow(difPx[i] / 255, 2.2);
        var sG = Math.pow(difPx[i + 1] / 255, 2.2);
        var sB = Math.pow(difPx[i + 2] / 255, 2.2);
        var lum = sR * 0.299 + sG * 0.587 + sB * 0.114;

        var cr, cg, cb;
        if (total < 0.02) {
            // Unmasked area — keep original diffuse
            cr = sR; cg = sG; cb = sB;
        } else {
            // Normalize zone weights
            var nA = wA / total, nB = wB / total, nC = wC / total;

            // Use diffuse luminance to modulate tone — darker diffuse areas get
            // darkened zone colors, brighter areas get lightened zone colors.
            // This mimics BL2's shadow/highlight shading on skin zones.
            var t = Math.max(0, Math.min(1, lum * 1.5));  // luminance → tone factor
            var darkMul = 0.5 + t * 0.5;   // shadow range: 0.5 → 1.0
            var brightMul = 0.8 + t * 0.4;  // highlight range: 0.8 → 1.2

            // Blend zone colors weighted by mask, modulated by tone
            var mul = darkMul * (1.0 - t) + brightMul * t;
            cr = (zA[0] * nA + zB[0] * nB + zC[0] * nC) * mul;
            cg = (zA[1] * nA + zB[1] * nB + zC[1] * nC) * mul;
            cb = (zA[2] * nA + zB[2] * nB + zC[2] * nC) * mul;

            // Preserve diffuse shading detail via luminance modulation
            var lumScale = lum * 0.5 + 0.5;
            cr *= lumScale;
            cg *= lumScale;
            cb *= lumScale;
        }

        // Reinhard tonemap
        cr = cr / (cr + 1.0);
        cg = cg / (cg + 1.0);
        cb = cb / (cb + 1.0);

        // Linear to sRGB
        difPx[i]     = Math.min(255, Math.pow(Math.max(cr, 0), 1.0 / 2.2) * 255 + 0.5) | 0;
        difPx[i + 1] = Math.min(255, Math.pow(Math.max(cg, 0), 1.0 / 2.2) * 255 + 0.5) | 0;
        difPx[i + 2] = Math.min(255, Math.pow(Math.max(cb, 0), 1.0 / 2.2) * 255 + 0.5) | 0;
    }

    ctx.putImageData(difData, 0, 0);
    var tex = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    else if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    _skinCompositeCache[cacheKey] = tex;
    return tex;
}

// Fallback: composite without zone mask, using diffuse luminance to approximate zones
function _compositeSkinFallback(difImg, zones, cacheKey) {
    if (_skinCompositeCache[cacheKey]) return _skinCompositeCache[cacheKey];

    var w = difImg.width, h = difImg.height;
    var canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(difImg, 0, 0);
    var imgData = ctx.getImageData(0, 0, w, h);
    var px = imgData.data;

    var zA = zones.a || [0.1, 0.1, 0.1];
    var zB = zones.b || zA;
    var zC = zones.c || zA;

    for (var i = 0; i < px.length; i += 4) {
        var sR = Math.pow(px[i] / 255, 2.2);
        var sG = Math.pow(px[i + 1] / 255, 2.2);
        var sB = Math.pow(px[i + 2] / 255, 2.2);
        var lum = sR * 0.299 + sG * 0.587 + sB * 0.114;

        // BL2 skins: A=primary/dominant, B=secondary/accent, C=tertiary/dark detail
        // Zone A covers the majority of the model, B appears on bright accent panels, C on shadows
        var wB = Math.max(0, Math.min(1, (lum - 0.4) * 3.0));
        var wC = Math.max(0, Math.min(1, (0.15 - lum) * 5.0));
        var wA = Math.max(0, 1.0 - wB - wC);

        var cr = zA[0] * wA + zB[0] * wB + zC[0] * wC;
        var cg = zA[1] * wA + zB[1] * wB + zC[1] * wC;
        var cb = zA[2] * wA + zB[2] * wB + zC[2] * wC;

        cr = cr * (lum * 0.6 + 0.4);
        cg = cg * (lum * 0.6 + 0.4);
        cb = cb * (lum * 0.6 + 0.4);

        cr = cr / (cr + 1.0);
        cg = cg / (cg + 1.0);
        cb = cb / (cb + 1.0);

        px[i]     = Math.min(255, Math.pow(Math.max(cr, 0), 1.0 / 2.2) * 255 + 0.5) | 0;
        px[i + 1] = Math.min(255, Math.pow(Math.max(cg, 0), 1.0 / 2.2) * 255 + 0.5) | 0;
        px[i + 2] = Math.min(255, Math.pow(Math.max(cb, 0), 1.0 / 2.2) * 255 + 0.5) | 0;
    }

    ctx.putImageData(imgData, 0, 0);
    var tex = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    else if (tex.encoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    _skinCompositeCache[cacheKey] = tex;
    return tex;
}

// Apply BL2 skin colors by compositing zone mask + diffuse + skin zone colors.
// Uses the actual extracted zone mask textures from the game when available.
// zones: { a: [r,g,b], b: [r,g,b], c: [r,g,b] } in linear color space (0-1)
function applySkinColors(group, zones) {
    if (!group || !zones) return;
    var charName = _currentCharName || "";
    var maskImg = _bodyMaskImages[charName] || null;

    function recolorSubgroup(subgroup, partName, useMask) {
        if (!subgroup) return;
        // Skip if a real MIC material has already been applied to this subgroup —
        // the per-head Mati_* texture/color set is ground truth, don't overwrite it.
        if (subgroup.userData && subgroup.userData._micHeadApplied) return;
        subgroup.traverse(function(child) {
            if (!child.isMesh || !child.material) return;
            var mats = Array.isArray(child.material) ? child.material : [child.material];
            for (var idx = 0; idx < mats.length; idx++) {
                var mat = mats[idx];
                if (!mat._skinCloned) {
                    mat = mat.clone();
                    mat._skinCloned = true;
                    mat._origMap = mat.map;
                    if (Array.isArray(child.material)) child.material[idx] = mat;
                    else child.material = mat;
                }

                var srcMap = mat._origMap;
                if (srcMap && srcMap.image && srcMap.image.complete && srcMap.image.width > 0) {
                    // Compact cache key — round zone values to 4 decimal places to avoid float noise
                    var _zk = function(z) { return z.map(function(v) { return v.toFixed(4); }).join(","); };
                    var cacheKey = charName + "_" + partName + "_" + _zk(zones.a) + "_" + _zk(zones.b || zones.a) + "_" + _zk(zones.c || zones.a);
                    var skinTex;
                    if (useMask && maskImg) {
                        skinTex = _compositeSkinWithMask(maskImg, srcMap.image, zones, cacheKey);
                    } else {
                        skinTex = _compositeSkinFallback(srcMap.image, zones, cacheKey + "_fb");
                    }
                    mat.map = skinTex;
                    mat.color.setRGB(1, 1, 1);
                } else {
                    // Texture not loaded yet — color tint fallback
                    var zA = zones.a || [0.1, 0.1, 0.1];
                    var zB = zones.b || zA;
                    var blendR = (zA[0] * 0.6 + zB[0] * 0.4) / ((zA[0] * 0.6 + zB[0] * 0.4) + 1.0);
                    var blendG = (zA[1] * 0.6 + zB[1] * 0.4) / ((zA[1] * 0.6 + zB[1] * 0.4) + 1.0);
                    var blendB = (zA[2] * 0.6 + zB[2] * 0.4) / ((zA[2] * 0.6 + zB[2] * 0.4) + 1.0);
                    mat.color.setRGB(
                        Math.pow(blendR, 1.0 / 2.2),
                        Math.pow(blendG, 1.0 / 2.2),
                        Math.pow(blendB, 1.0 / 2.2)
                    );
                }
                mat.emissiveIntensity = 0.08;
                mat.needsUpdate = true;
            }
        });
    }

    if (group.children && group.children.length >= 2) {
        // Find body (loadIndex 0) and head (loadIndex 1) by tag, not position
        // This is safe against async load order changes
        var bodyGroup = null, headGroup = null;
        for (var ci = 0; ci < group.children.length; ci++) {
            var idx = group.children[ci].userData._loadIndex;
            if (idx === 0) bodyGroup = group.children[ci];
            else if (idx === 1) headGroup = group.children[ci];
        }
        if (!bodyGroup) bodyGroup = group.children[0];
        if (!headGroup && group.children.length >= 2) headGroup = group.children[1];
        recolorSubgroup(bodyGroup, "body", true);     // Body uses zone mask
        recolorSubgroup(headGroup, "head", false);    // Head uses luminance fallback
    } else {
        recolorSubgroup(group, "body", true);
    }
}

// Apply a head's actual MIC material — diffuse + zone mask + zone colors,
// optional decal/pattern/reflect, special hologram/digistruct/power flags.
// headGroup is the head GLTF scene (just the head, not the full character group).
var _headMaterialCache = {};
function applyHeadMaterial(headGroup, headAsset) {
    if (!headGroup || !headAsset || !_headMatDB) return false;
    var mic = _headMatDB[headAsset];
    if (!mic || !mic.textures) return false;
    var difUrl = mic.textures.p_Diffuse;
    var maskUrl = mic.textures.p_Masks;
    var nrmUrl = mic.textures.p_Normal;
    var refUrl = mic.textures.P_SimpleReflect;
    var patUrl = mic.textures.p_Pattern;
    var dclUrl = mic.textures.p_Decal;
    if (!difUrl || !maskUrl) return false;

    var colors = _micVectorsToColors(mic.vectors || {}, "default");
    var cacheKey = "head_" + headAsset;
    // We DON'T set the _micHeadApplied flag here — only when textures actually
    // composite successfully (in tryComposite below). If MIC assets 404, the
    // synchronous skin recolor still wins, so heads stay tinted instead of grey.

    function applyMat(mat) {
        headGroup.traverse(function(child) {
            if (!child.isMesh || !child.material) return;
            // Swap material — preserve UV setup
            var old = child.material;
            child.material = mat;
            if (Array.isArray(old)) old.forEach(function(m) { _disposeMaterialTextures(m); m.dispose(); });
            else { _disposeMaterialTextures(old); old.dispose(); }
        });
    }

    var pendingLoads = 2;
    var maskImg = null, difImg = null, patImg = null, dclImg = null;
    if (patUrl) pendingLoads++;
    if (dclUrl) pendingLoads++;

    function tryComposite() {
        if (--pendingLoads > 0) return;
        if (!maskImg || !difImg) return;

        var params = {
            shadowsIntensity: (mic.scalars && mic.scalars.p_ShadowsIntensity) || 2,
            highlightsIntensity: (mic.scalars && mic.scalars.p_HighlightsIntensity) || 2,
        };
        var patIntensity = (mic.scalars && mic.scalars.p_PatternIntensity) || 0;
        var dclIntensity = (mic.scalars && mic.scalars.p_DecalIntensity) || 0;
        if (patImg && patIntensity > 0.001) {
            params.pattern = {
                img: patImg,
                color: mic.vectors.p_PatternColor || [1,1,1],
                channelScale: mic.vectors.p_PatternChannelScale || [1,1,1],
                scalePos: mic.vectors.p_PatternScalePosition || [1,1,0,0],
                rotation: (mic.scalars && mic.scalars.p_PatternRotation) || 0,
                intensity: patIntensity,
            };
        }
        if (dclImg && dclIntensity > 0.001) {
            params.decal = {
                img: dclImg,
                color: mic.vectors.p_DecalColor || [1,1,1],
                scalePos: mic.vectors.p_DecalScalePosition || [1,1,0,0],
                useFullColor: !!(mic.scalars && mic.scalars.p_UseFullColorDecal),
                intensity: dclIntensity,
            };
        }

        var compTex = _compositeBL2Texture(maskImg, difImg, colors, cacheKey, params);
        var matOpts = {
            map: compTex,
            metalness: 0.25,
            roughness: 0.55,
            emissive: new THREE.Color(0, 0, 0),
            emissiveIntensity: 0.0,
        };
        if (nrmUrl) {
            matOpts.normalMap = _loadTexture(nrmUrl);
            matOpts.normalScale = new THREE.Vector2(0.9, 0.9);
        }
        if (refUrl) {
            // Use reflect texture as an env-style sphere map for cheap shine
            var rt = _loadTexture(refUrl);
            rt.mapping = THREE.EquirectangularReflectionMapping;
            matOpts.envMap = rt;
            var refCol = (mic.vectors && mic.vectors.p_ReflectColor) || [1,1,1];
            matOpts.envMapIntensity = (refCol[0] + refCol[1] + refCol[2]) / 3;
        }
        var mat = new THREE.MeshStandardMaterial(matOpts);
        // Apply emissive base color from MIC (e.g. Iris head has red glow)
        if (mic.vectors && mic.vectors.p_EmissiveColor) {
            var ec = mic.vectors.p_EmissiveColor;
            // EmissiveColor values are HDR; clamp into a usable range
            var maxC = Math.max(ec[0], ec[1], ec[2], 1);
            mat.emissive.setRGB(ec[0] / maxC, ec[1] / maxC, ec[2] / maxC);
            mat.emissiveIntensity = Math.min(0.4, maxC * 0.04);
        }
        applyMat(mat);
        headGroup.userData._micHeadApplied = true;
        if (mic.scalars) _registerSpecialMaterial(mat, mic.scalars, mic.vectors);
    }

    _loadImage(maskUrl, function(im) { maskImg = im; tryComposite(); });
    _loadImage(difUrl,  function(im) { difImg = im;  tryComposite(); });
    if (patUrl) _loadImage(patUrl, function(im) { patImg = im; tryComposite(); });
    if (dclUrl) _loadImage(dclUrl, function(im) { dclImg = im; tryComposite(); });
    return true;
}

// Look up skin asset path in the color database and apply
function applySkinFromAsset(group, skinAssetPath) {
    if (!group || !skinAssetPath || !_skinColorsDB) return false;
    var entry = _skinColorsDB[skinAssetPath];
    if (!entry || !entry.zones) return false;
    _currentSkinAsset = skinAssetPath;
    applySkinColors(group, entry.zones);
    return true;
}

// Get skin color data for a given asset path
function getSkinColorData(skinAssetPath) {
    if (!_skinColorsDB || !skinAssetPath) return null;
    return _skinColorsDB[skinAssetPath] || null;
}

// ─── Special skin effects (hologram / digistruct / power emissive) ───────
// BL2 has special skins that switch on shader features via static scalars in the MIC:
//   p_Hologram_Enable     — translucent emissive cyan with scanline modulation
//   p_DigiStructEnable    — animated grid emissive in p_DigiStructColor
//   p_EnablePowerEmissive — pulsing emissive in p_PowerEmissiveColor (e.g. boss skins)
// We track the materials that opted in and tick them each frame.
var _specialMaterials = []; // [{ mat, kind, color, phase }]

function _tickSpecialEffects(scene) {
    if (!_specialMaterials.length) return;
    var t = performance.now() * 0.001;
    for (var i = _specialMaterials.length - 1; i >= 0; i--) {
        var rec = _specialMaterials[i];
        var mat = rec.mat;
        if (!mat || mat._disposed) {
            _specialMaterials.splice(i, 1);
            continue;
        }
        var phase = t + rec.phase;
        if (rec.kind === "hologram") {
            // Cyan flicker, opacity pulses with sine
            var s = 0.6 + 0.4 * Math.sin(phase * 4.0);
            mat.emissive.setRGB(0.1 * s, 0.8 * s, 1.0 * s);
            mat.emissiveIntensity = 0.6 + 0.3 * Math.sin(phase * 2.0);
            mat.opacity = 0.55 + 0.25 * Math.sin(phase * 5.0);
            mat.transparent = true;
        } else if (rec.kind === "digistruct") {
            var s2 = 0.7 + 0.3 * Math.sin(phase * 3.0);
            mat.emissive.setRGB(rec.color[0] * s2, rec.color[1] * s2, rec.color[2] * s2);
            mat.emissiveIntensity = 0.4 + 0.2 * Math.sin(phase * 4.0);
        } else if (rec.kind === "power") {
            // Sustained bloom — slow gentle breathing
            var s3 = 0.85 + 0.15 * Math.sin(phase * 1.5);
            mat.emissive.setRGB(
                Math.min(1, rec.color[0] / 20 * s3),
                Math.min(1, rec.color[1] / 20 * s3),
                Math.min(1, rec.color[2] / 20 * s3)
            );
            mat.emissiveIntensity = 1.5 + 0.5 * Math.sin(phase * 1.5);
        }
        mat.needsUpdate = true;
    }
}

function _registerSpecialMaterial(mat, scalars, vectors) {
    if (!mat || !scalars) return;
    var kind = null, color = [1, 1, 1];
    if (scalars.p_Hologram_Enable && scalars.p_Hologram_Enable > 0.5) {
        kind = "hologram";
    } else if (scalars.p_DigiStructEnable && scalars.p_DigiStructEnable > 0.5) {
        kind = "digistruct";
        color = (vectors && vectors.p_DigiStructColor) || [0.2, 1.0, 3.0];
    } else if (scalars.p_EnablePowerEmissive && scalars.p_EnablePowerEmissive > 0.5) {
        kind = "power";
        color = (vectors && vectors.p_PowerEmissiveColor) || [0, 14.5545, 20];
    }
    if (!kind) return;
    _specialMaterials.push({
        mat: mat, kind: kind, color: color,
        phase: Math.random() * Math.PI * 2,
    });
}

// ─── BL2 Sobel Ink-Outline Pass ──────────────────────────
// BL2 famously uses a screen-space Sobel edge detector to draw the inked outlines
// over its 3D models. We render the scene as normal, then run a Sobel pass on the
// luminance and multiply the result back over the color buffer (darken at edges).
THREE.BL2InkShader = {
    uniforms: {
        tDiffuse: { value: null },
        tEdges:   { value: null },
        edgeStrength: { value: 1.1 },   // how dark the inked lines get
        edgeThreshold: { value: 0.10 },  // ignore noise below this
    },
    vertexShader: [
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
    ].join("\n"),
    fragmentShader: [
        "uniform sampler2D tDiffuse;",
        "uniform sampler2D tEdges;",
        "uniform float edgeStrength;",
        "uniform float edgeThreshold;",
        "varying vec2 vUv;",
        "void main() {",
        "  vec4 base = texture2D(tDiffuse, vUv);",
        "  float edge = texture2D(tEdges, vUv).r;",
        "  edge = smoothstep(edgeThreshold, edgeThreshold + 0.18, edge);",
        "  float darken = 1.0 - clamp(edge * edgeStrength, 0.0, 0.65);",
        "  gl_FragColor = vec4(base.rgb * darken, base.a);",
        "}"
    ].join("\n"),
};

// ─── Viewer Factory ───────────────────────────────────────
function createViewer(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return null;

    var oldCanvas = container.querySelector("canvas");
    if (oldCanvas) oldCanvas.remove();

    var w = container.clientWidth || 400;
    var h = container.clientHeight || 400;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, w / h, 0.01, 100);
    camera.position.set(0, 1.2, 2.5);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor(0x0a0c14, 1);
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ── BL2 ink-outline post-process pipeline ─────────────
    // Render the scene to a buffer, derive luminance, run a Sobel edge filter,
    // then composite the original color with the inked edges to get the BL2 look.
    var composer = null, finalPass = null;
    if (typeof THREE.EffectComposer !== "undefined" && typeof THREE.SobelOperatorShader !== "undefined") {
        composer = new THREE.EffectComposer(renderer);
        var renderPass = new THREE.RenderPass(scene, camera);
        composer.addPass(renderPass);

        // Build a SECOND composer to extract edges. Pipeline: Render -> Luminosity -> Sobel
        // EffectComposer only carries one buffer, so we use a manual offscreen target + passes.
        var edgeTarget = new THREE.WebGLRenderTarget(w, h, {
            minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
        });
        var edgeComposer = new THREE.EffectComposer(renderer, edgeTarget);
        edgeComposer.renderToScreen = false;
        edgeComposer.addPass(new THREE.RenderPass(scene, camera));
        var lumPass = new THREE.ShaderPass(THREE.LuminosityShader);
        edgeComposer.addPass(lumPass);
        var sobelPass = new THREE.ShaderPass(THREE.SobelOperatorShader);
        sobelPass.uniforms.resolution.value.x = w * Math.min(window.devicePixelRatio, 2);
        sobelPass.uniforms.resolution.value.y = h * Math.min(window.devicePixelRatio, 2);
        edgeComposer.addPass(sobelPass);

        finalPass = new THREE.ShaderPass(THREE.BL2InkShader);
        finalPass.uniforms.tEdges.value = edgeComposer.readBuffer.texture;
        finalPass.renderToScreen = true;
        composer.addPass(finalPass);

        // Stash on the composer object for the resize handler
        composer._edgeComposer = edgeComposer;
        composer._sobelPass = sobelPass;
    }

    var controls = null;
    if (typeof THREE.OrbitControls !== "undefined") {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 1.0, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.minDistance = 0.5;
        controls.maxDistance = 6.0;
        controls.maxPolarAngle = Math.PI * 0.85;
        controls.update();
    }

    // Lighting — warm key, cool fill, BL2 amber rim
    var keyLight = new THREE.DirectionalLight(0xfff0dd, 3.2);
    keyLight.position.set(2, 3, 2);
    scene.add(keyLight);
    var fillLight = new THREE.DirectionalLight(0x99aadd, 1.3);
    fillLight.position.set(-2, 1, -1);
    scene.add(fillLight);
    // Rim light — this one gets dynamically colored by equipped rarity
    var rimLight = new THREE.DirectionalLight(0xfcb100, 0.9);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);
    var bottomFill = new THREE.DirectionalLight(0x556688, 0.55);
    bottomFill.position.set(0, -2, 1);
    scene.add(bottomFill);
    scene.add(new THREE.AmbientLight(0x6677aa, 1.05));

    // Ground indicator
    var groundGeo = new THREE.RingGeometry(0.4, 0.6, 32);
    var groundMat = new THREE.MeshBasicMaterial({ color: 0xfcb100, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    var currentModel = null;
    var animId = null;
    var rotSpeed = 0.003;
    var _pulsePhase = 0;

    function animate() {
        animId = requestAnimationFrame(animate);
        if (controls) controls.update();
        if (currentModel) currentModel.rotation.y += rotSpeed;
        // Subtle rim light pulse for high-rarity items
        if (rimLight._pulseEnabled) {
            _pulsePhase += 0.02;
            var pulse = 0.7 + Math.sin(_pulsePhase) * 0.2;
            rimLight.intensity = pulse;
        }
        // Animate hologram/digistruct/poweremissive pulses (per material)
        _tickSpecialEffects(scene);
        if (composer) {
            // Render edges first, then composite with original color
            composer._edgeComposer.render();
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }

    var ro = new ResizeObserver(function(entries) {
        for (var i = 0; i < entries.length; i++) {
            var rect = entries[i].contentRect;
            if (rect.width > 0 && rect.height > 0) {
                camera.aspect = rect.width / rect.height;
                camera.updateProjectionMatrix();
                renderer.setSize(rect.width, rect.height);
                if (composer) {
                    var pr = Math.min(window.devicePixelRatio, 2);
                    composer.setSize(rect.width, rect.height);
                    composer._edgeComposer.setSize(rect.width, rect.height);
                    composer._sobelPass.uniforms.resolution.value.x = rect.width * pr;
                    composer._sobelPass.uniforms.resolution.value.y = rect.height * pr;
                }
            }
        }
    });
    ro.observe(container);
    animate();

    return {
        scene: scene,
        camera: camera,
        renderer: renderer,
        controls: controls,
        rimLight: rimLight,
        ground: ground,
        groundMat: groundMat,
        currentModel: null,

        clearModel: function() {
            if (this.currentModel) {
                scene.remove(this.currentModel);
                this.currentModel.traverse(function(child) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(function(m) { m.dispose(); });
                        else child.material.dispose();
                    }
                });
                this.currentModel = null;
                currentModel = null;
            }
        },

        loadModel: function(urls, opts) {
            var self = this;
            self.clearModel();
            opts = opts || {};
            var fitHeight = opts.fitHeight || 2.0;
            var cameraY = opts.cameraY || 1.0;
            rotSpeed = (opts.spin !== undefined) ? opts.spin : 0.003;
            var overrideMaterial = opts.material || null;
            var onLoadedCb = opts.onLoaded || null;

            if (!Array.isArray(urls)) urls = [urls];
            var GLTFLoaderClass = THREE.GLTFLoader;
            if (!GLTFLoaderClass) { console.warn("GLTFLoader not available"); return; }
            var loader = new GLTFLoaderClass();
            var group = new THREE.Group();
            var loaded = 0;
            var failed = 0;
            var total = urls.length;

            function onDone() {
                if (failed >= total) return;
                // Sort children by load index to guarantee deterministic order
                // (async loads can complete in any order)
                group.children.sort(function(a, b) {
                    return (a.userData._loadIndex || 0) - (b.userData._loadIndex || 0);
                });
                if (overrideMaterial) {
                    applyMaterialOverride(group, overrideMaterial);
                }
                var box = new THREE.Box3().setFromObject(group);
                var size = box.getSize(new THREE.Vector3());
                var center = box.getCenter(new THREE.Vector3());
                var maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim === 0) maxDim = 1;
                var scale = fitHeight / maxDim;
                group.scale.setScalar(scale);
                group.position.x = -center.x * scale;
                group.position.y = -box.min.y * scale;
                group.position.z = -center.z * scale;

                self.currentModel = group;
                currentModel = group;
                scene.add(group);

                if (controls) {
                    controls.target.set(0, cameraY, 0);
                    camera.position.set(0, cameraY + 0.2, fitHeight * 1.6);
                    controls.update();
                }
                if (onLoadedCb) onLoadedCb(group);
            }

            function tryFinish() {
                loaded++;
                if (loaded >= total) onDone();
            }

            for (var i = 0; i < urls.length; i++) {
                (function(url, idx) {
                    loader.load(url, function(gltf) {
                        gltf.scene.userData._loadIndex = idx;
                        group.add(gltf.scene);
                        tryFinish();
                    }, undefined, function(err) {
                        console.warn("Failed to load:", url);
                        failed++;
                        tryFinish();
                    });
                })(urls[i], i);
            }
        },

        setMaterial: function(material) {
            if (this.currentModel && material) {
                applyMaterialOverride(this.currentModel, material);
            }
        },

        // Set rim light color and intensity based on rarity
        setAccentLight: function(rarityName, elementName) {
            var pal = RARITY_MATERIALS[rarityName] || RARITY_MATERIALS["Common"];
            var col = new THREE.Color(pal.accent);
            if (elementName && ELEMENT_COLORS[elementName]) {
                col.lerp(new THREE.Color(ELEMENT_COLORS[elementName]), 0.3);
            }
            rimLight.color.copy(col);
            groundMat.color.copy(col);
            var rank = RARITY_RANK[rarityName] || 0;
            rimLight.intensity = 0.6 + rank * 0.2;
            // Enable pulse for legendary+
            rimLight._pulseEnabled = rank >= 4;
            if (!rimLight._pulseEnabled) {
                rimLight.intensity = 0.6 + rank * 0.2;
            }
        },

        // Reset accent to default amber
        resetAccentLight: function() {
            rimLight.color.set(0xfcb100);
            rimLight.intensity = 0.9;
            rimLight._pulseEnabled = false;
            groundMat.color.set(0xfcb100);
        },

        destroy: function() {
            this.clearModel();
            if (animId) cancelAnimationFrame(animId);
            ro.disconnect();
            renderer.dispose();
            renderer.domElement.remove();
        }
    };
}

// ─── Global Character Viewer ──────────────────────────────
var charViewer = null;
var _charViewerMode = "character"; // "character" | "equipment"
var _currentCharName = null;
var _equippedItems = []; // [{category, rarityName, elementName, charClass, label, item}]
var _equipCarouselIdx = -1;

function initViewer(containerId) {
    // If viewer exists but canvas is gone (e.g., container was hidden/destroyed), recreate
    var container = document.getElementById(containerId);
    if (charViewer && container && container.querySelector("canvas")) return;
    if (charViewer) { charViewer.destroy(); charViewer = null; }
    charViewer = createViewer(containerId);
}

var _pendingCharTint = null;
var _currentSkinAsset = null; // track current skin for re-apply after head swap
var _headModelsMap = null; // loaded from head_models.json
var _currentHeadAsset = null;

// Load head model mapping on startup
(function() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/static/head_models.json", true);
    xhr.onload = function() {
        if (xhr.status === 200) {
            try {
                _headModelsMap = JSON.parse(xhr.responseText);
                console.log("Loaded " + Object.keys(_headModelsMap).length + " head model mappings");
            } catch(e) { console.warn("Failed to parse head_models.json"); }
        }
    };
    xhr.send();
})();

function _resolveHeadUrl(charName, headAsset) {
    // Try to find the head model GLTF from the mapping
    if (_headModelsMap && headAsset && _headModelsMap[headAsset]) {
        return _headModelsMap[headAsset];
    }
    // Fallback to default head for this character
    var info = CHARACTER_MODELS[charName];
    return info ? info.head : null;
}

function loadCharacterModel(charName, appearanceColors, headAsset, skinAsset) {
    if (!charViewer) return;
    _currentCharName = charName;
    _charViewerMode = "character";
    var info = CHARACTER_MODELS[charName];
    if (!info) return;
    charViewer.resetAccentLight();

    // Resolve head URL from asset path or use default
    _currentHeadAsset = headAsset || null;
    var headUrl = _resolveHeadUrl(charName, headAsset);
    if (!headUrl) headUrl = info.head;

    // Store tint for after model loads
    _pendingCharTint = (appearanceColors && appearanceColors.length > 0) ? appearanceColors[0] : null;
    // Project Paris Bug 3: skin was applied via setTimeout(800) race condition.
    // Now applied in onLoaded callback which fires after model is actually ready.
    var _pendingSkin = skinAsset || null;
    charViewer.loadModel([info.body, headUrl], {
        fitHeight: 2.0, cameraY: 0.9, spin: 0.004,
        onLoaded: function(group) {
            // Apply per-head MIC material (real diffuse/mask/normal/reflect/decal/pattern + zone colors)
            // BEFORE skin recolor — applyHeadMaterial flags the head subgroup so applySkinColors
            // skips the head and only recolors the body.
            var headSub = null;
            for (var ci = 0; ci < group.children.length; ci++) {
                if (group.children[ci].userData._loadIndex === 1) { headSub = group.children[ci]; break; }
            }
            if (headSub && _currentHeadAsset) applyHeadMaterial(headSub, _currentHeadAsset);
            if (_pendingSkin && typeof applySkinFromAsset === "function") {
                applySkinFromAsset(group, _pendingSkin);
            } else if (_pendingCharTint) {
                applyCharacterTint(group, _pendingCharTint.r, _pendingCharTint.g, _pendingCharTint.b);
            }
        }
    });
    _updateViewportOverlay();
}

// Swap just the head model without reloading the body
function swapHeadModel(headAsset) {
    if (!charViewer || !charViewer.currentModel || !_currentCharName) return;
    var headUrl = _resolveHeadUrl(_currentCharName, headAsset);
    if (!headUrl) return;
    _currentHeadAsset = headAsset;

    // Remove existing head group (second child of the main group)
    var group = charViewer.currentModel;
    if (group.children.length >= 2) {
        var oldHead = group.children[1];
        group.remove(oldHead);
        oldHead.traverse(function(child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(function(m) { m.dispose(); });
                else child.material.dispose();
            }
        });
    }

    // Load new head into the same group
    var loader = new THREE.GLTFLoader();
    loader.load(headUrl, function(gltf) {
        // Tag the new head with loadIndex 1 so applySkinColors can find it
        gltf.scene.userData._loadIndex = 1;
        group.add(gltf.scene);
        // Apply per-head MIC material first — flags the subgroup so skin recolor skips it.
        applyHeadMaterial(gltf.scene, headAsset);
        // Re-apply skin colors to the entire group (body + new head — head will be skipped if MIC applied)
        if (_currentSkinAsset && _skinColorsDB && _skinColorsDB[_currentSkinAsset]) {
            applySkinColors(group, _skinColorsDB[_currentSkinAsset].zones);
        } else if (_pendingCharTint) {
            applyCharacterTint(gltf.scene, _pendingCharTint.r, _pendingCharTint.g, _pendingCharTint.b);
        }
    }, undefined, function(err) {
        console.warn("Failed to load head:", headUrl);
    });
}

// Show an equipped item in the character viewport
// partPaths: array of full part definition paths (from resolved_parts)
function showEquipmentInViewer(category, rarityName, elementName, charClass, manufacturer, partPaths) {
    if (!charViewer) return;
    _charViewerMode = "equipment";
    var url = null;
    var mat = null;

    var weaponCategories = ["Pistol", "Assault Rifle", "SMG", "Shotgun", "Sniper Rifle", "Rocket Launcher"];
    var gestaltCategories = weaponCategories.concat(["Shield", "Grenade Mod", "Relic"]);
    if (weaponCategories.indexOf(category) !== -1) {
        url = WEAPON_MODELS[category];
        mat = createTexturedWeaponMaterial(category, rarityName || "Common", elementName, manufacturer);
    } else if (category === "Class Mod" && charClass) {
        url = CLASSMOD_MODELS[charClass] || CLASSMOD_MODELS["Axton"];
        mat = createTexturedItemMaterial("Class Mod", rarityName || "Common", charClass);
    } else {
        url = ITEM_MODELS[category];
        mat = createTexturedItemMaterial(category, rarityName || "Common");
    }

    if (!url) {
        if (_currentCharName) loadCharacterModel(_currentCharName);
        return;
    }

    var loadOpts = { fitHeight: 1.5, cameraY: 0.5, spin: 0.006, material: mat };
    if (gestaltCategories.indexOf(category) !== -1) {
        loadOpts.onLoaded = function(group) {
            if (partPaths && partPaths.length && _gestaltMap && _partMeshNames) {
                applyGestaltSectionVisibility(group, category, partPaths);
            } else if (manufacturer && _gestaltMap) {
                applyGestaltManufacturerFallback(group, category, manufacturer);
            }
        };
    }
    charViewer.loadModel([url], loadOpts);
    charViewer.setAccentLight(rarityName || "Common", elementName);
    _updateViewportOverlay();
}

// Apply highest-rarity accent light from all equipped items
function applyEquippedAccentLight(equippedItems) {
    if (!charViewer) return;
    _equippedItems = equippedItems || [];
    if (!_equippedItems.length) {
        charViewer.resetAccentLight();
        return;
    }
    // Find highest rarity
    var best = _equippedItems[0];
    for (var i = 1; i < _equippedItems.length; i++) {
        var r1 = RARITY_RANK[best.rarityName] || 0;
        var r2 = RARITY_RANK[_equippedItems[i].rarityName] || 0;
        if (r2 > r1) best = _equippedItems[i];
    }
    charViewer.setAccentLight(best.rarityName, best.elementName);
}

// Carousel navigation
function equipCarouselNext() {
    if (!_equippedItems.length) return;
    _equipCarouselIdx = (_equipCarouselIdx + 1) % _equippedItems.length;
    _showCarouselItem();
}

function equipCarouselPrev() {
    if (!_equippedItems.length) return;
    _equipCarouselIdx = (_equipCarouselIdx - 1 + _equippedItems.length) % _equippedItems.length;
    _showCarouselItem();
}

function _showCarouselItem() {
    var item = _equippedItems[_equipCarouselIdx];
    if (!item) return;
    showEquipmentInViewer(item.category, item.rarityName, item.elementName, item.charClass, item.manufacturer, item.partPaths);
    _updateViewportOverlay(item);
}

function backToCharacter() {
    _charViewerMode = "character";
    _equipCarouselIdx = -1;
    // BUG-P55: _pendingCharTint values are already 0-255 from protobuf;
    // do NOT multiply by 255 again (was causing blown-out white tints)
    if (_currentCharName) loadCharacterModel(_currentCharName,
        _pendingCharTint ? [_pendingCharTint] : null,
        _currentHeadAsset, _currentSkinAsset);
    // Re-apply accent from equipped items
    if (_equippedItems.length) applyEquippedAccentLight(_equippedItems);
    _updateViewportOverlay();
}

// Update the viewport HUD overlay
function _updateViewportOverlay(equipItem) {
    var overlay = document.getElementById("viewport-hud");
    if (!overlay) return;

    // BUG-P56: use esc() (from app.js, available at call time) to prevent HTML injection
    var _esc = typeof esc === "function" ? esc : function(s) { return String(s || ""); };
    if (_charViewerMode === "character") {
        overlay.innerHTML = '<div class="vp-hud-label">' +
            _esc(_currentCharName || "CHARACTER") +
            '</div>' +
            (_equippedItems.length > 0 ?
                '<div class="vp-hud-hint">Click equipment to inspect</div>' : '');
        overlay.classList.remove("equip-mode");
    } else {
        var label = equipItem ? equipItem.label : "EQUIPMENT";
        var col = "#fcb100";
        if (equipItem && equipItem.rarityName) {
            var pal = RARITY_MATERIALS[equipItem.rarityName];
            if (pal) col = "#" + new THREE.Color(pal.accent).getHexString();
        }
        overlay.innerHTML = '<div class="vp-hud-equip">' +
            '<button class="vp-nav-btn vp-prev" onclick="equipCarouselPrev()" title="Previous">&lsaquo;</button>' +
            '<span class="vp-equip-name" style="color:' + col + '">' + _esc(label) + '</span>' +
            '<button class="vp-nav-btn vp-next" onclick="equipCarouselNext()" title="Next">&rsaquo;</button>' +
            '</div>' +
            '<button class="vp-back-btn" onclick="backToCharacter()">BACK TO CHARACTER</button>';
        overlay.classList.add("equip-mode");
    }
}

// ─── Weapon/Item Preview Viewer ──────────────────────────
var previewViewer = null;

function initPreviewViewer(containerId) {
    if (previewViewer) previewViewer.destroy();
    previewViewer = createViewer(containerId);
}

function loadWeaponPreview(category, rarityName, elementName, manufacturer, partPaths) {
    if (!previewViewer) return;
    var url = WEAPON_MODELS[category];
    if (!url) return;
    var mat = createTexturedWeaponMaterial(category, rarityName || "Common", elementName, manufacturer);
    var loadOpts = { fitHeight: 1.5, cameraY: 0.5, spin: 0.005, material: mat };
    loadOpts.onLoaded = function(group) {
        if (partPaths && partPaths.length && _gestaltMap && _partMeshNames) {
            applyGestaltSectionVisibility(group, category, partPaths);
        } else if (manufacturer && _gestaltMap) {
            applyGestaltManufacturerFallback(group, category, manufacturer);
        }
    };
    previewViewer.loadModel([url], loadOpts);
}

function loadItemPreview(category, charClass, rarityName) {
    if (!previewViewer) return;
    var url;
    if (category === "Class Mod" && charClass) {
        url = CLASSMOD_MODELS[charClass] || CLASSMOD_MODELS["Axton"];
    } else {
        url = ITEM_MODELS[category];
    }
    if (!url) return;
    var mat = createTexturedItemMaterial(category, rarityName || "Common", charClass);
    previewViewer.loadModel([url], { fitHeight: 1.5, cameraY: 0.5, spin: 0.005, material: mat });
}

function updatePreviewMaterial(rarityName, elementName, isWeapon) {
    if (!previewViewer) return;
    var mat = isWeapon ? createWeaponMaterial(rarityName, elementName) : createItemMaterial(rarityName);
    previewViewer.setMaterial(mat);
}

function destroyPreviewViewer() {
    if (previewViewer) {
        previewViewer.destroy();
        previewViewer = null;
    }
}
