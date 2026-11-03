"use client";

import { HUB_CATEGORIES, MAX_HUB_CATEGORIES } from "@/lib/hubCategories";

export default function CategoryPicker({ value, onChange, bare = false }: { value: string[]; onChange: (v: string[]) => void; bare?: boolean }) {
  const full = value.length >= MAX_HUB_CATEGORIES;
  const toggle = (tag: string) =>
    onChange(value.includes(tag) ? value.filter(t => t !== tag) : full ? value : [...value, tag]);

  return (
    <div className={`flex w-full flex-col gap-[6px] ${bare ? "" : "pt-[12px]"}`}>
      {!bare && (
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold leading-[20px] text-[#1c2533]">Categories</span>
          <span className={`text-[12.5px] font-semibold leading-[18px] ${full ? "text-[#8a3ffc]" : "text-[#98a0b4]"}`}>{value.length}/{MAX_HUB_CATEGORIES}</span>
        </div>
      )}
      <div className="max-h-[232px] overflow-y-auto rounded-[28px] border-[1.25px] border-[#e8e4f6] bg-[#fbfaff] p-[12px]">
        <div role="group" aria-label="Categories" className="flex flex-wrap gap-[8px]">
          {HUB_CATEGORIES.map(tag => {
            const on = value.includes(tag);
            return (
              <button
                key={tag} type="button" aria-pressed={on} disabled={!on && full} onClick={() => toggle(tag)}
                className={`h-[34px] rounded-[999px] border-[1.25px] px-[14px] text-[13px] leading-[20px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  on ? "border-[#8a3ffc] bg-[#8a3ffc] font-semibold text-white"
                    : "border-[#ddd8ee] bg-white text-[#1c2533] hover:border-[#8a3ffc] hover:text-[#8a3ffc]"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CategoryTags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-[8px]">
      {tags.map(t => (
        <span key={t} className="flex h-[30px] items-center rounded-[999px] border-[1.25px] border-[#e2d6ff] bg-[#f4f1ff] px-[12px] text-[12.5px] font-semibold text-[#8a3ffc]">{t}</span>
      ))}
    </div>
  );
}
