/**
 * Unit Tests for LocalStorageBackend
 *
 * The LocalStorageBackend implements the BackendService interface using
 * AsyncStorage for persistence. It provides CRUD operations for tasks,
 * outcomes, and questionnaire responses.
 *
 * This is the default backend for the MVP. When Firebase is added,
 * a FirebaseBackend will provide the same interface with remote sync.
 *
 * Key behaviors tested:
 * - Scheduler state persistence (load/save)
 * - Task CRUD operations
 * - Outcome recording
 * - Questionnaire response storage
 * - Error handling for storage failures
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalStorageBackend } from '../backends/local-storage';

describe('LocalStorageBackend', () => {
  let backend: LocalStorageBackend;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    backend = new LocalStorageBackend();
  });

  /**
   * Tests for initialize()
   *
   * No-op for LocalStorageBackend since AsyncStorage is always available.
   * Included for interface compatibility with remote backends.
   */
  describe('initialize', () => {
    /**
     * Verifies initialize completes without error.
     */
    it('should complete without error (no-op for local storage)', async () => {
      await expect(backend.initialize()).resolves.toBeUndefined();
    });
  });

  /**
   * Tests for setUserId()
   *
   * No-op for LocalStorageBackend since local storage doesn't need
   * user scoping. Remote backends would use this to scope data.
   */
  describe('setUserId', () => {
    /**
     * Verifies setUserId is a no-op that doesn't throw.
     */
    it('should be a no-op that does not throw', () => {
      expect(() => backend.setUserId('user-123')).not.toThrow();
      expect(() => backend.setUserId(null)).not.toThrow();
    });
  });

  /**
   * Tests for Scheduler State operations
   *
   * The scheduler state contains all tasks and their completion outcomes.
   */
  describe('Scheduler State', () => {
    describe('loadSchedulerState', () => {
      /**
       * Verifies null returned when no state has been saved.
       */
      it('should return null when no state exists in storage', async () => {
        const state = await backend.loadSchedulerState();
        expect(state).toBeNull();
      });

      /**
       * Verifies state is correctly parsed from storage, including
       * date deserialization for outcome timestamps.
       */
      it('should parse and return state from storage with deserialized dates', async () => {
        const mockState = {
          tasks: [{ id: 'task-1', title: 'Test Task' }],
          outcomes: [{ id: 'outcome-1', completedAt: '2024-01-01T00:00:00.000Z' }],
        };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockState));

        const state = await backend.loadSchedulerState();

        expect(state?.tasks).toHaveLength(1);
        expect(state?.outcomes).toHaveLength(1);
        // Verify date was deserialized from ISO string to Date object
        expect(state?.outcomes[0].completedAt).toBeInstanceOf(Date);
      });

      /**
       * Verifies graceful error handling returns null instead of crashing.
       */
      it('should return null on storage read error', async () => {
        (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const state = await backend.loadSchedulerState();
        expect(state).toBeNull();
      });
    });

    describe('saveSchedulerState', () => {
      /**
       * Verifies state is serialized and saved to correct storage key.
       */
      it('should persist state to AsyncStorage', async () => {
        const state = {
          tasks: [{ id: 'task-1' }],
          outcomes: [{ id: 'outcome-1', completedAt: new Date() }],
        };

        await backend.saveSchedulerState(state);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@scheduler_state',
          expect.any(String)
        );
      });

      /**
       * Verifies storage errors are propagated to caller.
       */
      it('should throw on storage write error', async () => {
        (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const state = { tasks: [], outcomes: [] };
        await expect(backend.saveSchedulerState(state)).rejects.toThrow('Storage error');
      });
    });
  });

  /**
   * Tests for Task CRUD operations
   */
  describe('Task Operations', () => {
    describe('createTask', () => {
      /**
       * Verifies new task is added to state and persisted.
       */
      it('should add task to state and save', async () => {
        const task = { id: 'new-task', title: 'New Task' };
        const result = await backend.createTask(task);

        expect(result).toEqual(task);
        expect(AsyncStorage.setItem).toHaveBeenCalled();
      });

      /**
       * Verifies task is appended to existing tasks, not replacing them.
       */
      it('should append to existing tasks (not replace)', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify({
            tasks: [{ id: 'existing-task' }],
            outcomes: [],
          })
        );

        await backend.createTask({ id: 'new-task' });

        const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
        const savedState = JSON.parse(setItemCall[1]);
        expect(savedState.tasks).toHaveLength(2);
      });
    });

    describe('updateTask', () => {
      /**
       * Verifies existing task is updated in place.
       */
      it('should update existing task by ID', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify({
            tasks: [{ id: 'task-1', title: 'Original' }],
            outcomes: [],
          })
        );

        await backend.updateTask({ id: 'task-1', title: 'Updated' });

        const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
        const savedState = JSON.parse(setItemCall[1]);
        expect(savedState.tasks[0].title).toBe('Updated');
      });
    });

    describe('deleteTask', () => {
      /**
       * Verifies task is removed from state.
       */
      it('should remove task by ID', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify({
            tasks: [{ id: 'task-1' }, { id: 'task-2' }],
            outcomes: [],
          })
        );

        await backend.deleteTask('task-1');

        const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
        const savedState = JSON.parse(setItemCall[1]);
        expect(savedState.tasks).toHaveLength(1);
        expect(savedState.tasks[0].id).toBe('task-2');
      });

      /**
       * Verifies outcomes associated with deleted task are also removed.
       * Outcome IDs are prefixed with task ID (e.g., "task-1_2024-01-01").
       */
      it('should remove outcomes associated with deleted task', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify({
            tasks: [{ id: 'task-1' }],
            outcomes: [
              { id: 'task-1_2024-01-01', completedAt: '2024-01-01T00:00:00.000Z' },
              { id: 'task-2_2024-01-01', completedAt: '2024-01-01T00:00:00.000Z' },
            ],
          })
        );

        await backend.deleteTask('task-1');

        const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
        const savedState = JSON.parse(setItemCall[1]);
        // Only task-2's outcome should remain
        expect(savedState.outcomes).toHaveLength(1);
        expect(savedState.outcomes[0].id).toBe('task-2_2024-01-01');
      });
    });

    describe('getTasks', () => {
      /**
       * Verifies empty array when no tasks exist.
       */
      it('should return empty array when no state exists', async () => {
        const tasks = await backend.getTasks();
        expect(tasks).toEqual([]);
      });

      /**
       * Verifies all tasks are returned.
       */
      it('should return all tasks from state', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify({
            tasks: [{ id: 'task-1' }, { id: 'task-2' }],
            outcomes: [],
          })
        );

        const tasks = await backend.getTasks();
        expect(tasks).toHaveLength(2);
      });
    });
  });

  /**
   * Tests for Outcome operations
   *
   * Outcomes record task completion events with timestamps.
   */
  describe('Outcome Operations', () => {
    describe('createOutcome', () => {
      /**
       * Verifies outcome is added to state and persisted.
       */
      it('should add outcome to state and save', async () => {
        const outcome = { id: 'outcome-1', completedAt: new Date() };
        const result = await backend.createOutcome(outcome);

        expect(result).toEqual(outcome);
        expect(AsyncStorage.setItem).toHaveBeenCalled();
      });
    });

    describe('getOutcomes', () => {
      /**
       * Verifies empty array when no outcomes exist.
       */
      it('should return empty array when no state exists', async () => {
        const outcomes = await backend.getOutcomes();
        expect(outcomes).toEqual([]);
      });

      /**
       * Verifies outcomes are returned with deserialized dates.
       */
      it('should return outcomes with deserialized completedAt dates', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
          JSON.stringify({
            tasks: [],
            outcomes: [{ id: 'outcome-1', completedAt: '2024-01-01T00:00:00.000Z' }],
          })
        );

        const outcomes = await backend.getOutcomes();
        expect(outcomes).toHaveLength(1);
        expect(outcomes[0].completedAt).toBeInstanceOf(Date);
      });
    });
  });

  /**
   * Tests for Questionnaire Response operations
   *
   * Stores FHIR-compatible questionnaire responses separately
   * from scheduler state.
   */
  describe('Questionnaire Operations', () => {
    describe('saveQuestionnaireResponse', () => {
      /**
       * Verifies response is saved to dedicated storage key.
       */
      it('should save response to questionnaire storage', async () => {
        const response = { id: 'response-1', answers: {} };
        await backend.saveQuestionnaireResponse(response);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@questionnaire_responses',
          expect.stringContaining('response-1')
        );
      });

      /**
       * Verifies new responses are appended to existing ones.
       */
      it('should append to existing responses (not replace)', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
          if (key === '@questionnaire_responses') {
            return Promise.resolve(JSON.stringify([{ id: 'existing' }]));
          }
          return Promise.resolve(null);
        });

        await backend.saveQuestionnaireResponse({ id: 'new' });

        const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
        const saved = JSON.parse(setItemCall[1]);
        expect(saved).toHaveLength(2);
      });

      /**
       * Verifies storage errors are propagated.
       */
      it('should throw on storage error', async () => {
        (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

        await expect(backend.saveQuestionnaireResponse({ id: 'test' })).rejects.toThrow();
      });
    });

    describe('getQuestionnaireResponses', () => {
      /**
       * Verifies empty array when no responses exist.
       */
      it('should return empty array when no responses exist', async () => {
        const responses = await backend.getQuestionnaireResponses();
        expect(responses).toEqual([]);
      });

      /**
       * Verifies all responses returned with deserialized dates.
       */
      it('should return all responses with deserialized completedAt dates', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
          if (key === '@questionnaire_responses') {
            return Promise.resolve(
              JSON.stringify([
                { id: 'r1', completedAt: '2024-01-01T00:00:00.000Z' },
                { id: 'r2', completedAt: '2024-01-02T00:00:00.000Z' },
              ])
            );
          }
          return Promise.resolve(null);
        });

        const responses = await backend.getQuestionnaireResponses();
        expect(responses).toHaveLength(2);
        expect(responses[0].completedAt).toBeInstanceOf(Date);
      });

      /**
       * Verifies filtering by taskId when provided.
       * Used to get responses for a specific scheduled task.
       */
      it('should filter responses by taskId when provided', async () => {
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
          if (key === '@questionnaire_responses') {
            return Promise.resolve(
              JSON.stringify([
                { id: 'r1', metadata: { taskId: 'task-1' } },
                { id: 'r2', metadata: { taskId: 'task-2' } },
                { id: 'r3', metadata: { taskId: 'task-1' } },
              ])
            );
          }
          return Promise.resolve(null);
        });

        const responses = await backend.getQuestionnaireResponses('task-1');
        expect(responses).toHaveLength(2);
        expect(responses.every((r) => r.metadata?.taskId === 'task-1')).toBe(true);
      });

      /**
       * Verifies graceful error handling returns empty array.
       */
      it('should return empty array on storage error', async () => {
        (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

        const responses = await backend.getQuestionnaireResponses();
        expect(responses).toEqual([]);
      });
    });
  });

  /**
   * Tests for Sync operations
   *
   * No-ops for LocalStorageBackend since there's no remote to sync with.
   * Remote backends would implement actual sync logic.
   */
  describe('Sync Operations', () => {
    /**
     * Verifies syncToRemote is a no-op that completes without error.
     */
    it('syncToRemote should complete without error (no-op)', async () => {
      await expect(backend.syncToRemote()).resolves.toBeUndefined();
    });

    /**
     * Verifies syncFromRemote is a no-op that completes without error.
     */
    it('syncFromRemote should complete without error (no-op)', async () => {
      await expect(backend.syncFromRemote()).resolves.toBeUndefined();
    });
  });
});
