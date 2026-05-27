import type { PresenceUpdate } from "./hookPayload.js";

export interface SelectedPresence {
  update: PresenceUpdate;
  startedAt: number;
}

interface SessionPresence {
  update: PresenceUpdate;
  startedAt: number;
  sequence: number;
}

const UNKNOWN_SESSION_ID = "__unknown__";

export class PresenceSessions {
  #sessions = new Map<string, SessionPresence>();
  #sequence = 0;

  update(update: PresenceUpdate): SelectedPresence {
    const sessionId = update.sessionId ?? UNKNOWN_SESSION_ID;
    const existing = this.#sessions.get(sessionId);
    const session: SessionPresence = {
      update,
      startedAt: startedAtForUpdate(existing, update),
      sequence: this.#sequence
    };
    this.#sequence += 1;
    this.#sessions.set(sessionId, session);

    const selected = this.#selectSession();
    return {
      update: selected.update,
      startedAt: selected.startedAt
    };
  }

  displayedPhase(): PresenceUpdate["phase"] | undefined {
    return this.#selectSessionOrUndefined()?.update.phase;
  }

  #selectSession(): SessionPresence {
    const selected = this.#selectSessionOrUndefined();
    if (!selected) {
      throw new Error("presence session selection requires at least one update");
    }
    return selected;
  }

  #selectSessionOrUndefined(): SessionPresence | undefined {
    const sessions = [...this.#sessions.values()];
    return newest(sessions.filter((session) => session.update.phase !== "idle")) ?? newest(sessions);
  }
}

function startedAtForUpdate(existing: SessionPresence | undefined, update: PresenceUpdate): number {
  if (update.eventName === "SessionStart" || existing === undefined) {
    return update.timestamp;
  }
  return existing.startedAt;
}

function newest(sessions: SessionPresence[]): SessionPresence | undefined {
  return sessions.reduce<SessionPresence | undefined>((selected, session) => {
    if (!selected || session.sequence > selected.sequence) {
      return session;
    }
    return selected;
  }, undefined);
}
