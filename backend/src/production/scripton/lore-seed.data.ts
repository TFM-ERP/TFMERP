/** Lore Atlas — the one researched element library. Seeded once (auto, if empty) by ScripOnService.
 *  Living-religion deities/prophets are intentionally NOT present (hard lock by absence).
 *  tier: FOLKLORE | SACRED_AWARE | HISTORICAL_PANTHEON | CARE
 *  genres: fantasy | horror | folklore | myth | crime | romance | naming-dress
 *  archetypes: shapeshifter | death-omen | blood-drinker | trickster | guardian | world-system | beast | undead | spirit | underworld | custom | wardrobe | naming
 */
export type LoreSeedRow = {
  slug: string; name: string; culture: string; region?: string;
  genres: string[]; archetypes: string[]; tier: string; blurb: string;
  origin?: string; variants?: string[]; hooks?: string[]; aliases?: string[]; sources?: string[];
};

export const LORE_SEED: LoreSeedRow[] = [
  // ---- Arabian (anchor; rich cards) ----
  { slug: "djinn", name: "Djinn", culture: "Arabian", genres: ["fantasy","folklore"], archetypes: ["world-system","shapeshifter"], tier: "SACRED_AWARE",
    blurb: "Fire-born spirits that shapeshift, bargain, and possess — at a cost.",
    origin: "Pre-Islamic Arabian spirits later woven through wider folklore; a parallel people of smokeless fire, free-willed and morally mixed.",
    variants: ["Marid (mightiest)","Ifrit (malevolent fire)","Si'lat (human-passing)"],
    hooks: ["A pact whose price is hidden in the wording.","A bound djinn that serves the letter, never the spirit, of a wish.","Possession that the household mistakes for madness."],
    aliases: ["jinn","genie","djinni"] },
  { slug: "ghoul", name: "Ghoul (Ghul)", culture: "Arabian", genres: ["horror","folklore"], archetypes: ["shapeshifter"], tier: "FOLKLORE",
    blurb: "Desert shapeshifter that lures lone travellers off the road and devours them.",
    origin: "A class of jinn-kin haunting wastes and graveyards; preys on travellers and the dead.",
    variants: ["Si'lat (female form)","Qutrub (frenzied)"],
    hooks: ["The hired guide who knows the dunes too well — and never eats.","A grave-robbing that wakes something older than the tomb.","A voice that calls your name in a dead friend's face."],
    aliases: ["ghul","ghoula"] },
  { slug: "marid", name: "Marid", culture: "Arabian", genres: ["fantasy","folklore"], archetypes: ["world-system"], tier: "SACRED_AWARE",
    blurb: "The mightiest jinn — sea-born, proud, granting wishes for a steep price.", aliases: ["marid jinn"] },
  { slug: "ifrit", name: "Ifrit", culture: "Arabian", genres: ["fantasy","horror"], archetypes: ["world-system"], tier: "SACRED_AWARE",
    blurb: "A malevolent fire-spirit of vengeance and ruin.", aliases: ["afreet","afrit"] },
  { slug: "qarin", name: "Qarin", culture: "Arabian", genres: ["fantasy","folklore"], archetypes: ["omen","spirit"], tier: "SACRED_AWARE",
    blurb: "A spirit-double that shadows a person and whispers." },
  { slug: "silat", name: "Si'lat", culture: "Arabian", genres: ["fantasy","folklore"], archetypes: ["shapeshifter"], tier: "FOLKLORE",
    blurb: "A jinn that takes a convincing human, often female, form." },
  { slug: "nasnas", name: "Nasnas", culture: "Arabian", genres: ["horror","folklore"], archetypes: ["beast"], tier: "FOLKLORE",
    blurb: "A half-bodied creature that hops with eerie speed." },
  { slug: "rukh", name: "Rukh (Roc)", culture: "Arabian", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE",
    blurb: "A colossal bird of prey that can carry off an elephant.", aliases: ["roc"] },
  { slug: "amaliq", name: "Amalekites (ʿAmāliqah)", culture: "Arabian", genres: ["folklore","fantasy"], archetypes: ["world-system","beast"], tier: "FOLKLORE",
    blurb: "A primeval nation of giants (from ʿimlāq, 'giant') said to have ruled ancient Arabia before vanishing.",
    origin: "In Arab tradition one of the 'extinct Arabs' (al-ʿArab al-bāʾida) beside ʿĀd and Thamūd — a towering, mighty people whose very name (ʿimlāq → plural ʿamāliqah/ʿamālīq) means 'giant'; later storytellers made them a primeval dynasty that once held Mecca, the Hijaz and Yemen.",
    variants: ["ʿĀd (giant builders of Iram of the Pillars)","Thamūd (rock-carvers of al-Ḥijr)","Jurhum (who followed them in Mecca)"],
    hooks: ["Ruins cut too large for any human hand — and the last of the builders still guarding them.","A drought-and-hubris myth: the giants defied heaven and were scoured from the earth.","A bloodline that still runs impossibly tall, hunted for what their ancestors buried."],
    aliases: ["amaliq","amaleeq","amalekites","giants","عماليق","العماليق","عمالقة","عملاق"] },

  // ---- Japanese ----
  { slug: "oni", name: "Oni", culture: "Japanese", genres: ["fantasy","horror"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A horned demon-ogre with an iron club and immense strength." },
  { slug: "kitsune", name: "Kitsune", culture: "Japanese", genres: ["fantasy","folklore"], archetypes: ["shapeshifter","trickster"], tier: "FOLKLORE", blurb: "A fox shapeshifter whose power grows with age.", aliases: ["fox spirit","nine-tailed fox"] },
  { slug: "tengu", name: "Tengu", culture: "Japanese", genres: ["fantasy","folklore"], archetypes: ["trickster","guardian"], tier: "FOLKLORE", blurb: "A mountain bird-spirit and martial trickster." },
  { slug: "kappa", name: "Kappa", culture: "Japanese", genres: ["fantasy","folklore"], archetypes: ["spirit"], tier: "FOLKLORE", blurb: "A river imp whose strength lives in the water held on its head." },
  { slug: "yurei", name: "Yurei", culture: "Japanese", genres: ["horror","folklore"], archetypes: ["death-omen","undead"], tier: "FOLKLORE", blurb: "A vengeful ghost bound by unfinished business.", aliases: ["ghost","onryo"] },
  { slug: "tanuki", name: "Tanuki", culture: "Japanese", genres: ["fantasy","folklore"], archetypes: ["shapeshifter","trickster"], tier: "FOLKLORE", blurb: "A shape-shifting raccoon-dog reveller." },

  // ---- Norse / Scandinavian ----
  { slug: "draugr", name: "Draugr", culture: "Norse", genres: ["horror","folklore"], archetypes: ["undead","blood-drinker"], tier: "FOLKLORE", blurb: "An undead barrow-guardian that swells in size and reeks of decay.", aliases: ["barrow-wight"] },
  { slug: "troll", name: "Troll", culture: "Norse", genres: ["fantasy","folklore"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A mountain giant that turns to stone in sunlight." },
  { slug: "jotunn", name: "Jotunn", culture: "Norse", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A primordial giant, ancient foe of the gods.", aliases: ["jotun","giant"] },
  { slug: "huldra", name: "Huldra", culture: "Norse", genres: ["fantasy","folklore"], archetypes: ["spirit","shapeshifter"], tier: "FOLKLORE", blurb: "A seductive forest spirit with a hidden tail." },
  { slug: "nisse", name: "Nisse", culture: "Norse", genres: ["fantasy","folklore"], archetypes: ["spirit","guardian"], tier: "FOLKLORE", blurb: "A farm gnome — blessing or bane by how it is treated.", aliases: ["tomte"] },
  { slug: "kraken", name: "Kraken", culture: "Norse", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "An abyssal sea-beast that drags ships under." },

  // ---- Slavic ----
  { slug: "baba-yaga", name: "Baba Yaga", culture: "Slavic", genres: ["fantasy","folklore"], archetypes: ["trickster","guardian"], tier: "FOLKLORE", blurb: "A witch in a hut on chicken legs — wise, cunning, unpredictable." },
  { slug: "rusalka", name: "Rusalka", culture: "Slavic", genres: ["horror","folklore"], archetypes: ["death-omen","spirit"], tier: "FOLKLORE", blurb: "A drowned water-maiden whose song lures men under." },
  { slug: "leshy", name: "Leshy", culture: "Slavic", genres: ["fantasy","folklore"], archetypes: ["guardian","shapeshifter"], tier: "FOLKLORE", blurb: "A forest guardian who leads folk astray." },
  { slug: "domovoi", name: "Domovoi", culture: "Slavic", genres: ["fantasy","folklore"], archetypes: ["spirit","guardian"], tier: "FOLKLORE", blurb: "A house spirit that guards — or curses — a home." },
  { slug: "vodyanoy", name: "Vodyanoy", culture: "Slavic", genres: ["horror","folklore"], archetypes: ["spirit"], tier: "FOLKLORE", blurb: "A vengeful water-man of rivers and mills." },
  { slug: "koschei", name: "Koschei", culture: "Slavic", genres: ["fantasy","horror"], archetypes: ["undead","world-system"], tier: "FOLKLORE", blurb: "A deathless sorcerer whose soul is hidden far from his body.", aliases: ["koschei the deathless"] },

  // ---- Chinese ----
  { slug: "jiangshi", name: "Jiangshi", culture: "Chinese", genres: ["horror","folklore"], archetypes: ["undead","blood-drinker"], tier: "FOLKLORE", blurb: "A hopping reanimated corpse that drains qi.", aliases: ["hopping vampire"] },
  { slug: "huli-jing", name: "Huli jing", culture: "Chinese", genres: ["fantasy","folklore"], archetypes: ["shapeshifter","trickster"], tier: "FOLKLORE", blurb: "A fox spirit of charm and intelligence.", aliases: ["fox spirit"] },
  { slug: "nian", name: "Nian", culture: "Chinese", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A New-Year beast that fears red and loud noise." },
  { slug: "pixiu", name: "Pixiu", culture: "Chinese", genres: ["fantasy","folklore"], archetypes: ["guardian","world-system"], tier: "FOLKLORE", blurb: "A wealth-devouring guardian beast." },
  { slug: "long-dragon", name: "Long (Dragon)", culture: "Chinese", genres: ["fantasy","myth"], archetypes: ["world-system","beast"], tier: "FOLKLORE", blurb: "A celestial dragon of rain, rivers and sovereignty.", aliases: ["chinese dragon"] },

  // ---- South Asian ----
  { slug: "rakshasa", name: "Rakshasa", culture: "South Asian", genres: ["fantasy","horror"], archetypes: ["shapeshifter","beast"], tier: "SACRED_AWARE", blurb: "A shape-shifting demon of the epics." },
  { slug: "naga", name: "Naga", culture: "South Asian", genres: ["fantasy","myth"], archetypes: ["world-system","guardian"], tier: "SACRED_AWARE", blurb: "Serpent demi-beings of underwater realms and hidden wisdom." },
  { slug: "vetala", name: "Vetala", culture: "South Asian", genres: ["horror","folklore"], archetypes: ["undead","spirit"], tier: "FOLKLORE", blurb: "A spirit that possesses and reanimates corpses." },
  { slug: "churel", name: "Churel", culture: "South Asian", genres: ["horror","folklore"], archetypes: ["death-omen","shapeshifter"], tier: "FOLKLORE", blurb: "A vengeful female ghost who returns for the living." },
  { slug: "garuda", name: "Garuda", culture: "South Asian", genres: ["fantasy","myth"], archetypes: ["guardian","beast"], tier: "SACRED_AWARE", blurb: "A vast divine eagle of the old stories." },

  // ---- Persian ----
  { slug: "simurgh", name: "Simurgh", culture: "Persian", genres: ["fantasy","myth"], archetypes: ["guardian","world-system"], tier: "FOLKLORE", blurb: "A benevolent wisdom-bird of rebirth." },
  { slug: "div", name: "Div", culture: "Persian", genres: ["fantasy","horror"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A malevolent demon of the old epics.", aliases: ["dev","daeva"] },
  { slug: "peri", name: "Peri", culture: "Persian", genres: ["fantasy","folklore"], archetypes: ["spirit"], tier: "FOLKLORE", blurb: "A winged, ethereal being — neither wholly good nor ill.", aliases: ["pari"] },
  { slug: "manticore", name: "Manticore", culture: "Persian", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "Man's head, lion's body, scorpion's tail — swift and lethal." },
  { slug: "azhdaha", name: "Azhdaha", culture: "Persian", genres: ["fantasy","myth"], archetypes: ["beast","world-system"], tier: "FOLKLORE", blurb: "A vast winged serpent — the Persian dragon.", aliases: ["azhdahak"] },

  // ---- Celtic / Irish ----
  { slug: "banshee", name: "Banshee", culture: "Celtic", genres: ["horror","folklore"], archetypes: ["death-omen"], tier: "FOLKLORE", blurb: "A wailing woman whose cry heralds a death.", aliases: ["bean sidhe"] },
  { slug: "puca", name: "Puca", culture: "Celtic", genres: ["fantasy","folklore"], archetypes: ["shapeshifter","trickster"], tier: "FOLKLORE", blurb: "A shapeshifting trickster, often a black horse by night.", aliases: ["pooka","puka"] },
  { slug: "selkie", name: "Selkie", culture: "Celtic", genres: ["fantasy","folklore"], archetypes: ["shapeshifter"], tier: "FOLKLORE", blurb: "A seal that sheds its skin to walk as a human — tales of love and loss." },
  { slug: "dullahan", name: "Dullahan", culture: "Celtic", genres: ["horror","folklore"], archetypes: ["death-omen","undead"], tier: "FOLKLORE", blurb: "A headless rider; speak your name and your fate is sealed." },
  { slug: "changeling", name: "Changeling", culture: "Celtic", genres: ["horror","folklore"], archetypes: ["shapeshifter"], tier: "FOLKLORE", blurb: "A fae swap left in a stolen child's place." },

  // ---- West African ----
  { slug: "anansi", name: "Anansi", culture: "West African", genres: ["fantasy","folklore"], archetypes: ["trickster"], tier: "FOLKLORE", blurb: "An Ashanti trickster spider, master of stories and wit." },
  { slug: "mami-wata", name: "Mami Wata", culture: "West African", genres: ["fantasy","folklore"], archetypes: ["spirit","guardian"], tier: "FOLKLORE", blurb: "A water spirit of dual nature — nurturing and destructive." },
  { slug: "adze", name: "Adze", culture: "West African", genres: ["horror","folklore"], archetypes: ["blood-drinker","shapeshifter"], tier: "FOLKLORE", blurb: "An Ewe vampiric being that shifts from firefly to human." },
  { slug: "tikoloshe", name: "Tikoloshe", culture: "West African", genres: ["fantasy","folklore"], archetypes: ["spirit","trickster"], tier: "FOLKLORE", blurb: "A mischievous Zulu water-sprite." },
  { slug: "impundulu", name: "Impundulu", culture: "West African", genres: ["horror","folklore"], archetypes: ["blood-drinker","beast"], tier: "FOLKLORE", blurb: "A lightning-bird familiar that rides storms and feeds on blood." },

  // ---- Latin American ----
  { slug: "la-llorona", name: "La Llorona", culture: "Latin American", genres: ["horror","folklore"], archetypes: ["death-omen","spirit"], tier: "FOLKLORE", blurb: "A weeping ghost mourning her drowned children.", aliases: ["weeping woman"] },
  { slug: "nahual", name: "Nahual", culture: "Latin American", genres: ["fantasy","folklore"], archetypes: ["shapeshifter"], tier: "FOLKLORE", blurb: "A shape-shifter who becomes an animal at will.", aliases: ["nagual"] },
  { slug: "chupacabra", name: "Chupacabra", culture: "Latin American", genres: ["horror","folklore"], archetypes: ["blood-drinker","beast"], tier: "FOLKLORE", blurb: "A livestock blood-drinker of modern legend." },
  { slug: "el-cucuy", name: "El Cucuy", culture: "Latin American", genres: ["horror","folklore"], archetypes: ["death-omen"], tier: "FOLKLORE", blurb: "The boogeyman who takes wayward children.", aliases: ["el coco"] },
  { slug: "pishtaco", name: "Pishtaco", culture: "Latin American", genres: ["horror","folklore"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A predator who steals body fat from his victims." },

  // ---- Filipino ----
  { slug: "aswang", name: "Aswang", culture: "Filipino", genres: ["horror","folklore"], archetypes: ["shapeshifter","blood-drinker"], tier: "FOLKLORE", blurb: "A shape-shifting witch-ghoul of the night." },
  { slug: "manananggal", name: "Manananggal", culture: "Filipino", genres: ["horror","folklore"], archetypes: ["blood-drinker","shapeshifter"], tier: "FOLKLORE", blurb: "A self-segmenting winged vampire." },
  { slug: "tikbalang", name: "Tikbalang", culture: "Filipino", genres: ["fantasy","folklore"], archetypes: ["trickster","shapeshifter"], tier: "FOLKLORE", blurb: "A horse-headed trickster of the forest trail." },
  { slug: "kapre", name: "Kapre", culture: "Filipino", genres: ["fantasy","folklore"], archetypes: ["spirit","guardian"], tier: "FOLKLORE", blurb: "A tree-dwelling giant wreathed in tobacco smoke." },
  { slug: "tiyanak", name: "Tiyanak", culture: "Filipino", genres: ["horror","folklore"], archetypes: ["shapeshifter"], tier: "FOLKLORE", blurb: "A vampiric creature disguised as an abandoned infant." },

  // ---- Greek (classical creatures) ----
  { slug: "minotaur", name: "Minotaur", culture: "Greek", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A bull-headed man at the heart of the labyrinth." },
  { slug: "cyclops", name: "Cyclops", culture: "Greek", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A one-eyed giant of immense strength." },
  { slug: "siren", name: "Siren", culture: "Greek", genres: ["fantasy","myth"], archetypes: ["death-omen","spirit"], tier: "FOLKLORE", blurb: "A song that lures sailors onto the rocks." },
  { slug: "harpy", name: "Harpy", culture: "Greek", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A winged snatcher of the storm-winds." },
  { slug: "chimera", name: "Chimera", culture: "Greek", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A fire-breathing fusion of lion, goat and serpent." },
  { slug: "hydra", name: "Hydra", culture: "Greek", genres: ["fantasy","myth"], archetypes: ["beast"], tier: "FOLKLORE", blurb: "A many-headed serpent that doubles each head you cut." },

  // ---- Historical pantheons (off by default; demonstrate the policy toggle) ----
  { slug: "greek-olympian", name: "Olympian deity (archetype)", culture: "Greek", genres: ["myth"], archetypes: ["world-system"], tier: "HISTORICAL_PANTHEON", blurb: "Classical Olympian god archetype — flagged; hidden unless historical pantheons are enabled." },
  { slug: "norse-aesir", name: "Aesir deity (archetype)", culture: "Norse", genres: ["myth"], archetypes: ["world-system"], tier: "HISTORICAL_PANTHEON", blurb: "Norse Aesir god archetype — flagged; hidden unless historical pantheons are enabled." },
  { slug: "egyptian-netjer", name: "Egyptian deity (archetype)", culture: "Egyptian", genres: ["myth"], archetypes: ["world-system"], tier: "HISTORICAL_PANTHEON", blurb: "Ancient Egyptian god archetype — flagged; hidden unless historical pantheons are enabled." },

  // ---- Crime & underworld (CARE) ----
  { slug: "cosca-family", name: "Cosca & family", culture: "Sicilian", genres: ["crime"], archetypes: ["underworld"], tier: "CARE", blurb: "The clan unit; fictive kinship binds members for life." },
  { slug: "capo-decina", name: "Capo-decina", culture: "Sicilian", genres: ["crime"], archetypes: ["underworld"], tier: "CARE", blurb: "Head of ten — a captain over a crew of soldiers." },
  { slug: "omerta", name: "Omerta", culture: "Sicilian", genres: ["crime"], archetypes: ["underworld"], tier: "CARE", blurb: "The code of silence; never cooperate with the state." },
  { slug: "vor-v-zakone", name: "Vor v zakone", culture: "Russian", genres: ["crime"], archetypes: ["underworld"], tier: "CARE", blurb: "Thief-in-law — a crime lord bound by the thieves' code." },
  { slug: "coded-tattoos", name: "Coded tattoos", culture: "Russian", genres: ["crime"], archetypes: ["underworld"], tier: "CARE", blurb: "Inked rank and record — a readable criminal resume." },
  { slug: "oyabun-kobun", name: "Oyabun-kobun", culture: "Japanese", genres: ["crime"], archetypes: ["underworld"], tier: "CARE", blurb: "Parent-child bond of absolute loyalty up the chain." },
  { slug: "plaza-system", name: "Plaza system", culture: "Mexican", genres: ["crime"], archetypes: ["underworld"], tier: "CARE", blurb: "Territory tolls; control of a smuggling corridor." },

  // ---- Romance & customs ----
  { slug: "mahr", name: "Mahr", culture: "Arabian", genres: ["romance"], archetypes: ["custom"], tier: "SACRED_AWARE", blurb: "A dowry paid to the bride herself in the marriage contract." },
  { slug: "henna-night", name: "Henna night", culture: "Arabian", genres: ["romance"], archetypes: ["custom"], tier: "FOLKLORE", blurb: "A pre-wedding gathering; hands adorned in henna patterns." },
  { slug: "rishta-matchmaker", name: "Rishta & matchmaker", culture: "Indian", genres: ["romance"], archetypes: ["custom"], tier: "CARE", blurb: "A family-brokered proposal through a trusted go-between." },
  { slug: "mehndi-sangeet", name: "Mehndi & Sangeet", culture: "Indian", genres: ["romance"], archetypes: ["custom"], tier: "FOLKLORE", blurb: "A henna ceremony and a musical night before the wedding." },
  { slug: "miai", name: "Miai", culture: "Japanese", genres: ["romance"], archetypes: ["custom"], tier: "FOLKLORE", blurb: "A formal arranged-introduction meeting between families." },
  { slug: "shadchan", name: "Shadchan", culture: "Jewish", genres: ["romance"], archetypes: ["custom"], tier: "FOLKLORE", blurb: "The matchmaker who brokers a suitable shidduch." },

  // ---- Naming & dress ----
  { slug: "thobe-abaya", name: "Thobe & abaya", culture: "Arabian", genres: ["naming-dress"], archetypes: ["wardrobe"], tier: "FOLKLORE", blurb: "Robe and cloak; collar and embroidery mark a wearer's origin." },
  { slug: "ibn-bint", name: "ibn / bint", culture: "Arabian", genres: ["naming-dress"], archetypes: ["naming"], tier: "FOLKLORE", blurb: "Son/daughter-of patronymics chain a lineage into a name." },
  { slug: "kimono-obi", name: "Kimono & obi", culture: "Japanese", genres: ["naming-dress"], archetypes: ["wardrobe"], tier: "FOLKLORE", blurb: "A wrapped robe and sash; pattern signals season and rank." },
  { slug: "honorifics-san", name: "-san / -sama", culture: "Japanese", genres: ["naming-dress"], archetypes: ["naming"], tier: "FOLKLORE", blurb: "Honorifics that encode exact social distance and respect." },
  { slug: "sari", name: "Sari", culture: "Indian", genres: ["naming-dress"], archetypes: ["wardrobe"], tier: "FOLKLORE", blurb: "Draped cloth; region, weave and colour carry meaning." },
  { slug: "hanbok", name: "Hanbok", culture: "Korean", genres: ["naming-dress"], archetypes: ["wardrobe"], tier: "FOLKLORE", blurb: "Jeogori top and skirt/trousers; colour marks age and status." },
  { slug: "son-dottir", name: "-son / -dottir", culture: "Norse", genres: ["naming-dress"], archetypes: ["naming"], tier: "FOLKLORE", blurb: "Patronymic surnames built from the father's given name." },
];
