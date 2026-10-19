/** Kid-friendly level ids, weakest to strongest. Kept free of engine imports so stores can use it without pulling the search into their chunk. */
export const LEVEL_IDS = ['pawn', 'knight', 'bishop', 'rook', 'queen'] as const;
export type BotLevelId = (typeof LEVEL_IDS)[number];
