"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PlusCircle, BarChart2, Sparkles } from "lucide-react";

interface Props {
  profileId: string;
  color: string;
}

export default function BottomNav({ profileId, color }: Props) {
  const pathname = usePathname();
  const base = `/${profileId}`;

  const tabs = [
    { href: base, label: "My Shelf", icon: BookOpen },
    { href: `${base}/add`, label: "Add Book", icon: PlusCircle },
    { href: `${base}/series`, label: "Series", icon: BarChart2 },
    { href: `${base}/recommendations`, label: "For You", icon: Sparkles },
  ];

  return (
    <nav className="bottom-nav flex-shrink-0 bg-white border-t border-gray-100 shadow-lg">
      <div className="flex justify-around items-stretch h-20">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-90"
              style={{ color: active ? color : "#9ca3af" }}
            >
              <Icon
                size={active ? 30 : 26}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className="text-xs font-bold leading-none"
                style={{ fontSize: "11px" }}
              >
                {label}
              </span>
              {active && (
                <div
                  className="absolute bottom-0 w-10 h-1 rounded-t-full"
                  style={{ backgroundColor: color }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
