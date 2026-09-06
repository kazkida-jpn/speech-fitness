/** A paragraph is a string; a bullet list is an array of strings. */
export type LegalBlock = string | string[];

export type LegalSection = { heading: string; blocks: LegalBlock[] };

export type LegalDocument = {
  title: string;
  lead: string;
  sections: LegalSection[];
};
