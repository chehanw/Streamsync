/**
 * useIPSSTaskSetup
 *
 * Seeds the three post-surgery IPSS follow-up tasks into the local Scheduler
 * exactly once, as soon as:
 *   1. The scheduler is ready
 *   2. A real (non-placeholder) surgery date is available
 *
 * Safe to call on every render — it checks for existing tasks before writing
 * and uses a ref to avoid redundant async calls within the same session.
 */

import { useEffect, useRef } from 'react';
import { useStandard } from '@/lib/services/standard-context';
import { useSurgeryDate } from '@/hooks/use-surgery-date';
import { createIPSSFollowUpTasks, IPSS_TASK_IDS } from '@/lib/tasks/ipss-tasks';

export function useIPSSTaskSetup(): void {
  const { scheduler } = useStandard();
  const surgeryDate = useSurgeryDate();
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    if (!scheduler) return;
    if (surgeryDate.isLoading) return;
    // Skip placeholder dates (dev only) — wait for a real surgery date
    if (!surgeryDate.date || surgeryDate.isPlaceholder) return;

    // Idempotency check: if the 1-month task already exists, all three were seeded
    if (scheduler.getTask(IPSS_TASK_IDS.ONE_MONTH)) {
      seededRef.current = true;
      return;
    }

    seededRef.current = true;

    const tasks = createIPSSFollowUpTasks(surgeryDate.date);
    Promise.all(tasks.map((task) => scheduler.createOrUpdateTask(task))).catch((err) => {
      console.error('[IPSS] Failed to seed follow-up tasks:', err);
      seededRef.current = false; // allow retry on next render
    });
  }, [scheduler, surgeryDate.isLoading, surgeryDate.date, surgeryDate.isPlaceholder]);
}
