import { faStar } from "@fortawesome/free-regular-svg-icons";
import { faGlobe, faList, faTableCellsLarge } from "@fortawesome/free-solid-svg-icons";
import { A } from "@solidjs/router";
import Fa from "solid-fa";
import { createResource, createSignal, For, onCleanup, onMount } from "solid-js";

import { games, initialSortedGames } from "../../globals";
import { Locale, localeNamesMap, setLocale, locale, t, RAW_LOCALES } from "../../i18n/i18n";
import { Game } from "../../types";
import { autofocus } from "../../components/global/Directives";

import blobStyles from "./GameBlobs.module.css";
import gameListStyles from "./GameList.module.css";
import styles from "./GameSelect.module.css";
import { GameSortColumn, searchGames } from "../../api";

enum DisplayType {
  Card = -1,
  List = 1,
}

export default function GameSelect() {
  const [displayType, setDisplayType] = createSignal<DisplayType>(DisplayType.Card);
  const [search, setSearch] = createSignal("");
  const [sort, setSort] = createSignal<GameSortColumn>(GameSortColumn.ModDownloads);

  const [filteredGames] = createResource<readonly number[], readonly [string, GameSortColumn], readonly number[]>(
    () => [search(), sort()],
    async ([query, sort]) => {
      return await searchGames(query, [
        { column: GameSortColumn.Relevance, descending: true },
        { column: sort, descending: sort !== GameSortColumn.Name },
      ]);
    },
    { initialValue: initialSortedGames() },
  );

  onMount(() => {
    document.body.classList.add(styles.body);
  });

  onCleanup(() => {
    document.body.classList.remove(styles.body);
  });

  return (
    <>
      <div class={blobStyles.gradientBlobs} aria-hidden="true">
        <div class={blobStyles.gradientBlob} data-blob-1></div>
        <div class={blobStyles.gradientBlob} data-blob-2></div>
        <div class={blobStyles.gradientBlob} data-blob-3></div>
        <div class={blobStyles.gradientBlob} data-blob-4></div>
      </div>
      <div class={styles.language}>
        <form on:submit={(e) => e.preventDefault()}>
          <label for="language" aria-label="Change language">
            <Fa icon={faGlobe} />
          </label>
          <select name="language" id="language" on:change={(e) => setLocale(e.target.value as Locale)}>
            <For each={RAW_LOCALES}>
              {(loc) => (
                <option value={loc} selected={locale() === loc}>
                  {localeNamesMap[loc]}
                </option>
              )}
            </For>
          </select>
        </form>
      </div>
      <header class={styles.header}>
        <h1>{t("game_select.title")}</h1>
        <p>{t("game_select.subtitle")}</p>
      </header>
      <main class={styles.main}>
        <form on:submit={(e) => e.preventDefault()} class={styles.gameSearch}>
          <input
            type="search"
            name="search-game"
            id="search-game"
            placeholder={t("game_select.search.input_placeholder")}
            value={search()}
            maxlength="100"
            use:autofocus
            on:input={(e) => setSearch(e.target.value)}
          />
          <select name="sort-type" id="sort-type" on:input={(e) => setSort(e.target.value as GameSortColumn)}>
            <option value={GameSortColumn.ModDownloads} selected>{t("global.list_sort_type.mod_downloads")}</option>
            <option value={GameSortColumn.Popularity}>{t("global.list_sort_type.popularity")}</option>
            <option value={GameSortColumn.Name}>{t("global.list_sort_type.name")}</option>
          </select>
          <button
            type="button"
            on:click={() => setDisplayType((prev) => (prev * -1) as DisplayType)}
            title={t("game_select.search.display_type_btn", {
              type:
                displayType() === DisplayType.Card
                  ? t("game_select.search.card_display_type")
                  : t("game_select.search.list_display_type"),
            })}
          >
            {displayType() === DisplayType.Card ? <Fa icon={faList} /> : <Fa icon={faTableCellsLarge} />}
          </button>
        </form>
        <ol
          classList={{
            [gameListStyles.gameList]: true,
            [gameListStyles.searching]: search().length > 0,
            [gameListStyles.gameList__gameCard]: displayType() === DisplayType.Card,
            [gameListStyles.gameList__gameItem]: displayType() === DisplayType.List,
          }}
        >
          <For
            each={filteredGames.latest}
            fallback={
              <li class={gameListStyles.gameList__empty}>
                <p>{t("game_select.no_games_msg")}</p>
              </li>
            }
          >
            {(game) => <GameComponent game={games()[game]} />}
          </For>
        </ol>
      </main>
    </>
  );
}

function GameComponent(props: { game: Game }) {
  const url = `/img/game_covers/${props.game.thunderstoreId}.webp`;

  return (
    <li class={gameListStyles.gameList__game} style={`--img-src: url("${url}")`}>
      <img src={url} alt={t("game_select.bg_img_alt", { gameName: props.game.name })} />
      <div class={gameListStyles.game__content}>
        <p class={gameListStyles.game__title}>{props.game.name}</p>
        <div class={gameListStyles.game__actions}>
          <A href={`/profile/${props.game.id}/`} tabIndex="-1">
            <button data-select>{t("game_select.select_btn")}</button>
          </A>
          <A href={`/profile/${props.game.id}/`} tabIndex="-1">
            <button data-default>{t("game_select.default_btn")}</button>
          </A>
        </div>
        <button class={gameListStyles.game__favoriteBtn} title={t("game_select.fav_btn")}>
          <Fa icon={faStar} />
        </button>
      </div>
    </li>
  );
}
