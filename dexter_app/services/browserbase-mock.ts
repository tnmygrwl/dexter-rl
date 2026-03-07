/**
 * Mock tab data for demo purposes.
 * Each entry simulates what Browserbase scraping would return.
 */

const MOCK_TABS: Record<string, string> = {
  'wonderwall|oasis': `
Wonderwall - Oasis
Capo 2nd fret
Standard Tuning: E A D G B E
Key: F#m (sounds as G#m with capo)
Tempo: 87 BPM
Time Signature: 4/4

[Intro]
Em7  G  Dsus4  A7sus4

e|---0-------3-------0-------0---|
B|---3-------3-------3-------3---|
G|---0-------0-------2-------0---|
D|---2-------0-------0-------2---|
A|---2-------2-------x-------0---|
E|---0-------3-------x-------x---|

[Verse 1]
Em7              G
Today is gonna be the day
         Dsus4               A7sus4
That they're gonna throw it back to you
Em7              G
By now you should've somehow
       Dsus4                A7sus4
Realized what you gotta do

[Chorus]
      C        D           Em
And all the roads we have to walk are winding
      C        D              Em
And all the lights that lead us there are blinding
  C           D
There are many things
         G     D     Em
That I would like to say to you
        A7sus4
But I don't know how

      C   Em  G   Em
Because maybe
      C   Em   G    Em
You're gonna be the one that saves me
      C   Em  G   Em
And after all
                 A7sus4
You're my wonderwall
`,

  'wish you were here|pink floyd': `
Wish You Were Here - Pink Floyd
Standard Tuning: E A D G B E
Key: G major
Tempo: 60 BPM
Time Signature: 4/4

[Intro]
Em  G  Em  G  Em  A  Em  A  G

e|---0---0---0-----|---3---3---3-----|
B|---0---0---0-----|---3---3---3-----|
G|---0---0---0-----|---0---0---0-----|
D|---2---2---2-----|---0---0---0-----|
A|---2---2---2-----|---2---2---2-----|
E|---0---0---0-----|---3---3---3-----|

[Verse 1]
    C                          D
So, so you think you can tell
              Am                 G
Heaven from hell, blue skies from pain
                D                      C
Can you tell a green field from a cold steel rail?
              Am                        G
A smile from a veil? Do you think you can tell?

[Chorus]
  C                            D
How I wish, how I wish you were here
         Am
We're just two lost souls
                G
Swimming in a fish bowl
D                C
Year after year
`,

  'hotel california|eagles': `
Hotel California - Eagles
Standard Tuning: E A D G B E
Key: B minor
Tempo: 74 BPM
Time Signature: 4/4

[Intro]
Bm  F#  A  E  G  D  Em  F#

e|---2---2---0---0---3---2---0---2---|
B|---3---2---2---0---3---3---0---2---|
G|---4---3---2---1---0---2---0---3---|
D|---4---4---2---2---0---0---2---4---|
A|---2---4---0---2---2---x---2---4---|
E|---x---2---x---0---3---x---0---2---|

[Verse 1]
Bm                              F#
On a dark desert highway, cool wind in my hair
A                              E
Warm smell of colitas rising up through the air
G                              D
Up ahead in the distance I saw a shimmering light
Em                                    F#
My head grew heavy and my sight grew dim, I had to stop for the night

[Chorus]
G                         D
Welcome to the Hotel California
F#                                      Bm
Such a lovely place, such a lovely face
G                              D
Plenty of room at the Hotel California
Em                                            F#
Any time of year, you can find it here
`,

  'nothing else matters|metallica': `
Nothing Else Matters - Metallica
Standard Tuning: E A D G B E
Key: E minor
Tempo: 69 BPM
Time Signature: 6/8

[Intro]
Em

e|---0-----0---0-----0---0-----0---|
B|-----0-------0-------0-------0---|
G|-------0-------0-------0---------|
D|---2-----------2-----------2-----|
A|---------------------------------|
E|---0-----------0-----------0-----|

e|---0-----0---0-----0---0-----0---|
B|-----0-------0-------0-------0---|
G|-------0-------0-------0---------|
D|---------------------------------|
A|---2-----------2-----------2-----|
E|---0-----------0-----------0-----|

[Verse 1]
Em              D        C
So close no matter how far
Em              D         C
Couldn't be much more from the heart
Em            D           C
Forever trusting who we are
G  B7        Em
And nothing else matters

[Chorus]
C   A
Never opened myself this way
D                   Em
Life is ours, we live it our way
C    A
All these words I don't just say
D              Em
And nothing else matters
`,
};

export function getMockRawTab(title: string, artist: string): string | null {
  const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;

  for (const [mockKey, tab] of Object.entries(MOCK_TABS)) {
    if (key.includes(mockKey.split('|')[0]) || mockKey.split('|')[0].includes(title.toLowerCase())) {
      return tab.trim();
    }
  }

  return null;
}

export function getAvailableMockSongs(): { title: string; artist: string }[] {
  return Object.keys(MOCK_TABS).map((key) => {
    const [title, artist] = key.split('|');
    return {
      title: title.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
      artist: artist.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
    };
  });
}
