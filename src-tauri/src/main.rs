#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(debug_assertions)]
    {
        // 防止开发调试代码时，tauri 的热更新导致 mihomo 进程不能及时清理
        let mut system = sysinfo::System::new();
        system.refresh_all();
        for process in system.processes_by_name("self-mihomo".as_ref()) {
            process.kill();
        }
    }
    clash_verge_self_lib::run().unwrap();
}
