import { addDays, istDate, type ISODate } from './dates';
import { isOpen, type Application, type Round } from './domain';

export type FollowUpEvent = 'created' | 'status_changed' | 'round_saved' | 'checked';

export type FollowUpInput = Pick<Application, 'status' | 'deadline' | 'applied_on'> & {
  rounds: Pick<Round, 'scheduled_at' | 'result'>[];
};

// Rules from the spec's "Follow-up rules" table, checked top to bottom.
export function suggestFollowUp(app: FollowUpInput, event: FollowUpEvent, today: ISODate): ISODate | null {
  if (!isOpen(app.status)) return null;
  if (app.status === 'to_apply') return app.deadline ? addDays(app.deadline, -1) : null;
  if (app.status === 'offer') return addDays(today, 3);

  const nextRound = app.rounds
    .filter((r) => r.result === 'upcoming' && r.scheduled_at)
    .map((r) => istDate(r.scheduled_at!))
    .sort()[0];
  if (nextRound) return addDays(nextRound, 1);

  if (app.status === 'in_progress') return addDays(today, 5);

  const base = event === 'created' || event === 'status_changed' ? (app.applied_on ?? today) : today;
  return addDays(base, 7);
}
