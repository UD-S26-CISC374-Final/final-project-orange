import { ERStore, type User } from "../objects/er-diagram/diagram-handler";
import type { Question } from "./queue-manager";

export function makeAgeQuestion(npc: User, _store: ERStore): Question {
    const newAge = npc.age + Math.floor(Math.random() * 10) + 1;
    return {
        dialogue: `Hi I'm ${npc.name}! Can you update my age to ${newAge}? I'm in the USER table!`,
        difficulty: 1,
        method: "PATCH",
        validate: (store, _input) => {
            return store.users.get(npc.id)?.age === newAge;
        }
    }
}

export function makePetQuestion(npc: User, store: ERStore): Question {
    const pet = Array.from(store.pets.values())
        .find(p => p.ownerId === npc.id);
    const newSpecies = pet?.species === "dog" ? "cat" : "dog";
    return {
        dialogue: `I'm ${npc.name}, ID ${npc.id}. My pet's species is wrong, can you fix it to ${newSpecies}?`,
        difficulty: 2,
        method: "PATCH",
        validate: (store, _input) => {
            const updatedPet = Array.from(store.pets.values())
                .find(p => p.ownerId === npc.id);
            return updatedPet?.species === newSpecies;
        }
    }
}

export function makeJobSalaryQuestion(npc: User, store: ERStore): Question {
    const employment = Array.from(store.employments.values())
        .find(e => e.userId === npc.id);
    const job = employment ? store.jobs.get(employment.jobId) : undefined;
    const newSalary = job ? job.yearlySalary + 10000 : 100000;
    return {
        dialogue: `I'm ${npc.name}. I got a raise, my new salary is $${newSalary}. Can you update that?`,
        difficulty: 3,
        method: "PATCH",
        validate: (store, _input) => {
            const emp = Array.from(store.employments.values())
                .find(e => e.userId === npc.id);
            if (!emp) return false;
            return store.jobs.get(emp.jobId)?.yearlySalary === newSalary;
        }
    }
}

export const easyQuestions = [
    makeAgeQuestion,

];

export const mediumQuestions = [
    makePetQuestion,

];

export const hardQuestions = [
    makeJobSalaryQuestion,

];
