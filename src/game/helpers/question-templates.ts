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

function bumpMoney(base: number): number {
    return base + (Math.floor(Math.random() * 5) + 1) * 100;
}

function makeFeelingQuestion(npc: User, _store: ERStore): QuestionDraft {
    const options = ["excited", "calm", "curious", "grateful", "confident"];
    const newFeeling = options[Math.floor(Math.random() * options.length)];
    return {
        objective: {
            method: "PUT",
            targetType: "USER",
            targetRowId: npc.id,
            targetField: "feeling",
            description: `PUT USER: change row id ${npc.id}, column "feeling" to a new value`,
        },
        naturalDialogue: `Hey, ${npc.name} here. Can you change my mood to ${newFeeling} in USER? Please process this request now.`,
    };
}

function makeMoneyQuestion(npc: User, _store: ERStore): QuestionDraft {
    const newMoney = bumpMoney(npc.money);
    return {
        objective: {
            method: "PUT",
            targetType: "USER",
            targetRowId: npc.id,
            targetField: "money",
            description: `PUT USER: change row id ${npc.id}, column "money" to a new value`,
        },
        naturalDialogue: `I just got paid. Please update my USER money to ${newMoney} and submit this request.`,
    };
}

function makeUserGetQuestion(npc: User, _store: ERStore): QuestionDraft {
    return {
        objective: {
            method: "GET",
            targetType: "USER",
            targetRowId: npc.id,
            targetField: "name",
            description: `GET USER: fetch row id ${npc.id}, field "name"`,
        },
        naturalDialogue: `Can you check my USER name field for me? Open that row and complete this request.`,
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

function makePetGetQuestion(npc: User, store: ERStore): QuestionDraft {
    const pet = Array.from(store.pets.values()).find((p) => p.ownerId === npc.id);
    if (!pet) {
        return makeAgeQuestion(npc, store);
    }
    return {
        objective: {
            method: "GET",
            targetType: "PET",
            targetRowId: pet.id,
            targetField: "species",
            description: `GET PET: fetch row id ${pet.id}, field "species"`,
        },
        naturalDialogue: `Could you pull up my PET species value? Please handle this request for pet ${pet.id}.`,
    };
}

function makePetNameQuestion(npc: User, store: ERStore): QuestionDraft {
    const pet = Array.from(store.pets.values()).find((p) => p.ownerId === npc.id);
    if (!pet) {
        return makeAgeQuestion(npc, store);
    }
    const names = ["Comet", "Mocha", "Patches", "Nova", "Milo"];
    const newName = names[Math.floor(Math.random() * names.length)];
    return {
        objective: {
            method: "PUT",
            targetType: "PET",
            targetRowId: pet.id,
            targetField: "name",
            description: `PUT PET: change row id ${pet.id}, column "name" to a new value`,
        },
        naturalDialogue: `I renamed my pet. Update PET ${pet.id} name to ${newName} and finish this request.`,
    };
}

function makeHousePriceQuestion(npc: User, store: ERStore): QuestionDraft {
    const house = Array.from(store.houses.values()).find((h) => h.ownerId === npc.id);
    if (!house) {
        return makePetQuestion(npc, store);
    }
    const newPrice = house.listingPrice + 10000;
    return {
        objective: {
            method: "PUT",
            targetType: "HOUSE",
            targetRowId: house.id,
            targetField: "listingPrice",
            description: `PUT HOUSE: change row id ${house.id}, column "listingPrice" to a new value`,
        },
        naturalDialogue: `Please raise my HOUSE listing to ${newPrice}. This request should edit listingPrice.`,
    };
}

function makeHouseColorQuestion(npc: User, store: ERStore): QuestionDraft {
    const house = Array.from(store.houses.values()).find((h) => h.ownerId === npc.id);
    if (!house) {
        return makePetQuestion(npc, store);
    }
    const colors = ["green", "cream", "gray", "white"];
    const newColor = colors[Math.floor(Math.random() * colors.length)];
    return {
        objective: {
            method: "PUT",
            targetType: "HOUSE",
            targetRowId: house.id,
            targetField: "color",
            description: `PUT HOUSE: change row id ${house.id}, column "color" to a new value`,
        },
        naturalDialogue: `We repainted! Please set HOUSE ${house.id} color to ${newColor} to complete this request.`,
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

function makeJobLocationQuestion(npc: User, store: ERStore): QuestionDraft {
    const employment = Array.from(store.employments.values()).find(
        (e) => e.userId === npc.id,
    );
    const job = employment ? store.jobs.get(employment.jobId) : undefined;
    if (!employment || !job) {
        return makeHousePriceQuestion(npc, store);
    }
    const locations = ["Hybrid", "On-site", "Remote"];
    const newLocation = locations[Math.floor(Math.random() * locations.length)];
    return {
        objective: {
            method: "PUT",
            targetType: "JOB",
            targetRowId: job.id,
            targetField: "location",
            description: `PUT JOB: change row id ${job.id}, column "location" to a new value`,
        },
        naturalDialogue: `My office setup changed. Update JOB ${job.id} location to ${newLocation} and submit this request.`,
    };
}

function makeVehiclePriceQuestion(npc: User, store: ERStore): QuestionDraft {
    const house = Array.from(store.houses.values()).find((h) => h.ownerId === npc.id);
    const vehicle = house
        ? Array.from(store.vehicles.values()).find((v) => v.houseId === house.id)
        : undefined;
    if (!house || !vehicle) {
        return makeJobSalaryQuestion(npc, store);
    }
    const newPrice = vehicle.price + 2000;
    return {
        objective: {
            method: "PUT",
            targetType: "VEHICLE",
            targetRowId: vehicle.id,
            targetField: "price",
            description: `PUT VEHICLE: change row id ${vehicle.id}, column "price" to a new value`,
        },
        naturalDialogue: `Please update VEHICLE ${vehicle.id} price to ${newPrice}. That is the request I need.`,
    };
}

function makeVehicleModelQuestion(npc: User, store: ERStore): QuestionDraft {
    const house = Array.from(store.houses.values()).find((h) => h.ownerId === npc.id);
    const vehicle = house
        ? Array.from(store.vehicles.values()).find((v) => v.houseId === house.id)
        : undefined;
    if (!house || !vehicle) {
        return makeJobSalaryQuestion(npc, store);
    }
    const models = ["hatchback", "wagon", "coupe", "suv"];
    const newModel = models[Math.floor(Math.random() * models.length)];
    return {
        objective: {
            method: "PUT",
            targetType: "VEHICLE",
            targetRowId: vehicle.id,
            targetField: "model",
            description: `PUT VEHICLE: change row id ${vehicle.id}, column "model" to a new value`,
        },
        naturalDialogue: `I switched cars. Set VEHICLE ${vehicle.id} model to ${newModel} and complete this request.`,
    };
}

function makeJobPostQuestion(_npc: User, store: ERStore): QuestionDraft {
    const jobs = Array.from(store.jobs.values());
    const newJobId = `j${jobs.length + 1}`;
    const titles = ["Designer", "Analyst", "Technician", "Consultant"];
    const title = titles[Math.floor(Math.random() * titles.length)];
    const salary = 70000 + Math.floor(Math.random() * 5) * 5000;
    const location = ["Remote", "Hybrid", "On-site"][
        Math.floor(Math.random() * 3)
    ];
    return {
        objective: {
            method: "POST",
            targetType: "JOB",
            description: `POST JOB: add a new row for id ${newJobId}`,
            expectedInsertFields: {
                id: newJobId,
                title,
                yearlySalary: salary,
                location,
            },
        },
        naturalDialogue: `Can you create a new JOB row (${newJobId}) with title ${title}, salary ${salary}, and location ${location}? Please process this request.`,
    };
}

function makeVehiclePostQuestion(npc: User, store: ERStore): QuestionDraft {
    const house = Array.from(store.houses.values()).find((h) => h.ownerId === npc.id);
    if (!house) {
        return makeJobSalaryQuestion(npc, store);
    }
    const vehicles = Array.from(store.vehicles.values());
    const newVehicleId = `v${vehicles.length + 1}`;
    const color = ["black", "silver", "blue"][Math.floor(Math.random() * 3)];
    const year = 2019 + Math.floor(Math.random() * 7);
    const model = ["sedan", "suv", "truck"][Math.floor(Math.random() * 3)];
    const price = 18000 + Math.floor(Math.random() * 8) * 2000;
    return {
        objective: {
            method: "POST",
            targetType: "VEHICLE",
            description: `POST VEHICLE: add a new row for id ${newVehicleId}`,
            expectedInsertFields: {
                id: newVehicleId,
                houseId: house.id,
                color,
                year,
                model,
                price,
            },
        },
        naturalDialogue: `I bought another car. Add VEHICLE ${newVehicleId} for house ${house.id} (${year} ${color} ${model}, price ${price}) and complete this request.`,
    };
}

export const easyQuestions = [
    makeAgeQuestion,
    makeFeelingQuestion,
    makeMoneyQuestion,
    makeUserGetQuestion,
];

export const mediumQuestions = [
    makePetQuestion,
    makePetGetQuestion,
    makePetNameQuestion,
    makeHousePriceQuestion,
    makeHouseColorQuestion,
];

export const hardQuestions = [
    makeJobSalaryQuestion,
    makeJobLocationQuestion,
    makeVehiclePriceQuestion,
    makeVehicleModelQuestion,
    makeJobPostQuestion,
    makeVehiclePostQuestion,
];
