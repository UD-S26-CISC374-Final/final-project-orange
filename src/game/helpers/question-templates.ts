import {
    ERStore,
    type ApiRequestObjective,
    type User,
} from "../objects/er-diagram/diagram-handler";

export type QuestionDraft = {
    objective: ApiRequestObjective;
    /** Must include the word "request" (medium mode replaces it with a color hint). */
    naturalDialogue: string;
};

export function makeAgeQuestion(npc: User, _store: ERStore): QuestionDraft {
    const newAge = npc.age + Math.floor(Math.random() * 10) + 1;
    return {
        objective: {
            method: "PUT",
            targetType: "USER",
            targetRowId: npc.id,
            targetField: "age",
            description: `PUT USER: change row id ${npc.id}, column "age" to a new value`,
        },
        naturalDialogue: `Hi I'm ${npc.name}! Can you update my age to ${newAge}? I'm in the USER table — please handle this request when you're ready.`,
    };
}

export function makePetQuestion(npc: User, store: ERStore): QuestionDraft {
    const pet = Array.from(store.pets.values()).find(
        (p) => p.ownerId === npc.id,
    );
    if (!pet) {
        return makeAgeQuestion(npc, store);
    }
    const newSpecies = pet.species === "dog" ? "cat" : "dog";
    const petId = pet.id;
    return {
        objective: {
            method: "PUT",
            targetType: "PET",
            targetRowId: petId,
            targetField: "species",
            description: `PUT PET: change row id ${petId}, column "species" to a new value`,
        },
        naturalDialogue: `I'm ${npc.name}, ID ${npc.id}. My pet's species is wrong — can you fix it to ${newSpecies}? Please complete this request in the PET table.`,
    };
}

export function makeJobSalaryQuestion(npc: User, store: ERStore): QuestionDraft {
    const employment = Array.from(store.employments.values()).find(
        (e) => e.userId === npc.id,
    );
    const job = employment ? store.jobs.get(employment.jobId) : undefined;
    if (!employment || !job) {
        return makePetQuestion(npc, store);
    }
    const newSalary = job.yearlySalary + 10000;
    const jobId = job.id;
    return {
        objective: {
            method: "PUT",
            targetType: "JOB",
            targetRowId: jobId,
            targetField: "yearlySalary",
            description: `PUT JOB: change row id ${jobId}, column "yearlySalary" to a new value`,
        },
        naturalDialogue: `I'm ${npc.name}. I got a raise — my new salary is $${newSalary}. Can you update that in the JOB table? This request should change yearlySalary.`,
    };
}

export const easyQuestions = [makeAgeQuestion];

export const mediumQuestions = [makePetQuestion];

export const hardQuestions = [makeJobSalaryQuestion];
