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
        return entry.question.difficulty * 10;
    }

    increaseDifficulty() {
        if (this.maxUnlockedDifficulty < 3) {
            this.maxUnlockedDifficulty = (this.maxUnlockedDifficulty + 1) as Difficulty;
        }
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
