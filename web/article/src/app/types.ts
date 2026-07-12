export interface BiText { en: string; zh: string }

export interface Author {
  name: string;
  nameZh: string;
  affKeys: string; // e.g. "a,b"
  email?: string;
}

export interface Affiliation {
  key: string; // "a","b","c"…
  text: string;
  textZh: string;
}

export interface Subsection {
  id: string;
  number: string;
  title: BiText;
  content: BiText;
}

export interface Section {
  id: string;
  number: string;
  title: BiText;
  content: BiText;
  subsections: Subsection[];
}

export interface FigureItem {
  id: string;
  number: number;
  caption: BiText;
  placeholder: string; // visual description / colour placeholder
  src?: string; // real backend image URL when available
  sectionId?: string; // nearest section in the source document
  order?: number; // source order shared by figures and tables
}

export interface TableCell {
  text: string;
  colspan?: number;
  rowspan?: number;
  isHeader?: boolean;
  align?: string;
}

export interface TableRow { cells: string[] }

export interface TableItem {
  id: string;
  number: number;
  caption: BiText;
  headers: string[];
  rows: TableRow[];
  headerRows?: TableCell[][];
  bodyRows?: TableCell[][];
  footnotes?: string[];
  sectionId?: string;
  order?: number;
}

export interface PaperData {
  journal: string;
  journalZh: string;
  issn: string;
  doi: string;
  volume: string;
  year: string;
  pages: string;
  received: string;
  revised: string;
  accepted: string;
  title: BiText;
  authors: Author[];
  affiliations: Affiliation[];
  highlights: string[];
  highlightsZh: string[];
  abstract: BiText;
  keywords: { en: string[]; zh: string[] };
  sections: Section[];
  figures: FigureItem[];
  tables: TableItem[];
  references: string[];
}
