import type { ApiRequestObjective } from "../objects/er-diagram/diagram-handler";
import { ERStore, type User } from "../objects/er-diagram/diagram-handler";
import { formatNpcRequestDialogue, type NpcRequestDisplayMode } from "./api-request-dialogue";
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

    constructor(store: ERStore) {
        this.store = store;
    }

    init() {
        this.refillQueue();
    }

    getQueue(): QueueEntry[] {
        return this.activeQueue;
    }

    getPointValue(entry: QueueEntry): number {
        if (entry.isBoss) return entry.question.difficulty * 20;
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

    /** Inserts a boss into the queue, replacing the last slot if full. */
    spawnBoss(): QueueEntry | null {
        if (this.hasBossInQueue()) return null;

        const available = this.getAvailableUsers();
        if (available.length === 0) return null;

        const npc = this.pickRandomUser(available);
        // boss 1 uses medium, boss 2+ uses hard
        const bossDifficulty: Difficulty = this.bossCount === 0 ? 2 : 3;
        const pool: QuestionFn[] = bossDifficulty === 2 ? mediumQuestions : hardQuestions;
        const questionFn = pool[Math.floor(Math.random() * pool.length)];
        const draft = questionFn(npc, this.store);
        const mode = difficultyToDisplayMode(bossDifficulty);
        const dialogue = formatNpcRequestDialogue(draft.objective, draft.naturalDialogue, mode);

        const question: Question = {
            dialogue,
            difficulty: bossDifficulty,
            objective: draft.objective,
            naturalDialogue: draft.naturalDialogue,
        };

        const entry: QueueEntry = { npc, question, isBoss: true };

        // replace last slot if queue is full, otherwise just push
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

    /** Call after a matched pending request has been confirmed for an NPC task. */
    completeNpcEntry(entry: QueueEntry): void {
        this.activeQueue = this.activeQueue.filter(
            (e) => e.npc.id !== entry.npc.id,
        );
        this.inQueue.delete(entry.npc.id);
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
        while (this.activeQueue.length < QUEUE_SIZE) {
            const available = this.getAvailableUsers();
            if (available.length === 0) break;

            const npc = this.pickRandomUser(available);
            const question = this.pickQuestion(npc);

            this.activeQueue.push({ npc, question });
            this.inQueue.add(npc.id);
        }
    }
}