"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getWorkflowBySlug } from "@/lib/workflows";

interface Breadcrumb {
  label: string;
  href: string;
}

function getBreadcrumbs(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: "Dashboard", href: "/" }];

  if (pathname === "/") return crumbs;

  if (pathname.startsWith("/workflows")) {
    crumbs.push({ label: "Workflows", href: "/workflows" });

    const slug = pathname.split("/workflows/")[1];
    if (slug) {
      const workflow = getWorkflowBySlug(slug);
      crumbs.push({
        label: workflow?.title ?? slug,
        href: pathname,
      });
    }
  }

  return crumbs;
}

export function TopBar() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-6">
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {isLast ? (
                <span className="font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <Avatar className="h-7 w-7">
        <AvatarFallback className="bg-gold/15 text-xs font-medium text-gold">
          BP
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
