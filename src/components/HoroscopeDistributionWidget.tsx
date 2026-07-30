"use client";

interface DistributionItem {
    id: number;
    count: number;
}

interface HoroscopeDistributionWidgetProps {
    title: string;
    emptyLabel: string;
    items: DistributionItem[];
    getLabel: (id: number) => string;
    getSymbol?: (id: number) => string;
}

export default function HoroscopeDistributionWidget({
    title,
    emptyLabel,
    items,
    getLabel,
    getSymbol,
}: HoroscopeDistributionWidgetProps) {
    const maxCount = items.length > 0 ? items[0].count : 0;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{title}</h2>

            {items.length === 0 ? (
                <div className="text-sm text-gray-400 py-6 text-center">{emptyLabel}</div>
            ) : (
                <ul className="space-y-2.5">
                    {items.map(({ id, count }) => (
                        <li key={id} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 truncate text-sm text-gray-600 flex items-center gap-1.5">
                                {getSymbol && <span className="text-indigo-500">{getSymbol(id)}</span>}
                                {getLabel(id)}
                            </span>
                            <div className="flex-1 h-3 rounded-full bg-indigo-50 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-indigo-500"
                                    style={{ width: `${(count / maxCount) * 100}%` }}
                                />
                            </div>
                            <span className="w-6 shrink-0 text-right text-sm font-semibold text-gray-700 tabular-nums">
                                {count}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
