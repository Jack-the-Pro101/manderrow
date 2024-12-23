#![deny(unused_must_use)]
#![feature(path_add_extension)]

mod commands;
mod game_reviews;
mod games;
mod ipc;
mod launching;
mod mods;
mod paths;
mod window_state;
mod wrap;

use std::sync::OnceLock;

use anyhow::{anyhow, Context};
use log::error;

static PRODUCT_NAME: OnceLock<String> = OnceLock::new();
static IDENTIFIER: OnceLock<String> = OnceLock::new();

fn product_name() -> &'static str {
    PRODUCT_NAME.get().unwrap()
}

fn identifier() -> &'static str {
    IDENTIFIER.get().unwrap()
}

#[derive(Debug, Clone, serde::Serialize)]
struct Error {
    message: String,
    backtrace: String,
}

impl<T: std::fmt::Display> From<T> for Error {
    #[track_caller]
    fn from(value: T) -> Self {
        let backtrace = std::backtrace::Backtrace::force_capture();
        error!("{value}\nBacktrace:\n{backtrace}");
        Self {
            message: value.to_string(),
            backtrace: backtrace.to_string(),
        }
    }
}

fn run_app(ctx: tauri::Context<tauri::Wry>) -> anyhow::Result<()> {
    let level_filter = std::env::var("RUST_LOG")
        .map(|s| {
            s.parse::<log::LevelFilter>()
                .expect("Invalid logging configuration")
        })
        .unwrap_or(log::LevelFilter::Info);
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .filter(move |metadata| {
                    metadata.level() <= level_filter
                        && (metadata.level() < log::Level::Trace
                            || (cfg!(debug_assertions) && metadata.target() == "manderrow"))
                })
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(window_state::init())
        .invoke_handler(tauri::generate_handler![
            commands::close_splashscreen::close_splashscreen,
            commands::games::get_games,
            commands::games::get_games_popularity,
            commands::i18n::get_preferred_locales,
            commands::mod_index::fetch_mod_index,
            commands::mod_index::query_mod_index,
            commands::profiles::get_profiles,
            commands::profiles::create_profile,
            commands::profiles::delete_profile,
            commands::profiles::launch_profile,
        ])
        .run(ctx)
        .context("error while running tauri application")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn main() -> anyhow::Result<()> {
    let ctx = tauri::generate_context!();
    PRODUCT_NAME
        .set(ctx.config().product_name.clone().unwrap())
        .unwrap();
    IDENTIFIER.set(ctx.config().identifier.clone()).unwrap();

    paths::init().unwrap();

    let mut args = std::env::args_os();
    _ = args.next().unwrap();

    match args.next() {
        Some(cmd) if cmd == "wrap" => tauri::async_runtime::block_on(async move {
            match wrap::run(args).await {
                Ok(()) => Ok(()),
                Err(e) => {
                    if cfg!(debug_assertions) {
                        tokio::fs::write("/tmp/manderrow-wrap-crash", &format!("{e:?}")).await?;
                    }
                    Err(e)
                }
            }
        }),
        Some(cmd) => Err(anyhow!("Unrecognized command {cmd:?}")),
        None => run_app(ctx),
    }
}
