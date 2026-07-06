"use client";

import type { AlertItem } from "@/lib/types";

interface AlertPanelProps {
  alerts: AlertItem[];
  onClear: () => void;
}

const alertIcons: Record<string, string> = {
  bullish_momentum: "📈",
  bearish_momentum: "📉",
  support_strengthening: "🛡️",
  support_weakening: "⚠️",
  resistance_strengthening: "🔒",
  resistance_weakening: "🔓",
  momentum_reversal: "🔄",
};

export default function AlertPanel({ alerts, onClear }: AlertPanelProps) {
  return (
    <div className="w-72 border-l border-border bg-bg-secondary flex flex-col shrink-0 hidden lg:flex">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <svg
            className="w-4 h-4 text-accent-yellow"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          Alerts
          {alerts.length > 0 && (
            <span className="text-xs bg-accent-yellow/20 text-accent-yellow rounded-full px-1.5 py-0.5">
              {alerts.length}
            </span>
          )}
        </h2>
        {alerts.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-muted text-sm">
            <p>No alerts yet</p>
            <p className="text-xs mt-1">Alerts appear when significant momentum is detected</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="px-4 py-3 hover:bg-bg-card transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">
                    {alertIcons[alert.type] || "📊"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary leading-snug">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-text-muted">
                        {formatAlertTime(alert.timestamp)}
                      </span>
                      {alert.score > 0 && (
                        <span
                          className={`text-xs font-medium ${
                            alert.score >= 70
                              ? "text-accent-green"
                              : alert.score >= 50
                                ? "text-accent-yellow"
                                : "text-accent-red"
                          }`}
                        >
                          Score: {alert.score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatAlertTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}
