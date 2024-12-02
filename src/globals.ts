import { createResource } from "solid-js";
import { getGames } from "./api";
import { Game } from "./types";

export const [gamesResource] = createResource<[Game[], Map<string, Game>], unknown>(async () => {
  const games = await getGames();
  games.sort((a, b) => a.name.localeCompare(b.name));
  const byId = new Map(games.map((game) => [game.id, game]));
  return [games, byId];
});
export const games = () => gamesResource.latest![0];
export const gamesById = () => gamesResource.latest![1];
