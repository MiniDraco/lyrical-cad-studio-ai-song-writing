export type TagCategory = 'Style' | 'Lyrics' | 'FX' | 'Mood' | 'Instruments' | 'Genre';

export interface TagLibrary {
  Style: string[];
  Lyrics: string[];
  FX: string[];
  Mood: string[];
  Instruments: string[];
  Genre: string[];
}

export interface LineData {
  id: string;
  text: string;
  syllableCount: number;
  suffix: string;
  rhymeColor: string;
  punctuation: string[];
}

export interface PillData {
  id: string;
  label: string;
  category: TagCategory | 'discovered' | 'CustomBranches';
}

export interface StyleBranch {
  id: string;
  name: string;
  pills: string[];
}
