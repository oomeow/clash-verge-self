#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(err) = clash_verge_self_lib::run() {
        eprintln!("failed to run the application: {err:#}");
        std::process::exit(1);
    }
}
