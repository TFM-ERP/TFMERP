'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useExitGuard } from './useExitGuard';
import { uploadFile, productionApi } from '@/lib/api';
import { useViewport } from './useViewport';
import { ENDING_TYPES } from './endingTypes';
import { useLocale } from '@/lib/i18n';
import { AR_DIALECTS, isArabicLang } from './dialects';
import { BASE_GENRES, BLEND_LAYERS, TONES, MOODS, TREATMENTS, SETTING_ERAS, SETTING_COUNTRIES, PROJECT_INTENTS, BUDGET_TIERS, ACCENTS, STYLE_PACKS, STYLE_STRENGTH, eraOptionsFor, tx, arLabel, subgenresForLabel } from './taxonomy';

/** ScriptON — consolidated intake (2-step) with the Lore Atlas. Steers the whole ladder; never writes the story alone. */
const C = { scrim: 'rgba(6,7,10,0.85)', panel: '#0e1014', band: '#14161c', hair: 'rgba(255,255,255,.08)', gold: '#C6A463', gold2: '#E6D2A2', ink: '#1a1509', cream: '#F4EEE0', text: '#E7E3D8', mut: '#9aa1ab', faint: '#6b727d', blue: '#5b8def', violet: '#8b7cf0', green: '#57b368', red: '#e5635f', amber: '#e0a458' };
const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Romance', 'Thriller', 'Horror', 'Sci-fi', 'Fantasy', 'Mystery', 'Crime', 'War', 'Western', 'Historical', 'Epic', 'Biopic', 'Musical', 'Family', 'Animation', 'Sport', 'Film-noir', 'Disaster', 'Survival', 'Coming-of-age', 'Spy', 'Heist', 'Superhero', 'Psychological', 'Satire', 'Road movie', 'Martial arts', 'Slasher'];
const SCOPE: [string, string][] = [['subject', 'Real subject & history'], ['craft', 'Story-craft & refs'], ['mythology', 'Mythology / culture'], ['comps', 'Comps & box office'], ['legal', 'Cultural / legal fit'], ['general', 'General web']];
const PTYPES: [string, string, string][] = [['MOVIE', 'Movie', '~90-120 min'], ['TV_SERIES', 'TV series', '8-22 ep'], ['LIMITED', 'Limited', '4-8 ep'], ['VERTICAL', 'Vertical', '60-100 ep'], ['SHORT', 'Short film', '<=40 min'], ['DOC', 'Documentary', 'varies']];
const SERIES_TYPES = ['TV_SERIES', 'VERTICAL', 'LIMITED'];
// Series-type presets — mirror backend SERIES_PRESETS / VERTICAL_PRESETS (knowledge/formats.ts).
// episodes/minutesPerEp are the template norm (midpoint for ranges); the fields stay editable
// (editing switches to Custom). marketKey is sent on the brief so the backend uses the explicit
// template instead of only inferring it from the Country/market field. `types` gates which
// project types show the preset.
type SeriesPreset = { key: string; label: string; labelAr: string; episodes: number; minutesPerEp: number; seasons: number; marketKey: string; types: string[] };
const SERIES_PRESETS: SeriesPreset[] = [
  { key: 'US_STREAMING', label: 'US streaming drama', labelAr: 'دراما البث الأمريكية', episodes: 10, minutesPerEp: 60, seasons: 1, marketKey: 'US_STREAMING', types: ['TV_SERIES'] },
  { key: 'US_NETWORK', label: 'US network hour', labelAr: 'ساعة الشبكات الأمريكية', episodes: 22, minutesPerEp: 44, seasons: 1, marketKey: 'US_NETWORK', types: ['TV_SERIES'] },
  { key: 'UK', label: 'UK / BBC drama', labelAr: 'دراما بريطانية / BBC', episodes: 6, minutesPerEp: 58, seasons: 1, marketKey: 'UK', types: ['TV_SERIES'] },
  { key: 'KDRAMA', label: 'K-drama', labelAr: 'دراما كورية', episodes: 16, minutesPerEp: 65, seasons: 1, marketKey: 'KDRAMA', types: ['TV_SERIES'] },
  { key: 'TURKISH_DIZI', label: 'Turkish dizi', labelAr: 'دراما تركية', episodes: 36, minutesPerEp: 130, seasons: 1, marketKey: 'TURKISH_DIZI', types: ['TV_SERIES'] },
  { key: 'TELENOVELA', label: 'Telenovela', labelAr: 'تيلينوفيلا', episodes: 120, minutesPerEp: 45, seasons: 1, marketKey: 'TELENOVELA', types: ['TV_SERIES'] },
  { key: 'ANIME', label: 'Anime', labelAr: 'أنمي', episodes: 12, minutesPerEp: 24, seasons: 1, marketKey: 'ANIME', types: ['TV_SERIES'] },
  { key: 'RAMADAN_MUSALSAL', label: 'Ramadan musalsal (MENA)', labelAr: 'مسلسل رمضاني', episodes: 30, minutesPerEp: 40, seasons: 1, marketKey: 'RAMADAN_MUSALSAL', types: ['TV_SERIES'] },
  { key: 'NORDIC_NOIR', label: 'Nordic noir', labelAr: 'نوار إسكندنافي', episodes: 8, minutesPerEp: 58, seasons: 1, marketKey: 'NORDIC_NOIR', types: ['TV_SERIES'] },
  { key: 'LIMITED', label: 'Limited series', labelAr: 'مسلسل محدود', episodes: 6, minutesPerEp: 55, seasons: 1, marketKey: 'UK', types: ['LIMITED'] },
  { key: 'VERTICAL', label: 'Vertical micro-drama', labelAr: 'دراما عمودية قصيرة', episodes: 80, minutesPerEp: 1.5, seasons: 1, marketKey: 'GLOBAL', types: ['VERTICAL'] },
];
const seriesPresetsFor = (pt: string): SeriesPreset[] => SERIES_PRESETS.filter((s) => s.types.indexOf(pt) >= 0);
// Locale-default so the first view is meaningful (no bare 10×50): MENA → Ramadan musalsal, else US streaming.
const defaultPresetKey = (pt: string, ar: boolean): string => (pt === 'TV_SERIES' ? (ar ? 'RAMADAN_MUSALSAL' : 'US_STREAMING') : pt === 'LIMITED' ? 'LIMITED' : pt === 'VERTICAL' ? 'VERTICAL' : '');
const smartFramework = (pt: string, genres: string[] = []): string => {
  if (pt === 'TV_SERIES' || pt === 'VERTICAL') return 'tv_network';
  if (pt === 'LIMITED') return 'limited';
  const g = (genres || []).join(' ').toLowerCase();
  if (/epic|myth|fantasy|adventure|hero|historical|legend/.test(g)) return 'vogler';
  return 'savecat';
};
const FRAMEWORK_INFO: { id: string; name: string; desc: string; ar: string; arDesc: string }[] = [
  { id: 'three_act', name: 'Three-Act (classic)', desc: 'Setup, confrontation, resolution - the universal spine.', ar: '\u0627\u0644\u0641\u0635\u0648\u0644 \u0627\u0644\u062b\u0644\u0627\u062b\u0629 (\u0643\u0644\u0627\u0633\u064a\u0643\u064a)', arDesc: '\u0627\u0644\u062a\u0623\u0633\u064a\u0633\u060c \u0627\u0644\u0645\u0648\u0627\u062c\u0647\u0629\u060c \u0627\u0644\u062d\u0644 \u2014 \u0627\u0644\u0639\u0645\u0648\u062f \u0627\u0644\u0641\u0642\u0631\u064a \u0627\u0644\u0643\u0648\u0646\u064a.' },
  { id: 'savecat', name: 'Save the Cat (15)', desc: 'Blake Snyder 15-beat commercial-feature sheet. Plot-forward.', ar: '\u0623\u0646\u0642\u0650\u0630 \u0627\u0644\u0642\u0637\u0629 (15)', arDesc: '\u062e\u0631\u064a\u0637\u0629 \u0628\u0644\u064a\u0643 \u0633\u0646\u0627\u064a\u062f\u0631 \u0645\u0646 15 \u0645\u0641\u0635\u0644\u064b\u0627 \u0644\u0644\u0623\u0641\u0644\u0627\u0645 \u0627\u0644\u062a\u062c\u0627\u0631\u064a\u0629. \u062d\u0628\u0643\u0629 \u062f\u0627\u0641\u0639\u0629.' },
  { id: 'field', name: 'Syd Field Paradigm', desc: 'Three acts with clear plot points - the textbook structure.', ar: '\u0646\u0645\u0648\u0630\u062c \u0633\u064a\u062f \u0641\u064a\u0644\u062f', arDesc: '\u062b\u0644\u0627\u062b\u0629 \u0641\u0635\u0648\u0644 \u0628\u0646\u0642\u0627\u0637 \u062d\u0628\u0643\u0629 \u0648\u0627\u0636\u062d\u0629 \u2014 \u0627\u0644\u0628\u0646\u064a\u0629 \u0627\u0644\u0645\u062f\u0631\u0633\u064a\u0629.' },
  { id: 'vogler', name: 'Hero\u2019s Journey (12)', desc: 'Vogler / Campbell mythic 12 stages. Adventure, epic, fantasy.', ar: '\u0631\u062d\u0644\u0629 \u0627\u0644\u0628\u0637\u0644 (12)', arDesc: '\u0645\u0631\u0627\u062d\u0644 \u0641\u0648\u063a\u0644\u0631/\u0643\u0627\u0645\u0628\u0644 \u0627\u0644\u0623\u0633\u0637\u0648\u0631\u064a\u0629 \u0627\u0644\u064012. \u0645\u063a\u0627\u0645\u0631\u0629\u060c \u0645\u0644\u062d\u0645\u0629\u060c \u0641\u0627\u0646\u062a\u0627\u0632\u064a\u0627.' },
  { id: 'harmon', name: 'Story Circle (8)', desc: 'Dan Harmon 8-step character loop. Tight TV and character pieces.', ar: '\u062f\u0627\u0626\u0631\u0629 \u0627\u0644\u0642\u0635\u0629 (8)', arDesc: '\u062d\u0644\u0642\u0629 \u062f\u0627\u0646 \u0647\u0627\u0631\u0645\u0648\u0646 \u0627\u0644\u0634\u062e\u0635\u064a\u0629 \u0645\u0646 8 \u062e\u0637\u0648\u0627\u062a. \u0623\u0639\u0645\u0627\u0644 \u062a\u0644\u0641\u0632\u064a\u0648\u0646\u064a\u0629 \u0648\u0634\u062e\u0635\u064a\u0629 \u0645\u062d\u0643\u0645\u0629.' },
  { id: 'sequence8', name: '8-Sequence', desc: 'Eight 10-15 min sequences (film-school method). Propulsive plots.', ar: '\u0627\u0644\u062b\u0645\u0627\u0646\u064a \u0645\u062a\u062a\u0627\u0644\u064a\u0627\u062a', arDesc: '\u062b\u0645\u0627\u0646\u064a \u0645\u062a\u062a\u0627\u0644\u064a\u0627\u062a \u0645\u0646 10-15 \u062f\u0642\u064a\u0642\u0629 (\u0645\u0646\u0647\u062c \u0645\u062f\u0627\u0631\u0633 \u0627\u0644\u0633\u064a\u0646\u0645\u0627). \u062d\u0628\u0643\u0627\u062a \u062f\u0627\u0641\u0639\u0629.' },
  { id: 'hauge', name: 'Hauge Six-Stage', desc: 'Michael Hauge 6 stages and 5 turning points. Inner and outer journey.', ar: '\u0645\u0631\u0627\u062d\u0644 \u0647\u0648\u063a \u0627\u0644\u0633\u062a', arDesc: '\u0645\u0627\u064a\u0643\u0644 \u0647\u0648\u063a: 6 \u0645\u0631\u0627\u062d\u0644 \u06485 \u0646\u0642\u0627\u0637 \u062a\u062d\u0648\u0651\u0644. \u0631\u062d\u0644\u0629 \u062f\u0627\u062e\u0644\u064a\u0629 \u0648\u062e\u0627\u0631\u062c\u064a\u0629.' },
  { id: 'freytag', name: 'Freytag Pyramid (5-act)', desc: 'Exposition to climax to denouement. Tragedy and prestige drama.', ar: '\u0647\u0631\u0645 \u0641\u0631\u0627\u064a\u062a\u0627\u063a (5 \u0641\u0635\u0648\u0644)', arDesc: '\u0645\u0646 \u0627\u0644\u0639\u0631\u0636 \u0625\u0644\u0649 \u0627\u0644\u0630\u0631\u0648\u0629 \u0625\u0644\u0649 \u0627\u0644\u062d\u0644. \u0645\u0623\u0633\u0627\u0629 \u0648\u062f\u0631\u0627\u0645\u0627 \u0631\u0641\u064a\u0639\u0629.' },
  { id: 'kishotenketsu', name: 'Kish\u014dtenketsu (4-act)', desc: 'East-Asian 4-act driven by a twist, not conflict. Art-house, contemplative, non-Western.', ar: '\u0643\u064a\u0634\u0648\u062a\u0650\u0646\u0643\u0650\u062a\u0633\u0648 (4 \u0641\u0635\u0648\u0644)', arDesc: '\u0628\u0646\u064a\u0629 \u0634\u0631\u0642-\u0622\u0633\u064a\u0648\u064a\u0629 \u0645\u0646 4 \u0641\u0635\u0648\u0644 \u062a\u0642\u0648\u062f\u0647\u0627 \u0645\u0641\u0627\u062c\u0623\u0629 \u0644\u0627 \u0635\u0631\u0627\u0639. \u0641\u0646\u064a\u060c \u062a\u0623\u0645\u0644\u064a\u060c \u063a\u064a\u0631 \u063a\u0631\u0628\u064a.' },
  { id: 'truby', name: 'Truby 22 Steps', desc: 'John Truby deep moral and character architecture. Literary, complex scripts.', ar: '\u062e\u0637\u0648\u0627\u062a \u062c\u0648\u0646 \u062a\u0631\u064e\u0628\u064a \u0627\u0644\u064022', arDesc: '\u0628\u0646\u064a\u0629 \u062c\u0648\u0646 \u062a\u0631\u064e\u0628\u064a \u0627\u0644\u0623\u062e\u0644\u0627\u0642\u064a\u0629 \u0648\u0627\u0644\u0634\u062e\u0635\u064a\u0629 \u0627\u0644\u0639\u0645\u064a\u0642\u0629. \u0646\u0635\u0648\u0635 \u0623\u062f\u0628\u064a\u0629 \u0645\u0639\u0642\u0651\u062f\u0629.' },
  { id: 'story_spine', name: 'Pixar Story Spine', desc: 'Once upon a time... until finally. Simple, emotional, family / animation.', ar: '\u0639\u0645\u0648\u062f \u0642\u0635\u0629 \u0628\u064a\u0643\u0633\u0627\u0631', arDesc: '\u0643\u0627\u0646 \u064a\u0627 \u0645\u0627 \u0643\u0627\u0646... \u0648\u0623\u062e\u064a\u0631\u064b\u0627. \u0628\u0633\u064a\u0637\u060c \u0639\u0627\u0637\u0641\u064a\u060c \u0639\u0627\u0626\u0644\u064a/\u0631\u0633\u0648\u0645 \u0645\u062a\u062d\u0631\u0643\u0629.' },
  { id: 'tv_network', name: 'TV Network Hour', desc: 'Teaser plus 4-5 acts around ad breaks. Broadcast episodic.', ar: '\u0633\u0627\u0639\u0629 \u0627\u0644\u062a\u0644\u0641\u0632\u064a\u0648\u0646 \u0627\u0644\u0634\u0628\u0643\u064a', arDesc: '\u0645\u0642\u062f\u0645\u0629 \u062c\u0627\u0630\u0628\u0629 \u06484-5 \u0641\u0635\u0648\u0644 \u062d\u0648\u0644 \u0627\u0644\u0641\u0648\u0627\u0635\u0644 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u064a\u0629. \u062d\u0644\u0642\u0627\u062a \u0628\u062b\u0651.' },
  { id: 'limited', name: 'Limited Series', desc: 'Premise to finale arc across episodes. Prestige limited series.', ar: '\u0645\u0633\u0644\u0633\u0644 \u0645\u062d\u062f\u0648\u062f', arDesc: '\u0642\u0648\u0633 \u0645\u0646 \u0627\u0644\u0637\u0631\u062d \u0625\u0644\u0649 \u0627\u0644\u062e\u062a\u0627\u0645 \u0639\u0628\u0631 \u0627\u0644\u062d\u0644\u0642\u0627\u062a. \u0645\u0633\u0644\u0633\u0644 \u0645\u062d\u062f\u0648\u062f \u0631\u0641\u064a\u0639.' },
];
const LENSES: [string, string][] = [['fantasy', 'Fantasy'], ['horror', 'Horror'], ['folklore', 'Folklore'], ['myth', 'Myth'], ['crime', 'Crime'], ['romance', 'Romance & customs'], ['naming-dress', 'Naming & dress']];
const SUB_PRESENCE = ['Rarely', 'Occasionally', 'Balanced', 'Frequent', 'Constant'];
const SUB_INTENSITY = ['Subtle', 'Light', 'Moderate', 'Strong', 'Dominant'];
const GENRE_FAMS: { id: string; name: string; bring: string; presence: string[]; intensity: string[]; styles?: string[] }[] = [
  { id: 'comedy', name: 'Comedy & humour', bring: 'wit, gags, comic relief', presence: ['Rarely', 'Occasionally', 'Balanced', 'Frequent', 'Constant'], intensity: ['Subtle', 'Light', 'Moderate', 'Strong', 'Dominant'] },
  { id: 'action', name: 'Action & spectacle', bring: 'set-pieces, fights, chases', presence: ['Only When Required', 'Scene-Driven', 'Story-Driven', 'Frequent', 'Action-Centric'], intensity: ['Grounded', 'Moderate', 'High', 'Epic', 'Extreme'], styles: ['Hand-to-Hand Combat', 'Sword Fighting', 'Martial Arts', 'Military Combat', 'Gunfights', 'Tactical Operations', 'Large-Scale Battles', 'Chases & Pursuits', 'Vehicle Combat', 'Mixed Styles'] },
  { id: 'spy', name: 'Espionage & spycraft', bring: 'tradecraft, double-crosses', presence: ['Minimal', 'Occasional', 'Moderate', 'Significant', 'Core Story Element'], intensity: ['Realistic', 'Professional', 'High-Stakes', 'International', 'Mission Impossible / Bond Level'] },
  { id: 'horror', name: 'Horror & dread', bring: 'fear, dread, the unseen', presence: ['Rare', 'Occasional', 'Moderate', 'Frequent', 'Constant'], intensity: ['Uneasy', 'Suspenseful', 'Disturbing', 'Terrifying', 'Nightmare Fuel'] },
  { id: 'mystery', name: 'Mystery & investigation', bring: 'clues, reveals, deduction', presence: ['Light Mystery', 'Supporting Element', 'Balanced', 'Major Narrative Driver', 'Core Story Structure'], intensity: ['Straightforward', 'Layered', 'Complex', 'Highly Intricate', 'Puzzle Box'] },
  { id: 'drama', name: 'Drama & emotion', bring: 'character, feeling, theme', presence: ['Light Emotional Moments', 'Moderate', 'Balanced', 'Strong', 'Emotionally Driven'], intensity: ['Subtle', 'Moving', 'Powerful', 'Heartbreaking', 'Deeply Emotional'] },
  { id: 'scifi', name: 'Sci-fi & speculative', bring: 'tech, worlds, what-ifs', presence: ['Background Element', 'Supporting Concept', 'Balanced', 'Major Story Driver', 'World-Defining'], intensity: ['Near Future', 'Advanced Technology', 'High Sci-Fi', 'Extreme Speculative', 'Reality-Altering'] },
  { id: 'romance', name: 'Romance & intimacy', bring: 'love, longing, connection', presence: ['Light Subplot', 'Occasional', 'Balanced', 'Major Thread', 'Central Love Story'], intensity: ['Tender', 'Warm', 'Passionate', 'Yearning', 'All-Consuming'] },
  { id: 'thriller', name: 'Thriller & suspense', bring: 'tension, ticking clocks', presence: ['Occasional', 'Supporting', 'Balanced', 'Frequent', 'Relentless'], intensity: ['Tense', 'Gripping', 'High-Stakes', 'Nerve-Shredding', 'Unbearable'] },
  { id: 'language', name: 'Language & voice', bring: 'slang, dialect, diction', presence: ['Light Touch', 'Occasional', 'Balanced', 'Strong', 'Defining'], intensity: ['Naturalistic', 'Flavoured', 'Stylised', 'Heightened', 'Signature'] },
  { id: 'anime', name: 'Anime & stylisation', bring: 'shonen, isekai, mecha', presence: ['Light Influence', 'Occasional', 'Balanced', 'Strong', 'Defining'], intensity: ['Subtle', 'Stylised', 'Bold', 'Heightened', 'Full Anime'] },
];
const ROLES: [string, string][] = [
  ['PROTAGONIST', 'Protagonist'],
  ['ANTAGONIST', 'Antagonist'],
  ['ALLY', 'Ally'],
  ['MENTOR', 'Guide / Mentor'],
  ['LOVE_INTEREST', 'Love Interest'],
  ['WORLD_SYSTEM', 'World-System'],
  ['OBSTACLE', 'Obstacle'],
  ['OBSTACLE_TURNS_ALLY', 'Obstacle turns ally'],
  ['RIVAL', 'Rival'],
  ['KINGMAKER', 'Kingmaker'],
  ['OMEN', 'Omen'],
  ['CATALYST', 'Catalyst'],
  ['GATEKEEPER', 'Gatekeeper'],
  ['SHADOW', 'Shadow'],
  ['TRICKSTER', 'Trickster'],
  ['GUARDIAN', 'Guardian'],
  ['HERALD', 'Herald'],
];
const DSTOPS = ['OFF', 'ACCENT', 'SUBPLOT', 'WOVEN', 'DRIVER', 'SATURATED'];
const DNOTE: any = { OFF: 'No lore layer.', ACCENT: 'Lore stays flavour - a few beats and images. No scene turns on it; the ending would still work without it.', SUBPLOT: 'Lore powers a B-story or recurring motif. The A-plot stays grounded.', WOVEN: 'Lore is a world-rule; the midpoint turns on it. Remove it and you lose real plot, not just colour.', DRIVER: 'Lore is the engine - inciting, midpoint and climax turn on it. Grounded realism becomes the contrast.', SATURATED: 'Full mythic mode - the world runs on the lore end to end; realism is the accent.' };
const ARLABEL: any = { 'shapeshifter': 'Shapeshifters', 'death-omen': 'Death-omens', 'blood-drinker': 'Blood-drinkers & undead', 'trickster': 'Tricksters', 'guardian': 'Guardians & spirits', 'world-system': 'World-systems', 'beast': 'Beasts', 'undead': 'Undead', 'spirit': 'Spirits', 'underworld': 'Underworld', 'custom': 'Customs', 'wardrobe': 'Wardrobe', 'naming': 'Naming', 'omen': 'Omens' };
const ARORDER = ['shapeshifter', 'death-omen', 'blood-drinker', 'trickster', 'guardian', 'world-system', 'beast', 'undead', 'spirit', 'underworld', 'custom', 'wardrobe', 'naming', 'omen'];
const FALLBACK: any[] = [
  { slug: 'djinn', name: 'Djinn', culture: 'Arabian', genres: ['fantasy', 'folklore'], archetypes: ['world-system', 'shapeshifter'], tier: 'SACRED_AWARE', blurb: 'Fire-born spirits that shapeshift, bargain, and possess - at a cost.' },
  { slug: 'ghoul', name: 'Ghoul', culture: 'Arabian', genres: ['horror', 'folklore'], archetypes: ['shapeshifter'], tier: 'FOLKLORE', blurb: 'Desert shapeshifter that lures travellers off the road.' },
  { slug: 'marid', name: 'Marid', culture: 'Arabian', genres: ['fantasy', 'folklore'], archetypes: ['world-system'], tier: 'SACRED_AWARE', blurb: 'The mightiest jinn - sea-born, granting wishes for a price.' },
  { slug: 'qarin', name: 'Qarin', culture: 'Arabian', genres: ['fantasy', 'folklore'], archetypes: ['omen', 'spirit'], tier: 'SACRED_AWARE', blurb: 'A spirit-double that shadows a person and whispers.' },
  { slug: 'amaliq', name: 'Amalekites (ʿAmāliqah)', culture: 'Arabian', genres: ['folklore', 'fantasy'], archetypes: ['world-system', 'beast'], tier: 'FOLKLORE', blurb: 'A primeval nation of giants (from ʿimlāq, "giant") said to have ruled ancient Arabia before vanishing — kin to ʿĀd and Thamūd.' },
];

const LANGUAGES = ['Arabic (Modern Standard)', 'Arabic (Gulf / Khaleeji)', 'Arabic (Egyptian)', 'Arabic (Levantine)', 'Arabic (Maghrebi)', 'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Mandarin Chinese', 'Cantonese', 'Hindi', 'Urdu', 'Bengali', 'Tamil', 'Telugu', 'Japanese', 'Korean', 'Turkish', 'Persian (Farsi)', 'Russian', 'Indonesian', 'Malay', 'Thai', 'Vietnamese', 'Tagalog / Filipino', 'Swahili', 'Hausa', 'Yoruba', 'Amharic', 'Hebrew', 'Greek', 'Polish', 'Dutch', 'Swedish', 'Ukrainian', 'Romanian', 'Other'];
const MARKETS = ['Global / International', 'GCC / Gulf', 'Saudi Arabia (KSA)', 'United Arab Emirates (UAE)', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Egypt', 'Pan-Arab / MENA', 'Levant', 'North Africa', 'United States', 'Canada', 'United Kingdom & Ireland', 'France', 'Germany', 'Spain', 'Italy', 'Nordics', 'Latin America', 'Mexico', 'Brazil', 'India', 'China', 'Japan', 'South Korea', 'Southeast Asia', 'Indonesia', 'Turkey', 'Iran', 'Sub-Saharan Africa', 'Nigeria', 'Australia & New Zealand', 'Other'];
const RATINGS = ['Family / all ages', 'Teen (13+)', 'Mature (16+)', 'Adult (18+)', 'UAE \u00b7 G', 'UAE \u00b7 PG', 'UAE \u00b7 PG13', 'UAE \u00b7 PG15', 'UAE \u00b7 15+', 'UAE \u00b7 18+', 'UAE \u00b7 21+', 'KSA \u00b7 G', 'KSA \u00b7 PG', 'KSA \u00b7 PG12', 'KSA \u00b7 PG15', 'KSA \u00b7 R15', 'KSA \u00b7 R18', 'US film \u00b7 G', 'US film \u00b7 PG', 'US film \u00b7 PG-13', 'US film \u00b7 R', 'US film \u00b7 NC-17', 'US TV \u00b7 TV-Y', 'US TV \u00b7 TV-Y7', 'US TV \u00b7 TV-G', 'US TV \u00b7 TV-PG', 'US TV \u00b7 TV-14', 'US TV \u00b7 TV-MA', 'UK \u00b7 U', 'UK \u00b7 PG', 'UK \u00b7 12A', 'UK \u00b7 12', 'UK \u00b7 15', 'UK \u00b7 18', 'Australia \u00b7 G', 'Australia \u00b7 PG', 'Australia \u00b7 M', 'Australia \u00b7 MA15+', 'Australia \u00b7 R18+', 'Germany (FSK) \u00b7 0', 'Germany (FSK) \u00b7 6', 'Germany (FSK) \u00b7 12', 'Germany (FSK) \u00b7 16', 'Germany (FSK) \u00b7 18', 'France \u00b7 Tous publics', 'France \u00b7 -12', 'France \u00b7 -16', 'France \u00b7 -18'];

function Combo({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const fld: React.CSSProperties = { width: '100%', background: '#0b0c0f', border: '1px solid ' + C.hair, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13 };
  const filtered = options.filter((o) => !q || o.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen((o) => !o)} style={{ ...fld, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}><span style={{ color: value ? C.text : C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || placeholder}</span><span style={{ color: C.faint, marginLeft: 8 }}>▾</span></div>
      {open ? (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, background: '#0e1014', border: '1px solid ' + C.hair, borderRadius: 10, maxHeight: 240, overflow: 'auto', boxShadow: '0 14px 36px rgba(0,0,0,.55)' }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onClick={(e) => e.stopPropagation()} placeholder={t('Search...')} style={{ ...fld, border: 'none', borderBottom: '1px solid ' + C.hair, borderRadius: 0, position: 'sticky', top: 0 }} />
          {filtered.slice(0, 300).map((o) => (<div key={o} onClick={() => { onChange(o); setOpen(false); setQ(''); }} style={{ padding: '8px 12px', fontSize: 12.5, color: o === value ? C.gold2 : C.text, background: o === value ? 'rgba(198,164,99,.1)' : 'transparent', cursor: 'pointer' }}>{o}</div>))}
          {filtered.length === 0 && q ? (<div onClick={() => { onChange(q); setOpen(false); setQ(''); }} style={{ padding: '8px 12px', fontSize: 12.5, color: C.gold2, cursor: 'pointer' }}>{t('Use')} \u201c{q}\u201d</div>) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ScriptOnIntake({ projectId, busy, onBegin, onClose }: { projectId: string | null; busy?: boolean; onBegin: (form: any) => void; onClose: () => void }) {
  const { dir, t, locale } = useLocale();
  const [f, setF] = useState<any>({ mode: 'ADAPT', sourceText: '', realBased: true, realityLevel: 'INSPIRED', researchSubject: true, researchAmount: 55, genres: [], baseGenre: '', baseGenres: [], subgenre: '', subMix: {}, styles: [], styleMix: {}, blendLayers: [], tones: [], moods: [], treatment: '', settingCountry: '', settingEra: '', settingWorld: [], cultureEra: '', settingPlace: [], projectIntent: '', budgetTier: '', tone: '', framework: '', projectType: 'MOVIE', episodes: 10, minutesPerEp: 50, seasons: 1, loreSelections: [], loreDensity: 'ACCENT', lorePolicy: { allowHistoricalPantheon: false }, format: '', language: '', country: '', rating: '', researchScope: { subject: true, craft: true, mythology: true, comps: true, legal: true, general: true }, researchDepth: 60 });
  const [step, setStep] = useState(1);
  const [pastes, setPastes] = useState<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [upl, setUpl] = useState('');
  const [layerOn, setLayerOn] = useState(false);
  const [fwInfo, setFwInfo] = useState(false);
  const [genreOpen, setGenreOpen] = useState(false);
  const [endInfo, setEndInfo] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const savedDraftRef = useRef<any>(null);
  const firstSave = useRef(true);
  const draftKey = () => 'scripon.intakeDraft.' + projectId;
  const resumeDraft = () => { const d = savedDraftRef.current; if (!d) return; if (d.f && typeof d.f === 'object') setF(d.f); if (Array.isArray(d.pastes)) setPastes(d.pastes); if (Array.isArray(d.urls)) setUrls(d.urls); if (Array.isArray(d.files)) setFiles(d.files); if (typeof d.layerOn === 'boolean') setLayerOn(d.layerOn); if (d.step) setStep(d.step); setDraftAvailable(false); };
  const discardDraft = () => { try { if (projectId && typeof window !== 'undefined') window.localStorage.removeItem(draftKey()); } catch { /* */ } savedDraftRef.current = null; setDraftAvailable(false); };
  const { requestClose, guard } = useExitGuard(onClose, { dirty: () => !!((f.sourceText && f.sourceText.trim()) || pastes.length || urls.length || files.length || (f.name && String(f.name).trim()) || layerOn), title: t('Leave this build?'), body: t('Your in-progress form will close. It is auto-saved as a draft, so you can Resume it next time you open New Build.') });
  const [lenses, setLenses] = useState<string[]>(['fantasy']);
  const [atlasMode, setAtlasMode] = useState('culture');
  const [culture, setCulture] = useState('Arabian');
  const [q, setQ] = useState('');
  const [lib, setLib] = useState<any[]>([]);
  const [openEl, setOpenEl] = useState<any>(null);
  const vp = useViewport(); const narrow = vp !== 'desktop';

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  // Apply a series-type preset → fill episodes / min-per-ep / seasons + marketKey from the template.
  const applyPreset = (s: SeriesPreset) => setF((p: any) => ({ ...p, seriesPreset: s.key, marketKey: (s.key === 'VERTICAL' && locale === 'ar') ? 'MENA' : s.marketKey, episodes: s.episodes, minutesPerEp: s.minutesPerEp, seasons: s.seasons }));
  // Editing any episode/duration field means the template no longer matches → Custom (and let the backend infer market).
  const setManual = (k: string, v: number) => setF((p: any) => ({ ...p, [k]: v, seriesPreset: 'CUSTOM', marketKey: undefined }));
  const composeEnding = (ids: string[], custom?: string) => { const parts = ids.map((id) => { const en = ENDING_TYPES.find((x) => x.id === id); return en ? (en.label + ' \u2014 ' + en.desc) : id; }); if (custom && custom.trim()) parts.push('Custom: ' + custom.trim()); return parts.join('  +  '); };
  const endIds = (): string[] => ((f.spine && f.spine.endingIds) || []);
  const toggleEnding = (id: string) => setF((p: any) => { const sp: any = { ...(p.spine || {}) }; const cur: string[] = (sp.endingIds || []).slice(); const k = cur.indexOf(id); if (k >= 0) cur.splice(k, 1); else { if (cur.length >= 2) return p; cur.push(id); } sp.endingIds = cur; sp.ending = composeEnding(cur, sp.endingCustom); return { ...p, spine: sp }; });
  const setEndingCustom = (txt: string) => setF((p: any) => { const sp: any = { ...(p.spine || {}) }; sp.endingCustom = txt; sp.ending = composeEnding(sp.endingIds || [], txt); return { ...p, spine: sp }; });
  const toggleArr = (k: string, v: string) => setF((p: any) => ({ ...p, [k]: (p[k] || []).includes(v) ? p[k].filter((x: string) => x !== v) : [...(p[k] || []), v] }));
  // ── Creative-DNA taxonomy (mirrors the knowledge engine; derives genres[]/tone + setting for back-compat & steering) ──
  const reDna = (n: any) => { const bg: string[] = (Array.isArray(n.baseGenres) && n.baseGenres.length ? n.baseGenres : (n.baseGenre ? [n.baseGenre] : [])).slice(0, 3); const subs = Object.keys(n.subMix || {}); return { ...n,
    baseGenres: bg,
    baseGenre: bg[0] || '',
    subgenre: subs[0] || '',
    genres: [...bg, ...(n.blendLayers || [])].filter(Boolean),
    tone: ([] as string[]).concat(n.tones || [], (n.moods || []).map((m: string) => m + ' mood')).join(', '),
    settingPlace: n.settingCountry ? [n.settingCountry] : [],
    cultureEra: [n.settingCountry, n.settingEra].filter(Boolean).join(' · '),
  }; };
  // Base genre — up to 3 (Creative DNA). Each chosen subgenre carries presence ("how much") + intensity ("how strong") sliders.
  const pickBase = (label: string) => setF((p: any) => { const cur: string[] = (Array.isArray(p.baseGenres) && p.baseGenres.length ? p.baseGenres : (p.baseGenre ? [p.baseGenre] : [])).slice(); const i = cur.indexOf(label); if (i >= 0) cur.splice(i, 1); else { if (cur.length >= 3) return p; cur.push(label); } return reDna({ ...p, baseGenres: cur }); });
  const allSubsFor = (bg: string[]): string[] => { const seen = new Set<string>(); const out: string[] = []; (bg || []).forEach((label) => subgenresForLabel(label).forEach((s) => { if (!seen.has(s)) { seen.add(s); out.push(s); } })); return out; };
  const subToggle = (s: string) => setF((p: any) => { const mix: any = { ...(p.subMix || {}) }; if (mix[s]) delete mix[s]; else mix[s] = { p: 2, ii: 2 }; return reDna({ ...p, subMix: mix }); });
  const subSlide = (s: string, key: 'p' | 'ii', val: number) => setF((p: any) => { const mix: any = { ...(p.subMix || {}) }; mix[s] = { ...(mix[s] || { p: 2, ii: 2 }), [key]: val }; return reDna({ ...p, subMix: mix }); });
  // Style & Voice — optional, up to 2 craft voices each with a strength slider. Off by default; steers HOW, never WHAT.
  const styleToggle = (id: string) => setF((p: any) => { const cur: string[] = (p.styles || []).slice(); const i = cur.indexOf(id); if (i >= 0) cur.splice(i, 1); else { if (cur.length >= 2) return p; cur.push(id); } const mix: any = { ...(p.styleMix || {}) }; if (i < 0 && mix[id] == null) mix[id] = 2; return { ...p, styles: cur, styleMix: mix }; });
  const styleSlide = (id: string, val: number) => setF((p: any) => ({ ...p, styleMix: { ...(p.styleMix || {}), [id]: val } }));
  const toggleTax = (k: string, v: string) => setF((p: any) => { const cur = p[k] || []; return reDna({ ...p, [k]: cur.includes(v) ? cur.filter((x: string) => x !== v) : [...cur, v] }); });
  const setTax = (k: string, v: any) => setF((p: any) => reDna({ ...p, [k]: v }));
  const onFile = async (file?: File | null) => { if (!file) return; setUpl(t('Uploading...')); try { const up = await uploadFile(file); setFiles((a) => [...a, { name: up.originalName || 'file', url: up.url }]); setUpl(''); } catch { setUpl(t('Upload failed')); } };

  useEffect(() => { if (f.mode === 'ORIGINAL') setStep(2); }, [f.mode]);
  // When a series format is chosen, default the type-preset by locale/market so the first view is
  // meaningful (no bare 10×50) — unless the user already picked one valid for this type or went Custom.
  useEffect(() => {
    if (SERIES_TYPES.indexOf(f.projectType) < 0) return;
    if (f.seriesPreset === 'CUSTOM' || seriesPresetsFor(f.projectType).some((s) => s.key === f.seriesPreset)) return;
    const def = SERIES_PRESETS.find((s) => s.key === defaultPresetKey(f.projectType, locale === 'ar'));
    if (def) applyPreset(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.projectType, locale]);
  useEffect(() => {
    if (!projectId || typeof window === 'undefined') return;
    try { const raw = window.localStorage.getItem('scripon.intakeDraft.' + projectId); if (raw) { const d = JSON.parse(raw); if (d && d.f && typeof d.f === 'object') { savedDraftRef.current = d; setDraftAvailable(true); } } } catch { /* */ }
  }, [projectId]);
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    if (!projectId || typeof window === 'undefined') return;
    try {
      const meaningful = (f.sourceText && f.sourceText.trim()) || pastes.length || urls.length || files.length || (f.name && String(f.name).trim()) || layerOn;
      if (meaningful) window.localStorage.setItem('scripon.intakeDraft.' + projectId, JSON.stringify({ f, pastes, urls, files, layerOn, step }));
    } catch { /* */ }
  }, [f, pastes, urls, files, layerOn, step, projectId]);
  useEffect(() => {
    if (!layerOn) return;
    let live = true;
    productionApi.scripton.lore({ pantheon: f.lorePolicy.allowHistoricalPantheon ? '1' : '' })
      .then((r: any) => { if (live) setLib(Array.isArray(r.data) && r.data.length ? r.data : FALLBACK); })
      .catch(() => { if (live) setLib(FALLBACK); });
    return () => { live = false; };
  }, [layerOn, f.lorePolicy.allowHistoricalPantheon]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (lib || []).filter((r: any) => {
      const g = r.genres || [];
      const lensOk = !lenses.length || g.length === 0 || g.some((x: string) => lenses.includes(x));
      const termOk = !term || [r.name, r.blurb, r.culture].concat(r.aliases || [], r.archetypes || []).join(' ').toLowerCase().includes(term);
      return lensOk && termOk;
    });
  }, [lib, q, lenses]);
  const cultures = useMemo(() => Array.from(new Set((lib || []).map((r: any) => r.culture))), [lib]);
  const byCulture = useMemo(() => filtered.filter((r: any) => r.culture === culture), [filtered, culture]);
  const byArche = useMemo(() => { const g: any = {}; filtered.forEach((r: any) => (r.archetypes || []).forEach((a: string) => { (g[a] = g[a] || []).push(r); })); return g; }, [filtered]);

  const selected = (slug: string) => (f.loreSelections || []).some((s: any) => s.slug === slug);
  const toggleSel = (el: any) => setF((p: any) => { const has = (p.loreSelections || []).some((s: any) => s.slug === el.slug); return { ...p, loreSelections: has ? p.loreSelections.filter((s: any) => s.slug !== el.slug) : [...(p.loreSelections || []), { slug: el.slug, name: el.name, culture: el.culture, tier: el.tier, role: 'OBSTACLE', weight: 2, genre: (el.genres && el.genres[0]) || (lenses[0] || 'fantasy') }] }; });
  const setSel = (slug: string, k: string, v: any) => setF((p: any) => ({ ...p, loreSelections: (p.loreSelections || []).map((s: any) => s.slug === slug ? { ...s, [k]: v } : s) }));
  const toggleLens = (k: string) => setLenses((p) => p.includes(k) ? (p.length > 1 ? p.filter((x) => x !== k) : p) : [...p, k]);
  const gi = (): any => (((f.lorePolicy || {}).genreIntensity) || {});
  const giOn = (id: string) => !!gi()[id];
  const giDef: any = { p: 2, ii: 2, inf: 50, manualInf: false, styles: [] };
  const giWrite = (next: any) => set('lorePolicy', { ...f.lorePolicy, genreIntensity: next });
  const giToggle = (id: string) => { const fam: any = GENRE_FAMS.find((x) => x.id === id) || {}; const cur = { ...gi() }; if (cur[id]) delete cur[id]; else cur[id] = { p: 2, ii: 2, inf: 50, manualInf: false, styles: [], name: fam.name, presenceLabel: (fam.presence || [])[2], intensityLabel: (fam.intensity || [])[2] }; giWrite(cur); };
  const giSlide = (id: string, key: string, val: number) => { const fam: any = GENRE_FAMS.find((x) => x.id === id) || {}; const cur = gi(); const g: any = { ...(cur[id] || giDef), [key]: val, name: fam.name }; if (!g.manualInf) g.inf = Math.round(((g.p + g.ii) / 8) * 100); g.presenceLabel = (fam.presence || [])[g.p]; g.intensityLabel = (fam.intensity || [])[g.ii]; giWrite({ ...cur, [id]: g }); };
  const giSet = (id: string, patch: any) => { const cur = gi(); giWrite({ ...cur, [id]: { ...(cur[id] || giDef), ...patch } }); };
  const giStyle = (id: string, st: string) => { const cur = gi(); const g: any = cur[id] || giDef; const arr = (g.styles || []).slice(); const k = arr.indexOf(st); if (k >= 0) arr.splice(k, 1); else arr.push(st); giWrite({ ...cur, [id]: { ...g, styles: arr } }); };

  const begin = () => {
    if (!f.name || !String(f.name).trim()) return;
    const aggregate = [f.sourceText].concat(pastes).filter((x) => x && x.trim()).join('\n\n');
    const sources = ([] as any[])
      .concat(pastes.filter((x) => x && x.trim()).map((v) => ({ kind: 'paste', value: v })))
      .concat(urls.filter((u) => u && u.trim()).map((v) => ({ kind: 'url', value: v })))
      .concat(files.map((x) => ({ kind: 'file', name: x.name, value: x.url })));
    const isSeries = SERIES_TYPES.indexOf(f.projectType) >= 0;
    const framework = f.framework || smartFramework(f.projectType, f.genres);
    // Keep the draft here. It is cleared by the Studio ONLY once the build truly succeeds (directions generated),
    // so a mid-build failure (AI/credits/network) leaves the form intact and the user can return to Adapt & Build and Resume.
    onBegin({ ...f, episodes: isSeries ? f.episodes : null, minutesPerEp: isSeries ? f.minutesPerEp : null, seasons: isSeries ? f.seasons : null, framework, sourceText: aggregate, sources, sourceUrl: urls[0] || '', sourceFileUrl: files[0] ? files[0].url : '' });
  };

  const band: React.CSSProperties = { border: '1px solid ' + C.hair, borderRadius: 14, padding: 16, marginBottom: 12, background: C.band };
  const bandLit: React.CSSProperties = { ...band, borderColor: 'rgba(198,164,99,.4)' };
  const lab: React.CSSProperties = { fontSize: 11, color: C.faint, fontWeight: 600, margin: '10px 0 5px' };
  const bt: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: C.cream };
  const field: React.CSSProperties = { width: '100%', background: '#0b0c0f', border: '1px solid ' + C.hair, borderRadius: 10, padding: '10px 12px', color: C.text, fontSize: 13 };
  const chip = (on: boolean, color?: string): React.CSSProperties => ({ fontSize: 12, fontWeight: 600, color: on ? (color || C.gold2) : C.mut, background: on ? (color ? color + '22' : 'rgba(198,164,99,.16)') : '#171a20', border: '1px solid ' + (on ? (color ? color + '66' : 'rgba(198,164,99,.4)') : C.hair), borderRadius: 999, padding: '6px 12px', cursor: 'pointer', display: 'inline-block' });
  const Toggle = ({ on, onClick, children }: any) => (<span onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: C.text }}><span style={{ width: 34, height: 19, borderRadius: 999, background: on ? 'linear-gradient(180deg,' + C.gold2 + ',' + C.gold + ')' : '#23262e', border: '1px solid ' + C.hair, position: 'relative', flex: 'none' }}><i style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 13, height: 13, borderRadius: '50%', background: on ? C.ink : '#0b0c0f', transition: '.15s' }} /></span>{children}</span>);
  const slider = (k: string) => (<input type="range" min={0} max={100} value={f[k]} onChange={(e) => set(k, Number(e.target.value))} style={{ width: '100%', accentColor: C.gold }} />);

  const Pills = (<div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 700 }}>
    <span style={{ color: step === 1 ? C.gold2 : C.faint }}>{t('1 - Work source')}</span><span style={{ color: C.faint }}>{dir === 'rtl' ? '<' : '>'}</span><span style={{ color: step === 2 ? C.gold2 : C.faint }}>{t('2 - Brief')}</span>
  </div>);

  // ---- element card ----
  const Card = (el: any) => (
    <div key={el.slug} style={{ border: '1px solid ' + (selected(el.slug) ? 'rgba(198,164,99,.55)' : C.hair), background: selected(el.slug) ? 'rgba(198,164,99,.09)' : '#171a20', borderRadius: 11, padding: '10px 11px', cursor: 'pointer', position: 'relative' }} onClick={() => toggleSel(el)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.cream }}>{el.name}</div>
        <span onClick={(e) => { e.stopPropagation(); setOpenEl(el); }} style={{ fontSize: 11, color: C.faint, border: '1px solid ' + C.hair, borderRadius: 5, width: 18, height: 18, lineHeight: '16px', textAlign: 'center', flex: 'none' }}>i</span>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: .4, color: C.gold, textTransform: 'uppercase', margin: '2px 0 4px' }}>{el.culture}</div>
      <div style={{ fontSize: 10.5, color: C.mut, lineHeight: 1.4 }}>{el.blurb}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
        {el.tier === 'SACRED_AWARE' ? <span style={{ fontSize: 8.5, fontWeight: 700, color: '#f0c38f', background: 'rgba(229,160,95,.14)', borderRadius: 4, padding: '2px 5px' }}>{t('sacred-aware')}</span> : null}
        {el.tier === 'CARE' ? <span style={{ fontSize: 8.5, fontWeight: 700, color: '#e9a8a6', background: 'rgba(229,99,95,.14)', borderRadius: 4, padding: '2px 5px' }}>{t('care')}</span> : null}
        {(el.genres || []).includes('horror') ? <span style={{ fontSize: 8.5, fontWeight: 700, color: '#c3b6f5', background: 'rgba(139,124,240,.12)', borderRadius: 4, padding: '2px 5px' }}>{t('horror')}</span> : null}
      </div>
    </div>
  );

  const densIdx = DSTOPS.indexOf(f.loreDensity);
  const densColor = densIdx <= 1 ? C.green : densIdx <= 3 ? C.amber : C.red;

  return (
    <div dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 75, background: C.scrim, overflow: 'auto', fontFamily: 'var(--sx-body)' }}>
      {guard}
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '26px 18px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: C.gold, textTransform: 'uppercase' }}>{t('ScriptON - New Build')}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.cream, marginTop: 4 }}>{t('Adapt and build')}</div>
            <div style={{ fontSize: 13, color: C.mut }}>{t('Everything here steers the ladder.')} {projectId ? '' : t('Connect a project first.')}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{Pills}<button onClick={requestClose} style={{ background: 'transparent', border: '1px solid ' + C.hair, color: C.mut, borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>{t('Close')}</button></div>
        </div>

        <div style={{ marginBottom: 14 }}><div style={lab}>{t('Project / build title')} <span style={{ color: C.red }}>*</span></div><input value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder={t('Name this build - e.g. Antara, mythic cut')} style={{ ...field, fontSize: 15, fontWeight: 600, borderColor: (f.name && String(f.name).trim()) ? undefined : 'rgba(229,99,95,.6)' }} />{!(f.name && String(f.name).trim()) ? <div style={{ fontSize: 11, color: C.red, marginTop: 5 }}>{t('Required — name your build so you can find and reopen it on the Builds board.')}</div> : null}</div>
        <div style={{ display: 'inline-flex', background: '#171a20', border: '1px solid ' + C.hair, borderRadius: 10, padding: 3, gap: 2, marginBottom: 14 }}>
          {[['ADAPT', 'Adapt material'], ['ORIGINAL', 'From scratch']].map(([k, l]) => (
            <span key={k} onClick={() => { set('mode', k); setStep(k === 'ORIGINAL' ? 2 : 1); }} style={{ fontSize: 12, fontWeight: 600, color: f.mode === k ? C.gold2 : C.mut, background: f.mode === k ? 'rgba(198,164,99,.16)' : 'transparent', padding: '5px 12px', borderRadius: 8, cursor: 'pointer' }}>{t(l)}</span>
          ))}
        </div>

        {draftAvailable ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(198,164,99,.10)', border: '1px solid rgba(198,164,99,.35)', borderRadius: 10, padding: '9px 12px', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: C.cream, flex: 1 }}>{t('You left an unsaved build draft. Resume it, or start fresh.')}</span>
            <button onClick={resumeDraft} style={{ background: 'linear-gradient(180deg,' + C.gold2 + ',' + C.gold + ')', color: C.ink, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('Resume')}</button>
            <button onClick={discardDraft} style={{ background: 'transparent', color: C.mut, border: '1px solid ' + C.hair, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>{t('Discard')}</button>
          </div>
        ) : null}
        {step === 1 ? (
          <div>
              <div style={bandLit}>
                <div style={bt}>{t('Work source')} <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .5, color: C.gold, marginInlineStart: 8 }}>{t('MAIN PASTE BOX')}</span></div>
                <textarea value={f.sourceText} onChange={(e) => set('sourceText', e.target.value)} placeholder={t('Paste the primary work - synopsis, excerpt, chapter, or article...')} style={{ ...field, minHeight: 100, resize: 'none', marginTop: 8 }} />
                {pastes.map((p, i) => (
                  <div key={i} style={{ marginTop: 8, position: 'relative' }}>
                    <textarea value={p} onChange={(e) => setPastes((a) => a.map((x, j) => j === i ? e.target.value : x))} placeholder={t('Additional passage') + ' ' + (i + 1) + '...'} style={{ ...field, minHeight: 64, resize: 'none' }} />
                    <span onClick={() => setPastes((a) => a.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 6, insetInlineEnd: 8, color: C.faint, cursor: 'pointer', fontSize: 13 }}>x</span>
                  </div>
                ))}
                {urls.map((u, i) => (
                  <div key={'u' + i} style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                    <input value={u} onChange={(e) => setUrls((a) => a.map((x, j) => j === i ? e.target.value : x))} placeholder={t('Website article or URL...')} style={field} />
                    <span onClick={() => setUrls((a) => a.filter((_, j) => j !== i))} style={{ color: C.faint, cursor: 'pointer', fontSize: 13 }}>x</span>
                  </div>
                ))}
                {files.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{files.map((x, i) => <span key={i} style={{ fontSize: 11, color: C.green, border: '1px solid ' + C.hair, borderRadius: 8, padding: '4px 8px' }}>{x.name} <span onClick={() => setFiles((a) => a.filter((_, j) => j !== i))} style={{ color: C.faint, cursor: 'pointer' }}>x</span></span>)}</div> : null}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ ...chip(false), borderStyle: 'dashed' }} onClick={() => setPastes((a) => [...a, ''])}>{t('+ Add paste box')}</span>
                  <label style={{ ...chip(false), borderStyle: 'dashed', cursor: 'pointer' }}>{t('+ Add file(s)')}<input type="file" accept=".pdf,.fdx,.fountain,.txt,.docx,.epub,.html" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} /></label>
                  <span style={{ ...chip(false), borderStyle: 'dashed' }} onClick={() => setUrls((a) => [...a, ''])}>{t('+ Add website / URL')}</span>
                  {upl ? <span style={{ fontSize: 11.5, color: C.green }}>{upl}</span> : null}
                </div>
                <div style={{ fontSize: 10.5, color: C.faint, marginTop: 8 }}>{t('Accepts PDF, FDX, Fountain, Word, EPUB, HTML - one file or many.')}</div>
              </div>
            <button disabled={!projectId || !(f.name && String(f.name).trim())} onClick={() => setStep(2)} style={{ width: '100%', height: 46, border: 'none', borderRadius: 12, background: 'linear-gradient(180deg,' + C.gold2 + ',' + C.gold + ')', color: C.ink, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: (projectId && f.name && String(f.name).trim()) ? 1 : 0.6 }}>{(f.name && String(f.name).trim()) ? (t('Next - Brief') + ' ' + (dir === 'rtl' ? '<' : '>')) : t('Name your build to continue')}</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 300px', gap: 14 }}>
            <div>
              {f.mode !== 'ORIGINAL' ? <div style={{ marginBottom: 10 }}><span onClick={() => setStep(1)} style={{ fontSize: 12, color: C.mut, border: '1px solid ' + C.hair, borderRadius: 9, padding: '6px 11px', cursor: 'pointer' }}>{dir === 'rtl' ? '>' : '<'} {t('Back to source')}</span></div> : null}

              <div style={bandLit}>
                <div style={bt}>{t('Project type')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 7, marginTop: 8 }}>
                  {PTYPES.map(([k, l, h]) => (
                    <div key={k} onClick={() => set('projectType', k)} style={{ border: '1px solid ' + (f.projectType === k ? 'rgba(198,164,99,.5)' : C.hair), background: f.projectType === k ? 'rgba(198,164,99,.1)' : '#171a20', borderRadius: 10, padding: '9px 8px', textAlign: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: f.projectType === k ? C.gold2 : C.cream }}>{t(l)}</div>
                      <div style={{ fontSize: 9, color: C.faint, marginTop: 1 }}>{t(h)}</div>
                    </div>
                  ))}
                </div>
                {(f.projectType === 'TV_SERIES' || f.projectType === 'VERTICAL' || f.projectType === 'LIMITED') ? (
                  <div style={{ marginTop: 10, border: '1px solid rgba(198,164,99,.3)', borderRadius: 10, padding: 11, background: 'rgba(198,164,99,.05)' }}>
                    <div style={{ ...lab, marginBottom: 6 }}>{t('Series type')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {seriesPresetsFor(f.projectType).map((s) => (
                        <span key={s.key} onClick={() => applyPreset(s)} style={chip(f.seriesPreset === s.key)}>{(locale === 'ar' ? s.labelAr : s.label) + ' · ' + s.episodes + ' ' + t('ep') + ' × ~' + s.minutesPerEp + ' ' + t('min')}</span>
                      ))}
                      <span onClick={() => setF((p: any) => ({ ...p, seriesPreset: 'CUSTOM', marketKey: undefined }))} style={chip(f.seriesPreset === 'CUSTOM')}>{t('Custom')}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
                      <div><div style={lab}>{t('Episodes')}</div><input type="number" value={f.episodes} onChange={(e) => setManual('episodes', Number(e.target.value))} style={field} /></div>
                      <div><div style={lab}>{t('Minutes / ep')}</div><input type="number" value={f.minutesPerEp} onChange={(e) => setManual('minutesPerEp', Number(e.target.value))} style={field} /></div>
                      <div><div style={lab}>{t('Seasons')}</div><input type="number" value={f.seasons} onChange={(e) => setManual('seasons', Number(e.target.value))} style={field} /></div>
                    </div>
                    <div style={{ fontSize: 10, color: C.faint, marginTop: 7 }}>{t('Pick a template, then tweak the numbers — editing switches to Custom. Country/market below is the cultural setting, not the format.')}</div>
                  </div>
                ) : null}
              </div>

              {f.mode === 'ADAPT' ? (
                <div style={bandLit}>
                  <div style={bt}>{t('Grounding in reality')}</div>
                  <div style={{ marginTop: 8 }}><Toggle on={f.realBased} onClick={() => set('realBased', !f.realBased)}>{t('Based on a real story / person')}</Toggle></div>
                  {f.realBased ? (<>
                    <div style={lab}>{t('How faithful vs invented')}</div>
                    <div style={{ display: 'flex', gap: 7 }}>{[['FAITHFUL', 'Faithful'], ['INSPIRED', 'Inspired-by'], ['LOOSE', 'Loosely']].map(([k, l]) => <span key={k} style={chip(f.realityLevel === k)} onClick={() => set('realityLevel', k)}>{t(l)}</span>)}</div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}><Toggle on={f.researchSubject} onClick={() => set('researchSubject', !f.researchSubject)}>{t('Research the subject online')}</Toggle><div style={{ flex: 1, minWidth: 150 }}><div style={{ ...lab, margin: '0 0 3px' }}>{t('How much real detail')}</div>{slider('researchAmount')}</div></div>
                    <textarea value={f.realPersonNote || ''} onChange={(e) => set('realPersonNote', e.target.value)} placeholder={t('Brief about the real person / story — who they are, what is true, the wound, what to keep vs dramatise...')} style={{ ...field, minHeight: 66, resize: 'none', marginTop: 10 }} />
                  </>) : null}
                </div>
              ) : null}

              <div style={band}>
                <div style={bt}>{t('Creative DNA')}</div>
                <div style={lab}>{t('Base genre')} <span style={{ color: C.faint, fontWeight: 500 }}>· {t('pick up to 3')}</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{BASE_GENRES.map((g) => { const on = (f.baseGenres || []).includes(g.label); const full = (f.baseGenres || []).length >= 3; return <span key={g.id} style={{ ...chip(on), opacity: !on && full ? 0.4 : 1 }} onClick={() => pickBase(g.label)}>{on ? '✓ ' : ''}{tx(g, locale)}</span>; })}</div>
                {(f.baseGenres || []).length ? (<>
                  <div style={lab}>{t('Subgenre')} <span style={{ color: C.faint, fontWeight: 500 }}>· {t('how much, and how intense')}</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{allSubsFor(f.baseGenres).map((s) => <span key={s} style={chip(!!(f.subMix || {})[s], C.blue)} onClick={() => subToggle(s)}>{(f.subMix || {})[s] ? '✓ ' : ''}{s}</span>)}</div>
                  {Object.keys(f.subMix || {}).length ? (<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>{Object.keys(f.subMix || {}).map((s) => { const cfg: any = (f.subMix || {})[s] || { p: 2, ii: 2 }; return (
                    <div key={s} style={{ border: '1px solid ' + C.hair, borderRadius: 11, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: C.cream }}>{s}</div><span onClick={() => subToggle(s)} style={{ marginLeft: 'auto', fontSize: 11, color: C.faint, cursor: 'pointer' }}>✕</span></div>
                      <div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: C.gold, textTransform: 'uppercase' }}>{t('How much in the story')}</span><span style={{ fontSize: 11.5, fontWeight: 700, color: C.cream }}>{t(SUB_PRESENCE[cfg.p])}</span></div><input type="range" min={0} max={4} step={1} value={cfg.p} onChange={(e) => subSlide(s, 'p', Number(e.target.value))} style={{ width: '100%', marginTop: 5, accentColor: C.gold }} /></div>
                      <div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: C.gold, textTransform: 'uppercase' }}>{t('How intense when it appears')}</span><span style={{ fontSize: 11.5, fontWeight: 700, color: C.cream }}>{t(SUB_INTENSITY[cfg.ii])}</span></div><input type="range" min={0} max={4} step={1} value={cfg.ii} onChange={(e) => subSlide(s, 'ii', Number(e.target.value))} style={{ width: '100%', marginTop: 5, accentColor: C.gold }} /></div>
                    </div>); })}</div>) : null}
                </>) : null}
                <div style={lab}>{t('Blend layers')} <span style={{ color: C.faint, fontWeight: 500 }}>· {t('stack any')}</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{BLEND_LAYERS.map((g) => <span key={g.id} style={chip((f.blendLayers || []).includes(g.label), C.blue)} onClick={() => toggleTax('blendLayers', g.label)}>{(f.blendLayers || []).includes(g.label) ? '+ ' : ''}{tx(g, locale)}</span>)}</div>
                <div style={lab}>{t('Tone')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{TONES.map((g) => <span key={g.id} style={chip((f.tones || []).includes(g.label))} onClick={() => toggleTax('tones', g.label)}>{tx(g, locale)}</span>)}</div>
                <div style={lab}>{t('Mood')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{MOODS.map((g) => <span key={g.id} style={chip((f.moods || []).includes(g.label), C.violet)} onClick={() => toggleTax('moods', g.label)}>{tx(g, locale)}</span>)}</div>
                <div style={lab}>{t('Treatment')} <span style={{ color: C.faint, fontWeight: 500 }}>· {t('narrative method')}</span></div>
                <select value={f.treatment || ''} onChange={(e) => setTax('treatment', e.target.value)} style={{ ...field, cursor: 'pointer' }}><option value="">{t('Optional — e.g. linear, non-linear')}</option>{TREATMENTS.map((g) => <option key={g.id} value={g.label}>{tx(g, locale)}</option>)}</select>
              </div>

              <div style={band}>
                <div style={bt}>{t('Setting & world')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <div><div style={lab}>{t('Setting country / place')}</div><Combo value={f.settingCountry} onChange={(v) => setTax('settingCountry', v)} options={SETTING_COUNTRIES} placeholder={t('Where the story is set...')} /></div>
                  <div><div style={lab}>{t('Era / period')}</div><select value={f.settingEra || ''} onChange={(e) => setTax('settingEra', e.target.value)} style={{ ...field, cursor: 'pointer' }}><option value="">{t('Pick an era...')}</option>{eraOptionsFor(f.settingCountry).map((g) => <option key={g.label} value={g.label}>{tx(g, locale)}</option>)}</select></div>
                </div>
                <input value={Array.isArray(f.settingWorld) ? f.settingWorld.join(', ') : (f.settingWorld || '')} onChange={(e) => setTax('settingWorld', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder={t('World details — e.g. desert frontier, royal court, war-torn city...')} style={{ ...field, marginTop: 8 }} />
                <div style={{ fontSize: 10.5, color: C.faint, marginTop: 6 }}>{t('The engine auto-loads each era’s language, names and customs — for Egypt, every Arab country, and many world settings.')}</div>
              </div>

              <div style={band}>
                <div style={bt}>{t('Intent & budget')}</div>
                <div style={lab}>{t('Project intent')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{PROJECT_INTENTS.map((g) => <span key={g.id} style={chip(f.projectIntent === g.label)} onClick={() => setTax('projectIntent', f.projectIntent === g.label ? '' : g.label)}>{tx(g, locale)}</span>)}</div>
                <div style={lab}>{t('Budget scope')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{BUDGET_TIERS.map((g) => <span key={g.id} title={locale === 'ar' ? g.arHint : g.hint} style={chip(f.budgetTier === g.label, C.green)} onClick={() => setTax('budgetTier', f.budgetTier === g.label ? '' : g.label)}>{tx(g, locale)}</span>)}</div>
                {f.budgetTier ? <div style={{ fontSize: 10.5, color: C.faint, marginTop: 6 }}>{(() => { const b: any = BUDGET_TIERS.find((x) => x.label === f.budgetTier) || {}; return (locale === 'ar' ? b.arHint : b.hint) || ''; })()}</div> : null}
              </div>

              <div style={band}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={bt}>{t('Story framework')}</div><button type="button" onClick={() => setFwInfo((v) => !v)} title={t('What each framework means')} style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid ' + C.hair, background: fwInfo ? 'rgba(198,164,99,.18)' : 'transparent', color: C.gold2, fontSize: 11, fontWeight: 800, fontStyle: 'italic', cursor: 'pointer', lineHeight: 1, display: 'grid', placeItems: 'center' }}>i</button></div>
                <div style={{ fontSize: 10.5, color: C.faint, margin: '6px 0 8px' }}>{t('The beat map your Beats stage will follow. Auto picks the best fit for your format; tap the i to see what each one is.')}</div>
                <select value={f.framework || ''} onChange={(e) => set('framework', e.target.value)} style={{ ...field, cursor: 'pointer' }}>
                  <option value="">{t('Auto') + ' — ' + ((): string => { const fw = FRAMEWORK_INFO.find((x) => x.id === smartFramework(f.projectType, f.genres)); return fw ? (locale === 'ar' ? fw.ar : fw.name) : 'Save the Cat (15)'; })()}</option>
                  {FRAMEWORK_INFO.map((fw) => <option key={fw.id} value={fw.id}>{locale === 'ar' ? fw.ar : fw.name}</option>)}
                </select>
                {fwInfo ? (<div style={{ marginTop: 8, background: '#101218', border: '1px solid ' + C.hair, borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 7, maxHeight: 240, overflow: 'auto' }}>{FRAMEWORK_INFO.map((fw) => (<div key={fw.id} style={{ fontSize: 11, lineHeight: 1.45 }}><span style={{ color: C.gold2, fontWeight: 700 }}>{locale === 'ar' ? fw.ar : fw.name}</span><span style={{ color: C.faint }}>{' — ' + (locale === 'ar' ? fw.arDesc : fw.desc)}</span></div>))}</div>) : null}
              </div>

              <div style={band}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={bt}>{t('Style & Voice')}</div><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.gold, marginInlineStart: 8 }}>{t('OPTIONAL')}</span><span style={{ marginInlineStart: 'auto', fontSize: 10, color: (f.styles || []).length >= 2 ? C.gold2 : C.faint, fontWeight: 700 }}>{(f.styles || []).length}/2 {t('chosen')}</span></div>
                <div style={{ fontSize: 10.5, color: C.faint, margin: '6px 0 8px' }}>{t('How the script is written — pick up to 2 craft voices and how strongly to apply. Steers texture, never the plot.')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{STYLE_PACKS.map((sp) => { const on = (f.styles || []).includes(sp.id); const full = !on && (f.styles || []).length >= 2; return <span key={sp.id} onClick={() => styleToggle(sp.id)} title={locale === 'ar' ? sp.arBlurb : sp.blurb} style={{ ...chip(on, C.violet), opacity: full ? 0.4 : 1, cursor: full ? 'not-allowed' : 'pointer' }}>{on ? '✓ ' : ''}{locale === 'ar' ? sp.ar : sp.label}</span>; })}</div>
                {(f.styles || []).length ? (<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>{(f.styles || []).map((id: string) => { const sp = STYLE_PACKS.find((x) => x.id === id); if (!sp) return null; const sv = typeof (f.styleMix || {})[id] === 'number' ? (f.styleMix || {})[id] : 2; return (
                  <div key={id} style={{ border: '1px solid ' + C.hair, borderRadius: 11, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: C.cream }}>{locale === 'ar' ? sp.ar : sp.label}</div><span onClick={() => styleToggle(id)} style={{ marginLeft: 'auto', fontSize: 11, color: C.faint, cursor: 'pointer' }}>✕</span></div>
                    <div style={{ fontSize: 10, color: C.faint, margin: '2px 0 6px' }}>{locale === 'ar' ? sp.arBlurb : sp.blurb}</div>
                    <div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: C.gold, textTransform: 'uppercase' }}>{t('How strongly')}</span><span style={{ fontSize: 11.5, fontWeight: 700, color: C.cream }}>{t(STYLE_STRENGTH[sv])}</span></div><input type="range" min={0} max={4} step={1} value={sv} onChange={(e) => styleSlide(id, Number(e.target.value))} style={{ width: '100%', marginTop: 5, accentColor: C.gold }} /></div>
                  </div>); })}</div>) : null}
              </div>

              <div style={band}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={bt}>{t('Ending')}</div><button type="button" onClick={() => setEndInfo((v) => !v)} title={t('What each ending means')} style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid ' + C.hair, background: endInfo ? 'rgba(198,164,99,.18)' : 'transparent', color: C.gold2, fontSize: 11, fontWeight: 800, fontStyle: 'italic', cursor: 'pointer', lineHeight: 1, display: 'grid', placeItems: 'center' }}>i</button><span style={{ marginInlineStart: 'auto', fontSize: 10, color: endIds().length >= 2 ? C.gold2 : C.faint, fontWeight: 700 }}>{endIds().length}/2 {t('chosen')}</span></div>
                <div style={{ fontSize: 10.5, color: C.faint, margin: '6px 0 8px' }}>{t("How the story lands - pick up to two to blend (e.g. bittersweet + open / sequel hook). Written into the brief and honoured at the climax; same list as the Doctor's Re-engineer ending.")}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{ENDING_TYPES.map((en) => { const on = endIds().includes(en.id); const full = !on && endIds().length >= 2; return <span key={en.id} onClick={() => toggleEnding(en.id)} title={locale === 'ar' ? en.arDesc : en.desc} style={{ ...chip(on), opacity: full ? 0.4 : 1, cursor: full ? 'not-allowed' : 'pointer' }}>{on ? '\u2713 ' : ''}{locale === 'ar' ? en.ar : en.label}</span>; })}</div>
                <input value={(f.spine && f.spine.endingCustom) || ''} onChange={(e) => setEndingCustom(e.target.value)} placeholder={t('Or add your own ending note, e.g. open ending hinting a sequel saga')} style={{ ...field, marginTop: 8 }} />
                {endInfo ? (<div style={{ marginTop: 8, background: '#101218', border: '1px solid ' + C.hair, borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 7, maxHeight: 240, overflow: 'auto' }}>{ENDING_TYPES.map((en) => (<div key={en.id} style={{ fontSize: 11, lineHeight: 1.45 }}><span style={{ color: C.gold2, fontWeight: 700 }}>{locale === 'ar' ? en.ar : en.label}</span><span style={{ color: C.faint }}>{' — ' + (locale === 'ar' ? en.arDesc : en.desc)}</span></div>))}</div>) : null}
              </div>

              <div style={layerOn ? bandLit : band}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={bt}>{t('Lore Atlas - genre & lore layer')}</div>
                  <Toggle on={layerOn} onClick={() => setLayerOn(!layerOn)}>{t('Add a lore layer')}</Toggle>
                </div>
                {layerOn ? (<>
                  <div style={{ fontSize: 10.5, color: C.blue, background: 'rgba(91,141,239,.08)', border: '1px solid rgba(91,141,239,.25)', borderRadius: 8, padding: '7px 9px', margin: '9px 0' }}>{t('The Atlas steers genre & texture - it does not write the story. It rides on top of your Work source.')}</div>
                  {(lenses.length + Object.keys(((f.lorePolicy || {}).genreIntensity) || {}).length + ((f.loreSelections || []).length)) ? (
                    <div style={{ fontSize: 10.5, color: C.mut, margin: '0 0 9px' }}>{t('Active layers:')} <span style={{ color: C.gold2 }}>{lenses.map((k) => t((LENSES.find(([x]) => x === k) || [k, k])[1])).join(' + ')}</span>{((f.loreSelections || []).length) ? ' · ' + (f.loreSelections || []).length + ' ' + t('elements') : ''}{(Object.keys(((f.lorePolicy || {}).genreIntensity) || {}).length) ? ' · ' + Object.keys(((f.lorePolicy || {}).genreIntensity) || {}).length + ' ' + t('genres') : ''}</div>
                  ) : null}
                  <div style={{ fontSize: 10.5, color: C.faint, marginBottom: 4 }}>{t('Lore genres — tap to combine several layers')}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{LENSES.map(([k, l]) => <span key={k} style={chip(lenses.includes(k), k === 'crime' ? C.red : k === 'romance' || k === 'naming-dress' ? C.green : undefined)} onClick={() => toggleLens(k)}>{lenses.includes(k) ? '✓ ' : ''}{t(l)}</span>)}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
                    <div style={{ display: 'inline-flex', background: '#15181e', border: '1px solid ' + C.hair, borderRadius: 9, padding: 3, gap: 2 }}>
                      {[['culture', 'By culture'], ['archetype', 'By archetype']].map(([k, l]) => <span key={k} onClick={() => setAtlasMode(k)} style={{ fontSize: 11.5, fontWeight: 600, color: atlasMode === k ? C.gold2 : C.mut, background: atlasMode === k ? 'rgba(198,164,99,.16)' : 'transparent', padding: '5px 11px', borderRadius: 7, cursor: 'pointer' }}>{t(l)}</span>)}
                    </div>
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search all lore - name, trait, function...')} style={{ ...field, flex: 1, padding: '8px 11px' }} />
                  </div>
                  {atlasMode === 'culture' ? (<>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 9 }}>{cultures.map((c) => <span key={c} style={chip(culture === c, C.blue)} onClick={() => setCulture(c)}>{c}</span>)}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 8 }}>{byCulture.map((el: any) => Card(el))}</div>
                    {byCulture.length === 0 ? <div style={{ fontSize: 11, color: C.faint }}>{t('No elements for this lens/culture.')}</div> : null}
                  </>) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {ARORDER.filter((a) => byArche[a] && byArche[a].length).map((a) => (
                        <div key={a}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.gold2, marginBottom: 6, borderBottom: '1px solid ' + C.hair, paddingBottom: 4 }}>{t(ARLABEL[a] || a)}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 8 }}>{byArche[a].map((el: any) => Card(el))}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Toggle on={f.lorePolicy.allowHistoricalPantheon} onClick={() => set('lorePolicy', { ...f.lorePolicy, allowHistoricalPantheon: !f.lorePolicy.allowHistoricalPantheon })}>{t('Allow historical pantheons (Greek/Norse/Egyptian gods)')}</Toggle>
                    <span style={{ fontSize: 10, color: C.faint }}>{t('Living-religion sacred figures stay locked.')}</span>
                  </div>

                  {(f.loreSelections || []).length ? (
                    <div style={{ marginTop: 12, borderTop: '1px solid ' + C.hair, paddingTop: 10 }}>
                      <div style={{ ...bt, fontSize: 12.5 }}>{t('Selected - role & weight')}</div>
                      {(f.loreSelections || []).map((s: any) => (
                        <div key={s.slug} style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.cream, minWidth: 92 }}>{s.name}</span>
                          <select value={s.role} onChange={(e) => setSel(s.slug, 'role', e.target.value)} style={{ background: '#0b0c0f', color: C.text, border: '1px solid ' + C.hair, borderRadius: 8, padding: '5px 8px', fontSize: 11.5 }}>{ROLES.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
                          <span style={{ display: 'flex', gap: 3 }}>{[1, 2, 3, 4].map((w) => <i key={w} onClick={() => setSel(s.slug, 'weight', w)} style={{ width: 11, height: 11, borderRadius: '50%', background: w <= s.weight ? C.gold2 : '#2a2d36', cursor: 'pointer', display: 'inline-block' }} />)}</span>
                          <span style={{ fontSize: 10.5, color: s.weight >= 3 ? C.gold2 : C.mut, fontWeight: 700 }}>{s.weight >= 3 ? t('Spine') : t('Accent')}</span>
                          <span onClick={() => toggleSel(s)} style={{ marginInlineStart: 'auto', color: C.faint, cursor: 'pointer', fontSize: 13 }}>x</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 14, borderTop: '1px solid ' + C.hair, paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ ...bt, fontSize: 12.5 }}>{t('Genre intensity')}</div>
                      <span style={{ fontSize: 10, color: C.faint }}>{t('presence')} {'\u00b7'} {t('intensity')} {'\u00b7'} {t('influence')}</span>
                      {Object.keys(gi()).length ? <span style={{ fontSize: 10, color: C.gold2, fontWeight: 700, background: 'rgba(198,164,99,.14)', border: '1px solid rgba(198,164,99,.3)', borderRadius: 999, padding: '2px 9px' }}>{Object.keys(gi()).length} {t('active')}</span> : null}
                      <span style={{ marginInlineStart: 'auto' }}><Toggle on={genreOpen} onClick={() => setGenreOpen(!genreOpen)}>{genreOpen ? t('Hide') : t('Show')}</Toggle></span>
                    </div>
                    {genreOpen ? (<>
                      {Object.keys(gi()).length ? (<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 2px' }}>{GENRE_FAMS.filter((g) => giOn(g.id)).map((g) => <span key={g.id} style={{ fontSize: 10.5, fontWeight: 700, color: C.gold2, background: 'rgba(198,164,99,.12)', border: '1px solid rgba(198,164,99,.3)', borderRadius: 999, padding: '3px 10px' }}>{g.name.split(' ')[0]} {gi()[g.id].inf}%</span>)}</div>) : null}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                        {GENRE_FAMS.map((g) => { const on = giOn(g.id); const cfg: any = gi()[g.id] || giDef; return (
                          <div key={g.id} style={{ border: '1px solid ' + C.hair, borderRadius: 11, overflow: 'hidden' }}>
                            <div onClick={() => giToggle(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', background: on ? 'rgba(198,164,99,.06)' : 'transparent' }}>
                              <div><div style={{ fontSize: 12.5, fontWeight: 700, color: C.cream }}>{g.name}</div><div style={{ fontSize: 10, color: C.faint }}>{g.bring}</div></div>
                              <div style={{ marginLeft: 'auto', width: 38, height: 21, borderRadius: 999, background: on ? 'linear-gradient(180deg,' + C.gold2 + ',' + C.gold + ')' : '#2a2d36', position: 'relative', flex: 'none' }}><i style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 17, height: 17, borderRadius: '50%', background: on ? '#15120B' : '#0b0c0f', transition: '.18s' }} /></div>
                            </div>
                            {on ? (<div style={{ padding: '2px 12px 13px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .5, color: C.gold, textTransform: 'uppercase' }}>{t('Presence — how often')}</span><span style={{ fontSize: 11.5, fontWeight: 700, color: C.cream }}>{g.presence[cfg.p]}</span></div><input type="range" min={0} max={4} step={1} value={cfg.p} onChange={(e) => giSlide(g.id, 'p', Number(e.target.value))} style={{ width: '100%', marginTop: 5, accentColor: C.gold }} /></div>
                              <div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .5, color: C.gold, textTransform: 'uppercase' }}>{t('Intensity — how strong')}</span><span style={{ fontSize: 11.5, fontWeight: 700, color: C.cream }}>{g.intensity[cfg.ii]}</span></div><input type="range" min={0} max={4} step={1} value={cfg.ii} onChange={(e) => giSlide(g.id, 'ii', Number(e.target.value))} style={{ width: '100%', marginTop: 5, accentColor: C.gold }} /></div>
                              {g.styles ? (<div><div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .5, color: C.gold, textTransform: 'uppercase', marginBottom: 5 }}>{t('Action style')}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{g.styles.map((st) => <span key={st} onClick={() => giStyle(g.id, st)} style={chip(((cfg.styles) || []).includes(st))}>{st}</span>)}</div></div>) : null}
                              <div><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .5, color: C.gold, textTransform: 'uppercase' }}>{t('Narrative influence')}</span><span style={{ fontSize: 12.5, fontWeight: 700, color: C.gold2 }}>{cfg.inf}%</span></div><input type="range" min={0} max={100} step={5} value={cfg.inf} onChange={(e) => giSet(g.id, { inf: Number(e.target.value), manualInf: true })} style={{ width: '100%', marginTop: 5, accentColor: C.gold }} /></div>
                            </div>) : null}
                          </div>
                        ); })}
                      </div>
                    </>) : null}
                  </div>


                  <div style={{ marginTop: 12, borderTop: '1px solid ' + C.hair, paddingTop: 10 }}>
                    <div style={{ ...bt, fontSize: 12.5 }}>{t('Lore density - how far the layer bends the story')}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>{DSTOPS.map((d, i) => <span key={d} onClick={() => set('loreDensity', d)} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700, color: f.loreDensity === d ? C.ink : C.mut, background: f.loreDensity === d ? densColor : '#171a20', border: '1px solid ' + C.hair, borderRadius: 7, padding: '6px 2px', cursor: 'pointer' }}>{d.charAt(0) + d.slice(1).toLowerCase()}</span>)}</div>
                    <div style={{ fontSize: 11, color: C.text, background: '#0e1014', borderInlineStart: '3px solid ' + densColor, borderRadius: 8, padding: '9px 11px', marginTop: 8, lineHeight: 1.5 }}>{t(DNOTE[f.loreDensity])}</div>
                  </div>


                </>) : (
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>{t('Turn it on to draw authentic elements from 12 cultures - creatures, crime, customs, dress - keyed to your setting.')}</div>
                )}
              </div>

              <div style={band}>
                <div style={bt}>{t('Target')} <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.gold, marginInlineStart: 8 }}>{t('SHAPES THE STORY')}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <div><div style={lab}>{t('Target language')}</div><Combo value={f.language} onChange={(v) => set('language', v)} options={LANGUAGES} placeholder={t('Pick a language...')} /></div>
                  <div><div style={lab}>{t('Country / market')}</div><Combo value={f.country} onChange={(v) => set('country', v)} options={MARKETS} placeholder={t('Pick a market...')} /></div>
                  <div><div style={lab}>{t('Rating target')}</div><Combo value={f.rating} onChange={(v) => set('rating', v)} options={RATINGS} placeholder={t('Pick a rating...')} /></div>
                  <div><div style={lab}>{t('Format note (optional)')}</div><input value={f.format} onChange={(e) => set('format', e.target.value)} placeholder={t('e.g. anthology, 3-act')} style={field} /></div>
                </div>
                <div style={{ fontSize: 10.5, color: C.faint, marginTop: 8 }}>{t('Language, market and rating are written into the brief — they steer tone, content limits and cultural fit.')}</div>
                {isArabicLang(f.language) && (
                  <div style={{ marginTop: 12, borderTop: '1px solid ' + C.hair, paddingTop: 10 }}>
                    <div style={lab}>{t('Script dialect')} <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.gold, marginInlineStart: 8 }}>{t('THE DIALOGUE VOICE')}</span></div>
                    <select value={f.scriptVariety || 'ar-MSA'} onChange={(e) => set('scriptVariety', e.target.value)} dir="rtl" style={{ ...field, fontFamily: "var(--sx-body)" }}>
                      {AR_DIALECTS.map((d) => <option key={d.id} value={d.id}>{d.native} · {d.label}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {([['formal', 'الفصحى · Formal everywhere'], ['colloquial', 'عامية · Dialect dialogue']] as [string, string][]).map(([v, l]) => {
                        const on = (f.dialogueRegister || 'formal') === v;
                        return <button key={v} type="button" onClick={() => set('dialogueRegister', v)} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (on ? 'transparent' : C.hair), background: on ? ('linear-gradient(180deg,' + C.gold2 + ',' + C.gold + ')') : 'transparent', color: on ? C.ink : C.mut }}>{l}</button>;
                      })}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.faint, marginTop: 6 }}>{t('Formal keeps the whole script in فصحى. Colloquial writes action in فصحى and the DIALOGUE in the chosen dialect — the professional norm.')}</div>
                  </div>
                )}
                {f.language && !isArabicLang(f.language) ? (
                  <div style={{ marginTop: 12, borderTop: '1px solid ' + C.hair, paddingTop: 10 }}>
                    <div style={lab}>{t('Accents / dialects')} <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.gold, marginInlineStart: 8 }}>{t('THE DIALOGUE VOICE')}</span></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 6 }}>{ACCENTS.map((a) => <span key={a.id} style={chip((f.accents || []).includes(a.label), C.blue)} onClick={() => toggleTax('accents', a.label)}>{tx(a, locale)}</span>)}</div>
                    <div style={{ fontSize: 10.5, color: C.faint, marginTop: 6 }}>{t('Written via idiom and a capitalized parenthetical (e.g. (Cockney)) — never phonetic spelling.')}</div>
                  </div>
                ) : null}
              </div>

              <div style={band}>
                <div style={bt}>{t('Research scope')} <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.gold, marginInlineStart: 8 }}>{t('ON BY DEFAULT')}</span></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>{SCOPE.map(([k, l]) => <span key={k} style={chip(!!f.researchScope?.[k])} onClick={() => set('researchScope', { ...f.researchScope, [k]: !f.researchScope?.[k] })}>{t(l)}</span>)}</div>
                <div style={lab}>{t('Research depth')}</div>{slider('researchDepth')}
              </div>

              <button disabled={!projectId || !!busy || !(f.name && String(f.name).trim())} onClick={begin} style={{ width: '100%', height: 50, border: 'none', borderRadius: 12, background: 'linear-gradient(180deg,' + C.gold2 + ',' + C.gold + ')', color: C.ink, fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: (!projectId || busy || !(f.name && String(f.name).trim())) ? 0.6 : 1 }}>{busy ? t('Beginning...') : (f.name && String(f.name).trim()) ? t('Begin the build') : t('Name your build to begin')}</button>
            </div>

            <div>
              <div style={{ position: 'sticky', top: 12, background: 'linear-gradient(180deg,#16191f,#121419)', border: '1px solid rgba(198,164,99,.25)', borderRadius: 12, padding: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 700, color: C.cream }}>{t('Creative brief')}</span><span style={{ fontSize: 8.5, fontWeight: 800, color: C.green, background: 'rgba(87,179,104,.16)', borderRadius: 4, padding: '2px 6px' }}>{t('LIVE')}</span></div>
                {[
                  t(PTYPES.find((p) => p[0] === f.projectType)?.[1] || 'Movie') + (f.projectType === 'TV_SERIES' || f.projectType === 'VERTICAL' || f.projectType === 'LIMITED' ? ' - ' + f.episodes + ' ' + t('ep x') + ' ' + f.minutesPerEp + ' ' + t('min') : ''),
                  (f.mode === 'ORIGINAL' ? t('From scratch') : t('Adapting source')) + (f.mode === 'ADAPT' && f.realBased ? ', ' + t((f.realityLevel || '').toLowerCase()) : ''),
                  t('Genres:') + ' ' + (f.genres || []).map((g: string) => arLabel(g, locale)).join('، ') + (((f.tones || []).length || (f.moods || []).length) ? ' - ' + ([] as string[]).concat((f.tones || []).map((x: string) => arLabel(x, locale)), (f.moods || []).map((x: string) => arLabel(x, locale))).join('، ') : ''),
                  layerOn && ((f.loreSelections || []).length || Object.keys(((f.lorePolicy || {}).genreIntensity) || {}).length) ? t('Lore:') + ' ' + ([] as string[]).concat((f.loreSelections || []).map((s: any) => s.name), GENRE_FAMS.filter((g) => giOn(g.id)).map((g) => g.name.split(' ')[0] + ' ' + gi()[g.id].inf + '%')).join(', ') + ' (' + f.loreDensity.toLowerCase() + ')' : t('No lore layer'),
                  [f.language, f.country, f.rating].filter(Boolean).join(' - ') || t('Target not set'),
                  [f.settingCountry, f.settingEra].filter(Boolean).join(' · ') ? (t('Setting:') + ' ' + [arLabel(f.settingCountry, locale), arLabel(f.settingEra, locale)].filter(Boolean).join(' · ') + (f.budgetTier ? ' · ' + arLabel(f.budgetTier, locale) : '')) : (f.budgetTier ? t('Budget:') + ' ' + arLabel(f.budgetTier, locale) : t('Setting not set')),
                ].map((line, i) => (
                  <div key={i} style={{ fontSize: 11, color: C.mut, lineHeight: 1.45, display: 'flex', gap: 7, marginBottom: 6 }}><span style={{ color: C.gold2 }}>-</span><span>{line}</span></div>
                ))}
                <div style={{ fontSize: 9.5, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>{t('Steers the brief; the Work source does the storytelling. Begin writes the Logline.')}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {openEl ? (
        <div dir={dir} style={{ position: 'fixed', inset: 0, background: 'rgba(6,7,10,.7)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setOpenEl(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: '100%', background: C.band, border: '1px solid ' + C.hair, borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: .5, color: C.gold, textTransform: 'uppercase' }}>{openEl.culture}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.cream, margin: '2px 0 8px' }}>{openEl.name}</div>
            <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{openEl.origin || openEl.blurb}</div>
            {Array.isArray(openEl.variants) && openEl.variants.length ? (<div style={{ marginTop: 10 }}><div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .5, color: C.faint }}>{t('VARIANTS')}</div><div style={{ fontSize: 12, color: C.mut, marginTop: 3 }}>{openEl.variants.join(' - ')}</div></div>) : null}
            {Array.isArray(openEl.hooks) && openEl.hooks.length ? (<div style={{ marginTop: 10 }}><div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: .5, color: C.faint }}>{t('STORY HOOKS')}</div>{openEl.hooks.map((h: string, i: number) => <div key={i} style={{ fontSize: 12, color: C.mut, lineHeight: 1.45, display: 'flex', gap: 7, marginTop: 4 }}><span style={{ color: C.gold2 }}>{dir === 'rtl' ? '<' : '>'}</span><span>{h}</span></div>)}</div>) : null}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={() => { toggleSel(openEl); setOpenEl(null); }} style={{ flex: 1, height: 38, border: 'none', borderRadius: 10, background: 'linear-gradient(180deg,' + C.gold2 + ',' + C.gold + ')', color: C.ink, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{selected(openEl.slug) ? t('Remove from build') : t('Add to build')}</button>
              <button onClick={() => setOpenEl(null)} style={{ height: 38, padding: '0 14px', background: 'transparent', border: '1px solid ' + C.hair, color: C.mut, borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>{t('Close')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
