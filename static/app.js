// BL2 Save Editor — Frontend

let currentFile = null;
let currentData = null;
let _mutating = false;  // Bug 21: guard against overlapping mutations

// ─── Weapon & Item SVG Icons (holographic silhouettes for inventory cards) ─────
const WEAPON_SVGS = {
    Pistol: `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="wpGlow"><feGaussianBlur stdDeviation="1.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#wpGlow)" fill="currentColor">
            <path d="M20,28 L100,24 L114,24 L116,28 L116,34 L100,36 L20,36 Z" opacity="0.7"/>
            <path d="M48,36 L52,36 L50,50 L42,64 L34,64 L36,56 Z" opacity="0.55"/>
            <path d="M52,36 L52,44 Q56,50 66,50 Q70,48 70,36" fill="none" stroke="currentColor" stroke-width="2" opacity="0.35"/>
            <rect x="34" y="62" width="10" height="3" rx="1" opacity="0.4"/>
        </g>
    </svg>`,

    "Assault Rifle": `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="arGlow"><feGaussianBlur stdDeviation="1.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#arGlow)" fill="currentColor">
            <path d="M2,30 L20,28 L24,26 L84,22 L118,24 L118,32 L84,34 L24,36 L20,38 L2,36 Z" opacity="0.65"/>
            <rect x="34" y="20 " width="40" height="3" rx="1" opacity="0.35"/>
            <path d="M56,36 L64,36 L62,56 Q58,62 52,58 L56,36 Z" opacity="0.5"/>
            <path d="M34,36 L40,36 L40,52 L34,56 L28,54 L30,48 Z" opacity="0.45"/>
            <rect x="76" y="34" width="6" height="10" rx="1" opacity="0.35"/>
        </g>
    </svg>`,

    SMG: `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="smgGlow"><feGaussianBlur stdDeviation="1.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#smgGlow)" fill="currentColor">
            <path d="M8,28 L18,26 L74,22 L100,24 L100,32 L74,34 L18,36 L8,34 Z" opacity="0.65"/>
            <path d="M6,28 L18,26 M6,28 L8,36 L18,34" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
            <rect x="40" y="36" width="14" height="20" rx="1" opacity="0.5"/>
            <path d="M24,36 L32,36 L32,50 L26,54 L22,52 Z" opacity="0.45"/>
            <rect x="62" y="36" width="5" height="12" rx="1" opacity="0.35"/>
        </g>
    </svg>`,

    Shotgun: `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="sgGlow"><feGaussianBlur stdDeviation="1.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#sgGlow)" fill="currentColor">
            <path d="M2,28 L20,24 L76,18 L118,18 L118,34 L76,38 L20,38 L2,36 Z" opacity="0.65"/>
            <rect x="78" y="34" width="18" height="8" rx="2" opacity="0.4"/>
            <path d="M34,38 L42,38 L42,52 L36,58 L28,56 L30,48 Z" opacity="0.5"/>
        </g>
    </svg>`,

    "Sniper Rifle": `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="srGlow"><feGaussianBlur stdDeviation="1.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#srGlow)" fill="currentColor">
            <path d="M2,32 L18,28 L80,24 L118,26 L118,32 L80,34 L18,36 L2,36 Z" opacity="0.6"/>
            <rect x="32" y="16" width="30" height="7" rx="3" opacity="0.5"/>
            <circle cx="62" cy="19.5" r="4" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45"/>
            <circle cx="32" cy="19.5" r="3" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35"/>
            <rect x="50" y="34" width="8" height="12" rx="1" opacity="0.45"/>
            <path d="M30,34 L36,34 L36,46 L30,50 L26,48 Z" opacity="0.4"/>
            <line x1="84" y1="32" x2="80" y2="42" stroke="currentColor" stroke-width="1.5" opacity="0.25"/>
            <line x1="90" y1="32" x2="94" y2="42" stroke="currentColor" stroke-width="1.5" opacity="0.25"/>
        </g>
    </svg>`,

    "Rocket Launcher": `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="rlGlow"><feGaussianBlur stdDeviation="2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#rlGlow)" fill="currentColor">
            <rect x="8" y="20" width="88" height="18" rx="6" opacity="0.6"/>
            <circle cx="100" cy="29" r="11" opacity="0.45"/>
            <circle cx="100" cy="29" r="7" opacity="0.2"/>
            <rect x="4" y="22" width="8" height="14" rx="2" opacity="0.4"/>
            <rect x="12" y="14" width="4" height="8" rx="1" opacity="0.35"/>
            <rect x="12" y="36" width="4" height="8" rx="1" opacity="0.35"/>
            <path d="M44,38 L52,38 L52,54 L46,60 L38,58 L40,48 Z" opacity="0.5"/>
        </g>
    </svg>`,

    Shield: `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="shGlow"><feGaussianBlur stdDeviation="2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#shGlow)" fill="currentColor">
            <polygon points="60,4 96,18 96,52 60,70 24,52 24,18" opacity="0.15" stroke="currentColor" stroke-width="2" stroke-opacity="0.6"/>
            <polygon points="60,14 84,24 84,46 60,58 36,46 36,24" opacity="0.1" stroke="currentColor" stroke-width="1" stroke-opacity="0.4"/>
            <circle cx="60" cy="37" r="8" opacity="0.2"/>
            <circle cx="60" cy="37" r="3" opacity="0.5"/>
        </g>
    </svg>`,

    "Grenade Mod": `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="grGlow"><feGaussianBlur stdDeviation="1.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#grGlow)" fill="currentColor">
            <ellipse cx="60" cy="44" rx="20" ry="18" opacity="0.5"/>
            <ellipse cx="60" cy="44" rx="20" ry="18" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
            <rect x="54" y="22" width="12" height="8" rx="2" opacity="0.5"/>
            <path d="M58,22 L58,12 L62,12 L62,16 L66,16 L66,18 L62,18 L62,22" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.45"/>
            <circle cx="66" cy="14" r="3" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
        </g>
    </svg>`,

    "Class Mod": `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="cmGlow"><feGaussianBlur stdDeviation="1.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#cmGlow)" fill="currentColor">
            <rect x="18" y="14" width="84" height="52" rx="6" opacity="0.12" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.5"/>
            <rect x="44" y="30" width="16" height="12" rx="1" opacity="0.4"/>
            <path d="M60,36 L76,31" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25"/>
            <path d="M44,36 L30,34" fill="none" stroke="currentColor" stroke-width="1" opacity="0.25"/>
            <rect x="68" y="28" width="8" height="6" rx="1" opacity="0.25"/>
            <rect x="30" y="32" width="8" height="5" rx="1" opacity="0.25"/>
        </g>
    </svg>`,

    Relic: `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="reGlow"><feGaussianBlur stdDeviation="2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#reGlow)" fill="currentColor">
            <polygon points="60,6 82,16 90,38 80,60 60,70 40,62 30,40 38,16" opacity="0.12" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.5"/>
            <polygon points="60,28 68,32 68,42 60,48 52,42 52,32" opacity="0.3"/>
            <circle cx="60" cy="38" r="5" opacity="0.4"/>
            <circle cx="60" cy="38" r="2" opacity="0.7"/>
        </g>
    </svg>`,

    Default: `<svg viewBox="0 0 120 80" class="holo-svg">
        <defs><filter id="dfGlow"><feGaussianBlur stdDeviation="1.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#dfGlow)" fill="currentColor">
            <rect x="20" y="12" width="80" height="56" rx="8" opacity="0.12" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.4"/>
            <circle cx="60" cy="40" r="10" opacity="0.2"/>
            <circle cx="60" cy="40" r="4" opacity="0.4"/>
        </g>
    </svg>`,
};

// ─── Character SVG Silhouettes (used in stats panel) ─────

const CHARACTER_SVGS = {
    Axton: `<svg viewBox="0 0 100 200" class="holo-char-svg">
        <defs>
            <filter id="axGlow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="axGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f0a030" stop-opacity="0.5"/><stop offset="100%" stop-color="#f0a030" stop-opacity="0.08"/></linearGradient>
        </defs>
        <g filter="url(#axGlow)">
            <ellipse cx="50" cy="26" rx="12" ry="14" fill="#f0a030" opacity="0.35"/>
            <rect x="38" y="12" width="24" height="5" rx="1" fill="#f0a030" opacity="0.4"/>
            <line x1="43" y1="24" x2="47" y2="24" stroke="#f0a030" stroke-width="2" opacity="0.8"/>
            <line x1="53" y1="24" x2="57" y2="24" stroke="#f0a030" stroke-width="2" opacity="0.8"/>
            <path d="M46,40 L26,48 L26,108 L40,112 L50,114 L60,112 L74,108 L74,48 L54,40 Z" fill="url(#axGrad)" stroke="#f0a030" stroke-width="1" stroke-opacity="0.5"/>
            <path d="M26,48 L16,88 L14,120" stroke="#f0a030" stroke-width="3.5" opacity="0.4" fill="none"/>
            <path d="M74,48 L84,88 L86,120" stroke="#f0a030" stroke-width="3.5" opacity="0.4" fill="none"/>
            <circle cx="14" cy="122" r="3" fill="#f0a030" opacity="0.25"/>
            <circle cx="86" cy="122" r="3" fill="#f0a030" opacity="0.25"/>
            <path d="M32,114 L28,168 L38,168 L50,130 L62,168 L72,168 L68,114" fill="#f0a030" opacity="0.12"/>
            <rect x="26" y="168" width="14" height="10" rx="2" fill="#f0a030" opacity="0.2"/>
            <rect x="60" y="168" width="14" height="10" rx="2" fill="#f0a030" opacity="0.2"/>
            <rect x="58" y="38" width="12" height="8" rx="2" fill="#f0a030" opacity="0.2"/>
            <rect x="63" y="34" width="3" height="5" rx="1" fill="#f0a030" opacity="0.35"/>
        </g>
    </svg>`,

    "Zer0": `<svg viewBox="0 0 100 200" class="holo-char-svg">
        <defs>
            <filter id="z0Glow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="z0Grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4b8be8" stop-opacity="0.45"/><stop offset="100%" stop-color="#4b8be8" stop-opacity="0.06"/></linearGradient>
        </defs>
        <g filter="url(#z0Glow)">
            <path d="M36,14 Q50,4 64,14 L66,32 Q64,42 50,44 Q36,42 34,32 Z" fill="#4b8be8" opacity="0.25"/>
            <line x1="38" y1="26" x2="62" y2="26" stroke="#4b8be8" stroke-width="3" opacity="0.9"/>
            <path d="M34,50 L24,56 L18,90 L14,120" stroke="#4b8be8" stroke-width="2.5" opacity="0.35" fill="none"/>
            <path d="M66,50 L76,56 L82,90 L86,120" stroke="#4b8be8" stroke-width="2.5" opacity="0.35" fill="none"/>
            <path d="M34,50 L34,108 L44,112 L50,114 L56,112 L66,108 L66,50" fill="url(#z0Grad)" stroke="#4b8be8" stroke-width="0.8" stroke-opacity="0.4"/>
            <line x1="28" y1="42" x2="70" y2="102" stroke="#4b8be8" stroke-width="1.5" opacity="0.2"/>
            <path d="M38,112 L32,175 L40,175 L50,138 L60,175 L68,175 L62,112" fill="#4b8be8" opacity="0.1"/>
            <line x1="30" y1="175" x2="42" y2="175" stroke="#4b8be8" stroke-width="2" opacity="0.3"/>
            <line x1="58" y1="175" x2="70" y2="175" stroke="#4b8be8" stroke-width="2" opacity="0.3"/>
        </g>
    </svg>`,

    Maya: `<svg viewBox="0 0 100 200" class="holo-char-svg">
        <defs>
            <filter id="myGlow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="myGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9b59b6" stop-opacity="0.45"/><stop offset="100%" stop-color="#9b59b6" stop-opacity="0.06"/></linearGradient>
        </defs>
        <g filter="url(#myGlow)">
            <ellipse cx="50" cy="26" rx="11" ry="13" fill="#9b59b6" opacity="0.3"/>
            <path d="M38,18 Q36,8 42,6 Q50,4 58,6 Q64,8 62,18" fill="#9b59b6" opacity="0.25" stroke="#9b59b6" stroke-width="1"/>
            <ellipse cx="44" cy="24" rx="2" ry="1.5" fill="#9b59b6" opacity="0.5"/>
            <ellipse cx="56" cy="24" rx="2" ry="1.5" fill="#9b59b6" opacity="0.5"/>
            <path d="M26,54 L28,78 L30,96 L36,108 L50,114 L64,108 L70,96 L72,78 L74,54" fill="url(#myGrad)" stroke="#9b59b6" stroke-width="0.8" stroke-opacity="0.4"/>
            <path d="M26,54 L20,88 L16,118" stroke="#9b59b6" stroke-width="2.5" opacity="0.35" fill="none"/>
            <path d="M74,54 L80,88 L84,118" stroke="#9b59b6" stroke-width="2.5" opacity="0.35" fill="none"/>
            <path d="M24,60 Q18,72 20,84 Q14,96 18,108" stroke="#9b59b6" stroke-width="1.5" opacity="0.5" fill="none"/>
            <path d="M22,68 Q16,80 18,92" stroke="#9b59b6" stroke-width="1" opacity="0.4" fill="none"/>
            <circle cx="16" cy="120" r="2.5" fill="#9b59b6" opacity="0.2"/>
            <circle cx="84" cy="120" r="2.5" fill="#9b59b6" opacity="0.2"/>
            <path d="M38,112 L34,170 L42,170 L50,134 L58,170 L66,170 L62,112" fill="#9b59b6" opacity="0.1"/>
            <rect x="32" y="168" width="12" height="8" rx="2" fill="#9b59b6" opacity="0.18"/>
            <rect x="56" y="168" width="12" height="8" rx="2" fill="#9b59b6" opacity="0.18"/>
        </g>
    </svg>`,

    Salvador: `<svg viewBox="0 0 100 200" class="holo-char-svg">
        <defs>
            <filter id="saGlow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="saGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e04040" stop-opacity="0.45"/><stop offset="100%" stop-color="#e04040" stop-opacity="0.06"/></linearGradient>
        </defs>
        <g filter="url(#saGlow)">
            <ellipse cx="50" cy="26" rx="15" ry="14" fill="#e04040" opacity="0.3"/>
            <line x1="40" y1="14" x2="38" y2="2" stroke="#e04040" stroke-width="2.5" opacity="0.5"/>
            <line x1="46" y1="12" x2="45" y2="0" stroke="#e04040" stroke-width="2.5" opacity="0.5"/>
            <line x1="54" y1="12" x2="55" y2="0" stroke="#e04040" stroke-width="2.5" opacity="0.5"/>
            <line x1="60" y1="14" x2="62" y2="2" stroke="#e04040" stroke-width="2.5" opacity="0.5"/>
            <line x1="41" y1="22" x2="47" y2="24" stroke="#e04040" stroke-width="2.5" opacity="0.7"/>
            <line x1="53" y1="24" x2="59" y2="22" stroke="#e04040" stroke-width="2.5" opacity="0.7"/>
            <path d="M14,48 L16,100 L42,108 L50,110 L58,108 L84,100 L86,48" fill="url(#saGrad)" stroke="#e04040" stroke-width="1" stroke-opacity="0.4"/>
            <path d="M14,48 L6,82 L2,110" stroke="#e04040" stroke-width="5" opacity="0.35" fill="none"/>
            <path d="M86,48 L94,82 L98,110" stroke="#e04040" stroke-width="5" opacity="0.35" fill="none"/>
            <rect x="-2" y="108" width="14" height="5" rx="1" fill="#e04040" opacity="0.3"/>
            <rect x="88" y="108" width="14" height="5" rx="1" fill="#e04040" opacity="0.3"/>
            <path d="M36,108 L32,152 L42,152 L50,126 L58,152 L68,152 L64,108" fill="#e04040" opacity="0.1"/>
            <rect x="30" y="150" width="14" height="10" rx="2" fill="#e04040" opacity="0.18"/>
            <rect x="56" y="150" width="14" height="10" rx="2" fill="#e04040" opacity="0.18"/>
        </g>
    </svg>`,

    Gaige: `<svg viewBox="0 0 100 200" class="holo-char-svg">
        <defs>
            <filter id="gaGlow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="gaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff4081" stop-opacity="0.45"/><stop offset="100%" stop-color="#ff4081" stop-opacity="0.06"/></linearGradient>
        </defs>
        <g filter="url(#gaGlow)">
            <ellipse cx="50" cy="26" rx="11" ry="13" fill="#ff4081" opacity="0.3"/>
            <path d="M38,18 L28,6" stroke="#ff4081" stroke-width="2.5" opacity="0.5"/>
            <path d="M62,16 L74,6" stroke="#ff4081" stroke-width="2.5" opacity="0.5"/>
            <circle cx="45" cy="25" r="1.5" fill="#ff4081" opacity="0.6"/>
            <circle cx="55" cy="25" r="1.5" fill="#ff4081" opacity="0.6"/>
            <path d="M26,50 L28,86 L36,92 L50,96 L64,92 L72,86 L74,50" fill="url(#gaGrad)" stroke="#ff4081" stroke-width="0.8" stroke-opacity="0.4"/>
            <path d="M74,50 L80,84 L84,112" stroke="#ff4081" stroke-width="2.5" opacity="0.35" fill="none"/>
            <circle cx="84" cy="114" r="2" fill="#ff4081" opacity="0.2"/>
            <path d="M26,50 L20,68" stroke="#ff4081" stroke-width="3" opacity="0.4" fill="none"/>
            <circle cx="20" cy="70" r="3" fill="none" stroke="#ff4081" stroke-width="1.5" opacity="0.5"/>
            <path d="M18,73 L14,78 L14,100 L18,104 L22,104 L26,100 L26,78 L22,73 Z" fill="#ff4081" opacity="0.15" stroke="#ff4081" stroke-width="1" stroke-opacity="0.4"/>
            <path d="M30,92 L24,120 L50,124 L76,120 L70,92" fill="#ff4081" opacity="0.12"/>
            <line x1="36" y1="120" x2="34" y2="168" stroke="#ff4081" stroke-width="2.5" opacity="0.3"/>
            <line x1="64" y1="120" x2="66" y2="168" stroke="#ff4081" stroke-width="2.5" opacity="0.3"/>
            <rect x="30" y="166" width="12" height="9" rx="2" fill="#ff4081" opacity="0.18"/>
            <rect x="60" y="166" width="12" height="9" rx="2" fill="#ff4081" opacity="0.18"/>
        </g>
    </svg>`,

    Krieg: `<svg viewBox="0 0 100 200" class="holo-char-svg">
        <defs>
            <filter id="krGlow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <linearGradient id="krGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8a33a" stop-opacity="0.45"/><stop offset="100%" stop-color="#e8a33a" stop-opacity="0.06"/></linearGradient>
        </defs>
        <g filter="url(#krGlow)">
            <ellipse cx="50" cy="26" rx="15" ry="16" fill="#e8a33a" opacity="0.25"/>
            <path d="M36,20 L36,36 Q36,40 42,40 L58,40 Q64,40 64,36 L64,20" fill="#e8a33a" opacity="0.18"/>
            <circle cx="42" cy="24" r="4" fill="none" stroke="#e8a33a" stroke-width="1.5" opacity="0.6"/>
            <circle cx="58" cy="24" r="4" fill="none" stroke="#e8a33a" stroke-width="1.5" opacity="0.6"/>
            <circle cx="42" cy="24" r="1.5" fill="#e8a33a" opacity="0.6"/>
            <path d="M10,50 L14,104 L40,112 L50,114 L60,112 L86,104 L90,50" fill="url(#krGrad)" stroke="#e8a33a" stroke-width="1" stroke-opacity="0.4"/>
            <path d="M10,50 L2,84 L-2,112" stroke="#e8a33a" stroke-width="5.5" opacity="0.3" fill="none"/>
            <path d="M90,50 L96,84 L98,112" stroke="#e8a33a" stroke-width="4" opacity="0.3" fill="none"/>
            <line x1="-2" y1="112" x2="-6" y2="80" stroke="#e8a33a" stroke-width="2" opacity="0.35"/>
            <path d="M-6,80 L-16,68 Q-18,64 -14,62 L-6,70 Z" fill="#e8a33a" opacity="0.2"/>
            <circle cx="98" cy="114" r="3.5" fill="#e8a33a" opacity="0.2"/>
            <path d="M34,112 L30,168 L42,168 L50,132 L58,168 L70,168 L66,112" fill="#e8a33a" opacity="0.1"/>
            <rect x="28" y="166" width="16" height="10" rx="2" fill="#e8a33a" opacity="0.18"/>
            <rect x="56" y="166" width="16" height="10" rx="2" fill="#e8a33a" opacity="0.18"/>
        </g>
    </svg>`,
};

function getSVG(category) { return WEAPON_SVGS[category] || WEAPON_SVGS.Default; }
function getCharSVG(name) { return CHARACTER_SVGS[name] || CHARACTER_SVGS.Axton; }

// ─── Helpers ────────────────────────────────────────────────

async function api(url, opts = {}) {
    if (opts.body && typeof opts.body === "object") {
        opts.headers = { "Content-Type": "application/json" };
        opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, opts);
    const ct = (res.headers.get("content-type") || "");
    if (!ct.includes("application/json")) {
        const msg = "Server returned non-JSON response (status " + res.status + ")";
        toast(msg, "error");
        throw new Error(msg);
    }
    const json = await res.json();
    if (!res.ok) {
        const msg = json.error || "Request failed";
        toast(msg, "error");
        throw new Error(msg);
    }
    return json;
}

function toast(msg, type = "success") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast";
    if (type === "error") t.classList.add("toast-error");
    else if (type === "warning") t.classList.add("toast-warning");
    else t.classList.add("toast-success");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.add("hidden"), type === "error" ? 5000 : 2500);
}

function showLoading(show = true) {
    let el = document.getElementById("loading-overlay");
    if (!el) {
        el = document.createElement("div");
        el.id = "loading-overlay";
        el.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(el);
    }
    el.style.display = show ? "flex" : "none";
}

function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }

function showModal(id) { document.getElementById(id).classList.remove("hidden"); }
function hideModal(id) { document.getElementById(id).classList.add("hidden"); }

// ─── Red Text / Flavor Text Lookup ────────────────────────

const RED_TEXT = {
    "Infinity": "It's closer than you think! (No ammo consumed)",
    "Unkempt Harold": "Did I fire six shots, or only five? Three? Seven.",
    "Conference Call": "Let's just ping everyone all at once.",
    "Norfleet": "Blows Up Everything!!!",
    "Bee": "Float like a butterfly...",
    "Sham": "Wow, I CAN do this all day.",
    "Bitch": "...just come and get me.",
    "Thunderball Fists": "I can have such a thing?",
    "Lyuda": "Man Killer",
    "Grog Nozzle": "Hand over the goods.",
    "Lady Fist": "Love is a Lady Finger. True love is a Lady Fist.",
    "Fastball": "Forget the curveball Ricky, give him the heater.",
    "Flakker": "Flak the world.",
    "Pimpernel": "Sink me!",
    "Sand Hawk": "In. Not unlike Errol Flynn.",
    "Fibber": "Would I lie to you?",
    "Interfacer": "Because zero is more than one.",
    "Hawk Eye": "Eye in the sky.",
    "Butcher": "Fresh meat!",
    "Hellfire": "We don't need no water...",
    "Volcano": "Pele humbly requests a sacrifice.",
    "Pitchfork": "Mainstream'd!",
    "Shredifier": "Speed Kills.",
    "Veruc": "I want that rifle, Daddy!",
    "Maggie": "Monty's wife don't take no guff.",
    "Kerblaster": "Torgue got carried away with this one.",
    "Ogre": "Ogres have layers.",
    "Bad Touch": "When I'm good, I'm very good...",
    "Good Touch": "...but when I'm bad, I'm better.",
    "Sandhawk": "In. Not unlike Errol Flynn.",
    "Longbow": "Ceci n'est pas une sniper rifle!",
    "Quasar": "E=mc^(OMG)/wtf",
    "Pandemic": "Spread the sickness.",
    "Bonus Package": "2 more weeks...",
    "Chain Lightning": "Don't pay it back, pay it forward.",
    "Storm Front": "Shock and AWE!",
    "Fire Bee": "Bees are coming!",
    "Leech": "A skillful leech is better far...",
    "Transformer": "There's more than your eye can see.",
    "Rough Rider": "It takes more than that to kill a Bull Moose.",
    "Antagonist": "I'm rubber, you're glue.",
    "Blockade": "It's a whole lot of not dying.",
    "Evolution": "It's alive!",
    "Hide of Terramorphous": "...his hide turned the mightiest tink...",
    "Neogenator": "You're going to feel a little pinch.",
    "1340 Shield": "Who you gonna call?",
};

// ─── Element Icons and Badges ──────────────────────────────

const ELEMENT_ICONS = {
    "Fire": { symbol: "&#x1F525;", css: "#ff6600" },
    "Incendiary": { symbol: "&#x1F525;", css: "#ff6600" },
    "Shock": { symbol: "&#x26A1;", css: "#0099ff" },
    "Corrosive": { symbol: "&#x2623;", css: "#00dd00" },
    "Slag": { symbol: "&#x2B23;", css: "#cc00ff" },
    "Explosive": { symbol: "&#x1F4A5;", css: "#ffdd00" },
};

function getElementInfo(elem) {
    if (!elem) return null;
    var name = elem.name || "";
    var info = ELEMENT_ICONS[name];
    if (info) return { name: name, symbol: info.symbol, color: elem.color || info.css };
    return { name: name, symbol: "", color: elem.color || "#888" };
}

// ─── Stat Bar Helpers ──────────────────────────────────────

const STAT_CONFIG = {
    damage: {
        label: "DAMAGE",
        color: "#e04040",
        maxByType: { Pistol: 5000, "Assault Rifle": 5000, SMG: 3000, Shotgun: 20000, "Sniper Rifle": 30000, "Rocket Launcher": 100000 },
        defaultMax: 5000,
        invert: false,
    },
    fire_rate: {
        label: "FIRE RATE",
        color: "#f0a030",
        max: 15,
        invert: false,
    },
    reload_speed: {
        label: "RELOAD",
        color: "#4b8be8",
        max: 10,
        invert: true,
    },
    mag_size: {
        label: "MAGAZINE",
        color: "#3bbd40",
        max: 100,
        invert: false,
    },
    accuracy: {
        label: "ACCURACY",
        color: "#00e5ff",
        max: 100,
        invert: false,
    },
    recoil: {
        label: "RECOIL",
        color: "#ff4081",
        max: 100,
        invert: true,
    },
};

const STAT_AFFECTS = {
    damage: "Barrel, Body, Grip",
    fire_rate: "Barrel, Grip, Manufacturer",
    reload_speed: "Grip, Manufacturer",
    mag_size: "Grip, Body, Manufacturer",
    accuracy: "Barrel, Sight, Stock",
    recoil: "Stock, Grip, Barrel",
};

function computeStatPct(key, value, category) {
    var cfg = STAT_CONFIG[key];
    if (!cfg) return 0;
    if (cfg.invert) {
        if (key === "reload_speed") return Math.max(0, Math.min(100, (cfg.max - value) / cfg.max * 100));
        if (key === "recoil") return Math.max(0, Math.min(100, (cfg.max - value) / cfg.max * 100));
    }
    if (cfg.maxByType) {
        var maxVal = (category && cfg.maxByType[category]) || cfg.defaultMax;
        return Math.min(100, value / maxVal * 100);
    }
    return Math.min(100, value / cfg.max * 100);
}

function renderStatBars(stats, category, showAffects) {
    if (!stats) return "";
    var statKeys = ["damage", "fire_rate", "reload_speed", "mag_size", "accuracy", "recoil"];
    var html = '<div class="stat-bars-section">';
    html += '<div class="section-divider">ESTIMATED STATS</div>';
    for (var i = 0; i < statKeys.length; i++) {
        var key = statKeys[i];
        var cfg = STAT_CONFIG[key];
        if (!cfg) continue;
        var value = stats[key];
        if (value === undefined || value === null) continue;
        var pct = computeStatPct(key, value, category);
        var displayVal = typeof value === "number" ? (value % 1 === 0 ? value : value.toFixed(1)) : value;
        html += '<div class="stat-bar-row">';
        html += '<span class="stat-bar-label">' + cfg.label + '</span>';
        html += '<div class="stat-bar-wrap">';
        html += '<div class="stat-bar-bg">';
        html += '<div class="stat-bar-fill" style="width:' + pct + '%;background:' + cfg.color + '"></div>';
        html += '</div>';
        html += '<span class="stat-bar-val">' + displayVal + '</span>';
        html += '</div>';
        if (showAffects) {
            html += '<span class="stat-affects">' + (STAT_AFFECTS[key] || "") + '</span>';
        }
        html += '</div>';
    }
    html += '</div>';
    return html;
}

// ─── BL2 Stat Card Renderer ───────────────────────────────

function isWeaponCategory(cat) {
    return ["Pistol", "Assault Rifle", "SMG", "Shotgun", "Sniper Rifle", "Rocket Launcher"].indexOf(cat) !== -1;
}

function renderBL2StatCard(r) {
    var col = (r.rarity && r.rarity.color) || "#888";
    var rarName = r.rarity ? r.rarity.name : "Common";
    var lv = r.level ? r.level[1] : "?";
    var cat = r.category || "Item";
    var elemInfo = getElementInfo(r.element);
    var displayName = r.display_name || "Unknown";

    var html = '<div class="bl2-stat-card" style="border-color:' + col + ';--card-accent:' + col + ';animation:statCardFadeIn 0.3s ease-out">';

    // Item name in rarity color, uppercase, bold
    html += '<div class="bl2-item-name" style="color:' + col + '">' + esc(displayName).toUpperCase() + '</div>';

    // Rarity + type line
    html += '<div class="bl2-item-subtitle">';
    html += '<span class="rarity-badge" style="background:' + col + '20;color:' + col + '">' + rarName + '</span>';
    html += ' <span class="bl2-mfr">' + esc(r.manufacturer_name || "") + '</span>';
    html += ' <span class="bl2-cat">' + esc(cat) + '</span>';
    html += '</div>';

    // Level requirement
    html += '<div class="bl2-level-req">Requires Level: ' + lv + '</div>';

    // Separator
    html += '<div class="bl2-card-separator" style="border-color:' + col + '30"></div>';

    if (isWeaponCategory(cat)) {
        // Weapon stat card
        html += renderWeaponStatSection(r, col);
    } else if (cat === "Shield") {
        html += renderShieldStatSection(r, col);
    } else if (cat === "Grenade Mod") {
        html += renderGrenadeStatSection(r, col);
    } else if (cat === "Class Mod") {
        html += renderClassModStatSection(r, col);
    } else if (cat === "Relic") {
        html += renderRelicStatSection(r, col);
    } else {
        html += '<div class="bl2-stat-line"><span class="bl2-stat-label">Type</span><span class="bl2-stat-value">' + esc(cat) + '</span></div>';
    }

    // Element badge
    if (elemInfo) {
        html += '<div class="bl2-card-separator" style="border-color:' + col + '30"></div>';
        html += '<div class="bl2-element-row">';
        html += '<span class="bl2-element-icon" style="color:' + elemInfo.color + '">' + elemInfo.symbol + '</span>';
        html += '<span class="bl2-element-name" style="color:' + elemInfo.color + '">' + elemInfo.name + ' Damage</span>';
        html += '</div>';
    }

    // Green text (bonus attributes from resolved_parts)
    var bonuses = [];
    if (r.resolved_parts) {
        for (var i = 0; i < r.resolved_parts.length; i++) {
            var p = r.resolved_parts[i];
            if (p.effect && p.effect.trim()) {
                bonuses.push(p.effect);
            }
        }
    }
    if (bonuses.length > 0) {
        html += '<div class="bl2-card-separator" style="border-color:' + col + '30"></div>';
        for (var b = 0; b < bonuses.length; b++) {
            html += '<div class="bl2-green-text">+ ' + esc(bonuses[b]) + '</div>';
        }
    }

    // Red/flavor text for legendaries
    var redText = RED_TEXT[displayName];
    if (redText) {
        html += '<div class="bl2-card-separator" style="border-color:' + col + '30"></div>';
        html += '<div class="bl2-red-text">' + esc(redText) + '</div>';
    }

    html += '</div>';
    return html;
}

function renderWeaponStatSection(r, col) {
    var html = '';
    var stats = r.estimated_stats;
    var statDefs = [
        { key: "damage", label: "Damage" },
        { key: "accuracy", label: "Accuracy" },
        { key: "fire_rate", label: "Fire Rate" },
        { key: "reload_speed", label: "Reload Speed" },
        { key: "mag_size", label: "Magazine Size" },
    ];

    for (var i = 0; i < statDefs.length; i++) {
        var def = statDefs[i];
        var value = stats ? stats[def.key] : null;
        var displayVal = "---";
        var pct = 0;
        if (value !== null && value !== undefined) {
            displayVal = typeof value === "number" ? (value % 1 === 0 ? value : value.toFixed(1)) : value;
            pct = computeStatPct(def.key, value, r.category);
        }
        var barColor = STAT_CONFIG[def.key] ? STAT_CONFIG[def.key].color : col;
        html += '<div class="bl2-stat-line">';
        html += '<span class="bl2-stat-label">' + def.label + '</span>';
        html += '<div class="bl2-stat-bar-inline"><div class="bl2-stat-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>';
        html += '<span class="bl2-stat-value">' + displayVal + '</span>';
        html += '</div>';
    }
    return html;
}

function renderShieldStatSection(r, col) {
    var html = '';
    var shieldStats = [
        { label: "Capacity", est: "---" },
        { label: "Recharge Rate", est: "---" },
        { label: "Recharge Delay", est: "---" },
    ];

    // Try to pull from estimated_stats if available
    var stats = r.estimated_stats;
    if (stats) {
        if (stats.capacity !== undefined) shieldStats[0].est = stats.capacity;
        if (stats.recharge_rate !== undefined) shieldStats[1].est = stats.recharge_rate;
        if (stats.recharge_delay !== undefined) shieldStats[2].est = stats.recharge_delay;
    }

    for (var i = 0; i < shieldStats.length; i++) {
        html += '<div class="bl2-stat-line">';
        html += '<span class="bl2-stat-label">' + shieldStats[i].label + '</span>';
        html += '<span class="bl2-stat-value">' + shieldStats[i].est + '</span>';
        html += '</div>';
    }

    html += '<div class="bl2-stat-note">Stats are determined by game engine. Shown values are from parts if available.</div>';
    return html;
}

function renderGrenadeStatSection(r, col) {
    var html = '';
    var grenadeStats = [
        { label: "Damage", est: "---" },
        { label: "Blast Radius", est: "---" },
        { label: "Fuse Time", est: "---" },
    ];

    var stats = r.estimated_stats;
    if (stats) {
        if (stats.damage !== undefined) grenadeStats[0].est = stats.damage;
        if (stats.blast_radius !== undefined) grenadeStats[1].est = stats.blast_radius;
        if (stats.fuse_time !== undefined) grenadeStats[2].est = stats.fuse_time;
    }

    for (var i = 0; i < grenadeStats.length; i++) {
        html += '<div class="bl2-stat-line">';
        html += '<span class="bl2-stat-label">' + grenadeStats[i].label + '</span>';
        html += '<span class="bl2-stat-value">' + grenadeStats[i].est + '</span>';
        html += '</div>';
    }

    html += '<div class="bl2-stat-note">Stats are determined by game engine. Shown values are estimated from parts.</div>';
    return html;
}

function renderClassModStatSection(r, col) {
    var html = '';
    html += '<div class="bl2-stat-line">';
    html += '<span class="bl2-stat-label">Type</span>';
    html += '<span class="bl2-stat-value">Class Mod</span>';
    html += '</div>';
    html += '<div class="bl2-stat-line">';
    html += '<span class="bl2-stat-label">Manufacturer</span>';
    html += '<span class="bl2-stat-value">' + esc(r.manufacturer_name || "Unknown") + '</span>';
    html += '</div>';
    if (r.resolved_parts) {
        var partNames = [];
        for (var i = 0; i < r.resolved_parts.length; i++) {
            if (r.resolved_parts[i].name) partNames.push(r.resolved_parts[i].name);
        }
        if (partNames.length > 0) {
            html += '<div class="bl2-stat-note">Components: ' + esc(partNames.join(", ")) + '</div>';
        }
    }
    return html;
}

function renderRelicStatSection(r, col) {
    var html = '';
    html += '<div class="bl2-stat-line">';
    html += '<span class="bl2-stat-label">Type</span>';
    html += '<span class="bl2-stat-value">Relic</span>';
    html += '</div>';
    html += '<div class="bl2-stat-line">';
    html += '<span class="bl2-stat-label">Manufacturer</span>';
    html += '<span class="bl2-stat-value">' + esc(r.manufacturer_name || "Eridian") + '</span>';
    html += '</div>';
    if (r.resolved_parts) {
        var partNames = [];
        for (var i = 0; i < r.resolved_parts.length; i++) {
            if (r.resolved_parts[i].name) partNames.push(r.resolved_parts[i].name);
        }
        if (partNames.length > 0) {
            html += '<div class="bl2-stat-note">Components: ' + esc(partNames.join(", ")) + '</div>';
        }
    }
    return html;
}

// ─── Power Estimate Calculator ─────────────────────────────

function updatePowerEstimate() {
    var gsEl = document.getElementById("ew-gamestage");
    var giEl = document.getElementById("ew-gradeindex");
    var estEl = document.getElementById("ew-estimated-damage");
    if (!gsEl || !estEl) return;
    var gs = parseInt(gsEl.value) || 1;
    var gi = giEl ? parseInt(giEl.value) || 1 : gs;
    var modal = document.getElementById("modal-edit");
    var category = (modal && modal.dataset.category) || "Pistol";
    // BL2 base damage values at level 1 by weapon type
    var baseDmg = {
        Pistol: 13, "Assault Rifle": 16, SMG: 12,
        Shotgun: 14, "Sniper Rifle": 52, "Rocket Launcher": 110,
    };
    // BL2 pellet counts (affects displayed card damage for shotguns)
    var pellets = { Shotgun: 7 };
    var base = baseDmg[category] || 15;
    var pelletCount = pellets[category] || 1;
    // Bug 18: formula now matches backend (asset_db.py estimate_weapon_stats)
    // game_stage drives base level scaling, grade_index adds linear quality bonus
    var levelScale = Math.pow(1.13, gs - 1);
    var gradeBonus = gi > gs ? 1.0 + (gi - gs) * 0.025 : 1.0;
    var est = Math.round(base * levelScale * gradeBonus);
    // Shotguns show per-pellet x count
    var displayDmg = pelletCount > 1 ? (est + " x" + pelletCount) : est.toLocaleString();
    var totalDmg = est * pelletCount;
    var lvReq = gs;
    var color = totalDmg > 50000 ? "#ff4040" : totalDmg > 5000 ? "#e8a33a" : totalDmg > 500 ? "#9b59b6" : "#3bbd40";
    estEl.innerHTML = 'Est. Damage: <span class="power-damage-val" style="color:' + color + '">' + displayDmg + '</span>' +
        '<span style="color:#7a7e8e;font-size:11px;margin-left:12px">Level ' + lvReq + '</span>';
    // Warning if quality is extremely high
    if (gi > 80) {
        estEl.innerHTML += '<div style="color:#ff4040;font-size:10px;margin-top:4px">High quality values may cause instability in-game</div>';
    }
}

// (stat card CSS moved to style.css)

// ─── Save List ──────────────────────────────────────────────

async function loadSaveList() {
    try {
        const saves = await api("/api/saves");
        const list = document.getElementById("save-list");
        list.innerHTML = "";
        for (const s of saves) {
            const div = document.createElement("div");
            div.className = "save-item";
            const safeId = s.filename.replace(/\./g, "-");
            div.innerHTML = `
                <div class="save-name">${esc(s.filename)}</div>
                <div class="save-char-info" id="sinfo-${safeId}">Loading...</div>
                <div class="save-actions">
                    <button class="save-action-btn save-bak-btn" data-file="${esc(s.filename)}" title="Backups">&#x21BA;</button>
                    <button class="save-action-btn save-dup-btn" data-file="${esc(s.filename)}" title="Duplicate">&#x2398;</button>
                    <button class="save-action-btn save-del-btn" data-file="${esc(s.filename)}" title="Delete">&times;</button>
                </div>
                <div class="save-meta">${s.size_kb} KB</div>
            `;
            div.querySelector(".save-name").addEventListener("click", () => loadSave(s.filename));
            div.querySelector(".save-char-info").addEventListener("click", () => loadSave(s.filename));
            list.appendChild(div);
        }
        // Duplicate button handlers
        list.querySelectorAll(".save-dup-btn").forEach(btn => {
            btn.addEventListener("click", async function(e) {
                e.stopPropagation();
                var file = this.dataset.file;
                try {
                    var res = await api("/api/save/" + file + "/duplicate", { method: "POST" });
                    toast("Duplicated to " + res.new_filename);
                    await loadSaveList();
                } catch (err) { toast("Error: " + err.message, "error"); }
            });
        });
        // Delete button handlers
        list.querySelectorAll(".save-del-btn").forEach(btn => {
            btn.addEventListener("click", async function(e) {
                e.stopPropagation();
                var file = this.dataset.file;
                if (!confirm('Delete save "' + file + '"? (A .deleted backup will be kept)')) return;
                try {
                    await api("/api/save/" + file + "/delete", { method: "DELETE" });
                    toast("Deleted " + file);
                    if (currentFile === file) {
                        currentFile = null;
                        document.getElementById("editor").classList.add("hidden");
                        document.getElementById("no-save-msg").classList.remove("hidden");
                    }
                    await loadSaveList();
                } catch (err) { toast("Error: " + err.message, "error"); }
            });
        });
        // Backup button handlers
        list.querySelectorAll(".save-bak-btn").forEach(btn => {
            btn.addEventListener("click", async function(e) {
                e.stopPropagation();
                showBackups(this.dataset.file);
            });
        });
        // Project Paris Bug 4: single batch call instead of N full-parse calls
        api("/api/saves/previews").then(previews => {
            for (const s of saves) {
                const safeId = s.filename.replace(/\./g, "-");
                const el = document.getElementById("sinfo-" + safeId);
                const info = previews[s.filename];
                if (el && info) el.textContent = info.class_name + " - Level " + info.level;
            }
        }).catch(() => {});
    } catch (e) {
        console.error("Failed to load saves:", e);
    }
}

// ─── Backup Restore ────────────────────────────────────────

async function showBackups(filename) {
    var modal = document.getElementById("modal-backups");
    var listEl = document.getElementById("backup-list");
    modal.classList.remove("hidden");
    listEl.innerHTML = '<div style="color:var(--text-dim);font-size:12px">Loading...</div>';
    try {
        var res = await api("/api/save/" + filename + "/backups");
        if (!res.backups || !res.backups.length) {
            listEl.innerHTML = '<div style="color:var(--text-dim);font-size:13px;padding:12px">No backups available for this save.</div>';
            return;
        }
        var html = "";
        res.backups.forEach(function(b) {
            var date = new Date(b.modified * 1000).toLocaleString();
            var sizeKb = (b.size / 1024).toFixed(1);
            var label = b.generation === 0 ? "Latest backup" : b.generation === -1 ? "Deleted backup" : "Backup #" + b.generation;
            html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border)">';
            html += '<div><div style="font-size:13px;color:var(--text)">' + esc(label) + '</div>';
            html += '<div style="font-size:11px;color:var(--text-dim)">' + date + ' &middot; ' + sizeKb + ' KB</div></div>';
            html += '<button class="btn-small btn-restore-bak" data-file="' + esc(filename) + '" data-gen="' + b.generation + '">RESTORE</button>';
            html += '</div>';
        });
        listEl.innerHTML = html;
        listEl.querySelectorAll(".btn-restore-bak").forEach(function(btn) {
            btn.addEventListener("click", async function() {
                var file = this.dataset.file;
                var gen = parseInt(this.dataset.gen);
                if (!confirm("Restore this backup? Your current save will be backed up first.")) return;
                try {
                    await api("/api/save/" + file + "/backups/restore", {
                        method: "POST", body: { generation: gen }
                    });
                    toast("Restored from backup");
                    modal.classList.add("hidden");
                    if (currentFile === file) await loadSave(file);
                    await loadSaveList();
                } catch (e) { toast("Error: " + e.message, "error"); }
            });
        });
    } catch (e) {
        listEl.innerHTML = '<div style="color:#ff4444;font-size:12px">Error loading backups: ' + esc(e.message) + '</div>';
    }
}

// ─── Game Running Check ─────────────────────────────────────

async function checkGameRunning() {
    try {
        const status = await api("/api/game-status");
        const banner = document.getElementById("game-warning");
        if (status.running) {
            if (!banner) {
                const b = document.createElement("div");
                b.id = "game-warning";
                b.style.cssText = "background:#ff4040;color:#fff;text-align:center;padding:8px;font-weight:bold;font-size:13px;position:fixed;top:0;left:0;right:0;z-index:9999;";
                b.textContent = "⚠ BL2 IS RUNNING — Close the game before editing! Changes will be overwritten by the game.";
                document.body.prepend(b);
            }
        } else if (banner) {
            banner.remove();
        }
    } catch (e) {}
}
setInterval(checkGameRunning, 15000);
checkGameRunning();

// ─── Load Save ──────────────────────────────────────────────

async function loadSave(filename) {
    currentFile = filename;
    showLoading(true);
    try {
        currentData = await api("/api/save/" + filename);
        document.getElementById("no-save-msg").classList.add("hidden");
        document.getElementById("editor").classList.remove("hidden");
        document.getElementById("weapon-preview").classList.add("hidden");
        // Bug 23: destroy preview viewer to stop orphaned animation frame loop
        if (typeof destroyPreviewViewer === "function") destroyPreviewViewer();
        renderCharacter(currentData.character);
        renderEquipment(currentData);
        renderInventory(currentData.inventory);
        renderMissions(currentData.missions);
        await renderFastTravel(currentData.fast_travel);
        renderChallenges(currentData.challenges);
        // Mark active in sidebar
        document.querySelectorAll(".save-item").forEach(el => {
            el.classList.toggle("active", el.querySelector(".save-name").textContent === filename);
        });
    } catch (e) {
        toast("Failed to load save: " + e.message, "error");
        console.error(e);
    }
    showLoading(false);
}

// ─── Character ──────────────────────────────────────────────

// BL2 XP required per level — authoritative game values (index = level)
// Project Paris Bug 1: previous table diverged from game data at level 5+
const REQUIRED_XP = [
    0, 0, 358, 1241, 2850, 5376, 8997, 13886, 20208, 28126, 37798,
    49377, 63016, 78861, 97061, 117757, 141092, 167206, 196238, 228322, 263595,
    302190, 344238, 389873, 439222, 492414, 549578, 610840, 676325, 746158, 820463,
    899363, 982980, 1071435, 1164850, 1263343, 1367034, 1476041, 1590483, 1710476, 1836137,
    1967582, 2104926, 2248285, 2397772, 2553501, 2715586, 2884139, 3059273, 3241098, 3429728,
    3625271, 3827840, 4037543, 4254491, 4478792, 4710556, 4949890, 5196902, 5451701, 5714393,
    5985086, 6263885, 6550897, 6846227, 7149982, 7462266, 7783184, 8112840, 8451340, 8798786,
    9155282, 9520931, 9895837, 10280103, 10673830, 11077120, 11490077, 11912801, 12345393, 12787955,
];

function renderCharacter(c) {
    document.getElementById("char-class-badge").textContent = c.class_name;
    const h = Math.floor(c.time_played / 3600);
    const m = Math.floor((c.time_played % 3600) / 60);
    document.getElementById("char-playtime").textContent = "Time played: " + h + "h " + m + "m";

    document.getElementById("char-name").value = c.name || "";
    document.getElementById("char-level").value = c.level;
    document.getElementById("char-money").value = c.money;
    document.getElementById("char-eridium").value = c.eridium;
    document.getElementById("char-seraph").value = c.seraph;
    document.getElementById("char-torgue").value = c.torgue;
    document.getElementById("char-goldenkeys").value = c.golden_keys || 0;
    document.getElementById("char-skillpoints").value = c.skill_points || 0;
    document.getElementById("char-backpack").value = c.inventory_size;
    document.getElementById("char-bank").value = c.bank_size;
    document.getElementById("char-gunslots").value = c.weapon_slots;
    document.getElementById("char-oplevel").value = c.op_level || 0;
    document.getElementById("char-save-status").textContent = "";

    // Ammo grid
    var ammoGrid = document.getElementById("ammo-grid");
    if (ammoGrid && c.ammo) {
        var html = "";
        for (var i = 0; i < c.ammo.length; i++) {
            var a = c.ammo[i];
            html += '<div class="ammo-cell">';
            html += '<span class="ammo-label">' + esc(a.display_name) + '</span>';
            html += '<input type="number" class="ammo-input" data-ammo="' + esc(a.key) + '" min="0" max="' + a.max + '" value="' + a.quantity + '">';
            html += '<span class="ammo-max">/ ' + a.max + '</span>';
            html += '</div>';
        }
        ammoGrid.innerHTML = html;
    }

    // XP bar
    var lvl = c.level || 1;
    var xp = c.experience || 0;
    var xpCur = REQUIRED_XP[lvl] || 0;
    var xpNext = REQUIRED_XP[Math.min(lvl + 1, REQUIRED_XP.length - 1)] || xpCur;
    var xpInLevel = xp - xpCur;
    var xpNeeded = xpNext - xpCur;
    var pct = xpNeeded > 0 ? Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100)) : 100;
    var fill = document.getElementById("xp-bar-fill");
    var label = document.getElementById("xp-label");
    if (fill) fill.style.width = pct + "%";
    if (label) label.textContent = xpInLevel.toLocaleString() + " / " + xpNeeded.toLocaleString() + " XP";

    // Render skill trees
    renderSkillTree(c);
}

// ─── Skill Tree ────────────────────────────────────────────

var _skillTreeData = null;
var _skillEdits = {}; // track pending skill changes

async function loadSkillTreeData() {
    if (_skillTreeData) return _skillTreeData;
    try {
        _skillTreeData = await (await fetch("/static/skill_trees.json")).json();
    } catch (e) {
        _skillTreeData = {};
    }
    return _skillTreeData;
}

function getClassPrefix(charClassStr) {
    // Map class path to skill tree key: "GD_Soldier.Character.CharClass_Soldier" -> "GD_Soldier"
    if (!charClassStr) return null;
    var match = charClassStr.match(/^(GD_\w+)\./);
    return match ? match[1] : null;
}

// ── Skill Icon Mapping ──
var _SKILL_ICON = {
    // ── Axton (Soldier) ──
    "GD_Soldier_Skills.Scorpio.Skill_Scorpio":"AAIcon-SoldierAA",
    "GD_Soldier_Skills.Guerrilla.Sentry":"SkillIcon-Sentry",
    "GD_Soldier_Skills.Guerrilla.Ready":"SkillIcon-Ready",
    "GD_Soldier_Skills.Guerrilla.LaserSight":"SkillIcon-LaserSight",
    "GD_Soldier_Skills.Guerrilla.Willing":"SkillIcon-PickupTurret",
    "GD_Soldier_Skills.Guerrilla.Onslaught":"SkillIcon-Onslaught",
    "GD_Soldier_Skills.Guerrilla.ScorchedEarth":"SkillIcon-MultiRocket",
    "GD_Soldier_Skills.Guerrilla.Able":"SkillIcon-Able",
    "GD_Soldier_Skills.Guerrilla.Grenadier":"SkillIcon-Grenadier",
    "GD_Soldier_Skills.Guerrilla.CrisisManagement":"SkillIcon-CrisisManagement",
    "GD_Soldier_Skills.Guerrilla.DoubleUp":"SkillIcon-DoubleUp",
    "GD_Soldier_Skills.Gunpowder.Impact":"SkillIcon-Impact",
    "GD_Soldier_Skills.Gunpowder.Expertise":"SkillIcon-FastHands",
    "GD_Soldier_Skills.Gunpowder.Overload":"SkillIcon-Overload",
    "GD_Soldier_Skills.Gunpowder.MetalStorm":"SkillIcon-Metalstorm",
    "GD_Soldier_Skills.Gunpowder.Steady":"SkillIcon-Steady",
    "GD_Soldier_Skills.Gunpowder.LongBowTurret":"SkillIcon-LongbowTurret",
    "GD_Soldier_Skills.Gunpowder.Battlefront":"SkillIcon-Battlefront",
    "GD_Soldier_Skills.Gunpowder.DutyCalls":"SkillIcon-DutyCalls",
    "GD_Soldier_Skills.Gunpowder.DoOrDie":"SkillIcon-DoOrDie",
    "GD_Soldier_Skills.Gunpowder.Ranger":"SkillIcon-Ranger",
    "GD_Soldier_Skills.Gunpowder.Nuke":"SkillIcon-Nuke",
    "GD_Soldier_Skills.Survival.HealthY":"SkillIcon-Healthy",
    "GD_Soldier_Skills.Survival.Preparation":"SkillIcon-Preparation",
    "GD_Soldier_Skills.Survival.LastDitchEffort":"SkillIcon-LastDitchEffort",
    "GD_Soldier_Skills.Survival.Pressure":"SkillIcon-Pressure",
    "GD_Soldier_Skills.Survival.Forbearance":"SkillIcon-Forbearance",
    "GD_Soldier_Skills.Survival.PhalanxShield":"SkillIcon-BubbleShield",
    "GD_Soldier_Skills.Survival.QuickCharge":"SkillIcon-Quickcharge",
    "GD_Soldier_Skills.Survival.Resourceful":"SkillIcon-Resourceful",
    "GD_Soldier_Skills.Survival.Mag-Lock":"SkillIcon-StickyTurret",
    "GD_Soldier_Skills.Survival.Grit":"SkillIcon-Grit",
    "GD_Soldier_Skills.Survival.Gemini":"SkillIcon-Gemini",
    // ── Zer0 (Assassin) ──
    "GD_Assassin_Skills.ActionSkill.Skill_Deception":"AAIcon-AssassinAA",
    "GD_Assassin_Skills.Sniping.HeadShot":"SkillIcon-BoomHeadshot",
    "GD_Assassin_Skills.Sniping.Optics":"SkillIcon-Squint",
    "GD_Assassin_Skills.Sniping.Killer":"SkillIcon-Killer",
    "GD_Assassin_Skills.Sniping.Precision":"SkillIcon-Precision",
    "GD_Assassin_Skills.Sniping.OneShot":"SkillIcon-OneShotOneKill",
    "GD_Assassin_Skills.Sniping.Bore":"SkillIcon-Bore",
    "GD_Assassin_Skills.Sniping.Velocity":"Skillicon-velocity",
    "GD_Assassin_Skills.Sniping.KillConfirmed":"SkillIcon-KillConfirmed",
    "GD_Assassin_Skills.Sniping.AtOneWithTheGun":"SkillIcon-NoScoping",
    "GD_Assassin_Skills.Sniping.CriticalAscension":"SkillIcon-Escalation",
    "GD_Assassin_Skills.Sniping.Unforseen":"SkillIcon-Unforseen",
    "GD_Assassin_Skills.Cunning.FastHands":"SkillIcon-Expertise",
    "GD_Assassin_Skills.Cunning.CounterStrike":"SkillIcon-Counterstrike",
    "GD_Assassin_Skills.Cunning.Fearless":"SkillIcon-Fearless",
    "GD_Assassin_Skills.Cunning.Ambush":"SkillIcon-Dishonorable",
    "GD_Assassin_Skills.Cunning.RisingShot":"SkillIcon-BloodyTrails",
    "GD_Assassin_Skills.Cunning.DeathMark":"SkillIcon-DeathsMark",
    "GD_Assassin_Skills.Cunning.Innervate":"SkillIcon-Frenzy",
    "GD_Assassin_Skills.Cunning.TwoFang":"SkillIcon-TwitchyTrigger",
    "GD_Assassin_Skills.Cunning.DeathBlossom":"SkillIcon-DeathBlossom",
    "GD_Assassin_Skills.Cunning.Followthrough":"SkillIcon-Followthrough",
    "GD_Assassin_Skills.Cunning.Execute":"SkillIcon-Execute",
    "GD_Assassin_Skills.Bloodshed.Killing_Blow":"SkillIcon-Finisher",
    "GD_Assassin_Skills.Bloodshed.IronHand":"SkillIcon-Scrapper",
    "GD_Assassin_Skills.Bloodshed.Grim":"SkillIcon-Grim",
    "GD_Assassin_Skills.Bloodshed.BeLikeWater":"SkillIcon-Fluidity",
    "GD_Assassin_Skills.Bloodshed.Resurgence":"SkillIcon-Resurgence",
    "GD_Assassin_Skills.Bloodshed.Execute":"SkillIcon-Execute",
    "GD_Assassin_Skills.Bloodshed.Backstab":"SkillIcon-Backstab",
    "GD_Assassin_Skills.Bloodshed.Followthrough":"SkillIcon-Followthrough",
    "GD_Assassin_Skills.Bloodshed.LikeTheWind":"SkillIcon-LikeTheWind",
    "GD_Assassin_Skills.Bloodshed.ManyMustFall":"SkillIcon-KillingSpree",
    "GD_Assassin_Skills.Bloodshed.Unforseen":"SkillIcon-Unforseen",
    // ── Maya (Siren) ──
    "GD_Siren_Skills.Phaselock.Skill_Phaselock":"AAIcon-SirenAA",
    "GD_Siren_Skills.Motion.Ward":"SkillIcon-Ward",
    "GD_Siren_Skills.Motion.Accelerate":"SkillIcon-Accelerate",
    "GD_Siren_Skills.Motion.Suspension":"SkillIcon-Suspension",
    "GD_Siren_Skills.Motion.KineticReflection":"SkillIcon-KineticReflection",
    "GD_Siren_Skills.Motion.Fleet":"SkillIcon-Fleet",
    "GD_Siren_Skills.Motion.Converge":"SkillIcon-Stagnant",
    "GD_Siren_Skills.Motion.Inertia":"SkillIcon-Inertia",
    "GD_Siren_Skills.Motion.Quicken":"SkillIcon-Quicken",
    "GD_Siren_Skills.Motion.SubSequence":"SkillIcon-Subsequence",
    "GD_Siren_Skills.Motion.Thoughtlock":"SkillIcon-ThoughtLock",
    "GD_Siren_Skills.Harmony.MindControl":"SkillIcon-MindsEye",
    "GD_Siren_Skills.Harmony.SweetRelease":"SkillIcon-SweetRelease",
    "GD_Siren_Skills.Harmony.Restoration":"SkillIcon-Restoration",
    "GD_Siren_Skills.Harmony.Wreck":"SkillIcon-Wreck",
    "GD_Siren_Skills.Harmony.Elated":"SkillIcon-Elated",
    "GD_Siren_Skills.Harmony.Res":"SkillIcon-Res",
    "GD_Siren_Skills.Harmony.Recompense":"SkillIcon-Recompense",
    "GD_Siren_Skills.Harmony.Sustenance":"SkillIcon-Sustenance",
    "GD_Siren_Skills.Harmony.LifeTap":"SkillIcon-LifeTap",
    "GD_Siren_Skills.Harmony.Scorn":"SkillIcon-Scorn",
    "GD_Siren_Skills.Cataclysm.Flicker":"SkillIcon-Flicker",
    "GD_Siren_Skills.Cataclysm.Foresight":"SkillIcon-Foresight",
    "GD_Siren_Skills.Cataclysm.Immolate":"SkillIcon-Immolate",
    "GD_Siren_Skills.Cataclysm.Helios":"SkillIcon-Helios",
    "GD_Siren_Skills.Cataclysm.ChainReaction":"SkillIcon-ChainReaction",
    "GD_Siren_Skills.Cataclysm.Backdraft":"SkillIcon-Backdraft",
    "GD_Siren_Skills.Cataclysm.CloudKill":"SkillIcon-CloudKill",
    "GD_Siren_Skills.Cataclysm.Reaper":"SkillIcon-Reaper",
    "GD_Siren_Skills.Cataclysm.Blight":"SkillIcon-BlightPhoenix",
    "GD_Siren_Skills.Cataclysm.Ruin":"SkillIcon-Ruin",
    // ── Salvador (Mercenary) ──
    "GD_Mercenary_Skills.ActionSkill.Skill_Gunzerking":"AAIcon-MercAA_I1",
    "GD_Mercenary_Skills.GunLust.Locked_and_Loaded":"SkillIcon-LockedNLoaded",
    "GD_Mercenary_Skills.GunLust.QuickDraw":"SkillIcon-QuickDraw",
    "GD_Mercenary_Skills.GunLust.ImReady":"SkillIcon-ImReadyAlready",
    "GD_Mercenary_Skills.GunLust.AutoLoad":"SkillIcon-AutoLoader",
    "GD_Mercenary_Skills.GunLust.LayWaste":"SkillIcon-LayWaste",
    "GD_Mercenary_Skills.GunLust.NoKillLikeOverkill":"SkillIcon-NoKillLikeOverkill",
    "GD_Mercenary_Skills.GunLust.AllIneedIsOne":"SkillIcon-AllINeedIsOne",
    "GD_Mercenary_Skills.GunLust.MoneyShot":"SkillIcon-MoneyShot",
    "GD_Mercenary_Skills.GunLust.DontMakeMeAngry":"SkillIcon-DownNotOut",
    "GD_Mercenary_Skills.GunLust.KeepFiring":"SkillIcon-KeepFiring",
    "GD_Mercenary_Skills.Rampage.Inconceivable":"SkillIcon-Inconceivable",
    "GD_Mercenary_Skills.Rampage.FilledToTheBrim":"SkillIcon-FilledToTheBrim",
    "GD_Mercenary_Skills.Rampage.AllInTheReflexes":"SkillIcon-AllInTheReflexes",
    "GD_Mercenary_Skills.Rampage.LastManStanding":"SkillIcon-Diehard",
    "GD_Mercenary_Skills.Rampage.YippeeKiYay":"SkillIcon-Yippekiyay",
    "GD_Mercenary_Skills.Rampage.SteadyAsSheGoes":"SkillIcon-SteadyAsSheGoes",
    "GD_Mercenary_Skills.Rampage.5ShotsOrSix":"SkillIcon-5Shots",
    "GD_Mercenary_Skills.Rampage.DoubleYourFun":"SkillIcon-DoubleFun",
    "GD_Mercenary_Skills.Rampage.GetSome":"SkillIcon-GetSome",
    "GD_Mercenary_Skills.Rampage.KeepItPipingHot":"SkillIcon-KeepItPipingHot",
    "GD_Mercenary_Skills.Brawn.HardToKill":"SkillIcon-Asbestos",
    "GD_Mercenary_Skills.Brawn.Incite":"SkillIcon-Incite",
    "GD_Mercenary_Skills.Brawn.ImTheTank":"SkillIcon-ImTheJuggernaut",
    "GD_Mercenary_Skills.Brawn.AintGotTime":"SkillIcon-NoTimeToBleed",
    "GD_Mercenary_Skills.Brawn.BusFull":"SkillIcon-BusCantStop",
    "GD_Mercenary_Skills.Brawn.JustGotReal":"SkillIcon-JustGotReal",
    "GD_Mercenary_Skills.Brawn.FistfulOfHurt":"SkillIcon-FistfullHurt",
    "GD_Mercenary_Skills.Brawn.OutOfBubblegum":"SkillIcon-OutOfBubbleGum",
    "GD_Mercenary_Skills.Brawn.ComeAtMeBro":"SkillIcon-ComeAtMeBro_I1",
    "GD_Mercenary_Skills.Brawn.SexualTyrannosaurus":"SkillIcon-SexualTyranosaurus",
    // ── Gaige (Tulip/Mechromancer) ──
    "GD_Tulip_DeathTrap.Skills.Skill_DeathTrap":"AAIcon-MechroAA_I1",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.CloseEnough":"SkillIcon-Mechro01",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.CookingUpTrouble":"SkillIcon-Mechro15",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.FancyMathematics":"SkillIcon-Mechro24",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.BuckUp":"SkillIcon-Mechro04",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.PotentAsAPony":"SkillIcon-Mechro18",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.UpshotRobot":"SkillIcon-Mechro13",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.UnstoppableForce":"SkillIcon-Mechro20",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.ExplosiveClap":"SkillIcon-Mechro03",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.MadeOfSternerStuff":"SkillIcon-Mechro16",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.20PercentCooler":"SkillIcon-Mechro09",
    "GD_Tulip_Mechromancer_Skills.BestFriendsForever.SharingIsCaring":"SkillIcon-Mechro25",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.MorePep":"SkillIcon-Mechro05",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.Myelin":"SkillIcon-Mechro21",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.ShockAndAAAGGGHHH":"SkillIcon-Mechro07",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.TheStare":"SkillIcon-Mechro08",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.Strength":"SkillIcon-Mechro02",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.Shock":"SkillIcon-Mechro12",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.Burn":"SkillIcon-Mechro38",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.OneTwo":"SkillIcon-Mechro28",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.WiresDontTalk":"SkillIcon-Mechro37",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.Interspersed":"SkillIcon-Mechro36",
    "GD_Tulip_Mechromancer_Skills.LittleBigTrouble.MakeItSparkle":"SkillIcon-Mechro35",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.Anarchy":"SkillIcon-Mechro11",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.SmallerLighterFaster":"SkillIcon-Mechro17",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.PreshrunkCyberpunk":"SkillIcon-Mechro26",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.Robot_Rampage":"SkillIcon-Mechro23",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.BloodSoakedShields":"SkillIcon-Mechro30",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.DiscordSkill":"SkillIcon-Mechro31",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.TypecastIconoclast":"SkillIcon-Mechro32",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.RationalAnarchist":"SkillIcon-Mechro33",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.DeathFromAbove":"SkillIcon-Mechro14",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.TheNthDegree":"SkillIcon-Mechro34",
    "GD_Tulip_Mechromancer_Skills.OrderedChaos.WithClaws":"SkillIcon-Mechro06",
    // ── Krieg (Lilac/Psycho) ──
    "GD_Lilac_Skills_Mania.Skills.Skill_BuzzAxeRampage":"AAIcon-PsychoAA_I1",
    "GD_Lilac_Skills_Bloodlust.Skills.BloodFilled":"SkillIcon-Psycho01",
    "GD_Lilac_Skills_Bloodlust.Skills.BloodTwitch":"SkillIcon-Psycho02",
    "GD_Lilac_Skills_Bloodlust.Skills.TasteOfBlood":"SkillIcon-Psycho03",
    "GD_Lilac_Skills_Bloodlust.Skills.BloodOverdrive":"SkillIcon-Psycho04",
    "GD_Lilac_Skills_Bloodlust.Skills.NervousBlood":"SkillIcon-Psycho05",
    "GD_Lilac_Skills_Bloodlust.Skills.Bloodbath":"SkillIcon-Psycho06",
    "GD_Lilac_Skills_Bloodlust.Skills.FuelTheBlood":"SkillIcon-Psycho07",
    "GD_Lilac_Skills_Bloodlust.Skills.BuzzAxeBombadier":"SkillIcon-Psycho08",
    "GD_Lilac_Skills_Bloodlust.Skills.Boiling_Blood":"SkillIcon-Psycho09",
    "GD_Lilac_Skills_Bloodlust.Skills.BloodExplosion":"SkillIcon-Psycho10",
    "GD_Lilac_Skills_Mania.Skills.EmptyTheRage":"SkillIcon-Psycho11",
    "GD_Lilac_Skills_Mania.Skills.FeedTheMeat":"SkillIcon-Psycho12",
    "GD_Lilac_Skills_Mania.Skills.Embrace_The_Pain":"SkillIcon-Psycho13",
    "GD_Lilac_Skills_Mania.Skills.LightTheFuse":"SkillIcon-Psycho14",
    "GD_Lilac_Skills_Mania.Skills.StripTheFlesh":"SkillIcon-Psycho15",
    "GD_Lilac_Skills_Mania.Skills.Thrill_Of_The_Kill":"SkillIcon-Psycho16",
    "GD_Lilac_Skills_Mania.Skills.SilenceTheVoices":"SkillIcon-Psycho17",
    "GD_Lilac_Skills_Mania.Skills.PullThePin":"SkillIcon-Psycho18",
    "GD_Lilac_Skills_Mania.Skills.RedeemTheSoul":"SkillIcon-Psycho19",
    "GD_Lilac_Skills_Mania.Skills.ReleaseTheBeast":"SkillIcon-Psycho20",
    "GD_Lilac_Skills_Hellborn.Skills.BurnBabyBurn":"SkillIcon-Psycho21",
    "GD_Lilac_Skills_Hellborn.Skills.FuelThefire":"SkillIcon-Psycho22",
    "GD_Lilac_Skills_Hellborn.Skills.PainIsPower":"SkillIcon-Psycho24",
    "GD_Lilac_Skills_Hellborn.Skills.NumbedNerves":"SkillIcon-Psycho25",
    "GD_Lilac_Skills_Hellborn.Skills.FlameFlare":"SkillIcon-Psycho26",
    "GD_Lilac_Skills_Hellborn.Skills.Hellfire_Halitosis":"SkillIcon-Psycho27",
    "GD_Lilac_Skills_Hellborn.Skills.DelusionalDamage":"SkillIcon-Psycho28",
    "GD_Lilac_Skills_Hellborn.Skills.FireFirey":"SkillIcon-Psycho29",
    "GD_Lilac_Skills_Hellborn.Skills.ElementalElation":"SkillIcon-Psycho30",
    "GD_Lilac_Skills_Hellborn.Skills.RavingRetribution":"SkillIcon-Psycho31"
};

function _skillIconUrl(path) {
    var name = _SKILL_ICON[path];
    if (name) return "/static/icons/skills/" + name + ".png";
    return "";
}

// ── Skill Tooltip ──
var _stTooltip = null;
function _ensureTooltip() {
    if (_stTooltip) return _stTooltip;
    _stTooltip = document.createElement("div");
    _stTooltip.className = "st-tooltip";
    _stTooltip.innerHTML = '<div class="st-tooltip-name"></div><div class="st-tooltip-points"></div><div class="st-tooltip-desc"></div><div class="st-tooltip-hint">Left-click: add point / Right-click: remove</div>';
    document.body.appendChild(_stTooltip);
    return _stTooltip;
}

function renderSkillTree(c) {
    var container = document.getElementById("skill-tree-container");
    var emptyMsg = document.getElementById("skill-tree-empty");
    if (!c.class) {
        container.innerHTML = '';
        if (emptyMsg) emptyMsg.classList.remove("hidden");
        return;
    }

    loadSkillTreeData().then(function(treeData) {
        var prefix = getClassPrefix(c.class);
        var charTree = treeData[prefix];
        if (!charTree) {
            container.innerHTML = '';
            if (emptyMsg) emptyMsg.classList.remove("hidden");
            return;
        }

        if (emptyMsg) emptyMsg.classList.add("hidden");
        _skillEdits = {};
        var skills = c.skills || {};
        var totalAllocated = 0;
        for (var sk in skills) totalAllocated += skills[sk];
        var actionSkillPath = charTree.action_skill ? charTree.action_skill.path : "";
        if (skills[actionSkillPath]) totalAllocated -= skills[actionSkillPath];

        var maxPoints = Math.max(0, (c.level || 1) - 1);
        document.getElementById("skill-points-remaining").textContent =
            (c.skill_points || 0) + " unspent / " + totalAllocated + " allocated / " + maxPoints + " available";

        // Build skill metadata map for tooltips (avoids HTML-escaping issues in attributes)
        var _skillMeta = {};

        // Action skill banner
        var html = '';
        if (charTree.action_skill) {
            var asIcon = _skillIconUrl(charTree.action_skill.path);
            html += '<div class="st-action-skill">';
            if (asIcon) html += '<img class="st-action-icon" src="' + asIcon + '" alt="">';
            html += '<span class="st-action-name">' + esc(charTree.action_skill.name) + '</span>';
            if (charTree.action_skill.description) html += '<span class="st-action-desc">' + esc(charTree.action_skill.description) + '</span>';
            html += '</div>';
        }
        html += '<div class="skill-trees-row">';
        var treeKeys = Object.keys(charTree.trees);
        for (var ti = 0; ti < treeKeys.length; ti++) {
            var treeKey = treeKeys[ti];
            var tree = charTree.trees[treeKey];
            html += '<div class="skill-tree-panel" style="--tree-color:' + tree.color + '">';
            html += '<div class="st-header">' + esc(tree.name).toUpperCase() + '</div>';

            // Group by tier, place in col grid
            var tierSkills = {};
            for (var si = 0; si < tree.skills.length; si++) {
                var sk = tree.skills[si];
                if (sk.max === 0) continue;
                if (!tierSkills[sk.tier]) tierSkills[sk.tier] = {};
                tierSkills[sk.tier][sk.col] = sk;
            }
            for (var tier = 1; tier <= 6; tier++) {
                if (!tierSkills[tier]) continue;
                html += '<div class="st-tier-row" data-tier="' + tier + '">';
                for (var col = 0; col < 3; col++) {
                    html += '<div class="st-cell">';
                    var sk = tierSkills[tier][col];
                    if (sk) {
                        var curLevel = skills[sk.path] || 0;
                        var isMaxed = curLevel >= sk.max;
                        var cls = "st-skill" + (curLevel > 0 ? " st-active" : "") + (isMaxed ? " st-maxed" : "");
                        var iconUrl = _skillIconUrl(sk.path);
                        _skillMeta[sk.path] = { name: sk.name, desc: sk.desc || '', max: sk.max };
                        html += '<div class="' + cls + '" data-path="' + esc(sk.path) + '" data-max="' + sk.max + '">';
                        html += '<div class="st-icon-wrap">';
                        if (iconUrl) {
                            html += '<img class="st-icon" src="' + iconUrl + '" alt="" draggable="false">';
                        } else {
                            html += '<div class="st-icon-fallback">' + esc(sk.name.charAt(0)) + '</div>';
                        }
                        html += '<span class="st-points">' + curLevel + '/' + sk.max + '</span>';
                        html += '</div>';
                        html += '<div class="st-skill-label">' + esc(sk.name) + '</div>';
                        html += '</div>';
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        container.innerHTML = html;

        // Wire click and tooltip handlers
        var tip = _ensureTooltip();
        container.querySelectorAll(".st-skill").forEach(function(el) {
            el.addEventListener("click", function(e) {
                var path = this.dataset.path;
                var max = parseInt(this.dataset.max);
                var pts = this.querySelector(".st-points");
                var cur = parseInt(pts.textContent.split("/")[0]);
                var next = cur + 1;
                if (next > max) next = 0;
                pts.textContent = next + "/" + max;
                _skillEdits[path] = next;
                this.classList.toggle("st-active", next > 0);
                this.classList.toggle("st-maxed", next >= max);
                _updateTip(tip, this, _skillMeta);
                updateSkillPointsDisplay();
            });
            el.addEventListener("contextmenu", function(e) {
                e.preventDefault();
                var path = this.dataset.path;
                var max = parseInt(this.dataset.max);
                var pts = this.querySelector(".st-points");
                var cur = parseInt(pts.textContent.split("/")[0]);
                var next = cur - 1;
                if (next < 0) next = max;
                pts.textContent = next + "/" + max;
                _skillEdits[path] = next;
                this.classList.toggle("st-active", next > 0);
                this.classList.toggle("st-maxed", next >= max);
                _updateTip(tip, this, _skillMeta);
                updateSkillPointsDisplay();
            });
            el.addEventListener("mouseenter", function(e) {
                _updateTip(tip, this, _skillMeta);
                tip.classList.add("visible");
            });
            el.addEventListener("mousemove", function(e) {
                var x = e.clientX + 14, y = e.clientY + 14;
                if (x + 270 > window.innerWidth) x = e.clientX - 270;
                if (y + 160 > window.innerHeight) y = e.clientY - 160;
                tip.style.left = x + "px";
                tip.style.top = y + "px";
            });
            el.addEventListener("mouseleave", function() {
                tip.classList.remove("visible");
            });
        });
    });
}

function _updateTip(tip, el, meta) {
    var pts = el.querySelector(".st-points").textContent;
    var color = getComputedStyle(el.closest(".skill-tree-panel")).getPropertyValue("--tree-color").trim();
    var m = meta && meta[el.dataset.path];
    tip.querySelector(".st-tooltip-name").textContent = m ? m.name : '';
    tip.querySelector(".st-tooltip-name").style.color = color || "var(--accent)";
    tip.querySelector(".st-tooltip-points").textContent = pts;
    tip.querySelector(".st-tooltip-points").style.color = color || "var(--accent)";
    tip.querySelector(".st-tooltip-desc").textContent = m ? m.desc : '';
}

function updateSkillPointsDisplay() {
    if (!currentData || !currentData.character) return;
    var c = currentData.character;
    var skills = Object.assign({}, c.skills, _skillEdits);
    var treeData = _skillTreeData;
    var prefix = getClassPrefix(c.class);
    var charTree = treeData && treeData[prefix];
    var actionSkillPath = charTree && charTree.action_skill ? charTree.action_skill.path : "";

    var totalAllocated = 0;
    for (var sk in skills) {
        if (sk === actionSkillPath) continue;
        totalAllocated += skills[sk];
    }
    var maxPoints = Math.max(0, (c.level || 1) - 1);
    var unspent = maxPoints - totalAllocated;
    document.getElementById("skill-points-remaining").textContent =
        unspent + " unspent / " + totalAllocated + " allocated / " + maxPoints + " available";
    document.getElementById("skill-points-remaining").style.color = unspent < 0 ? "#e04040" : "var(--accent)";
}

document.getElementById("btn-save-skills").addEventListener("click", async function() {
    if (!currentFile || Object.keys(_skillEdits).length === 0) {
        toast("No skill changes to save", "error");
        return;
    }
    if (_mutating) return;
    _mutating = true;
    var status = document.getElementById("skill-save-status");
    status.textContent = "Saving...";
    try {
        var res = await api("/api/save/" + currentFile + "/skills", {
            method: "POST", body: { skills: _skillEdits }
        });
        toast("Skills updated (" + res.count + " changed)");
        _skillEdits = {};
        await loadSave(currentFile);
        status.textContent = "Saved!";
        setTimeout(function() { status.textContent = ""; }, 2000);
    } catch (e) {
        console.error("Save skills error:", e);
        status.textContent = "Error: " + (e.message || "Unknown");
    }
    _mutating = false;
});

document.getElementById("btn-reset-skills").addEventListener("click", async function() {
    if (!currentData || !currentData.character) return;
    if (_mutating) return;
    if (!confirm("Reset all skills to 0? (Action skill will keep 1 point)")) return;
    var c = currentData.character;
    var treeData = await loadSkillTreeData();
    var prefix = getClassPrefix(c.class);
    var charTree = treeData[prefix];
    if (!charTree) return;

    var resets = {};
    for (var treeKey in charTree.trees) {
        var tree = charTree.trees[treeKey];
        for (var i = 0; i < tree.skills.length; i++) {
            if (tree.skills[i].max > 0) {
                resets[tree.skills[i].path] = 0;
            }
        }
    }
    // Keep action skill at 1
    if (charTree.action_skill) {
        resets[charTree.action_skill.path] = 1;
    }

    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/skills", {
            method: "POST", body: { skills: resets }
        });
        toast("All skills reset");
        _skillEdits = {};
        await loadSave(currentFile);
    } catch (e) { /* handled by api() */ }
    _mutating = false;
});

document.getElementById("btn-save-char").addEventListener("click", async () => {
    if (_mutating) return;
    _mutating = true;
    const btn = document.getElementById("btn-save-char");
    const status = document.getElementById("char-save-status");
    btn.disabled = true;
    status.textContent = "Saving...";
    try {
        // BUG-29: include ammo in character payload to avoid double write_save
        var charBody = {
            name: document.getElementById("char-name").value,
            level: document.getElementById("char-level").value,
            money: document.getElementById("char-money").value,
            eridium: document.getElementById("char-eridium").value,
            seraph: document.getElementById("char-seraph").value,
            torgue: document.getElementById("char-torgue").value,
            golden_keys: document.getElementById("char-goldenkeys").value,
            skill_points: document.getElementById("char-skillpoints").value,
            inventory_size: document.getElementById("char-backpack").value,
            bank_size: document.getElementById("char-bank").value,
            weapon_slots: document.getElementById("char-gunslots").value,
            op_level: document.getElementById("char-oplevel").value,
        };
        var ammoInputs = document.querySelectorAll(".ammo-input");
        if (ammoInputs.length > 0) {
            var ammo = {};
            ammoInputs.forEach(function(inp) { ammo[inp.dataset.ammo] = parseInt(inp.value) || 0; });
            charBody.ammo = ammo;
        }
        const r = await api("/api/save/" + currentFile + "/character", {
            method: "POST", body: charBody,
        });
        renderCharacter(r);
        status.textContent = "SAVED";
        status.style.color = "var(--green)";
        toast("Character saved!");
    } catch (e) {
        status.textContent = "ERROR";
        status.style.color = "var(--red)";
        toast("Error: " + e.message);
    }
    btn.disabled = false;
    _mutating = false;
    setTimeout(() => { status.textContent = ""; }, 2000);
});

// ─── Zoom Controls ─────────────────────────────────────────

document.getElementById("vp-zoom-in").addEventListener("click", function() {
    if (!charViewer || !charViewer.camera) return;
    charViewer.camera.position.z = Math.max(0.5, charViewer.camera.position.z - 0.3);
    if (charViewer.controls) charViewer.controls.update();
});
document.getElementById("vp-zoom-out").addEventListener("click", function() {
    if (!charViewer || !charViewer.camera) return;
    charViewer.camera.position.z = Math.min(6, charViewer.camera.position.z + 0.3);
    if (charViewer.controls) charViewer.controls.update();
});

// ─── Currency Flash Animations ─────────────────────────────

document.querySelectorAll(".cc-input, .cg-input").forEach(function(input) {
    input.addEventListener("change", function() {
        var cell = this.closest(".cc-cell, .cg-cell");
        if (cell) {
            cell.classList.remove("flash");
            void cell.offsetWidth; // force reflow
            cell.classList.add("flash");
            setTimeout(function() { cell.classList.remove("flash"); }, 600);
        }
    });
});

// ─── Equipment Panel ────────────────────────────────────────

const CLASS_GLOW = {
    Axton: "rgba(240, 160, 48, 0.4)", "Zer0": "rgba(75, 139, 232, 0.4)",
    Maya: "rgba(155, 89, 182, 0.4)", Salvador: "rgba(224, 64, 64, 0.4)",
    Gaige: "rgba(255, 64, 129, 0.4)", Krieg: "rgba(232, 163, 58, 0.4)",
};

function renderEquipment(data) {
    const c = data.character;
    const inv = data.inventory;

    // Initialize 3D viewer and load character model with correct head + skin
    // Project Paris Bug 3: skin colors now applied via onLoaded callback, not setTimeout
    if (typeof initViewer === "function") {
        var _colors = c.appearance_colors;
        var _headAsset = c.head_asset || null;
        var _skinAsset = c.skin_asset || null;
        setTimeout(function() {
            initViewer("char-viewport-3d");
            loadCharacterModel(c.class_name, _colors, _headAsset, _skinAsset);
        }, 100);
    }

    // Build the equipped items list for the 3D viewport carousel
    var allEquipped = [];

    // Weapon slots
    const ws = document.getElementById("equip-weapon-slots");
    ws.innerHTML = "";
    const equipped = (inv.weapons || []).filter(w => w.slot > 0).sort((a, b) => a.slot - b.slot);
    for (let i = 1; i <= (c.weapon_slots || 2); i++) {
        const w = equipped.find(x => x.slot === i);
        const slot = document.createElement("div");
        slot.className = "equip-slot";
        if (w && w.resolved) {
            const r = w.resolved;
            const col = (r.rarity && r.rarity.color) || "#888";
            const rarName = (r.rarity && r.rarity.name) || "Common";
            const elemName = (r.element && r.element.name) || null;
            var wElemClass = elemName ? " elem-" + elemName.toLowerCase() : "";
            slot.style.borderLeft = "3px solid " + col;
            slot.setAttribute("data-rarity-border", "true");
            slot.style.setProperty("--slot-rarity-color", col);
            slot.innerHTML = '<div class="slot-icon weapon-icon-wrap' + wElemClass + '" style="color:' + col + ';--icon-rarity:' + col + '">' + getSVG(r.category) + '</div><div><div class="slot-label">Slot ' + i + '</div><div class="slot-name" style="color:' + col + '">' + esc(r.display_name) + '</div></div>';

            // Build equipped item entry for carousel
            // Extract part paths from resolved_parts for gestalt section visibility
            var wPartPaths = [];
            if (r.resolved_parts) {
                for (var pi = 0; pi < r.resolved_parts.length; pi++) {
                    if (r.resolved_parts[pi].path) wPartPaths.push(r.resolved_parts[pi].path);
                }
            }
            var equipEntry = {
                category: r.category,
                rarityName: rarName,
                elementName: elemName,
                charClass: c.class_name,
                manufacturer: r.manufacturer_name || null,
                partPaths: wPartPaths,
                label: r.display_name || ("Slot " + i),
                item: w
            };
            allEquipped.push(equipEntry);
            var eqIdx = allEquipped.length - 1;

            // Left-click: show 3D preview in viewport; right-click/double-click: show detail preview
            slot.addEventListener("click", (function(entry, idx, el) {
                return function(e) {
                    // Clear other slot highlights
                    document.querySelectorAll(".equip-slot.viewing").forEach(function(s) { s.classList.remove("viewing"); });
                    el.classList.add("viewing");
                    if (typeof showEquipmentInViewer === "function") {
                        _equipCarouselIdx = idx;
                        showEquipmentInViewer(entry.category, entry.rarityName, entry.elementName, entry.charClass, entry.manufacturer, entry.partPaths);
                        _updateViewportOverlay(entry);
                    }
                };
            })(equipEntry, eqIdx, slot));
            slot.addEventListener("dblclick", (function(item) {
                return function(e) { e.stopPropagation(); showPreview(item); };
            })(w));
        } else {
            slot.innerHTML = '<div><div class="slot-label">Slot ' + i + '</div><div class="slot-name" style="color:var(--text-muted)">Empty</div></div>';
        }
        ws.appendChild(slot);
    }

    // Gear slots
    const gs = document.getElementById("equip-gear-slots");
    gs.innerHTML = "";
    const gearTypes = ["Shield", "Grenade Mod", "Class Mod", "Relic"];
    const eqItems = (inv.items || []).filter(it => it.is_equipped === 1);
    for (const gt of gearTypes) {
        const item = eqItems.find(it => it.resolved && it.resolved.category === gt);
        const slot = document.createElement("div");
        slot.className = "equip-slot";
        if (item && item.resolved) {
            const r = item.resolved;
            const col = (r.rarity && r.rarity.color) || "#888";
            const rarName = (r.rarity && r.rarity.name) || "Common";
            const elemName = (r.element && r.element.name) || null;
            var gElemClass = elemName ? " elem-" + elemName.toLowerCase() : "";
            slot.style.borderLeft = "3px solid " + col;
            slot.setAttribute("data-rarity-border", "true");
            slot.style.setProperty("--slot-rarity-color", col);
            slot.innerHTML = '<div class="slot-icon weapon-icon-wrap' + gElemClass + '" style="color:' + col + ';--icon-rarity:' + col + '">' + getSVG(gt) + '</div><div><div class="slot-label">' + gt + '</div><div class="slot-name" style="color:' + col + '">' + esc(r.display_name) + '</div></div>';

            var gPartPaths = [];
            if (r.resolved_parts) {
                for (var pi = 0; pi < r.resolved_parts.length; pi++) {
                    if (r.resolved_parts[pi].path) gPartPaths.push(r.resolved_parts[pi].path);
                }
            }
            var equipEntry = {
                category: gt,
                rarityName: rarName,
                elementName: elemName,
                charClass: c.class_name,
                manufacturer: r.manufacturer_name || null,
                partPaths: gPartPaths,
                label: r.display_name || gt,
                item: item
            };
            allEquipped.push(equipEntry);
            var eqIdx = allEquipped.length - 1;

            slot.addEventListener("click", (function(entry, idx, el) {
                return function(e) {
                    document.querySelectorAll(".equip-slot.viewing").forEach(function(s) { s.classList.remove("viewing"); });
                    el.classList.add("viewing");
                    if (typeof showEquipmentInViewer === "function") {
                        _equipCarouselIdx = idx;
                        showEquipmentInViewer(entry.category, entry.rarityName, entry.elementName, entry.charClass, entry.manufacturer, entry.partPaths);
                        _updateViewportOverlay(entry);
                    }
                };
            })(equipEntry, eqIdx, slot));
            slot.addEventListener("dblclick", (function(it) {
                return function(e) { e.stopPropagation(); showPreview(it); };
            })(item));
        } else {
            slot.innerHTML = '<div class="slot-icon" style="color:var(--text-muted)">' + getSVG(gt) + '</div><div><div class="slot-label">' + gt + '</div><div class="slot-name" style="color:var(--text-muted)">Empty</div></div>';
        }
        gs.appendChild(slot);
    }

    // Apply accent lighting from highest-rarity equipped item
    if (typeof applyEquippedAccentLight === "function") {
        applyEquippedAccentLight(allEquipped);
    }

    // Update customize button summary
    var custSummary = document.getElementById("customize-summary");
    if (custSummary) {
        var headName = c.head_asset ? c.head_asset.split(".").pop().replace(/_/g, " ") : "Default";
        custSummary.textContent = headName;
    }
}

// ─── Weapon Preview + Editor ────────────────────────────────

function showPreview(item) {
    const r = item.resolved;
    if (!r) return;
    const preview = document.getElementById("weapon-preview");
    const content = document.getElementById("preview-content");
    const col = (r.rarity && r.rarity.color) || "#888";
    const cat = r.category || "Item";

    // Build the stat card
    var statCardHtml = renderBL2StatCard(r);

    // Build parts section (for all items that have parts)
    let partsHtml = "";
    if (r.resolved_parts) {
        partsHtml = r.resolved_parts.filter(p => p.slot !== "Prefix" && p.slot !== "Title").map(p => {
            const eff = p.effect ? '<span class="part-effect">' + esc(p.effect) + '</span>' : "";
            return '<div class="preview-part"><span class="part-slot">' + p.slot + '</span><span><span class="part-name">' + esc(p.name) + '</span>' + eff + '</span></div>';
        }).join("");
    }

    // Full stat bars section (for weapons with estimated stats)
    var fullStatBarsHtml = "";
    if (isWeaponCategory(cat) && r.estimated_stats) {
        fullStatBarsHtml = renderStatBars(r.estimated_stats, r.category, false);
        fullStatBarsHtml += '<div class="stat-note">Stats are estimated from parts + level. Change parts to modify stats.</div>';
    }

    // Determine the parts label
    var partsTitle = "PARTS";
    if (isWeaponCategory(cat)) partsTitle = "WEAPON PARTS";
    else if (cat === "Shield") partsTitle = "SHIELD PARTS";
    else if (cat === "Grenade Mod") partsTitle = "GRENADE PARTS";
    else if (cat === "Class Mod") partsTitle = "CLASS MOD COMPONENTS";
    else if (cat === "Relic") partsTitle = "RELIC COMPONENTS";

    // Edit button for all editable item types
    var actionButtonsHtml = '<div style="margin-top:14px;display:flex;gap:8px">';
    if (isWeaponCategory(cat)) {
        actionButtonsHtml += '<button class="btn-primary" id="btn-edit-weapon">EDIT WEAPON</button>';
    } else if (["Shield", "Grenade Mod", "Class Mod", "Relic"].indexOf(cat) !== -1) {
        actionButtonsHtml += '<button class="btn-primary" id="btn-edit-weapon">EDIT ' + cat.toUpperCase() + '</button>';
    }
    actionButtonsHtml += '<button class="btn-accent" id="btn-export-preview">EXPORT CODE</button>';
    actionButtonsHtml += '</div>';

    content.innerHTML = `
        <div class="preview-layout">
            <div class="preview-3d-viewport" id="preview-3d-viewport" style="border-color:${col}40"></div>
            <div class="preview-info">
                ${statCardHtml}
                ${fullStatBarsHtml}
                <div class="preview-parts-title">${partsTitle}</div>
                <div class="preview-parts-grid">${partsHtml}</div>
                ${actionButtonsHtml}
            </div>
        </div>`;

    // Initialize 3D preview with rarity-tinted material
    if (typeof initPreviewViewer === "function") {
        var rarName = (r.rarity && r.rarity.name) || "Common";
        var elemName = (r.element && r.element.name) || null;
        setTimeout(function() {
            initPreviewViewer("preview-3d-viewport");
            if (isWeaponCategory(cat)) {
                var mfrName = r.manufacturer_name || null;
                var prevPartPaths = [];
                if (r.resolved_parts) {
                    for (var pi = 0; pi < r.resolved_parts.length; pi++) {
                        if (r.resolved_parts[pi].path) prevPartPaths.push(r.resolved_parts[pi].path);
                    }
                }
                loadWeaponPreview(cat, rarName, elemName, mfrName, prevPartPaths);
            } else {
                var charClass = currentData && currentData.character ? currentData.character.class_name : null;
                loadItemPreview(cat, charClass, rarName);
            }
        }, 50);
    }

    var editBtn = document.getElementById("btn-edit-weapon");
    if (editBtn) {
        editBtn.onclick = () => openWeaponEditor(item);
    }
    document.getElementById("btn-export-preview").onclick = () => exportItem(item.field, item.index);
    preview.classList.remove("hidden");
    preview.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ─── Universal Item/Weapon Editor ──────────────────────────

// Slot configs per item type
const WEAPON_SLOTS = {
    keys: ["body", "grip", "barrel", "sight", "stock", "elemental", "accessory1", "accessory2", "material"],
    labels: {
        body: "Body", grip: "Grip", barrel: "Barrel", sight: "Sight",
        stock: "Stock", elemental: "Element", accessory1: "Accessory",
        accessory2: "Accessory 2", material: "Material"
    },
    partIdxMap: ["Body", "Grip", "Barrel", "Sight", "Stock", "Element", "Accessory1", "Accessory2", "Material"],
    apiKind: "weapon"
};

const ITEM_SLOTS = {
    keys: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "material"],
    apiSlotNames: { alpha: "alpha", beta: "beta", gamma: "gamma", delta: "delta", epsilon: "epsilon", zeta: "zeta", eta: "eta", theta: "theta", material: "material" },
    // Friendly labels per item category
    labelsByCategory: {
        "Shield": { alpha: "Body (Capacity)", beta: "Battery (Recharge)", gamma: "Capacitor (Delay)", delta: "Accessory (Special)", epsilon: "Part 5", zeta: "Part 6", eta: "Part 7", theta: "Part 8", material: "Material" },
        "Grenade Mod": { alpha: "Delivery (Longbow/MIRV)", beta: "Blast Radius", gamma: "Child Count", delta: "Element Accessory", epsilon: "Part 5", zeta: "Part 6", eta: "Part 7", theta: "Part 8", material: "Material" },
        "Class Mod": { alpha: "Specialty", beta: "Primary Stat", gamma: "Secondary Stat", delta: "Tertiary Stat", epsilon: "Part 5", zeta: "Part 6", eta: "Part 7", theta: "Part 8", material: "Material" },
        "Relic": { alpha: "Primary Effect", beta: "Secondary Effect", gamma: "Bonus", delta: "Accessory", epsilon: "Part 5", zeta: "Part 6", eta: "Part 7", theta: "Part 8", material: "Material" },
    },
    partIdxMap: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Material"],
    apiKind: "item"
};

// Map item editor slot names back to backend slot names for the /edit endpoint
const ITEM_TO_BACKEND_SLOT = {
    alpha: "body", beta: "grip", gamma: "barrel", delta: "sight",
    epsilon: "stock", zeta: "elemental", eta: "accessory1", theta: "accessory2",
    material: "material"
};

async function openWeaponEditor(item) {
    const r = item.resolved;
    const cat = r.category || "Item";
    const isWeapon = isWeaponCategory(cat);
    const slotConfig = isWeapon ? WEAPON_SLOTS : ITEM_SLOTS;
    const slotLabels = isWeapon ? slotConfig.labels : (slotConfig.labelsByCategory[cat] || slotConfig.labelsByCategory["Shield"]);

    const modal = document.getElementById("modal-edit");
    const form = document.getElementById("edit-weapon-form");
    var titleEl = document.getElementById("edit-modal-title");
    if (titleEl) titleEl.textContent = "EDIT " + cat.toUpperCase();

    modal.dataset.field = item.field;
    modal.dataset.index = item.index;
    modal.dataset.category = cat;
    modal.dataset.isWeapon = isWeapon ? "1" : "0";

    // Preserve original values exactly (including 0 for quest items)
    const gs = r.level ? r.level[1] : 1;
    const gi = r.level ? r.level[0] : gs;
    const _origGs = gs;
    const _origGi = gi;

    let html = '';

    // ── Stats Overview (weapons only) ──
    if (isWeapon && r.estimated_stats) {
        html += '<div class="editor-section">';
        html += '<div class="editor-section-title section-divider">STATS OVERVIEW</div>';
        html += renderStatBars(r.estimated_stats, r.category, true);
        html += '</div>';
    }

    // ── Level / Power Section ──
    html += '<div class="power-section">';
    html += '<div class="section-divider" style="color:#ff4040">DAMAGE &amp; LEVEL</div>';
    html += '<div class="power-slider-row">';
    html += '<label>LEVEL REQ <span style="color:#7a7e8e;font-size:10px">(game_stage)</span></label>';
    html += '<input type="range" id="ew-gamestage" min="0" max="127" value="' + gs + '" data-orig="' + gs + '">';
    html += '<span class="power-val" id="ew-gamestage-val">' + gs + '</span>';
    html += '</div>';
    html += '<div class="power-slider-row">';
    html += '<label>DAMAGE MULT <span style="color:#7a7e8e;font-size:10px">(grade_index)</span></label>';
    html += '<input type="range" id="ew-gradeindex" min="0" max="127" value="' + gi + '" data-orig="' + gi + '">';
    html += '<span class="power-val" id="ew-gradeindex-val">' + gi + '</span>';
    html += '</div>';

    if (isWeapon) {
        html += '<div id="ew-estimated-damage" class="power-estimate"></div>';
    }
    html += '</div>';

    // ── Parts / Components ──
    var sectionTitle = isWeapon ? "WEAPON PARTS" : cat.toUpperCase() + " COMPONENTS";
    html += '<div class="editor-section">';
    html += '<div class="editor-section-title section-divider">' + sectionTitle + '</div>';

    var slots = slotConfig.keys;
    html += '<div class="add-row">';

    for (var si = 0; si < slots.length; si++) {
        var slot = slots[si];
        var partIdx = si; // direct index mapping
        var currentPart = r.resolved_parts && r.resolved_parts[partIdx];
        var currentPath = currentPart ? currentPart.path || "" : "";
        var label = slotLabels[slot] || slot;

        html += '<label>' + esc(label);
        html += '<select id="ew-' + slot + '" data-slot="' + slot + '" data-current="' + esc(currentPath) + '">';
        html += '<option value="__loading__" selected disabled>Loading...</option>';
        html += '</select></label>';
    }
    html += '</div></div>';

    form.innerHTML = html;
    showModal("modal-edit");

    // ── Wire up controls ──
    var submitBtn = document.getElementById("btn-edit-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "LOADING PARTS (0/" + slots.length + ")...";
    var _loadedCount = 0;

    var gsSlider = document.getElementById("ew-gamestage");
    var giSlider = document.getElementById("ew-gradeindex");
    if (gsSlider) gsSlider.addEventListener("input", function () {
        document.getElementById("ew-gamestage-val").textContent = this.value;
        if (isWeapon) updatePowerEstimate();
    });
    if (giSlider) giSlider.addEventListener("input", function () {
        document.getElementById("ew-gradeindex-val").textContent = this.value;
        if (isWeapon) updatePowerEstimate();
    });
    if (isWeapon) updatePowerEstimate();

    // ── Load compatible parts for balance (weapons only) ──
    var compatParts = {};
    var balancePath = r.balance_path || "";
    if (isWeapon && balancePath) {
        try {
            compatParts = await api("/api/assets/parts?balance=" + encodeURIComponent(balancePath));
        } catch (e) { /* fall back to no compatibility data */ }
    }

    // ── Compatibility warning banner ──
    var compatWarn = document.getElementById("ew-compat-warning");
    if (!compatWarn) {
        compatWarn = document.createElement("div");
        compatWarn.id = "ew-compat-warning";
        compatWarn.className = "compat-warning hidden";
        compatWarn.innerHTML = '<span class="compat-icon">!</span> <span id="ew-compat-msg">Some selected parts are not standard for this weapon.</span>';
        form.parentElement.insertBefore(compatWarn, form);
    }
    compatWarn.classList.add("hidden");

    function updateCompatWarning() {
        if (!isWeapon || !balancePath) return;
        var warns = [];
        for (var ci = 0; ci < slots.length; ci++) {
            var s = document.getElementById("ew-" + slots[ci]);
            if (!s) continue;
            var v = s.value;
            if (!v || v === "__keep__" || v === "__loading__" || v === "none") continue;
            var slotCompat = compatParts[slots[ci]];
            if (!slotCompat) continue;
            var found = false;
            for (var j = 0; j < slotCompat.length; j++) {
                if (slotCompat[j].path === v) { found = true; break; }
            }
            if (!found) {
                var lbl = slotLabels[slots[ci]] || slots[ci];
                warns.push(lbl);
            }
        }
        var msg = document.getElementById("ew-compat-msg");
        if (warns.length > 0) {
            msg.textContent = "Non-standard parts: " + warns.join(", ") + ". May produce glitched items.";
            compatWarn.classList.remove("hidden");
        } else {
            compatWarn.classList.add("hidden");
        }
    }

    // ── Load parts for each slot (parallel) ──
    var apiKind = slotConfig.apiKind;
    function _populateSlot(slot, parts) {
        var sel = document.getElementById("ew-" + slot);
        if (!sel) return;
        var currentPath = sel.dataset.current;
        var slotCompat = compatParts[slot];
        var compatSet = {};
        if (slotCompat) {
            for (var ci = 0; ci < slotCompat.length; ci++) compatSet[slotCompat[ci].path] = true;
        }
        var hasCompat = isWeapon && slotCompat && slotCompat.length > 0;

        sel.innerHTML = '';
        var keepOpt = document.createElement("option");
        keepOpt.value = "__keep__";
        keepOpt.textContent = currentPath ? "(Keep Current)" : "(No Change)";
        sel.appendChild(keepOpt);
        var noneOpt = document.createElement("option");
        noneOpt.value = "none";
        noneOpt.textContent = "None";
        sel.appendChild(noneOpt);

        var compatList = [];
        var incompatList = [];
        var foundCurrent = false;
        for (var pi = 0; pi < parts.length; pi++) {
            var p = parts[pi];
            if (p.path === currentPath) foundCurrent = true;
            if (hasCompat && !compatSet[p.path]) {
                incompatList.push(p);
            } else {
                compatList.push(p);
            }
        }
        for (var pi = 0; pi < compatList.length; pi++) {
            var p = compatList[pi];
            var opt = document.createElement("option");
            opt.value = p.path;
            opt.textContent = p.name;
            opt.style.color = "#000";
            if (p.path === currentPath) opt.selected = true;
            sel.appendChild(opt);
        }
        if (hasCompat && incompatList.length > 0) {
            var sep = document.createElement("option");
            sep.disabled = true;
            sep.textContent = "── Non-standard ──";
            sep.style.color = "#999";
            sel.appendChild(sep);
            for (var pi = 0; pi < incompatList.length; pi++) {
                var p = incompatList[pi];
                var opt = document.createElement("option");
                opt.value = p.path;
                opt.textContent = "\u26A0 " + p.name;
                opt.style.color = "#b08020";
                if (p.path === currentPath) opt.selected = true;
                sel.appendChild(opt);
            }
        }
        if (currentPath && !foundCurrent) {
            var opt = document.createElement("option");
            opt.value = currentPath;
            opt.textContent = currentPath.split(".").pop().replace(/_/g, " ") + " (current)";
            opt.selected = true;
            sel.appendChild(opt);
        }
        sel.addEventListener("change", updateCompatWarning);
    }

    // Single batch API call for all slots instead of N individual calls
    var apiSlots = slots.map(function(slot) {
        return isWeapon ? slot : (slotConfig.apiSlotNames ? slotConfig.apiSlotNames[slot] : slot);
    });
    api("/api/assets/all-parts-batch?kind=" + apiKind + "&slots=" + encodeURIComponent(apiSlots.join(",")))
        .then(function(allParts) {
            for (var si = 0; si < slots.length; si++) {
                var slot = slots[si];
                var apiSlot = apiSlots[si];
                var parts = allParts[apiSlot];
                if (parts && parts.length > 0) {
                    _populateSlot(slot, parts);
                } else {
                    var sel = document.getElementById("ew-" + slot);
                    if (sel) sel.innerHTML = '<option value="__keep__">(Keep Current)</option>';
                }
            }
            submitBtn.disabled = false;
            submitBtn.textContent = "SAVE CHANGES";
            updateCompatWarning();
        })
        .catch(function() {
            // Fallback: leave all slots as "Keep Current"
            submitBtn.disabled = false;
            submitBtn.textContent = "SAVE CHANGES";
        });
}

document.getElementById("btn-edit-submit").addEventListener("click", async () => {
    if (_mutating) return;  // BUG-P51: prevent double-click on edit submit
    _mutating = true;
    const modal = document.getElementById("modal-edit");
    const field = parseInt(modal.dataset.field);
    const index = parseInt(modal.dataset.index);
    const gsEl = document.getElementById("ew-gamestage");
    const giEl = document.getElementById("ew-gradeindex");
    const gameStage = parseInt(gsEl.value);
    const gradeIndex = parseInt(giEl.value);
    const editorIsWeapon = modal.dataset.isWeapon === "1";

    // Collect changed parts — map item slot names back to backend slot names
    const slotKeys = editorIsWeapon
        ? ["body", "grip", "barrel", "sight", "stock", "elemental", "accessory1", "accessory2", "material"]
        : ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "material"];

    const parts = {};
    for (const slot of slotKeys) {
        const sel = document.getElementById("ew-" + slot);
        if (sel) {
            const v = sel.value;
            if (v && v !== "__keep__" && v !== "__loading__") {
                // Map item editor slot names to backend slot names
                var backendSlot = editorIsWeapon ? slot : (ITEM_TO_BACKEND_SLOT[slot] || slot);
                parts[backendSlot] = v;
            }
        }
    }

    // Send each independently — only what changed
    var payload = { parts };
    var origGs = parseInt(gsEl.dataset.orig);
    var origGi = parseInt(giEl.dataset.orig);
    if (gameStage !== origGs) payload.game_stage = gameStage;
    if (gradeIndex !== origGi) payload.grade_index = gradeIndex;

    try {
        await api("/api/save/" + currentFile + "/items/" + field + "/" + index + "/edit", {
            method: "POST",
            body: payload,
        });
        hideModal("modal-edit");
        // Verify the edit by reloading and checking item count
        var before = currentData ? (currentData.inventory.weapons.length + currentData.inventory.items.length) : 0;
        await loadSave(currentFile);
        var after = currentData ? (currentData.inventory.weapons.length + currentData.inventory.items.length) : 0;
        if (before > 0 && after < before) {
            toast("WARNING: Item count dropped from " + before + " to " + after + "! Check server log.");
        } else {
            toast("Item updated! (" + after + " items verified)");
        }
    } catch (e) {
        toast("Error: " + e.message);
    }
    _mutating = false;
});

// ─── Inventory ──────────────────────────────────────────────

function renderInventory(inv) {
    renderItemList("inventory-weapons", inv.weapons || []);
    renderItemList("inventory-items", inv.items || []);
    renderItemList("inventory-bank", inv.bank || []);
}

function renderItemList(containerId, items) {
    const container = document.getElementById(containerId);
    if (!items.length) {
        container.innerHTML = '<div class="empty-msg">No items</div>';
        return;
    }
    container.innerHTML = "";
    for (const item of items) {
        const r = item.resolved || {};
        const lv = r.level ? r.level[1] : "?";
        const name = r.display_name || "Unknown";
        const cat = r.category || "Item";
        const mfr = r.manufacturer_name || "";
        const rarity = r.rarity || { color: "#888", name: "Common" };
        const elem = r.element;

        let elemBadge = "";
        if (elem) elemBadge = '<span class="element-badge" style="background:' + elem.color + '20;color:' + elem.color + ';font-size:10px;padding:1px 6px">' + elem.name + '</span>';

        // Check for red text
        var redTextSnippet = RED_TEXT[name];
        var redTextHtml = "";
        if (redTextSnippet) {
            // Truncate for card display
            var truncated = redTextSnippet.length > 40 ? redTextSnippet.substring(0, 37) + "..." : redTextSnippet;
            redTextHtml = '<div style="color:#e04040;font-style:italic;font-size:10px;margin-top:2px;opacity:0.8">' + esc(truncated) + '</div>';
        }

        const card = document.createElement("div");
        // Rarity class for pulse animations on high-rarity items
        var rarClass = rarity.name ? " rarity-" + rarity.name.toLowerCase().replace(/ /g, "-").replace("very-rare", "very_rare") : "";
        card.className = "item-card" + rarClass;
        card.style.setProperty("--item-rarity", rarity.color);
        card.setAttribute("data-rarity-color", rarity.color);
        card.setAttribute("data-search", (name + " " + mfr + " " + cat + " " + rarity.name + " " + (elem ? elem.name : "")).toLowerCase());
        card.setAttribute("data-rarity-name", rarity.name);

        // Drag-and-drop reordering
        card.draggable = true;
        card.dataset.dragField = item.field;
        card.dataset.dragIndex = item.index;

        // Element class for glow effect on icon
        var elemClass = elem ? " elem-" + elem.name.toLowerCase() : "";

        card.innerHTML = `
            <div class="weapon-icon-wrap${elemClass}" style="color:${rarity.color};--icon-rarity:${rarity.color}">${getSVG(cat)}</div>
            <div class="item-info">
                <div class="item-name" style="color:${rarity.color}">${esc(name)}</div>
                <div class="item-detail">${esc(mfr)} ${esc(cat)}
                    <span class="rarity-badge" style="background:${rarity.color}18;color:${rarity.color}">${rarity.name}</span>
                    ${elemBadge}
                </div>
                ${redTextHtml}
            </div>
            <div class="item-level-badge">LV ${lv}</div>
            <div class="item-actions">
                <button class="btn-sm btn-act" data-a="level">LVL</button>
                <button class="btn-sm btn-act" data-a="dupe">DUP</button>
                <button class="btn-sm btn-act" data-a="export">EXP</button>
                <button class="btn-danger-sm btn-act" data-a="delete">DEL</button>
            </div>`;

        card.addEventListener("click", e => {
            if (e.target.closest(".btn-act")) {
                const a = e.target.dataset.a;
                if (a === "level") showEditLevel(item.field, item.index, lv);
                else if (a === "dupe") duplicateItem(item.field, item.index);
                else if (a === "export") exportItem(item.field, item.index);
                else if (a === "delete") deleteItem(item.field, item.index);
                return;
            }
            document.querySelectorAll(".item-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            showPreview(item);
        });
        card.addEventListener("contextmenu", e => showContextMenu(e, item));
        card.addEventListener("dragstart", function(e) {
            e.dataTransfer.setData("text/plain", JSON.stringify({ field: item.field, index: item.index }));
            this.classList.add("dragging");
        });
        card.addEventListener("dragend", function() { this.classList.remove("dragging"); });
        card.addEventListener("dragover", function(e) {
            e.preventDefault();
            this.classList.add("drag-over");
        });
        card.addEventListener("dragleave", function() { this.classList.remove("drag-over"); });
        card.addEventListener("drop", async function(e) {
            e.preventDefault();
            this.classList.remove("drag-over");
            try {
                var src = JSON.parse(e.dataTransfer.getData("text/plain"));
                var dst = { field: parseInt(this.dataset.dragField), index: parseInt(this.dataset.dragIndex) };
                if (src.field !== dst.field || src.index === dst.index) return;
                if (_mutating) return;  // Bug 21: prevent overlapping mutations
                _mutating = true;
                await api("/api/save/" + currentFile + "/items/" + src.field + "/reorder", {
                    method: "POST", body: { from: src.index, to: dst.index }
                });
                await loadSave(currentFile);
            } catch (err) { /* handled by api() */ }
            _mutating = false;  // Bug 22: must reset outside try — error left flag stuck
        });
        container.appendChild(card);
    }
}

// ─── Main Editor Tabs ────────────────────────────────────────

document.querySelectorAll(".main-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".main-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".main-tab-content").forEach(c => c.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById("mtab-" + tab.dataset.mtab).classList.add("active");
    });
});

// ─── Inventory Sub-Tabs ──────────────────────────────────────

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
        tab.classList.add("active");
        document.getElementById("inventory-" + tab.dataset.tab).classList.remove("hidden");
    });
});

// ─── Inventory Search & Filter ──────────────────────────────

function filterInventory() {
    const query = (document.getElementById("inv-search").value || "").toLowerCase();
    const rarity = document.getElementById("inv-filter-rarity").value;
    document.querySelectorAll(".tab-content .item-card").forEach(card => {
        const text = card.getAttribute("data-search") || "";
        const cardRarity = card.getAttribute("data-rarity-name") || "";
        const matchText = !query || text.includes(query);
        const matchRarity = !rarity || cardRarity === rarity;
        card.classList.toggle("filter-hidden", !(matchText && matchRarity));
    });
}

document.getElementById("inv-search").addEventListener("input", filterInventory);
document.getElementById("inv-filter-rarity").addEventListener("change", filterInventory);

// ─── Keyboard Shortcuts ────────────────────────────────────

document.addEventListener("keydown", e => {
    // Ignore shortcuts when typing in inputs
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") e.target.blur();
        return;
    }

    // Escape: close any open modal
    if (e.key === "Escape") {
        document.querySelectorAll(".modal:not(.hidden)").forEach(m => m.classList.add("hidden"));
        return;
    }

    // Ctrl+S: save active tab (Project Paris Bug 2 — was always saving character)
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        var activeMainTab = document.querySelector(".main-tab.active");
        var tabKey = activeMainTab ? activeMainTab.dataset.mtab : "character";
        var saveBtn = null;
        if (tabKey === "skills") saveBtn = document.getElementById("btn-save-skills");
        else if (tabKey === "fasttravel") saveBtn = document.getElementById("btn-save-ft");
        else saveBtn = document.getElementById("btn-save-char");
        if (saveBtn) saveBtn.click();
        return;
    }

    // Ctrl+F: focus search
    if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        const search = document.getElementById("inv-search");
        if (search) search.focus();
        return;
    }

    // 1-5: switch main editor tabs
    if ("1234567".includes(e.key)) {
        const tabs = document.querySelectorAll(".main-tab");
        const idx = parseInt(e.key) - 1;
        if (tabs[idx]) tabs[idx].click();
        return;
    }
});

// ─── Item Actions ───────────────────────────────────────────

async function deleteItem(field, index) {
    if (_mutating) return;  // Bug 21: prevent overlapping mutations
    if (!confirm("Delete this item?")) return;
    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/items/" + field + "/" + index, { method: "DELETE" });
        toast("Item deleted");
        document.getElementById("weapon-preview").classList.add("hidden");
        await loadSave(currentFile);
    } catch (e) { /* error toast handled by api() */ }
    _mutating = false;
}

async function duplicateItem(field, index) {
    if (_mutating) return;  // Bug 21: prevent overlapping mutations
    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/items/" + field + "/" + index + "/duplicate", { method: "POST" });
        toast("Item duplicated");
        await loadSave(currentFile);
    } catch (e) { /* error toast handled by api() */ }
    _mutating = false;
}

document.getElementById("btn-bulk-level").addEventListener("click", function() {
    if (!currentFile) return;
    var activeTab = document.querySelector(".tab.active");
    var tabName = activeTab ? activeTab.dataset.tab : "weapons";
    var desc = document.getElementById("bulk-level-desc");
    if (desc) desc.textContent = "Set all " + tabName + " to the same level.";
    document.getElementById("bulk-level-input").value = 72;
    showModal("modal-bulk-level");
    document.getElementById("bulk-level-input").focus();
    document.getElementById("bulk-level-input").select();
});

document.getElementById("bulk-level-input").addEventListener("keydown", function(e) {
    if (e.key === "Enter") document.getElementById("btn-bulk-submit").click();
});

document.getElementById("btn-bulk-submit").addEventListener("click", async function() {
    var lv = parseInt(document.getElementById("bulk-level-input").value);
    if (isNaN(lv) || lv < 1 || lv > 127) { toast("Invalid level (1-127)", "error"); return; }
    if (_mutating) return;
    _mutating = true;
    var activeTab = document.querySelector(".tab.active");
    var tabName = activeTab ? activeTab.dataset.tab : "weapons";
    var fieldMap = { weapons: 54, items: 53, bank: 41 };
    var field = fieldMap[tabName] || 54;
    hideModal("modal-bulk-level");
    showLoading(true);
    try {
        var res = await api("/api/save/" + currentFile + "/items/" + field + "/bulk-level", {
            method: "POST", body: { level: lv }
        });
        toast(res.count + " " + tabName + " set to level " + lv);
        await loadSave(currentFile);
    } catch (e) { /* error toast handled by api() */ }
    showLoading(false);
    _mutating = false;
});

// ─── Loadout Save / Restore ────────────────────────────────

document.getElementById("btn-save-loadout").addEventListener("click", function() {
    if (!currentFile) return;
    document.getElementById("loadout-name-input").value = "";
    showModal("modal-save-loadout");
    document.getElementById("loadout-name-input").focus();
});

document.getElementById("loadout-name-input").addEventListener("keydown", function(e) {
    if (e.key === "Enter") document.getElementById("btn-save-loadout-submit").click();
});

document.getElementById("btn-save-loadout-submit").addEventListener("click", async function() {
    var name = document.getElementById("loadout-name-input").value.trim();
    if (!name) { toast("Enter a loadout name", "error"); return; }
    if (_mutating) return;
    _mutating = true;
    hideModal("modal-save-loadout");
    showLoading(true);
    try {
        var res = await api("/api/loadouts/save", {
            method: "POST", body: { filename: currentFile, name: name }
        });
        toast("Loadout saved: " + res.weapons + " weapons, " + res.items + " items");
    } catch (e) { /* handled by api() */ }
    showLoading(false);
    _mutating = false;
});

document.getElementById("btn-load-loadout").addEventListener("click", async function() {
    if (!currentFile) return;
    showModal("modal-load-loadout");
    var list = document.getElementById("loadout-list");
    list.innerHTML = '<div style="color:var(--text-dim);font-size:12px">Loading...</div>';
    try {
        var loadouts = await api("/api/loadouts");
        if (!loadouts.length) {
            list.innerHTML = '<div style="color:var(--text-dim);font-size:12px">No saved loadouts. Use SAVE LOADOUT to create one.</div>';
            return;
        }
        list.innerHTML = "";
        for (var i = 0; i < loadouts.length; i++) {
            var lo = loadouts[i];
            var row = document.createElement("div");
            row.className = "loadout-row";
            row.innerHTML = '<div class="loadout-info">' +
                '<span class="loadout-name">' + esc(lo.name) + '</span>' +
                '<span class="loadout-meta">' + esc(lo.character) + ' Lv' + lo.level + ' | ' + lo.weapons + 'W ' + lo.items + 'I</span>' +
                '</div>' +
                '<div class="loadout-actions">' +
                '<button class="btn-sm btn-primary loadout-restore" data-file="' + esc(lo.file) + '">LOAD</button>' +
                '<button class="btn-sm btn-danger-sm loadout-delete" data-file="' + esc(lo.file) + '">DEL</button>' +
                '</div>';
            list.appendChild(row);
        }
        list.querySelectorAll(".loadout-restore").forEach(function(btn) {
            btn.addEventListener("click", async function() {
                if (_mutating) return;
                var file = this.dataset.file;
                var replace = document.getElementById("loadout-replace-check").checked;
                if (replace && !confirm("This will clear your current weapons and items before loading the loadout. Continue?")) return;
                _mutating = true;
                hideModal("modal-load-loadout");
                showLoading(true);
                try {
                    var res = await api("/api/loadouts/" + encodeURIComponent(file) + "/restore", {
                        method: "POST", body: { filename: currentFile, replace: replace }
                    });
                    toast("Loadout loaded: " + res.imported + " items imported");
                    await loadSave(currentFile);
                } catch (e) { /* handled by api() */ }
                showLoading(false);
                _mutating = false;
            });
        });
        list.querySelectorAll(".loadout-delete").forEach(function(btn) {
            btn.addEventListener("click", async function() {
                if (!confirm("Delete this loadout?")) return;
                var file = this.dataset.file;
                try {
                    await api("/api/loadouts/" + encodeURIComponent(file), { method: "DELETE" });
                    this.closest(".loadout-row").remove();
                    toast("Loadout deleted");
                    if (!list.querySelector(".loadout-row")) {
                        list.innerHTML = '<div style="color:var(--text-dim);font-size:12px">No saved loadouts.</div>';
                    }
                } catch (e) { /* handled by api() */ }
            });
        });
    } catch (e) {
        list.innerHTML = '<div style="color:#e04040;font-size:12px">Failed to load loadouts</div>';
    }
});

function showEditLevel(field, index, lv) {
    document.getElementById("edit-level").value = (lv === "?" ? 1 : lv);
    document.getElementById("edit-field").value = field;
    document.getElementById("edit-index").value = index;
    showModal("modal-level");
}

document.getElementById("btn-level-submit").addEventListener("click", async () => {
    if (_mutating) return;  // BUG-P48: prevent double-click
    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/items/" + document.getElementById("edit-field").value + "/" + document.getElementById("edit-index").value + "/level", {
            method: "POST", body: { level: parseInt(document.getElementById("edit-level").value) },
        });
        hideModal("modal-level");
        toast("Level updated!");
        await loadSave(currentFile);
    } catch (e) { toast("Error: " + e.message); }
    _mutating = false;
});

async function exportItem(field, index) {
    try {
        const data = await api("/api/save/" + currentFile + "/export/" + field + "/" + index);
        document.getElementById("export-codes").value = data.code;
        showModal("modal-export");
    } catch (e) { toast("Error: " + e.message); }
}

// ─── Item Comparison ────────────────────────────────────────

let compareSlots = [null, null];

function addToCompare(item) {
    if (!compareSlots[0]) { compareSlots[0] = item; toast("Item 1 selected. Click another to compare."); return; }
    compareSlots[1] = item;
    showComparison();
}

function showComparison() {
    const body = document.getElementById("compare-body");
    body.innerHTML = "";
    for (let i = 0; i < 2; i++) {
        const item = compareSlots[i];
        if (!item) continue;
        const r = item.resolved || {};
        const rarity = r.rarity || { color: "#888", name: "?" };
        const name = r.display_name || "Unknown";
        const stats = r.estimated_stats || {};
        const col = document.createElement("div");
        col.className = "compare-col";
        let statsHtml = "";
        for (const [key, val] of Object.entries(stats)) {
            const num = typeof val === "number" ? val.toFixed(1) : val;
            statsHtml += '<div class="compare-stat"><span class="compare-stat-label">' + esc(key) + '</span><span class="compare-stat-val">' + num + '</span></div>';
        }
        col.innerHTML = `
            <div class="compare-name" style="color:${rarity.color}">${esc(name)}</div>
            <div class="compare-detail">${esc(r.manufacturer_name || "")} ${esc(r.category || "")} &middot; ${rarity.name} &middot; Lv ${r.level ? r.level[1] : "?"}</div>
            <div class="compare-stats">${statsHtml || '<div style="opacity:0.5">No stats available</div>'}</div>`;
        body.appendChild(col);
    }
    showModal("modal-compare");
    compareSlots = [null, null];
}

// ─── Right-Click Context Menu ───────────────────────────────

let ctxMenu = null;

async function transferItem(field, index, toField) {
    if (_mutating) return;
    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/items/" + field + "/" + index + "/transfer", {
            method: "POST", body: { to_field: toField }
        });
        var labels = { 54: "weapons", 53: "backpack", 41: "bank" };
        toast("Moved to " + (labels[toField] || "inventory"));
        await loadSave(currentFile);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
}

function showContextMenu(e, item) {
    e.preventDefault();
    hideContextMenu();
    const lv = item.resolved && item.resolved.level ? item.resolved.level[1] : "?";
    // Build transfer option based on current location
    var transferHtml = "";
    if (item.field === 41) {
        // In bank — offer move to backpack
        transferHtml = '<div class="ctx-item" data-a="to-backpack">Move to Backpack</div>';
    } else if (item.field === 53) {
        // In items backpack — offer move to bank
        transferHtml = '<div class="ctx-item" data-a="to-bank">Move to Bank</div>';
    } else if (item.field === 54) {
        // In weapons — offer move to bank
        transferHtml = '<div class="ctx-item" data-a="to-bank">Move to Bank</div>';
    }
    ctxMenu = document.createElement("div");
    ctxMenu.className = "ctx-menu";
    ctxMenu.innerHTML = `
        <div class="ctx-item" data-a="preview">Preview</div>
        <div class="ctx-item" data-a="level">Set Level</div>
        <div class="ctx-item" data-a="dupe">Duplicate</div>
        <div class="ctx-item" data-a="export">Export Code</div>
        <div class="ctx-item" data-a="compare">Compare</div>
        ${transferHtml}
        <div class="ctx-sep"></div>
        <div class="ctx-item ctx-danger" data-a="delete">Delete</div>`;
    ctxMenu.style.left = e.pageX + "px";
    ctxMenu.style.top = e.pageY + "px";
    document.body.appendChild(ctxMenu);
    ctxMenu.addEventListener("click", ev => {
        const a = ev.target.dataset.a;
        if (!a) return;
        hideContextMenu();
        if (a === "preview") showPreview(item);
        else if (a === "level") showEditLevel(item.field, item.index, lv);
        else if (a === "dupe") duplicateItem(item.field, item.index);
        else if (a === "to-bank") transferItem(item.field, item.index, 41);
        else if (a === "to-backpack") transferItem(item.field, item.index, item.resolved && item.resolved.is_weapon ? 54 : 53);
        else if (a === "export") exportItem(item.field, item.index);
        else if (a === "compare") addToCompare(item);
        else if (a === "delete") deleteItem(item.field, item.index);
    });
}

function hideContextMenu() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
}
document.addEventListener("click", hideContextMenu);
document.addEventListener("contextmenu", e => {
    if (!e.target.closest(".item-card")) hideContextMenu();
});

document.getElementById("btn-export-all").addEventListener("click", async () => {
    try {
        const s = await api("/api/save/" + currentFile + "/export-all");
        let t = "";
        if (s.weapons && s.weapons.length) t += "; Weapons\n" + s.weapons.join("\n") + "\n";
        if (s.items && s.items.length) t += "; Items\n" + s.items.join("\n") + "\n";
        if (s.bank && s.bank.length) t += "; Bank\n" + s.bank.join("\n") + "\n";
        document.getElementById("export-codes").value = t;
        showModal("modal-export");
    } catch (e) { toast("Error: " + e.message); }
});

// ─── Import ─────────────────────────────────────────────────

document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-preview").classList.add("hidden");
    document.getElementById("import-preview").innerHTML = "";
    showModal("modal-import");
});

// Preview: decode codes and show item names before importing
document.getElementById("btn-import-preview").addEventListener("click", async () => {
    const codes = document.getElementById("import-codes").value;
    if (!codes.trim()) return;
    const preview = document.getElementById("import-preview");
    preview.innerHTML = '<div style="opacity:0.5">Loading preview...</div>';
    preview.classList.remove("hidden");
    try {
        const items = await api("/api/preview-codes", { method: "POST", body: { codes } });
        if (!items.length) { preview.innerHTML = '<div style="color:#ff4444">No valid codes found</div>'; return; }
        let html = '<div class="preview-header">' + items.filter(i => !i.error).length + ' valid, ' + items.filter(i => i.error).length + ' invalid</div>';
        for (const item of items) {
            if (item.error) {
                html += '<div class="preview-item preview-error">Line ' + item.line + ': ' + esc(item.error) + '</div>';
            } else {
                const r = item.resolved || {};
                const color = r.rarity ? r.rarity.color : "#888";
                const name = r.display_name || "Unknown";
                const lv = r.level ? r.level[1] : "?";
                html += '<div class="preview-item"><span style="color:' + color + '">' + esc(name) + '</span> <span style="opacity:0.5">Lv' + lv + '</span></div>';
            }
        }
        preview.innerHTML = html;
    } catch (e) { preview.innerHTML = '<div style="color:#ff4444">Preview failed</div>'; }
});

document.getElementById("btn-import-submit").addEventListener("click", async () => {
    const codes = document.getElementById("import-codes").value;
    if (!codes.trim()) return;
    try {
        const r = await api("/api/save/" + currentFile + "/import", { method: "POST", body: { codes } });
        hideModal("modal-import");
        document.getElementById("import-codes").value = "";
        document.getElementById("import-preview").classList.add("hidden");
        let msg = "Imported " + r.imported + " item(s)";
        if (r.errors && r.errors.length > 0) {
            msg += " (" + r.errors.length + " skipped)";
            console.warn("Import errors:", r.errors);
        }
        toast(msg);
        await loadSave(currentFile);
    } catch (e) { /* error toast handled by api() */ }
});

// ─── Add Weapon ─────────────────────────────────────────────

let weaponTypes = null;

// Extract manufacturer from weapon type path
function extractMfrFromPath(path) {
    var short = path.split(".").pop() || "";
    var mfrs = ["Bandit","Dahl","Hyperion","Jakobs","Maliwan","Tediore","Torgue","Vladof"];
    for (var i = 0; i < mfrs.length; i++) {
        if (short.toLowerCase().indexOf(mfrs[i].toLowerCase()) !== -1) return mfrs[i];
    }
    return "";
}

document.getElementById("btn-add-weapon").addEventListener("click", async () => {
    showModal("modal-add");
    const cat = document.getElementById("add-category");
    if (!weaponTypes) weaponTypes = await api("/api/assets/weapon-types");
    cat.innerHTML = '<option value="">-- Select Weapon Type --</option>';
    const grouped = {};
    for (const [p, info] of Object.entries(weaponTypes)) {
        const t = info.display_type || info.type || "Other";
        (grouped[t] = grouped[t] || []).push({ path: p, ...info });
    }
    for (const [type, items] of Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]))) {
        const og = document.createElement("optgroup");
        og.label = type;
        for (const it of items.sort((a, b) => {
            // Sort by manufacturer name for clarity
            var mfrA = extractMfrFromPath(a.path);
            var mfrB = extractMfrFromPath(b.path);
            return mfrA.localeCompare(mfrB) || a.name.localeCompare(b.name);
        })) {
            const opt = document.createElement("option");
            opt.value = it.path;
            var mfr = extractMfrFromPath(it.path);
            var label = mfr ? mfr + " " + type : (it.name || type);
            opt.textContent = label + " (" + it.balance_count + " variants)";
            og.appendChild(opt);
        }
        cat.appendChild(og);
    }
});

document.getElementById("add-category").addEventListener("change", async () => {
    const catPath = document.getElementById("add-category").value;
    const bal = document.getElementById("add-balance");
    bal.disabled = true;
    document.getElementById("add-parts-section").classList.add("hidden");
    document.getElementById("btn-add-submit").disabled = true;
    if (!catPath) { bal.innerHTML = '<option value="">-- Select category --</option>'; return; }
    bal.innerHTML = '<option value="">Loading...</option>';
    try {
        const bals = await api("/api/assets/balances?type=" + encodeURIComponent(catPath));
        bal.innerHTML = '<option value="">-- Select --</option>';
        for (const b of bals) {
            const opt = document.createElement("option");
            opt.value = b.path;
            opt.textContent = b.name + " [" + b.rarity.name + "]";
            bal.appendChild(opt);
        }
        bal.disabled = false;
    } catch (e) { bal.innerHTML = '<option>Error</option>'; }
});

document.getElementById("add-balance").addEventListener("change", async () => {
    const bp = document.getElementById("add-balance").value;
    const ps = document.getElementById("add-parts-section");
    const pg = document.getElementById("add-parts-grid");
    document.getElementById("btn-add-submit").disabled = !bp;
    if (!bp) { ps.classList.add("hidden"); return; }
    try {
        const parts = await api("/api/assets/parts?balance=" + encodeURIComponent(bp));
        pg.innerHTML = "";
        for (const slot of ["body", "grip", "barrel", "sight", "stock", "elemental", "accessory1", "accessory2", "material"]) {
            const opts = parts[slot] || [];
            if (!opts.length) continue;
            const label = document.createElement("label");
            label.textContent = slot.charAt(0).toUpperCase() + slot.slice(1);
            const sel = document.createElement("select");
            sel.id = "add-part-" + slot;
            sel.innerHTML = '<option value="">None</option>';
            for (const p of opts) { const o = document.createElement("option"); o.value = p.path; o.textContent = p.name; sel.appendChild(o); }
            if (opts.length > 0) sel.value = opts[0].path;
            label.appendChild(sel);
            pg.appendChild(label);
        }
        ps.classList.toggle("hidden", pg.children.length === 0);
    } catch (e) { console.error(e); }
});

document.getElementById("btn-add-submit").addEventListener("click", async () => {
    if (_mutating) return;  // BUG-P49: prevent double-click adding duplicate weapons
    _mutating = true;
    const parts = {};
    for (const s of ["body", "grip", "barrel", "sight", "stock", "elemental", "accessory1", "accessory2", "material", "prefix", "title"]) {
        const sel = document.getElementById("add-part-" + s);
        if (sel && sel.value) parts[s] = sel.value;
    }
    try {
        await api("/api/save/" + currentFile + "/items/add", {
            method: "POST",
            body: { balance: document.getElementById("add-balance").value, level: parseInt(document.getElementById("add-level").value) || 1, parts },
        });
        hideModal("modal-add");
        toast("Weapon added!");
        await loadSave(currentFile);
    } catch (e) { toast("Error: " + e.message); }
    _mutating = false;
});

// ─── Add Item (non-weapon) ──────────────────────────────────

var _itemCategories = null;

document.getElementById("btn-add-item").addEventListener("click", async () => {
    showModal("modal-add-item");
    var cat = document.getElementById("add-item-category");
    if (!_itemCategories) _itemCategories = await api("/api/assets/item-categories");
    cat.innerHTML = '<option value="">-- Select Item Type --</option>';
    for (var c of _itemCategories) {
        var opt = document.createElement("option");
        opt.value = c.key;
        opt.textContent = c.name + " (" + c.count + ")";
        cat.appendChild(opt);
    }
});

document.getElementById("add-item-category").addEventListener("change", async () => {
    var catKey = document.getElementById("add-item-category").value;
    var bal = document.getElementById("add-item-balance");
    bal.disabled = true;
    document.getElementById("add-item-parts-section").classList.add("hidden");
    document.getElementById("btn-add-item-submit").disabled = true;
    if (!catKey) { bal.innerHTML = '<option value="">-- Select category --</option>'; return; }
    bal.innerHTML = '<option value="">Loading...</option>';
    try {
        var bals = await api("/api/assets/item-balances?category=" + encodeURIComponent(catKey));
        bal.innerHTML = '<option value="">-- Select --</option>';
        for (var b of bals) {
            var opt = document.createElement("option");
            opt.value = b.path;
            opt.textContent = b.name + " [" + b.rarity.name + "]";
            bal.appendChild(opt);
        }
        bal.disabled = false;
    } catch (e) { bal.innerHTML = '<option>Error loading items</option>'; }
});

document.getElementById("add-item-balance").addEventListener("change", async () => {
    var bp = document.getElementById("add-item-balance").value;
    var ps = document.getElementById("add-item-parts-section");
    var pg = document.getElementById("add-item-parts-grid");
    document.getElementById("btn-add-item-submit").disabled = !bp;
    if (!bp) { ps.classList.add("hidden"); return; }
    try {
        var parts = await api("/api/assets/item-parts?balance=" + encodeURIComponent(bp));
        pg.innerHTML = "";
        for (var slot in parts) {
            var opts = parts[slot];
            if (!opts || !opts.length) continue;
            var label = document.createElement("label");
            label.textContent = slot;
            var sel = document.createElement("select");
            sel.id = "add-item-part-" + slot.toLowerCase().replace(/[\s\/]+/g, "-");
            sel.dataset.slot = slot.toLowerCase().replace(/[\s\/]+/g, "-");
            sel.innerHTML = '<option value="">None</option>';
            for (var p of opts) { var o = document.createElement("option"); o.value = p.path; o.textContent = p.name; sel.appendChild(o); }
            if (opts.length > 0) sel.value = opts[0].path;
            label.appendChild(sel);
            pg.appendChild(label);
        }
        ps.classList.toggle("hidden", pg.children.length === 0);
    } catch (e) { console.error(e); }
});

document.getElementById("btn-add-item-submit").addEventListener("click", async () => {
    if (_mutating) return;  // BUG-P50: prevent double-click adding duplicate items
    _mutating = true;
    var parts = {};
    document.querySelectorAll("#add-item-parts-grid select").forEach(function(sel) {
        if (sel.value) {
            // Map display slot names back to alpha/beta/gamma etc.
            var slotMap = {"body": "alpha", "battery-grip": "beta", "battery/grip": "beta",
                           "capacitor-barrel": "gamma", "capacitor/barrel": "gamma",
                           "accessory": "delta", "accessory-2": "epsilon",
                           "slot-6": "zeta", "slot-7": "eta", "slot-8": "theta", "material": "material"};
            var key = sel.dataset.slot || "";
            parts[slotMap[key] || key] = sel.value;
        }
    });
    try {
        await api("/api/save/" + currentFile + "/items/add-item", {
            method: "POST",
            body: { balance: document.getElementById("add-item-balance").value, level: parseInt(document.getElementById("add-item-level").value) || 1, parts: parts },
        });
        hideModal("modal-add-item");
        toast("Item added!");
        await loadSave(currentFile);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

// ─── Modal close handlers ───────────────────────────────────

document.querySelectorAll(".modal-close").forEach(b => b.addEventListener("click", () => b.closest(".modal").classList.add("hidden")));
document.querySelectorAll(".modal-backdrop").forEach(b => b.addEventListener("click", () => b.closest(".modal").classList.add("hidden")));
document.getElementById("btn-close-preview").addEventListener("click", () => {
    document.getElementById("weapon-preview").classList.add("hidden");
    document.querySelectorAll(".item-card").forEach(c => c.classList.remove("selected"));
    if (typeof destroyPreviewViewer === "function") destroyPreviewViewer();
    // Also clear viewport selection state when closing detail preview
    document.querySelectorAll(".equip-slot.viewing").forEach(function(s) { s.classList.remove("viewing"); });
});
document.getElementById("btn-copy-export").addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("export-codes").value);
    toast("Copied!");
});

// ─── Character Customization ───────────────────────────────

var _custHeads = [];
var _custSkins = [];

document.getElementById("btn-open-customize").addEventListener("click", async () => {
    if (!currentData || !currentData.character) return;
    var c = currentData.character;
    showModal("modal-customize");

    // Load head/skin options
    var headSel = document.getElementById("cust-head");
    var skinSel = document.getElementById("cust-skin");
    headSel.innerHTML = '<option value="">Loading...</option>';
    skinSel.innerHTML = '<option value="">Loading...</option>';

    try {
        var data = await api("/api/assets/customizations/" + encodeURIComponent(c.class_name));
        _custHeads = data.heads || [];
        _custSkins = data.skins || [];

        headSel.innerHTML = '';
        for (var i = 0; i < _custHeads.length; i++) {
            var opt = document.createElement("option");
            opt.value = _custHeads[i].path;
            opt.textContent = _custHeads[i].name || _custHeads[i].path.split(".").pop();
            if (_custHeads[i].path === c.head_asset) opt.selected = true;
            headSel.appendChild(opt);
        }
        // Add current if not found
        if (c.head_asset && !_custHeads.find(function(h) { return h.path === c.head_asset; })) {
            var opt = document.createElement("option");
            opt.value = c.head_asset;
            opt.textContent = c.head_asset.split(".").pop() + " (current)";
            opt.selected = true;
            headSel.insertBefore(opt, headSel.firstChild);
        }

        skinSel.innerHTML = '';
        for (var i = 0; i < _custSkins.length; i++) {
            var opt = document.createElement("option");
            opt.value = _custSkins[i].path;
            var skinName = _custSkins[i].name || _custSkins[i].path.split(".").pop();
            // Add color indicator from skin database
            var skinInfo = typeof getSkinColorData === "function" ? getSkinColorData(_custSkins[i].path) : null;
            if (skinInfo && skinInfo.primary && skinInfo.primary !== "#555555") {
                opt.textContent = "\u25CF " + skinName;
                opt.style.color = skinInfo.primary;
            } else {
                opt.textContent = skinName;
            }
            if (_custSkins[i].path === c.skin_asset) opt.selected = true;
            skinSel.appendChild(opt);
        }
        if (c.skin_asset && !_custSkins.find(function(s) { return s.path === c.skin_asset; })) {
            var opt = document.createElement("option");
            opt.value = c.skin_asset;
            opt.textContent = c.skin_asset.split(".").pop() + " (current)";
            opt.selected = true;
            skinSel.insertBefore(opt, skinSel.firstChild);
        }
    } catch (e) {
        headSel.innerHTML = '<option>Error loading</option>';
        skinSel.innerHTML = '<option>Error loading</option>';
    }

    // Load appearance colors into sliders
    var colors = c.appearance_colors || [{r:127,g:127,b:127},{r:127,g:127,b:127},{r:127,g:127,b:127}];
    var groups = [
        document.getElementById("color-primary"),
        document.getElementById("color-secondary"),
        document.getElementById("color-tertiary"),
    ];
    for (var i = 0; i < 3; i++) {
        var col = colors[i] || {r:127, g:127, b:127};
        var grp = groups[i];
        if (!grp) continue;
        grp.querySelector(".color-r").value = col.r;
        grp.querySelector(".color-g").value = col.g;
        grp.querySelector(".color-b").value = col.b;
        grp.querySelector(".color-r").nextElementSibling.textContent = col.r;
        grp.querySelector(".color-g").nextElementSibling.textContent = col.g;
        grp.querySelector(".color-b").nextElementSibling.textContent = col.b;
        _updateColorPreview(i);
    }
});

function _updateColorPreview(idx) {
    var groups = [
        document.getElementById("color-primary"),
        document.getElementById("color-secondary"),
        document.getElementById("color-tertiary"),
    ];
    var grp = groups[idx];
    if (!grp) return;
    var r = parseInt(grp.querySelector(".color-r").value);
    var g = parseInt(grp.querySelector(".color-g").value);
    var b = parseInt(grp.querySelector(".color-b").value);
    var preview = document.getElementById("color-preview-" + idx);
    if (preview) preview.style.background = "rgb(" + r + "," + g + "," + b + ")";

    // Live 3D tinting: apply to character model
    if (idx === 0 && typeof charViewer !== "undefined" && charViewer && charViewer.currentModel) {
        if (typeof applyCharacterTint === "function") {
            applyCharacterTint(charViewer.currentModel, r, g, b);
        }
        charViewer.rimLight.color.setRGB(r / 255, g / 255, b / 255);
        charViewer.rimLight.intensity = 0.6;
    }
}

// ─── Live Head/Skin Viewport Updates ─────────────────────

// Skin name → approximate tint color for live preview
var SKIN_COLOR_HINTS = {
    "Orange": [255, 140, 30], "Red": [220, 40, 40], "Blue": [50, 100, 220],
    "Green": [40, 180, 60], "White": [220, 220, 220], "Black": [30, 30, 35],
    "Purple": [150, 50, 200], "Yellow": [240, 220, 40], "Pink": [255, 100, 160],
    "Cyan": [40, 200, 220], "Teal": [30, 180, 170], "Brown": [130, 80, 40],
    "Gold": [252, 177, 0], "Silver": [180, 185, 195], "Gray": [120, 120, 130],
    "Crimson": [180, 20, 40], "Olive": [128, 128, 0], "Navy": [20, 40, 120],
    "Lime": [100, 255, 50], "Maroon": [128, 0, 0],
};

function _getSkinTintFromName(skinPath) {
    if (!skinPath) return null;
    var name = skinPath.split(".").pop() || "";
    for (var key in SKIN_COLOR_HINTS) {
        if (name.indexOf(key) !== -1) return SKIN_COLOR_HINTS[key];
    }
    return null;
}

document.getElementById("cust-skin").addEventListener("change", function() {
    var skinPath = this.value;
    if (!skinPath || typeof charViewer === "undefined" || !charViewer || !charViewer.currentModel) return;

    // Try exact skin colors from extracted game data first
    if (typeof applySkinFromAsset === "function" && applySkinFromAsset(charViewer.currentModel, skinPath)) {
        // Success — update color sliders to show primary zone color
        var skinData = typeof getSkinColorData === "function" ? getSkinColorData(skinPath) : null;
        if (skinData && skinData.primary) {
            var hex = skinData.primary;
            var r = parseInt(hex.slice(1,3), 16);
            var g = parseInt(hex.slice(3,5), 16);
            var b = parseInt(hex.slice(5,7), 16);
            var grp = document.getElementById("color-primary");
            if (grp) {
                grp.querySelector(".color-r").value = r;
                grp.querySelector(".color-g").value = g;
                grp.querySelector(".color-b").value = b;
                grp.querySelector(".color-r").nextElementSibling.textContent = r;
                grp.querySelector(".color-g").nextElementSibling.textContent = g;
                grp.querySelector(".color-b").nextElementSibling.textContent = b;
                _updateColorPreview(0);
            }
            // Update secondary/tertiary sliders too
            if (skinData.secondary) {
                var secGrp = document.getElementById("color-secondary");
                if (secGrp) {
                    var sh = skinData.secondary;
                    secGrp.querySelector(".color-r").value = parseInt(sh.slice(1,3),16);
                    secGrp.querySelector(".color-g").value = parseInt(sh.slice(3,5),16);
                    secGrp.querySelector(".color-b").value = parseInt(sh.slice(5,7),16);
                    secGrp.querySelector(".color-r").nextElementSibling.textContent = parseInt(sh.slice(1,3),16);
                    secGrp.querySelector(".color-g").nextElementSibling.textContent = parseInt(sh.slice(3,5),16);
                    secGrp.querySelector(".color-b").nextElementSibling.textContent = parseInt(sh.slice(5,7),16);
                    _updateColorPreview(1);
                }
            }
            if (skinData.tertiary) {
                var terGrp = document.getElementById("color-tertiary");
                if (terGrp) {
                    var th = skinData.tertiary;
                    terGrp.querySelector(".color-r").value = parseInt(th.slice(1,3),16);
                    terGrp.querySelector(".color-g").value = parseInt(th.slice(3,5),16);
                    terGrp.querySelector(".color-b").value = parseInt(th.slice(5,7),16);
                    terGrp.querySelector(".color-r").nextElementSibling.textContent = parseInt(th.slice(1,3),16);
                    terGrp.querySelector(".color-g").nextElementSibling.textContent = parseInt(th.slice(3,5),16);
                    terGrp.querySelector(".color-b").nextElementSibling.textContent = parseInt(th.slice(5,7),16);
                    _updateColorPreview(2);
                }
            }
        }
        return;
    }

    // Fallback to name-based color hints
    var tint = _getSkinTintFromName(skinPath);
    if (tint && typeof applyCharacterTint === "function") {
        applyCharacterTint(charViewer.currentModel, tint[0], tint[1], tint[2]);
        var grp = document.getElementById("color-primary");
        if (grp) {
            grp.querySelector(".color-r").value = tint[0];
            grp.querySelector(".color-g").value = tint[1];
            grp.querySelector(".color-b").value = tint[2];
            grp.querySelector(".color-r").nextElementSibling.textContent = tint[0];
            grp.querySelector(".color-g").nextElementSibling.textContent = tint[1];
            grp.querySelector(".color-b").nextElementSibling.textContent = tint[2];
            _updateColorPreview(0);
        }
    }
});

document.getElementById("cust-head").addEventListener("change", function() {
    var headAssetPath = this.value;
    // Try fast head swap first (just replaces head mesh)
    if (headAssetPath && typeof swapHeadModel === "function") {
        swapHeadModel(headAssetPath);
    } else if (_currentCharName && typeof loadCharacterModel === "function") {
        // Fallback: reload entire character with new head
        var grp = document.getElementById("color-primary");
        var colors = null;
        if (grp) {
            colors = [{
                r: parseInt(grp.querySelector(".color-r").value),
                g: parseInt(grp.querySelector(".color-g").value),
                b: parseInt(grp.querySelector(".color-b").value)
            }];
        } else {
            colors = currentData && currentData.character ? currentData.character.appearance_colors : null;
        }
        loadCharacterModel(_currentCharName, colors, headAssetPath);
    }
});

// Wire up color slider live updates
document.querySelectorAll(".color-sliders input[type='range']").forEach(function(slider) {
    slider.addEventListener("input", function() {
        this.nextElementSibling.textContent = this.value;
        // Find which color group this belongs to
        var parent = this.closest(".color-sliders");
        if (parent.id === "color-primary") _updateColorPreview(0);
        else if (parent.id === "color-secondary") _updateColorPreview(1);
        else if (parent.id === "color-tertiary") _updateColorPreview(2);
    });
});

document.getElementById("btn-cust-submit").addEventListener("click", async () => {
    if (!currentFile || !currentData) return;
    var headPath = document.getElementById("cust-head").value;
    var skinPath = document.getElementById("cust-skin").value;

    var colors = [];
    var groups = [
        document.getElementById("color-primary"),
        document.getElementById("color-secondary"),
        document.getElementById("color-tertiary"),
    ];
    for (var i = 0; i < 3; i++) {
        var grp = groups[i];
        colors.push({
            a: 255,
            r: parseInt(grp.querySelector(".color-r").value),
            g: parseInt(grp.querySelector(".color-g").value),
            b: parseInt(grp.querySelector(".color-b").value),
        });
    }

    try {
        var body = { appearance_colors: colors };
        if (headPath) body.head_asset = headPath;
        if (skinPath) body.skin_asset = skinPath;
        var r = await api("/api/save/" + currentFile + "/character", {
            method: "POST", body: body
        });
        hideModal("modal-customize");
        toast("Customization applied!");
        await loadSave(currentFile);
    } catch (e) { toast("Error: " + e.message); }
});

// ─── Missions Tab ───────────────────────────────────────────

var _missionDb = null;
var _currentMissionPt = 0;

async function loadMissionDb() {
    if (_missionDb) return _missionDb;
    _missionDb = await api("/api/missions/db");
    return _missionDb;
}

async function _reloadMissionsTab(pt) {
    await loadSave(currentFile);
    document.querySelector('.main-tab[data-mtab="missions"]').click();
    document.getElementById("mission-playthrough").value = pt;
    document.getElementById("mission-playthrough").dispatchEvent(new Event("change"));
}

function renderMissions(data) {
    var banner = document.getElementById("mission-active");
    var list = document.getElementById("mission-list");
    var select = document.getElementById("mission-playthrough");
    var ptStatus = document.getElementById("playthrough-status");
    if (!data || !data.playthroughs || data.playthroughs.length === 0) {
        banner.innerHTML = "";
        list.innerHTML = '<div style="color:var(--text-dim);padding:20px">No mission data found</div>';
        return;
    }

    select.value = data.active_playthrough;
    _currentMissionPt = data.active_playthrough;

    // Show playthrough unlock status
    var ptCompleted = currentData && currentData.character ? currentData.character.playthroughs_completed : 0;
    var labels = [];
    if (ptCompleted >= 1) labels.push("TVHM unlocked");
    if (ptCompleted >= 2) labels.push("UVHM unlocked");
    ptStatus.textContent = labels.length ? labels.join(", ") : "Only Normal mode unlocked";

    function renderPlaythrough(ptIdx) {
        _currentMissionPt = ptIdx;
        var pt = data.playthroughs[ptIdx];
        if (!pt) {
            banner.innerHTML = "";
            list.innerHTML = '<div style="color:var(--text-dim);padding:20px">No data for this playthrough</div>';
            return;
        }
        if (pt.active_mission) {
            banner.innerHTML = "Active: <strong>" + esc(pt.active_mission_display) + "</strong>";
        } else {
            banner.innerHTML = "";
        }
        if (pt.missions.length === 0) {
            list.innerHTML = '<div style="color:var(--text-dim);padding:20px">No missions in this playthrough</div>';
            return;
        }
        var html = "";
        for (var i = 0; i < pt.missions.length; i++) {
            var m = pt.missions[i];
            var isActive = m.name === pt.active_mission;
            var statusClass = m.status === 4 ? "status-4" : m.status === 1 ? "status-1" : "status-other";
            html += '<div class="mission-row' + (isActive ? ' is-active' : '') + '">';
            html += '<span class="mission-level">Lv ' + m.level + '</span>';
            html += '<span class="mission-name">' + esc(m.display_name) + '</span>';
            if (m.is_dlc) html += '<span class="mission-dlc-tag">DLC</span>';
            // Set Active button (only for non-active missions with status=1)
            if (!isActive && m.status === 1) {
                html += '<button class="btn-mission-track" data-pt="' + ptIdx +
                    '" data-mission="' + esc(m.name) + '" title="Track this mission">TRACK</button>';
            }
            var toggleStatus = m.status === 4 ? 1 : 4;
            html += '<span class="mission-badge ' + statusClass + '" data-pt="' + ptIdx +
                '" data-mission="' + esc(m.name) + '" data-toggle="' + toggleStatus + '">' +
                esc(m.status_text) + '</span>';
            html += '<button class="btn-mission-remove" data-pt="' + ptIdx +
                '" data-mission="' + esc(m.name) + '" data-display="' + esc(m.display_name) +
                '" title="Remove mission">\u00d7</button>';
            html += '</div>';
        }
        list.innerHTML = html;

        // Status toggle
        list.querySelectorAll(".mission-badge").forEach(function(badge) {
            badge.addEventListener("click", async function() {
                var pt = parseInt(this.dataset.pt);
                var mission = this.dataset.mission;
                var status = parseInt(this.dataset.toggle);
                try {
                    await api("/api/save/" + currentFile + "/missions/" + pt + "/" + mission, {
                        method: "POST", body: { status: status }
                    });
                    await _reloadMissionsTab(pt);
                } catch (e) { toast("Error: " + e.message, "error"); }
            });
        });

        // Track button
        list.querySelectorAll(".btn-mission-track").forEach(function(btn) {
            btn.addEventListener("click", async function() {
                var pt = parseInt(this.dataset.pt);
                var mission = this.dataset.mission;
                try {
                    await api("/api/save/" + currentFile + "/missions/" + pt + "/set-active", {
                        method: "POST", body: { mission: mission }
                    });
                    toast("Now tracking: " + mission.split(".").pop());
                    await _reloadMissionsTab(pt);
                } catch (e) { toast("Error: " + e.message, "error"); }
            });
        });

        // Remove button
        list.querySelectorAll(".btn-mission-remove").forEach(function(btn) {
            btn.addEventListener("click", async function() {
                var pt = parseInt(this.dataset.pt);
                var mission = this.dataset.mission;
                var display = this.dataset.display;
                if (!confirm('Remove mission "' + display + '"?')) return;
                try {
                    await api("/api/save/" + currentFile + "/missions/" + pt + "/remove", {
                        method: "POST", body: { mission: mission }
                    });
                    toast("Removed: " + display);
                    await _reloadMissionsTab(pt);
                } catch (e) { toast("Error: " + e.message, "error"); }
            });
        });
    }

    renderPlaythrough(data.active_playthrough);

    select.onchange = function() {
        renderPlaythrough(parseInt(this.value));
    };
}

document.getElementById("btn-complete-all-missions").addEventListener("click", async function() {
    if (!currentFile) return;
    if (_mutating) return;
    var pt = _currentMissionPt;
    if (!confirm("Mark all missions in this playthrough as complete?")) return;
    _mutating = true;
    try {
        var res = await api("/api/save/" + currentFile + "/missions/" + pt + "/complete-all", {
            method: "POST"
        });
        toast("Completed " + res.count + " missions");
        await _reloadMissionsTab(pt);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

document.getElementById("btn-add-all-story").addEventListener("click", async function() {
    if (!currentFile) return;
    if (_mutating) return;
    var pt = _currentMissionPt;
    if (!confirm("Add all story missions (as Active) to this playthrough?")) return;
    _mutating = true;
    try {
        var res = await api("/api/save/" + currentFile + "/missions/" + pt + "/add-all-story", {
            method: "POST", body: { status: 1 }
        });
        toast("Added " + res.count + " story missions");
        await _reloadMissionsTab(pt);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

document.getElementById("btn-unlock-tvhm").addEventListener("click", async function() {
    if (!currentFile || _mutating) return;
    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/playthrough", {
            method: "POST", body: { action: "unlock_tvhm" }
        });
        toast("TVHM unlocked");
        await _reloadMissionsTab(_currentMissionPt);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

document.getElementById("btn-unlock-uvhm").addEventListener("click", async function() {
    if (!currentFile || _mutating) return;
    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/playthrough", {
            method: "POST", body: { action: "unlock_uvhm" }
        });
        toast("UVHM unlocked");
        await _reloadMissionsTab(_currentMissionPt);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

// Add Mission modal
document.getElementById("btn-add-mission").addEventListener("click", async function() {
    var db = await loadMissionDb();
    var storyGroup = document.getElementById("add-mission-story");
    var sideGroup = document.getElementById("add-mission-side");
    storyGroup.innerHTML = "";
    sideGroup.innerHTML = "";
    db.forEach(function(m) {
        var opt = document.createElement("option");
        opt.value = m.path;
        opt.textContent = m.name;
        if (m.is_story) storyGroup.appendChild(opt);
        else sideGroup.appendChild(opt);
    });
    document.getElementById("add-mission-custom").value = "";
    var charLevel = currentData && currentData.character ? currentData.character.level : 1;
    document.getElementById("add-mission-level").value = charLevel;
    showModal("modal-add-mission");
});

document.getElementById("btn-add-mission-submit").addEventListener("click", async function() {
    if (!currentFile || _mutating) return;
    var custom = document.getElementById("add-mission-custom").value.trim();
    var mission = custom || document.getElementById("add-mission-select").value;
    var status = parseInt(document.getElementById("add-mission-status").value);
    var level = parseInt(document.getElementById("add-mission-level").value) || 1;
    if (!mission) { toast("Select a mission", "error"); return; }
    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/missions/" + _currentMissionPt + "/add", {
            method: "POST", body: { mission: mission, status: status, level: level }
        });
        hideModal("modal-add-mission");
        toast("Mission added");
        await _reloadMissionsTab(_currentMissionPt);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

// ─── Fast Travel Tab ────────────────────────────────────────

var _ftStationState = {}; // name → boolean (unlocked)
var _allStations = null;

async function loadAllStations() {
    if (_allStations) return _allStations;
    _allStations = await api("/api/fast-travel/all-stations");
    return _allStations;
}

async function renderFastTravel(data) {
    var lastDiv = document.getElementById("ft-last-visited");
    var listDiv = document.getElementById("ft-station-list");
    if (!data) {
        lastDiv.innerHTML = "";
        listDiv.innerHTML = '<div style="color:var(--text-dim);padding:20px">No fast travel data</div>';
        return;
    }

    if (data.last_visited) {
        lastDiv.innerHTML = "Last visited: <strong>" + esc(data.last_visited_display) + "</strong>";
    } else {
        lastDiv.innerHTML = "";
    }

    var allStations = await loadAllStations();
    var unlocked = new Set(data.stations.map(function(s) { return s.name; }));

    _ftStationState = {};
    var html = "";
    for (var i = 0; i < allStations.length; i++) {
        var s = allStations[i];
        var isUnlocked = unlocked.has(s.name);
        _ftStationState[s.name] = isUnlocked;
        var cls = isUnlocked ? "unlocked" : "locked";
        var checked = isUnlocked ? " checked" : "";
        html += '<div class="ft-station ' + cls + '">';
        html += '<button class="ft-toggle' + checked + '" data-station="' + esc(s.name) + '">' +
            (isUnlocked ? "\u2713" : "") + '</button>';
        html += '<span class="ft-station-name">' + esc(s.display_name) + '</span>';
        html += '</div>';
    }

    // Also show any unlocked stations NOT in allStations (DLC, unknown)
    data.stations.forEach(function(s) {
        if (!allStations.find(function(a) { return a.name === s.name; })) {
            _ftStationState[s.name] = true;
            html += '<div class="ft-station unlocked">';
            html += '<button class="ft-toggle checked" data-station="' + esc(s.name) + '">\u2713</button>';
            html += '<span class="ft-station-name">' + esc(s.display_name) + ' <span style="color:var(--text-dim)">(extra)</span></span>';
            html += '</div>';
        }
    });

    listDiv.innerHTML = html;

    listDiv.querySelectorAll(".ft-toggle").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var name = this.dataset.station;
            _ftStationState[name] = !_ftStationState[name];
            this.classList.toggle("checked");
            this.textContent = _ftStationState[name] ? "\u2713" : "";
            var row = this.closest(".ft-station");
            row.classList.toggle("unlocked", _ftStationState[name]);
            row.classList.toggle("locked", !_ftStationState[name]);
        });
    });
}

document.getElementById("btn-save-ft").addEventListener("click", async function() {
    if (!currentFile) return;
    if (_mutating) return;
    _mutating = true;
    var stations = [];
    for (var name in _ftStationState) {
        if (_ftStationState[name]) stations.push(name);
    }
    var status = document.getElementById("ft-status");
    status.textContent = "Saving...";
    try {
        await api("/api/save/" + currentFile + "/fast-travel", {
            method: "POST", body: { stations: stations }
        });
        toast("Fast travel stations updated");
        status.textContent = "Saved!";
        setTimeout(function() { status.textContent = ""; }, 2000);
        await loadSave(currentFile);
        document.querySelector('.main-tab[data-mtab="fasttravel"]').click();
    } catch (e) {
        toast("Error: " + e.message, "error");
        status.textContent = "Error";
    }
    _mutating = false;
});

document.getElementById("btn-unlock-all-ft").addEventListener("click", async function() {
    if (!currentFile) return;
    if (_mutating) return;
    _mutating = true;
    try {
        var res = await api("/api/save/" + currentFile + "/fast-travel/unlock-all", {
            method: "POST"
        });
        toast("Unlocked " + res.added + " new stations");
        await loadSave(currentFile);
        document.querySelector('.main-tab[data-mtab="fasttravel"]').click();
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

document.getElementById("btn-lock-all-ft").addEventListener("click", async function() {
    if (!currentFile) return;
    if (_mutating) return;
    if (!confirm("Lock all fast travel stations?")) return;
    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/fast-travel", {
            method: "POST", body: { stations: [] }
        });
        toast("All stations locked");
        await loadSave(currentFile);
        document.querySelector('.main-tab[data-mtab="fasttravel"]').click();
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

// ─── Ammo Fill ──────────────────────────────────────────────

document.getElementById("btn-fill-ammo").addEventListener("click", async function() {
    if (!currentFile) return;
    if (_mutating) return;
    _mutating = true;
    try {
        await api("/api/save/" + currentFile + "/ammo/fill", { method: "POST" });
        toast("Ammo filled to max");
        var r = await api("/api/save/" + currentFile);
        if (r.character) renderCharacter(r.character);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

// ─── Achievement Unlocker ──────────────────────────────────

document.getElementById("btn-unlock-achievements").addEventListener("click", async function() {
    if (!currentFile || _mutating) return;
    if (!confirm("This will max your level, complete all story missions, complete all challenges, and unlock all fast travel. Continue?")) return;
    _mutating = true;
    try {
        var res = await api("/api/save/" + currentFile + "/unlock-achievements", { method: "POST" });
        var parts = [];
        if (res.level) parts.push("Level " + res.level);
        if (res.missions_completed) parts.push(res.missions_completed + " missions");
        if (res.challenges_completed) parts.push(res.challenges_completed + " challenges");
        if (res.stations_unlocked) parts.push(res.stations_unlocked + " stations");
        toast("Achievements unlocked: " + parts.join(", "));
        await loadSave(currentFile);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

// ─── Challenges Tab ─────────────────────────────────────────

function renderChallenges(data) {
    var list = document.getElementById("challenge-list");
    var countEl = document.getElementById("challenge-count");
    if (!data || !data.categories) {
        list.innerHTML = '<div style="color:var(--text-dim);padding:20px">No challenge data</div>';
        return;
    }
    countEl.textContent = data.total + " challenges";
    var html = "";
    var cats = Object.keys(data.categories).sort();
    for (var ci = 0; ci < cats.length; ci++) {
        var cat = cats[ci];
        var challenges = data.categories[cat];
        html += '<div class="challenge-category">';
        html += '<div class="challenge-cat-header" data-cat="' + ci + '">';
        html += '<span class="challenge-cat-arrow">&#9654;</span> ';
        html += esc(cat) + ' <span class="challenge-cat-count">(' + challenges.length + ')</span>';
        html += '</div>';
        html += '<div class="challenge-cat-body" data-cat-body="' + ci + '" style="display:none">';
        for (var i = 0; i < challenges.length; i++) {
            var ch = challenges[i];
            var done = ch.completed_count > 0;
            html += '<div class="challenge-row' + (done ? ' is-complete' : '') + '">';
            html += '<span class="challenge-name">' + esc(ch.display_name) + '</span>';
            html += '<span class="challenge-progress">' + ch.progress + '</span>';
            html += '<span class="challenge-badge ' + (done ? 'badge-done' : 'badge-open') + '">' +
                (done ? 'DONE' : 'OPEN') + '</span>';
            html += '</div>';
        }
        html += '</div></div>';
    }
    list.innerHTML = html;

    // Collapsible categories
    list.querySelectorAll(".challenge-cat-header").forEach(function(header) {
        header.addEventListener("click", function() {
            var catId = this.dataset.cat;
            var body = list.querySelector('[data-cat-body="' + catId + '"]');
            var arrow = this.querySelector(".challenge-cat-arrow");
            if (body.style.display === "none") {
                body.style.display = "block";
                arrow.innerHTML = "&#9660;";
            } else {
                body.style.display = "none";
                arrow.innerHTML = "&#9654;";
            }
        });
    });
}

document.getElementById("btn-complete-all-challenges").addEventListener("click", async function() {
    if (!currentFile) return;
    if (_mutating) return;
    if (!confirm("Complete all challenges?")) return;
    _mutating = true;
    try {
        var res = await api("/api/save/" + currentFile + "/challenges/complete-all", { method: "POST" });
        toast("Completed " + res.count + " challenges");
        var data = await api("/api/save/" + currentFile + "/challenges");
        renderChallenges(data);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

document.getElementById("btn-reset-all-challenges").addEventListener("click", async function() {
    if (!currentFile) return;
    if (_mutating) return;
    if (!confirm("Reset all challenges to zero?")) return;
    _mutating = true;
    try {
        var res = await api("/api/save/" + currentFile + "/challenges/reset-all", { method: "POST" });
        toast("Reset " + res.count + " challenges");
        var data = await api("/api/save/" + currentFile + "/challenges");
        renderChallenges(data);
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

// ─── Achievements Tab ──────────────────────────────────────

var _achievementsData = null;
var _steamReady = false;

async function initSteam() {
    try {
        var res = await api("/api/steam/init", { method: "POST" });
        _steamReady = res.ok;
        _updateSteamStatusUI(res.ok, res.ok ? null : res.message);
    } catch (e) {
        _steamReady = false;
        _updateSteamStatusUI(false, "unavailable");
    }
}

function _updateSteamStatusUI(connected, errorMsg) {
    var el = document.getElementById("steam-status");
    if (connected) {
        el.innerHTML = "Steam: Connected";
        el.style.color = "var(--green, #4c6)";
    } else {
        var msg = errorMsg || "disconnected";
        el.innerHTML = esc(msg) + ' <a href="#" id="steam-reconnect" style="color:var(--accent);margin-left:6px;font-size:11px">[Reconnect]</a>';
        el.style.color = "var(--yellow, #cc0)";
        var link = document.getElementById("steam-reconnect");
        if (link) {
            link.addEventListener("click", function(e) {
                e.preventDefault();
                initSteam().then(function() { if (_steamReady) loadAchievements(); });
            });
        }
    }
}

// Check Steam health every 30s while on achievements tab
var _steamHealthInterval = null;
function startSteamHealthCheck() {
    if (_steamHealthInterval) return;
    _steamHealthInterval = setInterval(async function() {
        if (!_steamReady) return;
        try {
            var status = await api("/api/steam/status");
            if (!status.healthy) {
                _steamReady = false;
                _updateSteamStatusUI(false, "connection lost");
                toast("Steam connection lost. Click [Reconnect] to retry.", "warning");
            }
        } catch (e) {}
    }, 30000);
}

function stopSteamHealthCheck() {
    if (_steamHealthInterval) { clearInterval(_steamHealthInterval); _steamHealthInterval = null; }
}

async function loadAchievements() {
    try {
        _achievementsData = await api("/api/steam/achievements");
        renderAchievements(_achievementsData);
    } catch (e) { toast("Error loading achievements: " + e.message, "error"); }
}

function renderAchievements(data) {
    var list = document.getElementById("achievement-list");
    var filterCat = document.getElementById("ach-category-filter").value;
    var hideUnlocked = document.getElementById("ach-hide-unlocked").checked;

    // Populate category filter on first render
    var catSelect = document.getElementById("ach-category-filter");
    if (catSelect.options.length <= 1) {
        var seen = {};
        data.forEach(function(a) {
            if (!seen[a.category]) {
                seen[a.category] = true;
                var opt = document.createElement("option");
                opt.value = a.category;
                opt.textContent = a.category_name;
                catSelect.appendChild(opt);
            }
        });
    }

    // Show unlock count in steam-status
    var totalCount = data.length;
    var unlockedCount = data.filter(function(a) { return a.unlocked === true; }).length;
    var steamEl = document.getElementById("steam-status");
    if (steamEl && _steamReady) {
        steamEl.textContent = "Steam: Connected \u2014 " + unlockedCount + "/" + totalCount + " unlocked";
        steamEl.style.color = unlockedCount === totalCount ? "var(--green, #4c6)" : "var(--accent)";
    }

    var html = "";
    var curCat = "";
    data.forEach(function(a, idx) {
        if (filterCat && a.category !== filterCat) return;
        if (hideUnlocked && a.unlocked === true) return;

        if (a.category_name !== curCat) {
            curCat = a.category_name;
            html += '<div class="ach-category-header">' + esc(curCat) + '</div>';
        }
        var unlockClass = a.unlocked === true ? "unlocked" : (a.unlocked === false ? "locked" : "unknown");
        var statusIcon = a.unlocked === true ? "\u2713" : (a.unlocked === false ? "\u2717" : "?");
        html += '<div class="ach-row ' + unlockClass + '">';
        html += '<input type="checkbox" class="ach-checkbox" data-api="' + esc(a.api_name) + '">';
        html += '<span class="ach-status-icon">' + statusIcon + '</span>';
        html += '<div class="ach-info">';
        html += '<span class="ach-name">' + esc(a.name) + '</span>';
        html += '<span class="ach-desc">' + esc(a.description) + '</span>';
        html += '</div>';
        html += '<span class="ach-api-name">' + esc(a.api_name) + '</span>';
        html += '</div>';
    });
    if (!html) html = '<div style="color:var(--text-dim);padding:20px">No achievements match filter</div>';
    list.innerHTML = html;
}

document.getElementById("ach-category-filter").addEventListener("change", function() {
    if (_achievementsData) renderAchievements(_achievementsData);
});
document.getElementById("ach-hide-unlocked").addEventListener("change", function() {
    if (_achievementsData) renderAchievements(_achievementsData);
});

document.getElementById("btn-unlock-selected-ach").addEventListener("click", async function() {
    if (_mutating) return;
    var checkboxes = document.querySelectorAll(".ach-checkbox:checked");
    var names = [];
    checkboxes.forEach(function(cb) { names.push(cb.dataset.api); });
    if (!names.length) { toast("No achievements selected", "error"); return; }
    _mutating = true;
    document.getElementById("ach-status").textContent = "Unlocking...";
    try {
        var res = await api("/api/steam/achievements/unlock", {
            method: "POST", body: { achievements: names }
        });
        toast("Unlocked " + res.unlocked + " of " + res.total + " achievements");
        document.getElementById("ach-status").textContent = res.unlocked + " unlocked";
        setTimeout(function() { document.getElementById("ach-status").textContent = ""; }, 3000);
        await loadAchievements();
    } catch (e) { toast("Error: " + e.message, "error"); document.getElementById("ach-status").textContent = ""; }
    _mutating = false;
});

document.getElementById("btn-unlock-all-ach").addEventListener("click", async function() {
    if (_mutating) return;
    if (!confirm("Unlock ALL Steam achievements for BL2?")) return;
    _mutating = true;
    document.getElementById("ach-status").textContent = "Unlocking all...";
    try {
        var res = await api("/api/steam/achievements/unlock-all", { method: "POST" });
        toast("Unlocked " + res.unlocked + " of " + res.total + " achievements");
        document.getElementById("ach-status").textContent = "All unlocked!";
        setTimeout(function() { document.getElementById("ach-status").textContent = ""; }, 3000);
        await loadAchievements();
    } catch (e) { toast("Error: " + e.message, "error"); document.getElementById("ach-status").textContent = ""; }
    _mutating = false;
});

document.getElementById("btn-lock-selected-ach").addEventListener("click", async function() {
    if (_mutating) return;
    var checkboxes = document.querySelectorAll(".ach-checkbox:checked");
    var names = [];
    checkboxes.forEach(function(cb) { names.push(cb.dataset.api); });
    if (!names.length) { toast("No achievements selected", "error"); return; }
    if (!confirm("Re-lock " + names.length + " achievements?")) return;
    _mutating = true;
    try {
        var res = await api("/api/steam/achievements/clear", {
            method: "POST", body: { achievements: names }
        });
        toast("Locked " + res.cleared + " achievements");
        await loadAchievements();
    } catch (e) { toast("Error: " + e.message, "error"); }
    _mutating = false;
});

document.getElementById("btn-refresh-ach").addEventListener("click", function() {
    loadAchievements();
});

document.getElementById("btn-deselect-all-ach").addEventListener("click", function() {
    document.querySelectorAll(".ach-checkbox").forEach(function(cb) { cb.checked = false; });
});

// Load achievements when tab is clicked, manage health checks
document.querySelectorAll(".main-tab").forEach(function(tab) {
    tab.addEventListener("click", function() {
        if (tab.dataset.mtab === "achievements") {
            if (!_achievementsData) {
                initSteam().then(loadAchievements);
            }
            startSteamHealthCheck();
        } else {
            stopSteamHealthCheck();
        }
    });
});

// ─── Init ───────────────────────────────────────────────────

loadSaveList();
