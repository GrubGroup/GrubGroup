import { useState } from "react";
import type { Session } from "@/types";
import { Button, Chip, Icon, Input, Modal } from "@/components/ui";
import { usePlacesInput } from "@/hooks/usePlacesInput";
import { cn } from "@/utils/cn";
import { createSession, geocodeAddress } from "@/api/sessionApi";

export interface HostSessionModalProps {
  open: boolean;
  onClose: () => void;
  groupId: number;
  /** Called with the created Session after a successful POST /api/sessions. */
  onCreated: (session: Session) => void;
}

// Occasion preset chips (from the Figma). A chip sets the occasion; the free-text
// field overrides so the host can type anything.
const OCCASION_PRESETS = ["Dinner", "Group lunch", "Date", "Coffee chat"];

// "Members answer within" options (minutes) — drives the expiry timer.
const TIME_LIMIT_OPTIONS = [2, 5, 10, 15, 30, 60];

// Hour options for the scheduled time dropdown (12h labels -> 24h value).
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const label =
    h === 0
      ? "12:00 AM"
      : h < 12
        ? `${h}:00 AM`
        : h === 12
          ? "12:00 PM"
          : `${h - 12}:00 PM`;
  return { value: h, label };
});

type GeoStatus = "idle" | "checking" | "ok" | "notfound";

// Today's date as yyyy-mm-dd for the <input type="date"> min + default.
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The host's pre-session setup: occasion, meeting location (geocode-validated),
// date/time (Now or scheduled), and the answer window. On submit it creates the
// session — the gateway geocodes + seeds the host's Qa row.
export function HostSessionModal({
  open,
  onClose,
  groupId,
  onCreated,
}: HostSessionModalProps) {
  const [occasion, setOccasion] = useState("");
  const location = usePlacesInput("");
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");

  const [timeMode, setTimeMode] = useState<"now" | "schedule">("now");
  const [date, setDate] = useState(todayIso());
  const [hour, setHour] = useState(19); // 7 PM default

  const [timeLimit, setTimeLimit] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedAddress = location.value.trim();

  // Validate + geocode the typed location. Blocks submit until it resolves.
  const validateLocation = async () => {
    if (!trimmedAddress) {
      setGeoStatus("idle");
      return;
    }
    setGeoStatus("checking");
    try {
      const res = await geocodeAddress(trimmedAddress);
      setGeoStatus(res.ok ? "ok" : "notfound");
    } catch {
      setGeoStatus("notfound");
    }
  };

  // Editing the address invalidates a prior geocode result.
  const handleAddressChange = (value: string) => {
    location.setValue(value);
    if (geoStatus !== "idle") setGeoStatus("idle");
  };

  const canSubmit =
    Boolean(trimmedAddress) && geoStatus === "ok" && !submitting;

  const buildScheduledFor = (): string | "now" => {
    if (timeMode === "now") return "now";
    // Compose local date + hour into an ISO instant.
    const dt = new Date(`${date}T00:00:00`);
    dt.setHours(hour, 0, 0, 0);
    return dt.toISOString();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await createSession({
        group_id: groupId,
        time_limit: timeLimit,
        occasion: occasion.trim() || null,
        scheduled_for: buildScheduledFor(),
        location_address: trimmedAddress,
      });
      onCreated(session);
    } catch {
      setError("Could not start the session. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a group session"
      size="md"
    >
      <div className="flex flex-col gap-5">
        {/* Occasion */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text">
            What's the occasion?
          </label>
          <div className="flex flex-wrap gap-2">
            {OCCASION_PRESETS.map((preset) => (
              <Chip
                key={preset}
                label={preset}
                selected={occasion === preset}
                onToggle={() => setOccasion(occasion === preset ? "" : preset)}
              />
            ))}
          </div>
          <Input
            placeholder="Or type your own (e.g. Priya's birthday)"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
          />
        </div>

        {/* Location — geocode-validated */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text">
            Where should we meet?
          </label>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                leftIcon={<Icon name="map-pin" size={14} />}
                placeholder="Downtown San Francisco, CA"
                value={location.value}
                onChange={(e) => handleAddressChange(e.target.value)}
                onBlur={() => void validateLocation()}
                error={
                  geoStatus === "notfound"
                    ? "Couldn't find that place — try another."
                    : undefined
                }
                hint={geoStatus === "ok" ? "✓ Location confirmed" : undefined}
              />
            </div>
            <Button
              variant="ghost"
              size="md"
              isLoading={geoStatus === "checking"}
              disabled={!trimmedAddress || geoStatus === "ok"}
              onClick={() => void validateLocation()}
            >
              {geoStatus === "ok" ? "Confirmed" : "Check"}
            </Button>
          </div>
        </div>

        {/* Date & time — Now / Schedule */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text">When?</label>
          <div className="flex gap-2">
            {(["now", "schedule"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTimeMode(mode)}
                className={cn(
                  "flex-1 rounded-input border px-3 py-2 text-sm font-medium transition-colors",
                  timeMode === mode
                    ? "border-surface-inverse bg-surface-inverse text-white"
                    : "border-border bg-surface-sunken text-text-muted hover:border-border-strong",
                )}
              >
                {mode === "now" ? "Now" : "Schedule"}
              </button>
            ))}
          </div>
          {timeMode === "schedule" && (
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                min={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 flex-1 rounded-input border border-border bg-surface-sunken px-3 text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
              />
              <select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="h-11 flex-1 rounded-input border border-border bg-surface-sunken px-3 text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
              >
                {HOUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Answer window */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text">
            Members answer within
          </label>
          <select
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="h-11 rounded-input border border-border bg-surface-sunken px-3 text-text focus:outline-none focus:ring-2 focus:ring-focus-ring"
          >
            {TIME_LIMIT_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="accent"
            leftIcon={<Icon name="sparkles" size={14} />}
            disabled={!canSubmit}
            isLoading={submitting}
            onClick={() => void handleSubmit()}
          >
            Start session
          </Button>
        </div>
      </div>
    </Modal>
  );
}
