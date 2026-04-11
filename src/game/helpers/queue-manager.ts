import { ERStore, type User } from "../objects/er-diagram/diagram-handler";
import { easyQuestions, hardQuestions, mediumQuestions } from "./question-templates";

export type Difficulty = 1 | 2 | 3;
export type HTTPMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type Question = {
    dialogue: string;
    difficulty: Difficulty;
    method: HTTPMethod;
    validate: (store: ERStore, input: string) => boolean;
}

export type QueueEntry = {
    npc: User;
    question: Question;
}

type QuestionFn = (npc: User, store: ERStore) => Question;

const QUEUE_SIZE = 3;

export class QueueManager {
    private store: ERStore;
    private activeQueue: QueueEntry[] = [];
    private inQueue: Set<string> = new Set();
    private currentDifficulty: Difficulty = 1;

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
        if (this.currentDifficulty < 3) {
            this.currentDifficulty = (this.currentDifficulty + 1) as Difficulty;
        }
    }

    submitAnswer(entry: QueueEntry): boolean {
        const correct = entry.question.validate(this.store, "");
        if (!correct) return false;

        this.activeQueue = this.activeQueue.filter(
            e => e.npc.id !== entry.npc.id
        );
        this.inQueue.delete(entry.npc.id);
        this.refillQueue();
        return true;
    }

    private getAvailableUsers(): User[] {
        return Array.from(this.store.users.values())
            .filter(u => !this.inQueue.has(u.id));
    }

    private pickRandomUser(available: User[]): User {
        return available[Math.floor(Math.random() * available.length)];
    }

    private pickQuestion(npc: User): Question {
        let pool: QuestionFn[];
        if (this.currentDifficulty === 1) pool = easyQuestions;
        else if (this.currentDifficulty === 2) pool = mediumQuestions;
        else pool = hardQuestions;

        const questionFn = pool[Math.floor(Math.random() * pool.length)];
        return questionFn(npc, this.store);
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