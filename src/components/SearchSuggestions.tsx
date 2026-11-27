"use client";

import { useI18n } from "@/hooks/useI18n";

interface SearchSuggestionsProps {
    suggestions: string[];
    highlightedIndex: number;
    onSelect: (suggestion: string) => void;
    onHover: (index: number) => void;
}

const SearchSuggestions = ({ suggestions, highlightedIndex, onSelect, onHover }: SearchSuggestionsProps) => {
    const { t } = useI18n();

    if (suggestions.length === 0) return null;

    return (
        <ul
            role="listbox"
            aria-label={t("search.suggestions.ariaLabel")}
            className="absolute left-0 right-10 top-full mt-1 z-10 bg-white border rounded shadow-md overflow-hidden"
        >
            {suggestions.map((suggestion, i) => (
                <li
                    key={suggestion}
                    role="option"
                    aria-selected={i === highlightedIndex}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        onSelect(suggestion);
                    }}
                    onMouseEnter={() => onHover(i)}
                    className={`px-3 py-1.5 text-sm cursor-pointer ${
                        i === highlightedIndex ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-50"
                    }`}
                >
                    {suggestion}
                </li>
            ))}
        </ul>
    );
};

export default SearchSuggestions;
