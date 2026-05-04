import type {
    ApiRequestMethod,
    ApiRequestObjective,
    EntityType,
    TableRow,
} from "../objects/er-diagram/diagram-handler";

export type LevelId =
    | "tutorial"
    | "level-1"
    | "level-2"
    | "level-3"
    | "level-4"
    | "level-5"
    | "level-6";

export type LevelMode = "tutorial" | "fixed";

export type FixedLevelObjective = ApiRequestObjective & {
    expectedUpdateFields?: Partial<TableRow>;
    expectedDeleteFields?: string[];
};

export type FixedLevelRequest = {
    id: string;
    npcId: string;
    dialogue: string;
    naturalDialogue: string;
    objective: FixedLevelObjective;
};

export type LevelDefinition = {
    id: LevelId;
    title: string;
    intro: string;
    mode: LevelMode;
    unlockedTables: EntityType[];
    requests: FixedLevelRequest[];
};

export type EndlessModeDefinition = {
    id: "endless";
    title: string;
    unlockedTables: EntityType[];
    timerRuns: boolean;
    rewardTimeOnCorrect: boolean;
    requestMethods: ApiRequestMethod[];
};

export const LEVEL_DEFINITIONS: LevelDefinition[] = [
    {
        id: "tutorial",
        title: "Tutorial",
        intro:
            "Next feature: GET. Use it when a customer only needs existing data returned from a table.",
        mode: "tutorial",
        unlockedTables: ["USER"],
        requests: [
            {
                id: "tutorial-get-user-name",
                npcId: "u1",
                dialogue:
                    'Hi, I\'m Alice. Let\'s do this together: look in USER and return my "name" field.',
                naturalDialogue:
                    'Welcome! Can you look up my name in the USER table and return just the "name" field?',
                objective: {
                    method: "GET",
                    targetType: "USER",
                    targetRowId: "u1",
                    targetField: "name",
                    description: 'GET USER: fetch row id u1, field "name"',
                },
            },
        ],
    },
    {
        id: "level-1",
        title: "Level 1",
        intro:
            "Next feature: focused GET practice. Return exact fields from USER rows before changing any stored data.",
        mode: "fixed",
        unlockedTables: ["USER"],
        requests: [
            {
                id: "level-1-get-user-age",
                npcId: "u2",
                dialogue: 'GET USER: fetch row id u2, field "age"',
                naturalDialogue:
                    'Can you check my age in the USER table and return the "age" field?',
                objective: {
                    method: "GET",
                    targetType: "USER",
                    targetRowId: "u2",
                    targetField: "age",
                    description: 'GET USER: fetch row id u2, field "age"',
                },
            },
            {
                id: "level-1-get-user-money",
                npcId: "u3",
                dialogue: 'GET USER: fetch row id u3, field "money"',
                naturalDialogue:
                    'Please look up my USER money value and send that field back.',
                objective: {
                    method: "GET",
                    targetType: "USER",
                    targetRowId: "u3",
                    targetField: "money",
                    description: 'GET USER: fetch row id u3, field "money"',
                },
            },
            {
                id: "level-1-get-user-feeling",
                npcId: "u1",
                dialogue: 'GET USER: fetch row id u1, field "feeling"',
                naturalDialogue:
                    'Can you return my USER feeling field so I can confirm it?',
                objective: {
                    method: "GET",
                    targetType: "USER",
                    targetRowId: "u1",
                    targetField: "feeling",
                    description: 'GET USER: fetch row id u1, field "feeling"',
                },
            },
            {
                id: "level-1-get-user-name",
                npcId: "u4",
                dialogue: 'GET USER: fetch row id u4, field "name"',
                naturalDialogue:
                    'Can you pull the USER name field for row u4?',
                objective: {
                    method: "GET",
                    targetType: "USER",
                    targetRowId: "u4",
                    targetField: "name",
                    description: 'GET USER: fetch row id u4, field "name"',
                },
            },
        ],
    },
    {
        id: "level-2",
        title: "Level 2",
        intro:
            "Next feature: POST. Use it when someone asks you to create a brand-new row, then confirm it like any other request.",
        mode: "fixed",
        unlockedTables: ["USER"],
        requests: [
            {
                id: "level-2-get-user-money",
                npcId: "u3",
                dialogue: 'GET USER: fetch row id u3, field "money"',
                naturalDialogue:
                    'Please look up my USER money value and send that field back.',
                objective: {
                    method: "GET",
                    targetType: "USER",
                    targetRowId: "u3",
                    targetField: "money",
                    description:
                        'GET USER: fetch row id u3, field "money"',
                },
            },
            {
                id: "level-2-post-user-eve",
                npcId: "u4",
                dialogue:
                    "POST USER: add row u5 with name Eve, age 25, feeling curious, money 700",
                naturalDialogue:
                    "Please create a new USER row for Eve with age 25, feeling curious, and money 700.",
                objective: {
                    method: "POST",
                    targetType: "USER",
                    description: "POST USER: add a new row for id u5",
                    expectedInsertFields: {
                        id: "u5",
                        name: "Eve",
                        age: 25,
                        feeling: "curious",
                        money: 700,
                    },
                },
            },
            {
                id: "level-2-get-user-feeling",
                npcId: "u2",
                dialogue: 'GET USER: fetch row id u2, field "feeling"',
                naturalDialogue:
                    'Can you check my current USER feeling and return that field?',
                objective: {
                    method: "GET",
                    targetType: "USER",
                    targetRowId: "u2",
                    targetField: "feeling",
                    description:
                        'GET USER: fetch row id u2, field "feeling"',
                },
            },
            {
                id: "level-2-post-user-frank",
                npcId: "u1",
                dialogue:
                    "POST USER: add row u6 with name Frank, age 31, feeling focused, money 1200",
                naturalDialogue:
                    "Please create a new USER row for Frank with age 31, feeling focused, and money 1200.",
                objective: {
                    method: "POST",
                    targetType: "USER",
                    description: "POST USER: add a new row for id u6",
                    expectedInsertFields: {
                        id: "u6",
                        name: "Frank",
                        age: 31,
                        feeling: "focused",
                        money: 1200,
                    },
                },
            },
        ],
    },
    {
        id: "level-3",
        title: "Level 3",
        intro:
            "Next feature: PUT. Use it when a row already exists and one of its saved values needs to change.",
        mode: "fixed",
        unlockedTables: ["USER", "PET", "HOUSE"],
        requests: [
            {
                id: "level-3-get-pet-name",
                npcId: "u1",
                dialogue: 'GET PET: fetch row id p1, field "name"',
                naturalDialogue:
                    'Can you look up my pet row and return the "name" field?',
                objective: {
                    method: "GET",
                    targetType: "PET",
                    targetRowId: "p1",
                    targetField: "name",
                    description: 'GET PET: fetch row id p1, field "name"',
                },
            },
            {
                id: "level-3-post-pet-pixel",
                npcId: "u2",
                dialogue:
                    "POST PET: add row p2 with species cat, name Pixel, age 2, ownerId u2",
                naturalDialogue:
                    "Please create PET p2 for owner u2: a cat named Pixel, age 2.",
                objective: {
                    method: "POST",
                    targetType: "PET",
                    description: "POST PET: add a new row for id p2",
                    expectedInsertFields: {
                        id: "p2",
                        species: "cat",
                        name: "Pixel",
                        age: 2,
                        ownerId: "u2",
                    },
                },
            },
            {
                id: "level-3-put-pet-species",
                npcId: "u3",
                dialogue: 'PUT PET: change row id p1, field "species" to cat',
                naturalDialogue: "Please update PET p1 species to cat.",
                objective: {
                    method: "PUT",
                    targetType: "PET",
                    targetRowId: "p1",
                    targetField: "species",
                    description:
                        'PUT PET: change row id p1, column "species" to cat',
                    expectedUpdateFields: {
                        species: "cat",
                    },
                },
            },
            {
                id: "level-3-put-house-listing-price",
                npcId: "u4",
                dialogue:
                    'PUT HOUSE: change row id h1, field "listingPrice" to 335000',
                naturalDialogue:
                    "Please update HOUSE h1 listingPrice to 335000.",
                objective: {
                    method: "PUT",
                    targetType: "HOUSE",
                    targetRowId: "h1",
                    targetField: "listingPrice",
                    description:
                        'PUT HOUSE: change row id h1, column "listingPrice" to 335000',
                    expectedUpdateFields: {
                        listingPrice: 335000,
                    },
                },
            },
            {
                id: "level-3-get-house-color",
                npcId: "u1",
                dialogue: 'GET HOUSE: fetch row id h1, field "color"',
                naturalDialogue:
                    'Please check the HOUSE color value for row h1.',
                objective: {
                    method: "GET",
                    targetType: "HOUSE",
                    targetRowId: "h1",
                    targetField: "color",
                    description: 'GET HOUSE: fetch row id h1, field "color"',
                },
            },
        ],
    },
    {
        id: "level-4",
        title: "Level 4",
        intro:
            "Next feature: DELETE. Use it when a saved value should be cleared because the system no longer knows it.",
        mode: "fixed",
        unlockedTables: ["USER", "PET", "HOUSE"],
        requests: [
            {
                id: "level-4-get-user-money",
                npcId: "u1",
                dialogue:
                    "Can you check how much money Alice has recorded and return that value?",
                naturalDialogue:
                    "Can you check how much money Alice has recorded and return that value?",
                objective: {
                    method: "GET",
                    targetType: "USER",
                    targetRowId: "u1",
                    targetField: "money",
                    description: 'GET USER: fetch row id u1, field "money"',
                },
            },
            {
                id: "level-4-put-user-feeling",
                npcId: "u2",
                dialogue: "Alice is calm now. Update her saved mood to calm.",
                naturalDialogue: "Alice is calm now. Update her saved mood to calm.",
                objective: {
                    method: "PUT",
                    targetType: "USER",
                    targetRowId: "u1",
                    targetField: "feeling",
                    description:
                        'PUT USER: change row id u1, column "feeling" to calm',
                    expectedUpdateFields: {
                        feeling: "calm",
                    },
                },
            },
            {
                id: "level-4-get-pet-owner",
                npcId: "u3",
                dialogue:
                    "I need to know which user owns pet p1. Return its owner id.",
                naturalDialogue:
                    "I need to know which user owns pet p1. Return its owner id.",
                objective: {
                    method: "GET",
                    targetType: "PET",
                    targetRowId: "p1",
                    targetField: "ownerId",
                    description: 'GET PET: fetch row id p1, field "ownerId"',
                },
            },
            {
                id: "level-4-delete-house-color",
                npcId: "u4",
                dialogue:
                    "The paint color for house h1 is no longer known. Clear that saved value.",
                naturalDialogue:
                    "The paint color for house h1 is no longer known. Clear that saved value.",
                objective: {
                    method: "DELETE",
                    targetType: "HOUSE",
                    targetRowId: "h1",
                    targetField: "color",
                    description: 'DELETE HOUSE: clear row id h1, field "color"',
                    expectedDeleteFields: ["color"],
                },
            },
            {
                id: "level-4-put-pet-name",
                npcId: "u1",
                dialogue: "The pet called p1 has a new name: Scout. Save that.",
                naturalDialogue: "The pet called p1 has a new name: Scout. Save that.",
                objective: {
                    method: "PUT",
                    targetType: "PET",
                    targetRowId: "p1",
                    targetField: "name",
                    description:
                        'PUT PET: change row id p1, column "name" to Scout',
                    expectedUpdateFields: {
                        name: "Scout",
                    },
                },
            },
            {
                id: "level-4-post-house-h2",
                npcId: "u2",
                dialogue:
                    "Bob has a green house worth 275000. Add it as house h2.",
                naturalDialogue:
                    "Bob has a green house worth 275000. Add it as house h2.",
                objective: {
                    method: "POST",
                    targetType: "HOUSE",
                    description: "POST HOUSE: add a new row for id h2",
                    expectedInsertFields: {
                        id: "h2",
                        ownerId: "u2",
                        color: "green",
                        listingPrice: 275000,
                    },
                },
            },
        ],
    },
    {
        id: "level-5",
        title: "Level 5",
        intro:
            "Next feature: relationship work. JOB and EMPLOYMENT requests mix reads and mutations across linked tables.",
        mode: "fixed",
        unlockedTables: ["USER", "PET", "HOUSE", "JOB", "EMPLOYMENT"],
        requests: [
            {
                id: "level-5-get-job-title",
                npcId: "u1",
                dialogue: 'GET JOB: fetch row id j1, field "title"',
                naturalDialogue: "Please return the title saved for job j1.",
                objective: {
                    method: "GET",
                    targetType: "JOB",
                    targetRowId: "j1",
                    targetField: "title",
                    description: 'GET JOB: fetch row id j1, field "title"',
                },
            },
            {
                id: "level-5-get-employment-job",
                npcId: "u2",
                dialogue: 'GET EMPLOYMENT: fetch row id e1, field "jobId"',
                naturalDialogue:
                    "Can you check which job id is attached to employment e1?",
                objective: {
                    method: "GET",
                    targetType: "EMPLOYMENT",
                    targetRowId: "e1",
                    targetField: "jobId",
                    description:
                        'GET EMPLOYMENT: fetch row id e1, field "jobId"',
                },
            },
            {
                id: "level-5-put-job-salary",
                npcId: "u3",
                dialogue:
                    'PUT JOB: change row id j1, field "yearlySalary" to 105000',
                naturalDialogue: "Job j1 should now pay 105000 per year.",
                objective: {
                    method: "PUT",
                    targetType: "JOB",
                    targetRowId: "j1",
                    targetField: "yearlySalary",
                    description:
                        'PUT JOB: change row id j1, column "yearlySalary" to 105000',
                    expectedUpdateFields: {
                        yearlySalary: 105000,
                    },
                },
            },
            {
                id: "level-5-put-job-location",
                npcId: "u4",
                dialogue: 'PUT JOB: change row id j1, field "location" to Hybrid',
                naturalDialogue: "Job j1 has moved to Hybrid. Save that location.",
                objective: {
                    method: "PUT",
                    targetType: "JOB",
                    targetRowId: "j1",
                    targetField: "location",
                    description:
                        'PUT JOB: change row id j1, column "location" to Hybrid',
                    expectedUpdateFields: {
                        location: "Hybrid",
                    },
                },
            },
            {
                id: "level-5-post-job-analyst",
                npcId: "u1",
                dialogue:
                    "POST JOB: add row j2 with title Analyst, yearlySalary 80000, location Remote",
                naturalDialogue:
                    "Please add job j2: Analyst, yearly salary 80000, location Remote.",
                objective: {
                    method: "POST",
                    targetType: "JOB",
                    description: "POST JOB: add a new row for id j2",
                    expectedInsertFields: {
                        id: "j2",
                        title: "Analyst",
                        yearlySalary: 80000,
                        location: "Remote",
                    },
                },
            },
            {
                id: "level-5-post-employment-e2",
                npcId: "u2",
                dialogue: "POST EMPLOYMENT: add row e2 with userId u2 and jobId j1",
                naturalDialogue:
                    "Please connect user u2 to job j1 by creating employment row e2.",
                objective: {
                    method: "POST",
                    targetType: "EMPLOYMENT",
                    description: "POST EMPLOYMENT: add a new row for id e2",
                    expectedInsertFields: {
                        id: "e2",
                        userId: "u2",
                        jobId: "j1",
                    },
                },
            },
        ],
    },
    {
        id: "level-6",
        title: "Level 6",
        intro:
            "Next feature: full workflow. VEHICLE joins the schema, so choose GET, POST, PUT, or DELETE by intent.",
        mode: "fixed",
        unlockedTables: ["USER", "PET", "HOUSE", "JOB", "EMPLOYMENT", "VEHICLE"],
        requests: [
            {
                id: "level-6-get-vehicle-model",
                npcId: "u1",
                dialogue: 'GET VEHICLE: fetch row id v1, field "model"',
                naturalDialogue: "Can you return the saved model for vehicle v1?",
                objective: {
                    method: "GET",
                    targetType: "VEHICLE",
                    targetRowId: "v1",
                    targetField: "model",
                    description: 'GET VEHICLE: fetch row id v1, field "model"',
                },
            },
            {
                id: "level-6-get-employment-user",
                npcId: "u2",
                dialogue: 'GET EMPLOYMENT: fetch row id e1, field "userId"',
                naturalDialogue:
                    "Please return the user id connected to employment e1.",
                objective: {
                    method: "GET",
                    targetType: "EMPLOYMENT",
                    targetRowId: "e1",
                    targetField: "userId",
                    description:
                        'GET EMPLOYMENT: fetch row id e1, field "userId"',
                },
            },
            {
                id: "level-6-put-vehicle-price",
                npcId: "u3",
                dialogue: 'PUT VEHICLE: change row id v1, field "price" to 27000',
                naturalDialogue: "Vehicle v1 should now be priced at 27000.",
                objective: {
                    method: "PUT",
                    targetType: "VEHICLE",
                    targetRowId: "v1",
                    targetField: "price",
                    description:
                        'PUT VEHICLE: change row id v1, column "price" to 27000',
                    expectedUpdateFields: {
                        price: 27000,
                    },
                },
            },
            {
                id: "level-6-put-vehicle-model",
                npcId: "u4",
                dialogue: 'PUT VEHICLE: change row id v1, field "model" to wagon',
                naturalDialogue: "Vehicle v1 is now a wagon. Save that model.",
                objective: {
                    method: "PUT",
                    targetType: "VEHICLE",
                    targetRowId: "v1",
                    targetField: "model",
                    description:
                        'PUT VEHICLE: change row id v1, column "model" to wagon',
                    expectedUpdateFields: {
                        model: "wagon",
                    },
                },
            },
            {
                id: "level-6-delete-vehicle-color",
                npcId: "u1",
                dialogue: 'DELETE VEHICLE: clear row id v1, field "color"',
                naturalDialogue:
                    "The color for vehicle v1 is unknown now. Clear that value.",
                objective: {
                    method: "DELETE",
                    targetType: "VEHICLE",
                    targetRowId: "v1",
                    targetField: "color",
                    description: 'DELETE VEHICLE: clear row id v1, field "color"',
                    expectedDeleteFields: ["color"],
                },
            },
            {
                id: "level-6-post-vehicle-v2",
                npcId: "u2",
                dialogue:
                    "POST VEHICLE: add row v2 with houseId h1, color silver, year 2024, model suv, price 32000",
                naturalDialogue:
                    "Please add vehicle v2 to house h1: silver 2024 suv, price 32000.",
                objective: {
                    method: "POST",
                    targetType: "VEHICLE",
                    description: "POST VEHICLE: add a new row for id v2",
                    expectedInsertFields: {
                        id: "v2",
                        houseId: "h1",
                        color: "silver",
                        year: 2024,
                        model: "suv",
                        price: 32000,
                    },
                },
            },
        ],
    },
];

export const ENDLESS_MODE_DEFINITION: EndlessModeDefinition = {
    id: "endless",
    title: "Endless Mode",
    unlockedTables: ["USER", "PET", "HOUSE", "JOB", "EMPLOYMENT", "VEHICLE"],
    timerRuns: true,
    rewardTimeOnCorrect: true,
    requestMethods: ["GET", "POST", "PUT", "DELETE"],
};
