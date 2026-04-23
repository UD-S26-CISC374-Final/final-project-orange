# RushAPI Tutorial (Alpha Version)

## Goal

Gain as many points as possible before the timeout bar reaches zero.

## What You See On Screen

- **Timeout bar (left side):** drains over time. If it empties, the run ends.
- **Score (top center):** your current points.
- **NPC queue (bottom-left):** 3 active requests at a time.
- **Method area (bottom center):** choose `GET`, `POST`, `PUT`, or `DELETE`.
- **Pending requests panel (right side):** staged requests waiting to be confirmed.

## Controls

- `Enter` on the main menu: start the game.
- `1` / `2` / `3` / `4`: select method (`GET` / `POST` / `PUT` / `DELETE`).
- Mouse click:
    - Click an NPC to open their request dialogue.
    - Click a table to open its modal (after selecting a method).
    - Click UI buttons such as `Save`, `Undo`, and `Confirm Request(s)`.
- `Esc`: close the top open modal layer.
- Click on `Confirm Request(s)` to confirm pending requests.

## Main Game Loop (Step-by-Step)

1. Click an NPC in the queue to read their request.
2. Select the request method (`1-4` or method buttons).
3. Click the matching table and perform the needed action in the modal.
4. Click `Save` in the table modal to stage that action as a pending request.
5. Review staged items in the **Pending requests** panel (use `Undo` if needed).
6. Click `Confirm Request(s)` (or hold `Enter`) to submit staged requests.
7. Repeat quickly and accurately to keep scoring and survive longer.

## Scoring and Timer Rules

- The timeout bar drains continuously while gameplay is active.
- Correctly matched requests:
    - award points,
    - add a small timeout boost,
    - remove the matched NPC request and refill the queue.
- Incorrect or unmatched staged requests:
    - do not score,
    - apply a timeout penalty.
- In the current build, active requests are easy-tier and score **10 points each**.
- When timeout reaches zero, the game transitions to **Game Over**.

## Important Gameplay Guidelines

- Do not rush blind confirms. Stage carefully, then confirm.
- Always verify method + target table before saving.
- Use the NPC dialogue often to double-check what is being asked.
- Use `Undo` in the pending panel to remove bad staged requests before confirming.
- Save only stages a request; you score only after confirmation matches an active NPC request.

## Current Scope / Not Yet in Gameplay

- This tutorial reflects only mechanics currently playable in the game loop.
- Current generated requests are `USER` table `GET` and `PUT` tasks.
- Other tables exist in data/schema code but are not part of the active gameplay loop yet.
- Features like power-ups, boss users, progressive difficulty unlocks, replayable tutorial/help menu, and table-unlock progression are not included in this current playable loop.
