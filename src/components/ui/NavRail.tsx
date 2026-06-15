"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { wood } from "@/lib/theme";
import type { LucideIcon } from "lucide-react";

/**
 * NavRail — vertical sidebar navigation primitive.
 *
 * Accepts an `items` array + `activeColor` for the highlight.
 * Matching is done by exact path or prefix depending on `exact`.
 * Everything above the nav items goes in `header`.
 */
export interface NavItem {
  href:   string;
  icon:   LucideIcon;
  label:  string;
  exact?: boolean;
}

interface Props {
  items:       NavItem[];
  activeColor: string;
  header?:     React.ReactNode;
  width?:      number;
}

export function NavRail({ items, activeColor, header, width = 76 }: Props) {
  const pathname = usePathname();

  function active(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <nav
      className="flex-shrink-0 flex flex-col items-center py-6 gap-1"
      style={{
        width,
        background: `linear-gradient(180deg, #17110B 0%, #0F0904 100%)`,
        borderRight: "1px solid rgba(243,199,91,0.07)",
      }}
    >
      {header && <div className="mb-4 w-full flex flex-col items-center">{header}</div>}

      <div className="w-8 h-px mb-2" style={{ background: "rgba(255,255,255,0.07)" }} />

      {items.map(({ href, icon: Icon, label, exact }) => {
        const on = active(href, exact);
        return (
          <Link
            key={href}
            href={href}
            className="relative flex flex-col items-center gap-1 w-full px-2 py-2.5 rounded-xl transition-all duration-200"
            style={{
              background: on
                ? `linear-gradient(135deg, ${activeColor}30, ${activeColor}14)`
                : "transparent",
              border: on ? `1px solid ${activeColor}28` : "1px solid transparent",
            }}
          >
            {/* Active left pill */}
            {on && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                style={{ backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}88` }}
              />
            )}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: on ? `${activeColor}50` : "transparent",
                boxShadow:  on ? `0 0 18px ${activeColor}60` : "none",
              }}
            >
              <Icon size={21} style={{ color: on ? activeColor : "rgba(255,255,255,0.28)" }} />
            </div>
            <span
              className="text-[9px] font-bold leading-none"
              style={{ color: on ? activeColor : "rgba(255,255,255,0.22)" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
