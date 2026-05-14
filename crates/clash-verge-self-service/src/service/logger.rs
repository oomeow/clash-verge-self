use std::{collections::VecDeque, sync::Arc};

use once_cell::sync::OnceCell;
use parking_lot::RwLock;

const LOGS_QUEUE_LEN: usize = 100;

pub struct Logger {
    log_data: Arc<RwLock<VecDeque<String>>>,
}

impl Logger {
    pub fn global() -> &'static Logger {
        static LOGGER: OnceCell<Logger> = OnceCell::new();
        LOGGER.get_or_init(|| Logger {
            log_data: Arc::new(RwLock::new(VecDeque::with_capacity(LOGS_QUEUE_LEN))),
        })
    }

    pub fn get_log(&self) -> VecDeque<String> {
        self.log_data.read().clone()
    }

    pub fn append_log(&self, text: String) {
        let mut logs = self.log_data.write();
        if logs.len() >= LOGS_QUEUE_LEN {
            logs.pop_front();
        }
        logs.push_back(text);
    }

    pub fn clear_log(&self) {
        let mut logs = self.log_data.write();
        logs.clear();
    }
}
