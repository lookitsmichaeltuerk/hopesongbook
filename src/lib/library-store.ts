import { parseChordPro, type Song, type SongMelody } from './chordpro';

export type SyncStatus = 'loading' | 'saved' | 'saving' | 'offline';

export type Setlist = {
  id: string;
  name: string;
  songIds: string[];
};

const AMAZING_GRACE_MELODY: SongMelody = {
  beats: 24,
  harmony: [
    { beat: 0, chord: 'G' },
    { beat: 6, chord: 'C' },
    { beat: 9, chord: 'G' },
    { beat: 12, chord: 'Em' },
    { beat: 15, chord: 'D7' },
    { beat: 18, chord: 'G' },
    { beat: 21, chord: 'C' },
    { beat: 22.5, chord: 'G' },
  ],
  notes: [
    { midi: 62, beat: 0, dur: 1, syllable: 'A-' },
    { midi: 67, beat: 1, dur: 2, syllable: 'ma-' },
    { midi: 71, beat: 3, dur: 0.5, syllable: 'zing' },
    { midi: 67, beat: 3.5, dur: 0.5, syllable: 'grace' },
    { midi: 71, beat: 4, dur: 2, syllable: 'how' },
    { midi: 69, beat: 6, dur: 1, syllable: 'sweet' },
    { midi: 67, beat: 7, dur: 2, syllable: 'the' },
    { midi: 64, beat: 9, dur: 1, syllable: 'sound' },
    { midi: 62, beat: 10, dur: 2, syllable: 'that' },
    { midi: 62, beat: 12, dur: 1, syllable: 'saved' },
    { midi: 67, beat: 13, dur: 2, syllable: 'a' },
    { midi: 71, beat: 15, dur: 0.5, syllable: 'wretch' },
    { midi: 67, beat: 15.5, dur: 0.5, syllable: 'like' },
    { midi: 71, beat: 16, dur: 2, syllable: 'me,' },
    { midi: 69, beat: 18, dur: 1, syllable: 'I' },
    { midi: 74, beat: 19, dur: 2, syllable: 'once' },
    { midi: 71, beat: 21, dur: 1, syllable: 'was' },
    { midi: 67, beat: 22, dur: 2, syllable: 'found.' },
  ],
};

const WAYFARING_MELODY: SongMelody = {
  beats: 32,
  harmony: [
    { beat: 0, chord: 'Am' },
    { beat: 8, chord: 'Dm' },
    { beat: 12, chord: 'Am' },
    { beat: 16, chord: 'F' },
    { beat: 20, chord: 'C' },
    { beat: 24, chord: 'E7' },
    { beat: 28, chord: 'Am' },
  ],
  notes: [
    { midi: 69, beat: 0, dur: 1.5, syllable: 'I' },
    { midi: 72, beat: 1.5, dur: 0.5, syllable: 'am' },
    { midi: 69, beat: 2, dur: 1, syllable: 'a' },
    { midi: 67, beat: 3, dur: 1, syllable: 'poor' },
    { midi: 64, beat: 4, dur: 2, syllable: 'way-' },
    { midi: 62, beat: 6, dur: 1, syllable: 'far-' },
    { midi: 64, beat: 7, dur: 1, syllable: 'ing' },
    { midi: 69, beat: 8, dur: 2, syllable: 'stran-' },
    { midi: 67, beat: 10, dur: 2, syllable: 'ger,' },
    { midi: 64, beat: 12, dur: 3, syllable: 'trav-' },
    { midi: 69, beat: 15, dur: 1, syllable: 'ling' },
    { midi: 72, beat: 16, dur: 2, syllable: 'through' },
    { midi: 74, beat: 18, dur: 1, syllable: 'this' },
    { midi: 72, beat: 19, dur: 1, syllable: 'world' },
    { midi: 69, beat: 20, dur: 2, syllable: 'of' },
    { midi: 67, beat: 22, dur: 2, syllable: 'woe,' },
    { midi: 68, beat: 24, dur: 2, syllable: 'go-' },
    { midi: 71, beat: 26, dur: 2, syllable: 'ing' },
    { midi: 69, beat: 28, dur: 4, syllable: 'home.' },
  ],
};

const RISING_SUN_MELODY: SongMelody = {
  beats: 24,
  harmony: [
    { beat: 0, chord: 'Am' },
    { beat: 3, chord: 'C' },
    { beat: 6, chord: 'D' },
    { beat: 9, chord: 'F' },
    { beat: 12, chord: 'Am' },
    { beat: 15, chord: 'E7' },
    { beat: 18, chord: 'Am' },
    { beat: 21, chord: 'E7' },
  ],
  notes: [
    { midi: 69, beat: 0, dur: 2, syllable: 'There' },
    { midi: 69, beat: 2, dur: 1, syllable: 'is' },
    { midi: 72, beat: 3, dur: 2, syllable: 'a' },
    { midi: 74, beat: 5, dur: 1, syllable: 'house' },
    { midi: 76, beat: 6, dur: 2, syllable: 'in' },
    { midi: 72, beat: 8, dur: 1, syllable: 'New' },
    { midi: 69, beat: 9, dur: 2, syllable: 'Or-' },
    { midi: 69, beat: 11, dur: 1, syllable: 'leans' },
    { midi: 76, beat: 12, dur: 2, syllable: 'they' },
    { midi: 76, beat: 14, dur: 1, syllable: 'call' },
    { midi: 74, beat: 15, dur: 2, syllable: 'the' },
    { midi: 71, beat: 17, dur: 1, syllable: 'Ri-' },
    { midi: 69, beat: 18, dur: 5, syllable: 'sing Sun.' },
  ],
};

const MIDNIGHT_RIVER_MELODY: SongMelody = {
  beats: 32,
  harmony: [
    { beat: 0, chord: 'Fmaj7' },
    { beat: 4, chord: 'Em7' },
    { beat: 8, chord: 'Dm7' },
    { beat: 12, chord: 'Cmaj7' },
    { beat: 16, chord: 'Fmaj7' },
    { beat: 20, chord: 'G7' },
    { beat: 24, chord: 'Am7' },
    { beat: 28, chord: 'C' },
  ],
  notes: [
    { midi: 72, beat: 0, dur: 1.5, syllable: 'Sil-' },
    { midi: 71, beat: 1.5, dur: 1.5, syllable: 'ver' },
    { midi: 69, beat: 3, dur: 1, syllable: 'lights' },
    { midi: 67, beat: 4, dur: 2, syllable: 'on' },
    { midi: 64, beat: 6, dur: 2, syllable: 'the' },
    { midi: 65, beat: 8, dur: 1.5, syllable: 'mid-' },
    { midi: 69, beat: 9.5, dur: 1.5, syllable: 'night' },
    { midi: 67, beat: 11, dur: 1, syllable: 'ri-' },
    { midi: 64, beat: 12, dur: 4, syllable: 'ver,' },
    { midi: 69, beat: 16, dur: 2, syllable: 'hear' },
    { midi: 72, beat: 18, dur: 2, syllable: 'the' },
    { midi: 74, beat: 20, dur: 2, syllable: 'koto' },
    { midi: 71, beat: 22, dur: 2, syllable: 'ring-' },
    { midi: 72, beat: 24, dur: 3, syllable: 'ing' },
    { midi: 67, beat: 27, dur: 1, syllable: 'in' },
    { midi: 64, beat: 28, dur: 4, syllable: 'tune.' },
  ],
};

const SAKURA_MELODY: SongMelody = {
  beats: 32,
  harmony: [
    { beat: 0, chord: 'Am' },
    { beat: 4, chord: 'Dm' },
    { beat: 8, chord: 'Am' },
    { beat: 12, chord: 'E7' },
    { beat: 16, chord: 'Am' },
    { beat: 20, chord: 'F' },
    { beat: 24, chord: 'Dm' },
    { beat: 28, chord: 'E7' },
  ],
  notes: [
    { midi: 69, beat: 0, dur: 1, syllable: 'Sa-' },
    { midi: 69, beat: 1, dur: 1, syllable: 'ku-' },
    { midi: 71, beat: 2, dur: 2, syllable: 'ra,' },
    { midi: 69, beat: 4, dur: 1, syllable: 'sa-' },
    { midi: 69, beat: 5, dur: 1, syllable: 'ku-' },
    { midi: 71, beat: 6, dur: 2, syllable: 'ra,' },
    { midi: 69, beat: 8, dur: 1, syllable: 'ya-' },
    { midi: 71, beat: 9, dur: 1, syllable: 'yo-' },
    { midi: 72, beat: 10, dur: 1, syllable: 'i' },
    { midi: 71, beat: 11, dur: 1, syllable: 'no' },
    { midi: 69, beat: 12, dur: 1, syllable: 'so-' },
    { midi: 71, beat: 13, dur: 0.5, syllable: 'ra' },
    { midi: 69, beat: 13.5, dur: 0.5, syllable: 'wa' },
    { midi: 65, beat: 14, dur: 2, syllable: 'mi-' },
    { midi: 64, beat: 16, dur: 1, syllable: 'wa-' },
    { midi: 60, beat: 17, dur: 1, syllable: 'ta-' },
    { midi: 64, beat: 18, dur: 1, syllable: 'su' },
    { midi: 65, beat: 19, dur: 1, syllable: 'ka-' },
    { midi: 64, beat: 20, dur: 1, syllable: 'gi-' },
    { midi: 64, beat: 21, dur: 0.5, syllable: 'ri' },
    { midi: 60, beat: 21.5, dur: 0.5, syllable: 'ka-' },
    { midi: 59, beat: 22, dur: 2, syllable: 'su-' },
    { midi: 69, beat: 24, dur: 1, syllable: 'mi' },
    { midi: 71, beat: 25, dur: 1, syllable: 'ka' },
    { midi: 72, beat: 26, dur: 2, syllable: 'ku-' },
    { midi: 71, beat: 28, dur: 1, syllable: 'mo' },
    { midi: 69, beat: 29, dur: 1, syllable: 'ka' },
    { midi: 64, beat: 30, dur: 2, syllable: 'na.' },
  ],
};

const SHENANDOAH_MELODY: SongMelody = {
  beats: 24,
  harmony: [
    { beat: 0, chord: 'D' },
    { beat: 4, chord: 'G' },
    { beat: 8, chord: 'D' },
    { beat: 12, chord: 'Bm' },
    { beat: 16, chord: 'G' },
    { beat: 18, chord: 'A7' },
    { beat: 20, chord: 'D' },
  ],
  notes: [
    { midi: 62, beat: 0, dur: 1, syllable: 'Oh' },
    { midi: 66, beat: 1, dur: 1, syllable: 'Shen-' },
    { midi: 66, beat: 2, dur: 1, syllable: 'an-' },
    { midi: 69, beat: 3, dur: 1.5, syllable: 'do-' },
    { midi: 71, beat: 4.5, dur: 0.5, syllable: 'ah,' },
    { midi: 74, beat: 5, dur: 1, syllable: 'I' },
    { midi: 73, beat: 6, dur: 1, syllable: 'long' },
    { midi: 69, beat: 7, dur: 1, syllable: 'to' },
    { midi: 71, beat: 8, dur: 1.5, syllable: 'hear' },
    { midi: 69, beat: 9.5, dur: 2.5, syllable: 'you,' },
    { midi: 74, beat: 12, dur: 1, syllable: 'A-' },
    { midi: 73, beat: 13, dur: 1, syllable: 'way,' },
    { midi: 69, beat: 14, dur: 2, syllable: 'you' },
    { midi: 71, beat: 16, dur: 1, syllable: 'roll-' },
    { midi: 69, beat: 17, dur: 1, syllable: 'ing' },
    { midi: 66, beat: 18, dur: 1, syllable: 'ri-' },
    { midi: 64, beat: 19, dur: 1, syllable: 'ver' },
    { midi: 62, beat: 20, dur: 4, syllable: 'wide.' },
  ],
};

export const INITIAL_SONGS: Song[] = [
  parseChordPro(
    `{title: Amazing Grace}
{artist: John Newton · Traditional}
{key: G}
{tempo: 88}
{time: 3/4}

{start_of_verse: Verse 1}
A[G]mazing grace, how [C]sweet the [G]sound
That [Em]saved a wretch like [D7]me
I [G]once was [G7]lost, but [C]now am [G]found
Was [Em]blind, but [D7]now I [G]see
{end_of_verse}

{start_of_chorus: Chorus}
'Twas [G]grace that taught my [C]heart to [G]fear
And [Em]grace my fears re[D7]lieved
How [G]precious [G7]did that [C]grace ap[G]pear
The [Em]hour I [D7]first be[G]lieved
{end_of_chorus}

{start_of_verse: Verse 2}
Through [G]many dangers, [C]toils and [G]snares
I [Em]have already [D7]come
'Tis [G]grace hath [G7]brought me [C]safe thus [G]far
And [Em]grace will [D7]lead me [G]home
{end_of_verse}`,
    'song_amazing_grace',
    AMAZING_GRACE_MELODY
  ),

  parseChordPro(
    `{title: Wayfaring Stranger}
{artist: Appalachian Folk Standard}
{key: Am}
{tempo: 84}
{time: 4/4}

{start_of_verse: Verse 1}
I [Am]am a poor wayfaring [Dm]stranger
While [Am]traveling through this world of [E7]woe
Yet [Am]there's no sickness, toil, nor [Dm]danger
In [Am]that bright [E7]land to which I [Am]go
{end_of_verse}

{start_of_chorus: Chorus}
I'm [F]going there to see my [C]father
I'm [F]going there no more to [E7]roam
I'm [Am]only going over [Dm]Jordan
I'm [Am]only [E7]going over [Am]home
{end_of_chorus}

{start_of_bridge: Bridge}
{comment: Let Kora or Sitar layer shimmer on held chords}
I [Dm]know dark clouds will gather [Am]round me
I [G]know my way is rough and [C]steep [E7]
Yet [Am]beauteous fields lie just be[Dm]fore me
Where [Am]God's re[E7]deemed their vigils [Am]keep
{end_of_bridge}`,
    'song_wayfaring',
    WAYFARING_MELODY
  ),

  parseChordPro(
    `{title: Midnight River}
{artist: Hope Studio Sessions}
{key: C}
{tempo: 96}
{time: 4/4}

{start_of_verse: Verse 1}
[Fmaj7]Silver lights across the [Em7]harbor
[Dm7]Drifting past the timber [Cmaj7]pier
[Fmaj7]Every chord a quiet [Em7]anchor
[Dm7]Hold the sustain [G7]clear
{end_of_verse}

{start_of_chorus: Chorus}
Float the [Fmaj7]lyrics on the [G7]screen
Let the [Em7]Rhodes and Koto [Am7]lean
From the [Dm7]root note in your [G7]thumb
To the [Cmaj7]pocket of the [C7]drum
{end_of_chorus}

{start_of_bridge: Bridge}
[Abmaj7]Step outside the diatonic [G7]line
[Dm7]Voice-lead smoothly [G7]back in [Cmaj7]time
{end_of_bridge}`,
    'song_midnight_river',
    MIDNIGHT_RIVER_MELODY
  ),

  parseChordPro(
    `{title: House of the Rising Sun}
{artist: Traditional Ballad}
{key: Am}
{tempo: 78}
{time: 3/4}

{start_of_verse: Verse 1}
There [Am]is a [C]house in [D]New Or[F]leans
They [Am]call the [C]Rising [E7]Sun
And it's [Am]been the [C]ruin of [D]many a poor [F]boy
And [Am]God, I [E7]know I'm [Am]one [E7]
{end_of_verse}

{start_of_verse: Verse 2}
My [Am]mother [C]was a [D]tailor [F]
She [Am]sewed my [C]new blue [E7]jeans
My [Am]father [C]was a [D]gamblin' [F]man
Down [Am]in New [E7]Or[Am]leans [E7]
{end_of_verse}`,
    'song_rising_sun',
    RISING_SUN_MELODY
  ),

  parseChordPro(
    `{title: Sakura Variations}
{artist: Traditional Japanese · Koto Study}
{key: Am}
{tempo: 76}
{time: 4/4}

{start_of_verse: Theme}
{comment: Select 13-String Koto on the Strings Layer}
[Am]Sakura, [Dm]sakura, [Am]yayoi no [E7]sora wa
[Am]Miwatasu [F]kagiri, [Dm]kasumi ka [E7]kumo ka
[Am]Nioi zo [Dm]izuru, [Am]izaya [E7]izaya
[Dm]Mini [E7]yuka[Am]n
{end_of_verse}`,
    'song_sakura',
    SAKURA_MELODY
  ),

  parseChordPro(
    `{title: Shenandoah}
{artist: American River Ballad}
{key: D}
{tempo: 82}
{time: 4/4}

{start_of_verse: Verse 1}
Oh [D]Shenan[G]doah, I [D]long to [Bm]hear you
A[G]way, you [A7]rolling [D]river
Oh [G]Shenan[F#m]doah, I [Bm]long to [G]hear you
A[D]way, I'm [A7]bound a[G]way
'Cross the [A7]wide Mis[D]souri
{end_of_verse}`,
    'song_shenandoah',
    SHENANDOAH_MELODY
  ),
];

export const INITIAL_SETLISTS: Setlist[] = [
  {
    id: 'set_busking',
    name: 'Acoustic Busking',
    songIds: ['song_amazing_grace', 'song_wayfaring', 'song_rising_sun', 'song_shenandoah'],
  },
  {
    id: 'set_world',
    name: 'World & Studio Layers',
    songIds: ['song_midnight_river', 'song_sakura', 'song_wayfaring'],
  },
  {
    id: 'set_sunday',
    name: 'Sunday Morning',
    songIds: ['song_amazing_grace', 'song_shenandoah', 'song_midnight_river'],
  },
];
