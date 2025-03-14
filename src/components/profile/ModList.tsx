import { createInfiniteScroll } from "@solid-primitives/pagination";
import {
  Accessor,
  createContext,
  createMemo,
  createResource,
  createSignal,
  For,
  InitializedResource,
  Match,
  ResourceFetcherInfo,
  Show,
  Signal,
  Switch,
  useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import Fa from "solid-fa";
import { faDownload, faDownLong, faExternalLink, faTrash } from "@fortawesome/free-solid-svg-icons";
import { faHardDrive, faHeart, faThumbsUp } from "@fortawesome/free-regular-svg-icons";
import { fetch } from "@tauri-apps/plugin-http";

import { Mod, ModListing, ModPackage } from "../../types";
import { humanizeFileSize, numberFormatter, roundedNumberFormatter } from "../../utils";
import ErrorBoundary, { ErrorContext } from "../global/ErrorBoundary";
import { InitialProgress, ProgressData } from "./ModSearch";
import { fetchModIndex, installProfileMod, queryModIndex, uninstallProfileMod } from "../../api";

import styles from "./ModList.module.css";
import Markdown from "../global/Markdown";
import TabRenderer, { Tab, TabContent } from "../global/TabRenderer";
import { useParams } from "@solidjs/router";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
});

export type Fetcher = (page: number) => Promise<readonly Mod[]>;

export const ModInstallContext = createContext<{
  profile: string;
  installed: InitializedResource<readonly ModPackage[]>;
  refetchInstalled: () => Promise<void>;
}>();

export default function ModList(props: { mods: Fetcher }) {
  const [selectedMod, setSelectedMod] = createSignal<Mod>();

  return (
    <div class={styles.modListAndView}>
      <Show when={props.mods} keyed>
        {(mods) => <ModListMods mods={mods} selectedMod={[selectedMod, setSelectedMod]} />}
      </Show>
      <ModView mod={selectedMod} />
    </div>
  );
}

function ModView({ mod }: { mod: Accessor<Mod | undefined> }) {
  const [progress, setProgress] = createStore<InitialProgress | ProgressData>({
    completed: null,
    total: null,
  });

  function getInitialValue(mod: Mod | undefined) {
    if (mod === undefined) return undefined;
    if ("version" in mod) {
      const obj = { ...mod, versions: [mod.version] };
      // @ts-expect-error
      delete obj.version;
      // @ts-expect-error
      delete obj.game;
      return obj;
    } else {
      return mod;
    }
  }

  const [modListing, { refetch: refetchModListing }] = createResource<ModListing | undefined, Mod | {}, never>(
    // we need the "nullish" value passed through, so disguise it as non-nullish
    () => (mod() === undefined ? {} : mod()!),
    async (mod, info: ResourceFetcherInfo<ModListing | undefined, never>) => {
      if ("game" in mod) {
        await fetchModIndex(mod.game, { refresh: info.refetching }, setProgress);
        return (await queryModIndex(mod.game, "", [], { exact: [{owner: mod.owner, name: mod.name}] })).mods[0];
      } else if ("versions" in mod) {
        setProgress({ completed: null, total: null });
        return mod;
      } else {
        return undefined;
      }
    },
    { initialValue: getInitialValue(mod()) },
  );

  const [selectedVersion, setSelectedVersion] = createSignal<[string, number]>();

  const modData = () => ({ mod: mod(), selectedVersion: selectedVersion() });
  function onModSelect(endpoint: string) {
    return async ({ mod, selectedVersion }: { mod?: Mod; selectedVersion?: [string, number] }) => {
      if (mod == null) return undefined;

      // mod is a ModPackage if it has the version field, otherwise it is a ModListing
      const version =
        "version" in mod ? mod.version.version_number : selectedVersion?.[0] ?? mod.versions[0].version_number;

      try {
        const request = await fetch(
          `https://thunderstore.io/api/experimental/package/${mod.owner}/${mod.name}/${version}/${endpoint}/`,
        );
        return (await request.json()) as { markdown: string };
      } catch (error) {
        // TODO: error handling
        console.error(error);
        return undefined;
      }
    };
  }

  const [modReadme] = createResource(modData, onModSelect("readme"));
  const [modChangelog] = createResource(modData, onModSelect("changelog"));

  const tabs: Tab[] = [
    {
      id: "overview",
      name: "Overview",
      component: (
        <Show when={modReadme()} fallback={<p>Loading</p>}>
          {(modReadme) => <Markdown source={modReadme().markdown} div={{ class: "markdown" }} />}
        </Show>
      ),
    },
    {
      id: "dependencies",
      name: "Dependencies",
      component: () => {
        const modConstant = mod()!;
        const modVersionData =
          "versions" in modConstant ? modConstant.versions[selectedVersion()?.[1] ?? 0] : modConstant.version;

        return <For each={modVersionData.dependencies}>{(dependency) => <p>{dependency}</p>}</For>;
      },
    },
    {
      id: "changelog",
      name: "Changelog",
      component: (
        <Show when={modChangelog()?.markdown} fallback={<p>Loading</p>}>
          {(modChangelog) => <Markdown source={modChangelog()} div={{ class: "markdown" }} />}
        </Show>
      ),
    },
  ];

  const [currentTab, setCurrentTab] = createSignal(tabs[0]);

  const params = useParams();

  return (
    <div class={styles.scrollOuter}>
      <div class={`${styles.scrollInner} ${styles.modView}`}>
        <Show
          when={mod()}
          fallback={
            <div class={styles.nothingMsg}>
              <h2>No mod selected</h2>
              <p>Select a mod to it view here.</p>
            </div>
          }
        >
          {(mod) => {
            const modVersionData = () => {
              const modConstant = mod();

              return "versions" in modConstant
                ? modConstant.versions[selectedVersion()?.[1] ?? 0]
                : modConstant.version;
            };

            return (
              <>
                <div class={styles.modSticky}>
                  <div class={styles.modMeta}>
                    {/* TODO: For local mod with no package URL, remove link */}
                    <div style={{ "grid-area": "name" }}>
                      <a
                        href={`https://thunderstore.io/package/${mod().owner}/${mod().name}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        class={styles.modMetaLink}
                      >
                        <h2 class={styles.name}>{mod().name}</h2>
                        <Fa icon={faExternalLink} />
                      </a>
                    </div>
                    <div style={{ "grid-area": "owner" }}>
                      <a
                        href={`https://thunderstore.io/package/${mod().owner}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        class={styles.modMetaLink}
                      >
                        {mod().owner}
                        <Fa icon={faExternalLink} />
                      </a>
                    </div>
                    <ul class={styles.modMetadata}>
                      <li class={styles.metadata__field}>
                        <Fa icon={faThumbsUp} /> {roundedNumberFormatter.format(mod().rating_score)}
                      </li>
                      <li class={styles.metadata__field}>
                        <Fa icon={faDownload} /> {roundedNumberFormatter.format(modVersionData().downloads)}
                      </li>
                      <li class={styles.metadata__field}>
                        <Fa icon={faHardDrive} /> {humanizeFileSize(modVersionData().file_size)}
                      </li>
                    </ul>

                    <Show when={mod().donation_link != null}>
                      <a
                        class={styles.modMeta__donate}
                        href={mod().donation_link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Fa icon={faHeart} class={styles.donate__icon} />
                        <br /> Donate
                      </a>
                    </Show>
                  </div>

                  <TabRenderer
                    id="mod-view"
                    tabs={tabs}
                    styles={{
                      tabs: {
                        container: styles.tabs,
                        list: styles.tabs__list,
                        list__item: styles.tabs__tab,
                        list__itemActive: styles.tab__active,
                      },
                    }}
                    setter={setCurrentTab}
                  />
                </div>

                <div class={styles.modView__content}>
                  <TabContent currentTab={currentTab} tabs={tabs} />
                </div>

                <form class={styles.modView__form} action="#">
                  <div class={styles.modView__downloader}>
                    <select
                      class={styles.modView__versions}
                      onInput={(event) =>
                        setSelectedVersion([
                          event.target.value,
                          parseInt(event.target.selectedOptions[0].dataset.index!),
                        ])
                      }
                    >
                      {/* This entire thing is temporary anyway, it will be removed in a later commit */}
                      <For each={modListing.latest?.versions}>
                        {(version, i) => {
                          return (
                            <option value={version.version_number} data-index={i()}>
                              v{version.version_number} {i() === 0 ? "(latest)" : ""}
                            </option>
                          );
                        }}
                      </For>
                    </select>
                    <button class={styles.modView__downloadBtn}>Download</button>
                  </div>
                </form>
              </>
            );
          }}
        </Show>
      </div>
    </div>
  );
}

function ModListMods(props: { mods: Fetcher; selectedMod: Signal<Mod | undefined> }) {
  const infiniteScroll = createMemo(() => {
    // this should take readonly, which would make the cast unnecessary
    return createInfiniteScroll(props.mods as (page: number) => Promise<Mod[]>);
  });
  const paginatedMods = () => infiniteScroll()[0]();
  // idk why we're passing props here
  const infiniteScrollLoader = (el: Element) => infiniteScroll()[1](el);
  const end = () => infiniteScroll()[2].end();

  return (
    <div class={styles.scrollOuter}>
      <ol class={`${styles.modList} ${styles.scrollInner}`}>
        <For each={paginatedMods()}>{(mod) => <ModListItem mod={mod} selectedMod={props.selectedMod} />}</For>
        <Show when={!end()}>
          <li use:infiniteScrollLoader>Loading...</li>
        </Show>
      </ol>
    </div>
  );
}

function getIconUrl(owner: string, name: string, version: string) {
  return `https://gcdn.thunderstore.io/live/repository/icons/${owner}-${name}-${version}.png`;
}

function ModListItem(props: { mod: Mod; selectedMod: Signal<Mod | undefined> }) {
  const displayVersion = createMemo(() => {
    if ("version" in props.mod) return props.mod.version;
    return props.mod.versions[0];
  });

  const installContext = useContext(ModInstallContext);

  const installed = createMemo(() => {
    const mod = props.mod;
    if ("version" in mod) {
      return mod;
    } else {
      return installContext?.installed.latest.find((pkg) => pkg.uuid4 === mod.uuid4);
    }
  });

  function onSelect() {
    props.selectedMod[1](props.selectedMod[0]() === props.mod ? undefined : props.mod);
  }

  return (
    <li classList={{ [styles.mod]: true, [styles.selected]: props.selectedMod[0]() === props.mod }}>
      <div
        on:click={onSelect}
        onKeyDown={(key) => {
          if (key.key === "Enter") onSelect();
        }}
        class={styles.mod__btn}
        role="button"
        aria-pressed={props.selectedMod[0]() === props.mod}
        tabIndex={0}
      >
        <img class={styles.icon} src={getIconUrl(props.mod.owner, props.mod.name, displayVersion().version_number)} />
        <div class={styles.mod__content}>
          <div class={styles.left}>
            <p class={styles.info}>
              <span class={styles.name}>{props.mod.name}</span>
              <span class={styles.separator} aria-hidden>
                &bull;
              </span>
              <span class={styles.owner}>{props.mod.owner}</span>
            </p>
            <p class={styles.downloads}>
              <Show when={"versions" in props.mod}>
                <Fa icon={faDownload} />
                {roundedNumberFormatter.format(
                  (props.mod as ModListing).versions.map((v) => v.downloads).reduce((acc, x) => acc + x),
                )}
              </Show>
            </p>
            <p class={styles.description}>{displayVersion().description}</p>
          </div>
          <div class={styles.right}>
            <Show when={installContext !== undefined}>
              <Switch
                fallback={
                  <ErrorBoundary>
                    <InstallButton mod={props.mod as ModListing} installContext={installContext!} />
                  </ErrorBoundary>
                }
              >
                <Match when={installed()}>
                  {(installed) => (
                    <ErrorBoundary>
                      <UninstallButton mod={installed()} installContext={installContext!} />
                    </ErrorBoundary>
                  )}
                </Match>
              </Switch>
            </Show>
          </div>
        </div>
      </div>
    </li>
  );
}

function InstallButton(props: { mod: ModListing; installContext: NonNullable<typeof ModInstallContext.defaultValue> }) {
  const reportErr = useContext(ErrorContext);
  const [busy, setBusy] = createSignal(false);
  return (
    <button
      class={styles.downloadBtn}
      disabled={busy()}
      on:click={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await installProfileMod(props.installContext.profile, props.mod, 0);
          await props.installContext.refetchInstalled();
        } catch (e) {
          reportErr(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Show when={busy()} fallback={<Fa icon={faDownLong} />}>
        <progress />
      </Show>
    </button>
  );
}

function UninstallButton(props: {
  mod: ModPackage;
  installContext: NonNullable<typeof ModInstallContext.defaultValue>;
}) {
  const reportErr = useContext(ErrorContext);
  const [busy, setBusy] = createSignal(false);
  return (
    <button
      class={styles.downloadBtn}
      disabled={busy()}
      on:click={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await uninstallProfileMod(props.installContext.profile, props.mod.owner, props.mod.name);
          await props.installContext.refetchInstalled();
        } catch (e) {
          reportErr(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Show when={busy()} fallback={<Fa icon={faTrash} />}>
        <progress />
      </Show>
    </button>
  );
}
