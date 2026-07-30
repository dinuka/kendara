import { SEARCH_VOCABULARY, vocabularySkeleton } from "@/lib/search/vocabulary";

const MAX_SUGGESTIONS = 8;

// Matches the typed token against any individual word inside a vocabulary
// entry (multi-word entries like "පූර්ව ඵල්ගුනී" or "purva ashadha" match on
// either word), so a suggestion is only ever offered for text that
// getAstroKeywords/getExactMatch in the search API can also parse.
export const getSuggestions = (lastToken: string): string[] => {
    const token = vocabularySkeleton(lastToken);
    if (!token) return [];

    const matches: string[] = [];
    const seen = new Set<string>();

    for (const word of SEARCH_VOCABULARY) {
        const wordParts = word.split(/\s+/).map(vocabularySkeleton);
        const isMatch = wordParts.some((part) => part.startsWith(token));

        if (isMatch && !seen.has(word)) {
            seen.add(word);
            matches.push(word);
        }
    }

    matches.sort((a, b) => a.length - b.length || a.localeCompare(b));

    return matches.slice(0, MAX_SUGGESTIONS);
};

// Splits a search query into the tokens typed so far and the in-progress
// last token that autocomplete should match against.
export const splitLastToken = (query: string): { prefix: string; lastToken: string } => {
    const match = query.match(/^(.*?)(\S*)$/s);
    if (!match) return { prefix: "", lastToken: query };
    return { prefix: match[1], lastToken: match[2] };
};

export const insertSuggestion = (query: string, suggestion: string): string => {
    const { prefix } = splitLastToken(query);
    return `${prefix}${suggestion} `;
};
