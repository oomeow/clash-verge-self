#[cfg(unix)]
mod unix;

pub fn register() {
    #[cfg(unix)]
    unix::register();
}
