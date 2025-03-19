import { invoke } from "@tauri-apps/api/core";
import { wrapInvoke } from "../api";

export function closeSplashscreen(): Promise<void>  {
  return wrapInvoke(() => invoke("close_splashscreen"));
}

export function relaunch(): Promise<never>  {
  return wrapInvoke(() => invoke("relaunch"));
}