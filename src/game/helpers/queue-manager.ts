import type { ApiRequestObjective } from "../objects/er-diagram/diagram-handler";
import { ERStore, type User } from "../objects/er-diagram/diagram-handler";
import { formatNpcRequestDialogue, type NpcRequestDisplayMode } from "./api-request-dialogue";
import type { FixedLevelRequest } from "../constants/level_requests";
import {
    easyQuestions,
    hardQuestions,
    mediumQuestions,
    type QuestionDraft,
} from "./question-templates";

export type Difficulty = 1 | 2 | 3;

export type Question = {
    dialogue: string;
    difficulty: Difficulty;
    objective: ApiRequestObjective;
    naturalDialogue: string;
};

export type QueueEntry = {
    npc: User;
    question: Question;
    isBoss?: boolean;
    requestId?: string;
};

type QuestionFn = (npc: User, store: ERStore) => QuestionDraft;

const QUEUE_SIZE = 3;

function difficultyToDisplayMode(d: Difficulty): NpcRequestDisplayMode {
    if (d === 1) return "easy";
    if (d === 2) return "medium";
    return "hard";
}

export class QueueManager {
    private store: ERStore;
    private activeQueue: QueueEntry[] = [];
    private inQueue: Set<string> = new Set();
    private maxUnlockedDifficulty: Difficulty = 1;
    private bossCount = 0;
    private fixedRequests?: FixedLevelRequest[];
    private fixedCursor = 0;
    private fixedDifficulty: Difficulty = 1;

    constructor(store: ERStore) {
        this.store = store;
    }

    init() {
        this.refillQueue();
    }

    startFixedLevel(
        requests: FixedLevelRequest[],
        difficulty: Difficulty,
    ): void {
        this.fixedRequests = [...requests];
        this.fixedCursor = 0;
        this.fixedDifficulty = difficulty;
        this.activeQueue = [];
        this.inQueue.clear();
        this.refillQueue();
    }

    startEndlessMode(): void {
        this.fixedRequests = undefined;
        this.fixedCursor = 0;
        this.maxUnlockedDifficulty = 3;
        this.activeQueue = [];
        this.inQueue.clear();
        this.refillQueue();
    }

    isFixedLevelActive(): boolean {
        return this.fixedRequests !== undefined;
    }

    isFixedLevelComplete(): boolean {
        return Boolean(
            this.fixedRequests &&
                this.fixedCursor >= this.fixedRequests.length &&
                this.activeQueue.length === 0,
        );
    }

    getFixedLevelProgress(): { completed: number; total: number } {
        if (!this.fixedRequests) {
            return { completed: 0, total: 0 };
        }
        return {
            completed: Math.max(0, this.fixedCursor - this.activeQueue.length),
            total: this.fixedRequests.length,
        };
    }

    getQueue(): QueueEntry[] {
        return this.activeQueue;
    }

    getPointValue(entry: QueueEntry): number {
        if (entry.isBoss) return 30;
        return entry.question.difficulty * 10;
    }

    getBossCount(): number {
        return this.bossCount;
    }

    increaseDifficulty() {
        if (this.maxUnlockedDifficulty < 3) {
            this.maxUnlockedDifficulty = (this.maxUnlockedDifficulty + 1) as Difficulty;
        }
    }

    hasBossInQueue(): boolean {
        return this.activeQueue.some((e) => e.isBoss);
    }

    spawnBoss(): QueueEntry | null {
        if (this.fixedRequests) return null;
        if (this.hasBossInQueue()) return null;

        const available = this.getAvailableUsers();
        if (available.length === 0) return null;

        const npc = this.pickRandomUser(available);

        // boss 1 uses easy, boss 2 uses medium — pool driven by bossCount before increment
        const pool: QuestionFn[] = this.bossCount === 0 ? easyQuestions : mediumQuestions;
        const questionFn = pool[Math.floor(Math.random() * pool.length)];
        const draft = questionFn(npc, this.store);
        const difficulty: Difficulty = this.bossCount === 0 ? 1 : 2;
        const mode = difficultyToDisplayMode(difficulty);
        const dialogue = formatNpcRequestDialogue(draft.objective, draft.naturalDialogue, mode);

        const question: Question = {
            dialogue,
            difficulty,
            objective: draft.objective,
            naturalDialogue: draft.naturalDialogue,
        };

        const entry: QueueEntry = { npc, question, isBoss: true };

        if (this.activeQueue.length >= QUEUE_SIZE) {
            const replaced = this.activeQueue[this.activeQueue.length - 1];
            this.inQueue.delete(replaced.npc.id);
            this.activeQueue[this.activeQueue.length - 1] = entry;
        } else {
            this.activeQueue.push(entry);
        }

        this.inQueue.add(npc.id);
        this.bossCount += 1;
        return entry;
    }

    completeNpcEntry(entry: QueueEntry): void {
        if (entry.requestId) {
            this.activeQueue = this.activeQueue.filter(
                (e) => e.requestId !== entry.requestId,
            );
        } else {
            this.activeQueue = this.activeQueue.filter(
                (e) => e.npc.id !== entry.npc.id,
            );
        }
        this.inQueue.delete(entry.npc.id);
        this.refillQueue();
    }

    resetQueue() {
        this.activeQueue = [];
        this.inQueue.clear();
        this.refillQueue();
    }

    private getAvailableUsers(): User[] {
        return Array.from(this.store.users.values()).filter(
            (u) => !this.inQueue.has(u.id),
        );
    }

    private pickRandomUser(available: User[]): User {
        return available[Math.floor(Math.random() * available.length)];
    }

    private pickRandomDifficulty(): Difficulty {
        return (Math.floor(Math.random() * this.maxUnlockedDifficulty) + 1) as Difficulty;
    }

    private pickQuestion(npc: User): Question {
        const difficulty = this.pickRandomDifficulty();
        let pool: QuestionFn[];
        if (difficulty === 1) pool = easyQuestions;
        else if (difficulty === 2) pool = mediumQuestions;
        else pool = hardQuestions;

        const questionFn = pool[Math.floor(Math.random() * pool.length)];
        const draft = questionFn(npc, this.store);
        const mode = difficultyToDisplayMode(difficulty);
        const dialogue = formatNpcRequestDialogue(
            draft.objective,
            draft.naturalDialogue,
            mode,
        );
        return {
            dialogue,
            difficulty,
            objective: draft.objective,
            naturalDialogue: draft.naturalDialogue,
        };
    }

    private refillQueue() {
        if (this.fixedRequests) {
            this.refillFixedQueue();
            return;
        }
        while (this.activeQueue.length < QUEUE_SIZE) {
            const available = this.getAvailableUsers();
            if (available.length === 0) break;

            const npc = this.pickRandomUser(available);
            const question = this.pickQuestion(npc);

            this.activeQueue.push({ npc, question });
            this.inQueue.add(npc.id);
        }
    }

    private refillFixedQueue() {
        if (!this.fixedRequests) {
            return;
        }
        while (
            this.activeQueue.length < QUEUE_SIZE &&
            this.fixedCursor < this.fixedRequests.length
        ) {
            const request = this.fixedRequests[this.fixedCursor];
            const npc = this.store.users.get(request.npcId);
            if (!npc) {
                this.fixedCursor += 1;
                continue;
            }
            const question: Question = {
                dialogue: request.dialogue,
                difficulty: this.fixedDifficulty,
                objective: request.objective,
                naturalDialogue: request.naturalDialogue,
            };
            this.activeQueue.push({
                npc,
                question,
                requestId: request.id,
            });
            this.inQueue.add(npc.id);
            this.fixedCursor += 1;
        }
    }
}
