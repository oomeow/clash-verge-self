#[cfg(any(target_os = "linux", target_os = "macos"))]
mod unix;
#[cfg(target_os = "windows")]
mod windows;

pub fn init() {
    #[cfg(target_os = "windows")]
    windows::init();

    #[cfg(any(target_os = "linux", target_os = "macos"))]
    unix::init();
}
