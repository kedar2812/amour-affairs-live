"use client";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useTeam } from "@/lib/useData";
import { assetUrl } from "@/lib/api";

/*
 * Team Status — live from the dashboard Team page (team_members table).
 * Avatar (photo or initials) with status dot, role / current assignment.
 */
const statusStyles: Record<string, { dot: string; bg: string; text: string }> = {
  "On Shoot": { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-500" },
  "Editing": { dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-500" },
  "Available": { dot: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-500" },
  "On Leave": { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
};
const defaultStatus = { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" };

type ApiMember = {
  id: number; name: string; role?: string; status?: string;
  current_assignment?: string; photo_path?: string; avatar_initials?: string;
};

export function TeamStatus() {
  const { data } = useTeam();
  const team = (data as unknown as ApiMember[]) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.32 }}
      className="h-full"
    >
      <div className="dash-card h-full flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <h3 className="dash-card-title">Team Status</h3>
          <Link href="/team" className="text-[13px] font-semibold text-primary hover:underline">
            Manage
          </Link>
        </div>

        <div className="flex-1 px-6 pb-5 space-y-4 overflow-y-auto">
          {team.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 gap-2">
              <UserPlus className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">No team members yet</p>
              <Link href="/team" className="text-[12px] font-semibold text-primary hover:underline">Add your team →</Link>
            </div>
          )}
          {team.map((member) => {
            const sty = statusStyles[member.status || ""] || defaultStatus;
            const photo = member.photo_path ? assetUrl(member.photo_path) : "";
            const initials = (member.avatar_initials || member.name || "?").slice(0, 2).toUpperCase();
            return (
              <div key={member.id} className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-card shadow-sm bg-primary/10 flex items-center justify-center">
                    {photo ? (
                      <img src={photo} alt={member.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[11px] font-bold text-primary">{initials}</span>
                    )}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${sty.dot} ring-2 ring-card`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-[14px] font-semibold text-foreground truncate">{member.name}</h5>
                  <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                    {member.current_assignment
                      ? <>Working on <span className="font-medium text-foreground">{member.current_assignment}</span></>
                      : (member.role || "Team member")}
                  </p>
                </div>
                {member.status && (
                  <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md ${sty.bg} ${sty.text}`}>
                    {member.status}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
