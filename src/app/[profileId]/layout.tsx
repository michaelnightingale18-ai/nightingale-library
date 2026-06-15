"use client";
import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { SidebarNav } from "@/components/shelf/SidebarNav";
import CelebrationModal from "@/components/CelebrationModal";
import type { Profile } from "@/lib/types";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const profileId = params.profileId as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { setCurrentProfile, celebrationBook, hideCelebration } = useStore();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();
      if (data) {
        setProfile(data);
        setCurrentProfile(data);
      }
      setLoading(false);
    }
    load();
  }, [profileId, setCurrentProfile]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center wood-bg">
        <div className="text-6xl animate-bounce">📚</div>
      </div>
    );
  }

  if (!profile) {
    notFound();
  }

  return (
    <div
      className="h-full flex overflow-hidden wood-bg"
      style={{ "--profile-color": profile.color } as React.CSSProperties}
    >
      <SidebarNav profileId={profileId} profile={profile} />
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
      <CelebrationModal
        book={celebrationBook}
        profileName={profile.name}
        onClose={hideCelebration}
      />
    </div>
  );
}
