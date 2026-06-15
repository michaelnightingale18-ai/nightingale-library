"use client";
import { Home, BookOpen, Plus, Star, Bell, Settings } from "lucide-react";
import { NavRail } from "@/components/ui/NavRail";
import type { Profile } from "@/lib/types";

interface Props {
  profileId: string;
  profile:   Profile;
}

export function SidebarNav({ profileId, profile }: Props) {
  const items = [
    { href: "/",                             icon: Home,     label: "Home",    exact: true },
    { href: `/${profileId}`,                 icon: BookOpen, label: "Library", exact: true },
    { href: `/${profileId}/add`,             icon: Plus,     label: "Add",     exact: false },
    { href: `/${profileId}/recommendations`, icon: Star,     label: "For You", exact: false },
    { href: `/${profileId}/releases`,        icon: Bell,     label: "New",     exact: false },
    { href: `/${profileId}/settings`,        icon: Settings, label: "Settings", exact: false },
  ];

  return (
    <NavRail
      items={items}
      activeColor="#F3C75B"
      header={
        <div className="flex flex-col items-center gap-1 px-2">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${profile.color}55, ${profile.color}22)`,
              border:     `1.5px solid ${profile.color}44`,
            }}
          >
            {profile.avatar}
          </div>
          <span className="text-[9px] text-white/25 font-bold truncate max-w-[60px] text-center">
            {profile.name}
          </span>
        </div>
      }
    />
  );
}
