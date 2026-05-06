"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

interface AppSummary {
  id: string;
  name: string;
  subtitle: string | null;
  category: string | null;
  status: string;
  logoLightUrl: string | null;
  clientId: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-700 text-zinc-300",
  submitted: "bg-blue-500/20 text-blue-400",
  in_review: "bg-amber-500/20 text-amber-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-red-500/20 text-red-400",
};

function CopyPublicAppIdButton({
  clientId,
}: {
  clientId: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    void navigator.clipboard.writeText(clientId).then(
      () => {
        setCopied(true);
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          setCopied(false);
        }, 2000);
      },
      () => {
        /* ignore */
      },
    );
  }, [clientId]);

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-md border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
      aria-label={copied ? "Copied" : "Copy public app id"}
    >
      {copied ? (
        <svg
          className="h-4 w-4 text-emerald-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

export default function AppsPage() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/apps")
      .then((r) => r.json())
      .then((data) => setApps(data.apps || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">My Apps</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your provider applications
          </p>
        </div>
        <Link
          href="/apps/new"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
        >
          Create New App
        </Link>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-center py-12 animate-pulse">
          Loading apps...
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-16 border border-zinc-800 rounded-xl bg-zinc-900/20">
          <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-zinc-300 mb-2">
            No apps yet
          </h2>
          <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">
            Create your first provider app to configure identity, plans, user
            management, and signer access.
          </p>
          <Link
            href="/apps/new"
            className="inline-flex px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors"
          >
            Create Your First App
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <div
              key={app.id}
              className="flex flex-col gap-3 p-5 border border-zinc-800 rounded-xl bg-zinc-900/30 hover:border-zinc-700 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/apps/${app.id}`}
                  className="flex h-10 w-10 shrink-0 bg-linear-to-br from-emerald-500/20 to-teal-500/20 rounded-lg items-center justify-center text-emerald-400 text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  {app.name[0]?.toUpperCase()}
                </Link>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    STATUS_COLORS[app.status] || STATUS_COLORS.draft
                  }`}
                >
                  {app.status.replace("_", " ")}
                </span>
              </div>

              <div className="flex items-start justify-between gap-3 min-w-0">
                <Link
                  href={`/apps/${app.id}`}
                  className="block min-w-0 flex-1 hover:opacity-95 transition-opacity"
                >
                  <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors leading-tight">
                    {app.name}
                  </h3>
                  {app.subtitle ? (
                    <p className="text-xs text-zinc-500 mt-0.5">{app.subtitle}</p>
                  ) : null}
                </Link>
                {app.clientId ? (
                  <div className="flex flex-col gap-2 shrink-0">
                    <Link
                      href={`/apps/${app.id}/usage`}
                      className="w-full px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 transition-colors text-center whitespace-nowrap"
                    >
                      Usage
                    </Link>
                    <Link
                      href={`/apps/${app.id}/plans`}
                      className="w-full px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 transition-colors text-center whitespace-nowrap"
                    >
                      Plans
                    </Link>
                  </div>
                ) : null}
              </div>

              {(app.category || app.clientId) ? (
                <div className="flex flex-col gap-2 mt-0.5 text-xs">
                  {app.category ? (
                    <Link
                      href={`/apps/${app.id}`}
                      className="text-zinc-500 hover:text-zinc-400 transition-colors w-fit"
                    >
                      {app.category}
                    </Link>
                  ) : null}
                  {app.clientId ? (
                    <div className="min-w-0">
                      <div className="text-zinc-500 mb-1">Public app id</div>
                      <div className="flex items-start gap-2 min-w-0">
                        <code className="text-zinc-400 font-mono text-xs leading-snug break-all flex-1 min-w-0">
                          {app.clientId}
                        </code>
                        <CopyPublicAppIdButton clientId={app.clientId} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
