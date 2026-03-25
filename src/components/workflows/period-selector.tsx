"use client";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface PeriodSelectorProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  disabled?: boolean;
}

export function PeriodSelector({
  year,
  month,
  onChange,
  disabled,
}: PeriodSelectorProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

  return (
    <div className="flex items-center gap-2">
      <select
        value={month}
        onChange={(e) => onChange(year, Number(e.target.value))}
        disabled={disabled}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
      >
        {MONTHS.map((name, i) => (
          <option key={i + 1} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onChange(Number(e.target.value), month)}
        disabled={disabled}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
