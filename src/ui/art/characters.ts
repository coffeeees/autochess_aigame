// Character art registry (decision D6).
//   portrait: illustration for cards, codex and detail views (45 planned)
//   sprite:   pixel (dot) sprite sheet for the battlefield (planned)
// A character without art falls back to the SVG avatar (avatar.js), so art can be
// added one character at a time by adding an entry here; nothing else changes.
// Files live in public/assets/characters/ with lowercase-hyphen names.

export type ArtContext = 'field' | 'bench' | 'shop' | 'detail';

export interface Framing {
  scale: number; // zoom of the thumbnail inside its frame
  x: number; // focus point in % of the image
  y: number;
}

export interface Portrait {
  thumbnail: string; // small, square-ish crop source
  detail: string; // full illustration
  framing?: Partial<Record<ArtContext, Framing>>;
}

export interface SpriteSheet {
  src: string; // one PNG, frames in rows
  frameWidth: number;
  frameHeight: number;
  /** animation name -> { row, frames, fps }; 'idle' is required */
  animations: Record<string, { row: number; frames: number; fps: number }>;
  /** pixels per sprite pixel when drawn on the board (keeps dots crisp) */
  scale?: number;
}

export interface CharacterArt {
  portrait?: Portrait;
  sprite?: SpriteSheet;
}

export const characterArt: Readonly<Record<string, CharacterArt>> = {
  C01: {
    portrait: {
      thumbnail: 'assets/characters/c01-nox-thumbnail.png',
      detail: 'assets/characters/c01-nox.png',
      framing: {
        field: { scale: 3.2, x: 50, y: 40 },
        bench: { scale: 1.9, x: 50, y: 40 },
        shop: { scale: 1.8, x: 50, y: 40 },
      },
    },
  },
};

export const portraitOf = (id: string): Portrait | undefined => characterArt[id]?.portrait;
export const spriteOf = (id: string): SpriteSheet | undefined => characterArt[id]?.sprite;
