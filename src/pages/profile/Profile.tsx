import {
  createMemo,
  createResource,
  createSignal,
  createUniqueId,
  For,
  Show,
  useContext,
} from "solid-js";
import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { faCirclePlay as faCirclePlayOutline, faTrashCan } from "@fortawesome/free-regular-svg-icons";
import {
  faChevronLeft,
  faCirclePlay,
  faDownload,
  faFileImport,
  faPenToSquare,
  faPlus,
  faThumbTack,
  faFileExport,
  faGear,
  faArrowUpWideShort,
  faArrowDownShortWide,
} from "@fortawesome/free-solid-svg-icons";
import { OverlayScrollbarsComponent } from "overlayscrollbars-solid";
import Fa from "solid-fa";

import Console, { C2SChannel, clearConsole, createC2SChannel } from "../../components/global/Console";
import { PromptDialog } from "../../components/global/Dialog";
import { ErrorContext } from "../../components/global/ErrorBoundary";
import SelectDropdown from "../../components/global/SelectDropdown";
import TabRenderer from "../../components/global/TabRenderer";
import ModList, { ModInstallContext } from "../../components/profile/ModList";
import ModSearch from "../../components/profile/ModSearch";

import { createProfile, deleteProfile, getProfileMods, launchProfile, ProfileWithId } from "../../api";
import * as globals from "../../globals";
import { refetchProfiles } from "../../globals";
import { Refetcher } from "../../types";
import { autofocus } from "../../components/global/Directives";

import styles from "./Profile.module.css";
import sidebarStyles from "./SidebarProfiles.module.css"

interface ProfileParams {
  [key: string]: string | undefined;
  profileId?: string;
  gameId: string;
}

export default function Profile() {
  // @ts-expect-error params.profileId is an optional param, it can be undefined
  const params = useParams<ProfileParams>();

  const gameInfo = globals.gamesById().get(params.gameId)!; // TODO, handle undefined case

  const [profileSortOrder, setProfileSortOrder] = createSignal(false);

  const [profiles] = createResource(
    globals.profiles,
    (profiles) => {
      return profiles.filter((profile) => profile.game === params.gameId);
    },
    { initialValue: [] }
  );

  const currentProfile = createMemo(() => globals.profiles().find((profile) => profile.id === params.profileId));

  const reportErr = useContext(ErrorContext)!;

  const [consoleChannel, setConsoleChannel] = createSignal<C2SChannel>();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  async function launch(modded: boolean) {
    try {
      clearConsole();
      if (searchParams.tab !== "logs") {
        navigate(`?tab=logs`);
      }
      const channel = createC2SChannel();
      setConsoleChannel(channel);
      await launchProfile(params.profileId!, channel, { modded });
    } catch (e) {
      reportErr(e);
    }
  }

  return (
    <main class={styles.main}>
      <aside class={styles.sidebar}>
        <nav class={styles.sidebar__nav}>
          <A href="/" tabIndex="-1">
            <button class={styles.sidebar__btn}>
              <Fa icon={faChevronLeft} />
            </button>
          </A>

          <h1>{gameInfo.name}</h1>
        </nav>
        <section classList={{ [styles.sidebar__group]: true, [styles.sidebar__mainActions]: true }}>
          <button disabled={params.profileId === undefined} on:click={() => launch(true)} data-modded>
            <Fa icon={faCirclePlay} /> Start modded
          </button>
          <button disabled={params.profileId === undefined} on:click={() => launch(false)} data-vanilla>
            <Fa icon={faCirclePlayOutline} /> Start vanilla
          </button>
        </section>
        <section classList={{ [styles.sidebar__group]: true, [sidebarStyles.sidebar__profiles]: true }}>
          <h3 class={styles.sidebar__profilesTitle}>
            Profiles
            <div class={styles.sidebar__profilesActions}>
              <A class={styles.sidebar__profilesActionBtn} href={`/profile/${params.gameId}`}>
                <Fa icon={faPlus} />
              </A>
              <button class={styles.sidebar__profilesActionBtn} title="Import">
                <Fa icon={faFileImport} class={sidebarStyles.sidebar__profileActionsBtnIcon} />
              </button>
            </div>
          </h3>

          <form on:submit={(e) => e.preventDefault()} class={sidebarStyles.sidebar__profilesSearch}>
            <input type="text" name="profile-search" id="profile-search" placeholder="Search" maxLength={100} />
            <SelectDropdown<"alphabetical" | "creationDate">
              class={sidebarStyles.sidebar__profilesSearchSortBtn}
              multiselect={false}
              options={{
                "A-Z": {
                  value: "alphabetical",
                },

                "Creation Date": {
                  value: "creationDate",
                },
              }}
              label={{ labelText: "preset", preset: "Sort" }}
              onChanged={(key, selected) => console.log(key, selected)}
            />
            <button class={sidebarStyles.sidebar__profilesSearchSortByBtn} on:click={() => setProfileSortOrder((order) => !order)}>
              {profileSortOrder() ? <Fa icon={faArrowUpWideShort} /> : <Fa icon={faArrowDownShortWide} />}
            </button>
          </form>

          <OverlayScrollbarsComponent defer options={{ scrollbars: { autoHide: "leave" } }} class={sidebarStyles.sidebar__profilesListContainer}>
            <ol class={sidebarStyles.sidebar__profilesList}>
              <For each={profiles()}>
                {(profile) => (
                  <SidebarProfileComponent
                    gameId={params.gameId}
                    profileId={profile.id}
                    profileName={profile.name}
                    refetchProfiles={refetchProfiles}
                    selected={profile.id === params.profileId}
                  />
                )}
              </For>
            </ol>
          </OverlayScrollbarsComponent>
        </section>
        <section class={styles.sidebar__group}>
          <div class={styles.sidebar__otherGrid}>
            <A href="">
              <button>
                <Fa icon={faGear} class={styles.sidebar__otherGridIcon} />
                <br />
                Settings
              </button>
            </A>
            <A href="">
              <button>
                <Fa icon={faDownload} class={styles.sidebar__otherGridIcon} />
                <br />
                Downloads
              </button>
            </A>
          </div>
        </section>
      </aside>

      <div class={styles.content}>
        <Show
          when={params.profileId}
          fallback={<NoSelectedProfileContent gameId={params.gameId} profiles={profiles} refetchProfiles={refetchProfiles} />}
        >
          {(profileId) => {
            const [installed, { refetch: refetchInstalled0 }] = createResource(
              profileId,
              (profileId) => getProfileMods(profileId),
              { initialValue: [] }
            );

            const refetchInstalled = async () => {
              await refetchInstalled0();
            };

            return (
              <ModInstallContext.Provider value={{ profile: profileId(), installed, refetchInstalled }}>
                <TabRenderer
                  styles={{ tabs: { container: styles.tabs, list: styles.tabs__list, list__item: styles.tabs__tab, list__itemActive: styles.tab__active } }}
                  tabs={[
                    {
                      id: "mod-list",
                      name: "Installed",
                      component: <InstalledModsList game={params.gameId} />,
                    },

                    {
                      id: "mod-search",
                      name: "Online",
                      component: <ModSearch game={params.gameId} />,
                    },

                    {
                      id: "logs",
                      name: "Logs",
                      component: (
                        <div class={styles.content__console}>
                          <Console channel={consoleChannel} />
                        </div>
                      ),
                    },

                    {
                      id: "config",
                      name: "Config",
                      component: <div></div>,
                    },
                  ]}
                />
              </ModInstallContext.Provider>
            );
          }}
        </Show>
      </div>
    </main>
  );
}

function NoSelectedProfileContent(props: { gameId: string; profiles: () => ProfileWithId[]; refetchProfiles: Refetcher<ProfileWithId[]> }) {
  const [name, setName] = createSignal("");

  const navigate = useNavigate();

  async function submit(e: SubmitEvent) {
    e.preventDefault();

    const id = await createProfile(props.gameId, name());
    await props.refetchProfiles();
    navigate(`/profile/${props.gameId}/${id}`, { replace: true });
  }

  const nameId = createUniqueId();

  return (
    <>
      <p>{props.profiles().length !== 0 ? "Select a profile from the sidebar or create a new one" : "Create a new profile"}</p>
      <form on:submit={submit}>
        <label for={nameId}>Name</label>
        <input id={nameId} value={name()} on:input={(e) => setName(e.target.value)} use:autofocus />
        <button type="submit">Create</button>
      </form>
    </>
  );
}

function InstalledModsList(props: { game: string }) {
  const context = useContext(ModInstallContext)!;

  return (
    <Show
      when={context.installed.latest.length !== 0}
      fallback={<p>Looks like you haven't installed any mods yet.</p>}
    >
      <ModList
        // kinda gross
        mods={(() => {
          const data = context.installed();
          return async (page) => page === 0 ? data : [];
        })()}
      />
    </Show>
  );
}

function SidebarProfileComponent(props: {
  gameId: string;
  profileId: string;
  profileName: string;
  refetchProfiles: Refetcher<ProfileWithId[]>;
  selected: boolean;
}) {
  const [confirmingDeletion, setConfirmingDeletion] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  const navigate = useNavigate();

  return (
    <li class={sidebarStyles.profileList__item}>
      <A href={`/profile/${props.gameId}/${props.profileId}`}>
        {props.profileName}
      </A>
      <div class={sidebarStyles.profileItem__options}>
        <button data-pin title="Pin">
          <Fa icon={faThumbTack} rotate={90} />
        </button>
        <button data-pin title="Rename">
          <Fa icon={faPenToSquare} />
        </button>
        <button data-delete title="Delete" on:click={() => setConfirmingDeletion(true)}>
          <Fa icon={faTrashCan} />
        </button>
        <button data-export title="Export">
          <Fa icon={faFileExport} />
        </button>
      </div>

      <Show when={confirmingDeletion()}>
        <PromptDialog
          options={{
            title: "Confirm",
            question: `You are about to delete ${props.profileName}`,
            btns: {
              ok: {
                type: "danger",
                text: "Delete",
                async callback() {
                  if (props.selected) {
                    navigate(`/profile/${props.gameId}`, { replace: true });
                  }
                  if (deleting()) return;
                  setDeleting(true);
                  try {
                    await deleteProfile(props.profileId);
                  } finally {
                    setConfirmingDeletion(false);
                    setDeleting(false);
                    await props.refetchProfiles();
                  }
                },
              },
              cancel: {
                callback() {
                  setConfirmingDeletion(false);
                },
              },
            },
          }}
        />
      </Show>
    </li>
  );
}
