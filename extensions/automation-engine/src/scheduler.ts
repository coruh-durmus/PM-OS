/**
 * Cron-based automation scheduler for PM-OS.
 *
 * Supports standard 5-field cron expressions (minute hour day-of-month month day-of-week)
 * with wildcards, specific values, ranges (e.g. 1-5), and lists (e.g. 1,3,5).
 */

export interface AutomationConfig {
  id: string;
  name: string;
  /** Cron expression: "minute hour day month weekday" */
  schedule: string;
  actions: ActionConfig[];
  enabled: boolean;
}

export interface ActionConfig {
  type: string;
  params: Record<string, unknown>;
}

export type AutomationHandler = (config: AutomationConfig) => void | Promise<void>;

interface RegisteredAutomation {
  config: AutomationConfig;
  handler: AutomationHandler;
}

/**
 * Parse a single cron field and check whether the given value matches.
 *
 * Supported syntax per field:
 *   *        – any value
 *   5        – exact value
 *   1-5      – inclusive range
 *   1,3,5    – list of values (each element can itself be a range)
 */
function matchesCronField(field: string, value: number): boolean {
  if (field === '*') return true;

  // A field may contain comma-separated parts, each of which is either a
  // literal number or a range.
  const parts = field.split(',');
  return parts.some((part) => {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Number(startStr);
      const end = Number(endStr);
      return value >= start && value <= end;
    }
    return Number(part) === value;
  });
}

/**
 * Determine whether a cron expression matches a given Date.
 *
 * The expression must contain exactly 5 space-separated fields:
 *   minute  hour  day-of-month  month(1-12)  day-of-week(0=Sun..6=Sat)
 *
 * Returns `false` for empty or malformed expressions.
 */
export function matchesCron(schedule: string, date: Date): boolean {
  const trimmed = schedule.trim();
  if (trimmed === '') return false;

  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) return false;

  const [minuteField, hourField, dayField, monthField, weekdayField] = fields;

  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // JS months are 0-based
  const dayOfWeek = date.getDay(); // 0 = Sunday

  return (
    matchesCronField(minuteField, minute) &&
    matchesCronField(hourField, hour) &&
    matchesCronField(dayField, dayOfMonth) &&
    matchesCronField(monthField, month) &&
    matchesCronField(weekdayField, dayOfWeek)
  );
}

export class Scheduler {
  private automations = new Map<string, RegisteredAutomation>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  /** Tracks last-fired minute key per automation so we fire at most once per minute. */
  private lastFired = new Map<string, string>();

  /**
   * Register an automation config together with the handler to invoke when
   * the schedule matches.
   */
  register(config: AutomationConfig, handler: AutomationHandler): void {
    this.automations.set(config.id, { config, handler });
  }

  /**
   * Unregister an automation by id.
   */
  unregister(id: string): void {
    this.automations.delete(id);
    this.lastFired.delete(id);
  }

  /**
   * Start the scheduler. Every 30 seconds, checks registered automations
   * against the current time and fires any that match.
   */
  start(): void {
    if (this.intervalId !== null) return;

    this.intervalId = setInterval(() => {
      this.tick(new Date());
    }, 30_000);
  }

  /**
   * Stop the scheduler, clearing the check interval.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Perform a single tick -- evaluate all registered automations against
   * the supplied date. Exposed publicly so tests can drive it directly.
   */
  tick(now: Date): void {
    const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

    for (const [id, entry] of this.automations) {
      if (!entry.config.enabled) continue;
      if (entry.config.schedule.trim() === '') continue;
      if (!matchesCron(entry.config.schedule, now)) continue;

      // Prevent firing more than once per minute window
      if (this.lastFired.get(id) === minuteKey) continue;

      this.lastFired.set(id, minuteKey);
      entry.handler(entry.config);
    }
  }
}
