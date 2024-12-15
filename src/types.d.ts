export type Refetcher<T, R = unknown> = (
  info?: R
) => T | Promise<T> | undefined | null;

export interface Game {
  id: string;
  name: string;
  data_folder_name: string;
  display_mode: number;
  exclusions_url: string;
  exe_names: string[];
  game_image: string;
  instance_type: "Game" | "Server";
  package_loader: PackageLoader;
  settings_identifier: string;
  steam_folder_name: string;
  store_platform_metadata: StorePlatformMetadata[];
  thunderstore_url: string;
}

export enum PackageLoader {
  BepInEx = "BepInEx",
  MelonLoader = "MelonLoader",
  NorthStar = "NorthStar",
  GodotML = "GodotML",
  AncientDungeonVR = "AncientDungeonVR",
  ShimLoader = "ShimLoader",
  Lovely = "Lovely",
  ReturnOfModding = "ReturnOfModding",
  GDWeave = "GDWeave",
}

export type StorePlatformMetadata =
  | ((
      | { _storePlatform: "Steam" }
      | { _storePlatform: "SteamDirect" }
      | { _storePlatform: "Epic" }
      | { _storePlatform: "Xbox" }
    ) & { store_identifier: string })
  | { _storePlatform: "Oculus" }
  | { _storePlatform: "Origin" }
  | { _storePlatform: "Other" };

export type Mod = ModListing | ModPackage;

export interface ModMetadata {
  name: string;
  full_name: string;
  owner: string;
  package_url?: string;
  donation_link?: string;
  date_created: string;
  date_updated: string;
  rating_score: number;
  is_pinned: boolean;
  is_deprecated: boolean;
  has_nsfw_content: boolean;
  categories: string[];
  uuid4: string;
}

/**
 * A mod listing with all available versions.
 */
export interface ModListing extends ModMetadata {
  versions: ModVersion[];
}

/**
 * A versioned mod package.
 */
export interface ModPackage extends ModMetadata {
  game: string;
  version: ModVersion;
}

export interface ModVersion {
  name: string;
  full_name: string;
  description: string;
  icon: string;
  version_number: string;
  dependencies: string[];
  download_url: string;
  downloads: number;
  date_created: string;
  website_url?: string;
  is_active: boolean;
  uuid4: string;
  file_size: number;
}
