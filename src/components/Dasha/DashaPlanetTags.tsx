"use client";

import { memo } from "react";

/** A text tag for a planet — the same tags as the planet table's "Other" column plus its dignity. */
export interface PlanetTag {
    key: string;
    text: string;
    strikethrough?: boolean;
}

interface DashaPlanetTagsProps {
    tags: PlanetTag[] | undefined;
}

const DashaPlanetTags = ({ tags }: DashaPlanetTagsProps) => {
    if (!tags || tags.length === 0) return null;

    return (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-0.5">
            {tags.map((tag) => (
                <span
                    key={tag.key}
                    className={`text-[10px] leading-tight px-1 rounded bg-gray-100 text-gray-600 whitespace-nowrap ${
                        tag.strikethrough ? "line-through" : ""
                    }`}
                >
                    {tag.text}
                </span>
            ))}
        </span>
    );
};

export default memo(DashaPlanetTags);
