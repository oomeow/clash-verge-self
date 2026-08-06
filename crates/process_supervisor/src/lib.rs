use std::{
    ffi::OsString,
    path::PathBuf,
    process::Stdio,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU32, AtomicU64, AtomicUsize, Ordering},
    },
    time::Duration,
};

use parking_lot::Mutex;
use sysinfo::{Pid, ProcessesToUpdate, Signal, System};
use thiserror::Error;
use tokio::{
    io::{AsyncBufReadExt, AsyncRead, BufReader},
    process::{Child, Command},
    sync::mpsc,
    task::JoinHandle,
    time::sleep,
};
use tracing_subscriber::{Registry, layer::SubscriberExt};

/// Errors returned by the process supervisor when spawning, supervising, or stopping a process fails.
#[derive(Debug, Error)]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to start process `{program}`: {source}")]
    Spawn {
        program: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("process `{label}` did not expose a pid")]
    MissingPid { label: String },
}

pub type Result<T> = std::result::Result<T, Error>;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Restart policy for a managed child process.
#[derive(Debug, Clone)]
pub struct RestartPolicy {
    /// Maximum number of automatic restart attempts after an unexpected exit.
    pub max_restarts: usize,
    /// Delay between restart attempts.
    pub restart_delay: Duration,
}

impl Default for RestartPolicy {
    fn default() -> Self {
        Self {
            max_restarts: 0,
            restart_delay: Duration::from_secs(1),
        }
    }
}

/// Type alias for a line format function used to format log lines before writing.
pub type LineFormatter = Arc<dyn Fn(&str) -> String + Send + Sync + 'static>;

/// Optional log file destinations for redirected child stdout and stderr.
#[derive(Clone, Default)]
pub struct ProcessLogConfig {
    /// File used to persist stdout and stderr lines.
    pub log_file: Option<PathBuf>,
    /// Whether the target file should be truncated before the first spawn.
    pub truncate_on_start: bool,
    /// Optional line format function to apply to log lines before writing.
    pub line_formatter: Option<LineFormatter>,
    /// Max size (in MB) of a single log file before it is rotated. `None` uses the default (10 MB).
    pub log_roll_size: Option<u64>,
    /// Maximum number of rotated log files to keep. `None` uses the default (10).
    pub log_max_keep_files: Option<u64>,
}

impl std::fmt::Debug for ProcessLogConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ProcessLogConfig")
            .field("log_file", &self.log_file)
            .field("truncate_on_start", &self.truncate_on_start)
            .field("log_roll_size", &self.log_roll_size)
            .field("log_max_keep_files", &self.log_max_keep_files)
            .finish()
    }
}

impl ProcessLogConfig {
    /// Effective rotation size in MB, falling back to the default of 10 MB.
    pub fn roll_size(&self) -> u64 {
        self.log_roll_size.unwrap_or(10)
    }

    /// Effective max number of rotated files to keep, falling back to the default of 10.
    pub fn max_keep_files(&self) -> u64 {
        self.log_max_keep_files.unwrap_or(10)
    }
}

/// Full process configuration used to spawn and supervise a child program.
#[derive(Debug, Clone)]
pub struct ProcessSpec {
    /// Human-readable label used in logs and emitted events.
    pub label: String,
    /// Executable path.
    pub program: PathBuf,
    /// Command-line arguments.
    pub args: Vec<OsString>,
    /// Optional working directory.
    pub current_dir: Option<PathBuf>,
    /// Optional PID file path.
    pub pid_file: Option<PathBuf>,
    /// Additional environment variables.
    pub envs: Vec<(OsString, OsString)>,
    /// Restart policy for unexpected exits.
    pub restart_policy: RestartPolicy,
    /// Output persistence configuration.
    pub log_config: ProcessLogConfig,
}

impl ProcessSpec {
    /// Creates a process spec with sensible defaults for optional fields.
    pub fn new(label: impl Into<String>, program: impl Into<PathBuf>) -> Self {
        Self {
            label: label.into(),
            program: program.into(),
            args: Vec::new(),
            current_dir: None,
            pid_file: None,
            envs: Vec::new(),
            restart_policy: RestartPolicy::default(),
            log_config: ProcessLogConfig::default(),
        }
    }

    pub fn with_pid_file(mut self, pid_file: impl Into<PathBuf>) -> Self {
        self.pid_file = Some(pid_file.into());
        self
    }
}

/// Lifecycle events emitted while the managed child is running.
#[derive(Debug, Clone)]
pub enum ProcessEvent {
    Started {
        label: String,
        pid: u32,
    },
    Stdout {
        label: String,
        line: String,
    },
    Stderr {
        label: String,
        line: String,
    },
    Exited {
        label: String,
        pid: Option<u32>,
        code: Option<i32>,
        intentional: bool,
    },
    Restarting {
        label: String,
        attempt: usize,
        delay: Duration,
    },
    RestartLimitReached {
        label: String,
        attempts: usize,
    },
    Error {
        label: String,
        message: String,
    },
}

/// Event callback invoked for every emitted [`ProcessEvent`].
pub type EventHandler = Arc<dyn Fn(ProcessEvent) + Send + Sync + 'static>;

struct LogSink {
    sender: Option<mpsc::Sender<Vec<u8>>>,
    task: Option<JoinHandle<()>>,
    _guard: Option<tracing_appender::non_blocking::WorkerGuard>,
}

/// Supervises a single child process with optional restart and output handling.
#[derive(Clone)]
pub struct ProcessSupervisor {
    inner: Arc<Inner>,
}

struct Inner {
    /// Optional callback invoked for every emitted lifecycle event.
    handler: Option<EventHandler>,
    /// Pid of the currently tracked child process. `0` means no active child.
    pid: AtomicU32,
    /// Whether the current generation is considered running.
    running: AtomicBool,
    /// Whether shutdown was explicitly requested by the caller.
    stop_requested: AtomicBool,
    /// Restart attempts accumulated for the current generation.
    restart_count: AtomicUsize,
    /// Monotonic generation counter used to invalidate older supervisor tasks.
    generation: AtomicU64,
    /// Join handle for the active supervisor task, if one exists.
    task: Mutex<Option<JoinHandle<()>>>,
}

impl std::fmt::Debug for ProcessSupervisor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ProcessSupervisor")
            .field("pid", &self.pid())
            .field("running", &self.is_running())
            .field("restart_count", &self.restart_count())
            .finish()
    }
}

impl ProcessSupervisor {
    /// Creates a new process supervisor with an optional event handler.
    pub fn new(handler: Option<EventHandler>) -> Self {
        Self {
            inner: Arc::new(Inner {
                handler,
                pid: AtomicU32::new(0),
                running: AtomicBool::new(false),
                stop_requested: AtomicBool::new(false),
                restart_count: AtomicUsize::new(0),
                generation: AtomicU64::new(0),
                task: Mutex::new(None),
            }),
        }
    }

    /// Returns the currently tracked child pid, if any.
    pub fn pid(&self) -> Option<u32> {
        let pid = self.inner.pid.load(Ordering::SeqCst);
        (pid != 0).then_some(pid)
    }

    /// Returns whether the manager currently considers the child running.
    pub fn is_running(&self) -> bool {
        self.inner.running.load(Ordering::SeqCst)
    }

    /// Returns the number of restart attempts for the current generation.
    pub fn restart_count(&self) -> usize {
        self.inner.restart_count.load(Ordering::SeqCst)
    }

    /// Resets the tracked restart count to zero.
    pub fn reset_restart_count(&self) {
        self.inner.restart_count.store(0, Ordering::SeqCst);
    }

    pub fn kill_old_process(&self, pid_file: Option<&PathBuf>) {
        if self.pid().is_none()
            && let Some(pid_file) = pid_file
            && let Ok(old_pid) = std::fs::read_to_string(pid_file)
        {
            let pid = old_pid.trim().parse::<u32>().unwrap_or(0);
            log::info!("killing old process with pid {}", pid);
            kill_pid(pid);
        }
    }

    /// Stops the current child if needed and starts supervising a new one.
    pub async fn start(&self, spec: ProcessSpec) -> Result<u32> {
        log::info!("start requested for process `{}`", spec.label);
        self.kill_old_process(spec.pid_file.as_ref());
        self.stop().await?;

        let generation = self.inner.generation.fetch_add(1, Ordering::SeqCst) + 1;
        self.inner.stop_requested.store(false, Ordering::SeqCst);
        self.inner.restart_count.store(0, Ordering::SeqCst);

        let child = self.spawn_child(&spec)?;
        let pid = child.id().ok_or_else(|| Error::MissingPid {
            label: spec.label.clone(),
        })?;
        if let Some(pid_file) = &spec.pid_file {
            std::fs::write(pid_file, pid.to_string()).ok();
        }

        self.inner.pid.store(pid, Ordering::SeqCst);
        self.inner.running.store(true, Ordering::SeqCst);
        self.emit(ProcessEvent::Started {
            label: spec.label.clone(),
            pid,
        });

        let supervisor = self.clone();
        let task = tokio::spawn(async move {
            supervisor.supervise(generation, spec, child).await;
        });
        *self.inner.task.lock() = Some(task);

        Ok(pid)
    }

    /// Stops the currently supervised child and waits for the supervisor task to finish.
    pub async fn stop(&self) -> Result<()> {
        self.inner.stop_requested.store(true, Ordering::SeqCst);

        if let Some(pid) = self.pid() {
            log::info!("stop requested for pid {pid}");
            kill_pid(pid);
        } else {
            log::debug!("stop requested but no managed pid is currently tracked");
        }

        let task = self.inner.task.lock().take();
        if let Some(task) = task {
            log::debug!("waiting for process supervisor task to finish");
            if let Err(err) = task.await {
                log::error!("supervisor task failed: {err}");
            }
        }

        self.inner.pid.store(0, Ordering::SeqCst);
        self.inner.running.store(false, Ordering::SeqCst);
        log::debug!("process supervisor stop completed");
        Ok(())
    }

    /// Supervises one process generation until it is intentionally stopped, replaced,
    /// or exceeds the configured restart policy.
    ///
    /// The loop for each child instance is:
    /// 1. Spawn stdout/stderr pump tasks so output is drained concurrently.
    /// 2. Wait for the child to exit and for both output pumps to finish.
    /// 3. Finalize this exit via [`Self::finish_child_exit`], which clears tracked
    ///    runtime state and emits an `Exited` event.
    /// 4. If the exit was intentional or this supervisor generation is stale, stop.
    /// 5. Otherwise attempt a restart via [`Self::restart_child`].
    ///
    /// This split keeps the main supervision loop focused on lifecycle order while
    /// moving exit bookkeeping and restart policy decisions into smaller helpers.
    async fn supervise(&self, generation: u64, spec: ProcessSpec, mut child: Child) {
        let mut attempts = 0usize;
        let mut first_spawn = true;

        log::debug!("supervisor started for `{}` with generation {}", spec.label, generation);

        if let Some(log_file) = &spec.log_config.log_file {
            log::debug!("log file for `{}`: {}", spec.label, log_file.display());
        }

        loop {
            let pid = child.id();

            let mut log_sink = LogSink::new(
                &spec.label,
                spec.log_config.log_file.as_ref(),
                spec.log_config.truncate_on_start && first_spawn,
                spec.log_config.line_formatter.clone(),
                spec.log_config.roll_size(),
                spec.log_config.max_keep_files(),
            )
            .await;
            let stdout_task = tokio::spawn(pump_stream(
                child.stdout.take(),
                spec.label.clone(),
                false,
                self.inner.handler.clone(),
                log_sink.sender(),
            ));
            let stderr_task = tokio::spawn(pump_stream(
                child.stderr.take(),
                spec.label.clone(),
                true,
                self.inner.handler.clone(),
                log_sink.sender(),
            ));

            let status = child.wait().await;
            if let Err(err) = stdout_task.await {
                log::error!("stdout pump task failed: {err}");
            }
            if let Err(err) = stderr_task.await {
                log::error!("stderr pump task failed: {err}");
            }
            log_sink.shutdown().await;
            first_spawn = false;

            if self.finish_child_exit(generation, &spec.label, pid, status) {
                if let Some(pid_file) = &spec.pid_file {
                    std::fs::write(pid_file, "").ok();
                }
                break;
            }

            match self.restart_child(generation, &spec, &mut attempts).await {
                Ok(new_child) => {
                    let Some(new_child) = new_child else {
                        break;
                    };
                    if let Some(pid) = new_child.id()
                        && let Some(pid_file) = &spec.pid_file
                    {
                        std::fs::write(pid_file, pid.to_string()).ok();
                    }
                    child = new_child;
                }
                Err(err) => {
                    if let Some(pid_file) = &spec.pid_file {
                        std::fs::write(pid_file, "").ok();
                    }
                    self.emit(ProcessEvent::Error {
                        label: spec.label.clone(),
                        message: err.to_string(),
                    });
                    break;
                }
            }
        }

        log::debug!(
            "supervisor finished for `{}` with generation {}",
            spec.label,
            generation
        );
    }

    fn finish_child_exit(
        &self,
        generation: u64,
        label: &str,
        pid: Option<u32>,
        status: std::io::Result<std::process::ExitStatus>,
    ) -> bool {
        if let Err(err) = &status {
            log::error!("failed to wait on process `{label}`: {err}");
        }

        let intentional = self.inner.stop_requested.load(Ordering::SeqCst)
            || self.inner.generation.load(Ordering::SeqCst) != generation;
        let code = status.ok().and_then(|exit_status| exit_status.code());

        if self.inner.generation.load(Ordering::SeqCst) == generation {
            self.inner.pid.store(0, Ordering::SeqCst);
            self.inner.running.store(false, Ordering::SeqCst);
        }

        self.emit(ProcessEvent::Exited {
            label: label.to_string(),
            pid,
            code,
            intentional,
        });

        intentional
    }

    async fn restart_child(&self, generation: u64, spec: &ProcessSpec, attempts: &mut usize) -> Result<Option<Child>> {
        if *attempts >= spec.restart_policy.max_restarts {
            self.emit(ProcessEvent::RestartLimitReached {
                label: spec.label.clone(),
                attempts: *attempts,
            });
            return Ok(None);
        }

        *attempts += 1;
        self.inner.restart_count.store(*attempts, Ordering::SeqCst);
        self.emit(ProcessEvent::Restarting {
            label: spec.label.clone(),
            attempt: *attempts,
            delay: spec.restart_policy.restart_delay,
        });
        sleep(spec.restart_policy.restart_delay).await;

        if self.inner.stop_requested.load(Ordering::SeqCst)
            || self.inner.generation.load(Ordering::SeqCst) != generation
        {
            log::debug!(
                "skip restarting process `{}` because supervisor is no longer active",
                spec.label
            );
            return Ok(None);
        }

        let child = self.spawn_child(spec)?;
        let pid = child.id().ok_or_else(|| Error::MissingPid {
            label: spec.label.clone(),
        })?;
        self.mark_child_started(&spec.label, pid);

        Ok(Some(child))
    }

    fn mark_child_started(&self, label: &str, pid: u32) {
        self.inner.pid.store(pid, Ordering::SeqCst);
        self.inner.running.store(true, Ordering::SeqCst);
        self.emit(ProcessEvent::Started {
            label: label.to_string(),
            pid,
        });
    }

    fn spawn_child(&self, spec: &ProcessSpec) -> Result<Child> {
        let mut command = Command::new(&spec.program);
        command
            .args(spec.args.iter())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(false);

        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);

        if let Some(current_dir) = &spec.current_dir {
            command.current_dir(current_dir);
        }
        for (key, value) in &spec.envs {
            command.env(key, value);
        }

        log::info!(
            "start process `{}` with program `{}`",
            spec.label,
            spec.program.display()
        );

        command.spawn().map_err(|source| Error::Spawn {
            program: spec.program.clone(),
            source,
        })
    }

    fn emit(&self, event: ProcessEvent) {
        match &event {
            ProcessEvent::Started { label, pid } => {
                log::info!("process `{label}` started with pid {pid}");
            }
            ProcessEvent::Stdout { label, line } => {
                log::info!("[{label}]: {line}");
            }
            ProcessEvent::Stderr { label, line } => {
                log::error!("[{label}]: {line}");
            }
            ProcessEvent::Exited {
                label,
                pid,
                code,
                intentional,
            } => {
                log::info!(
                    "process `{label}` exited, pid: {:?}, code: {:?}, intentional: {intentional}",
                    pid,
                    code
                );
            }
            ProcessEvent::Restarting { label, attempt, delay } => {
                log::warn!(
                    "process `{label}` restarting, attempt {attempt}, delay {} ms",
                    delay.as_millis()
                );
            }
            ProcessEvent::RestartLimitReached { label, attempts } => {
                log::error!("process `{label}` reached restart limit after {attempts} retries");
            }
            ProcessEvent::Error { label, message } => {
                log::error!("process `{label}` error: {message}");
            }
        }

        if let Some(handler) = &self.inner.handler {
            handler(event);
        }
    }
}

async fn pump_stream(
    stream: Option<impl AsyncRead + Unpin>,
    label: String,
    is_stderr: bool,
    handler: Option<EventHandler>,
    log_sender: Option<mpsc::Sender<Vec<u8>>>,
) {
    let Some(stream) = stream else {
        return;
    };

    let mut reader = BufReader::new(stream);
    let mut buffer = Vec::new();

    loop {
        buffer.clear();
        match reader.read_until(b'\n', &mut buffer).await {
            Ok(0) => break,
            Ok(_) => {
                if let Some(log_sender) = &log_sender
                    && let Err(err) = log_sender.send(buffer.clone()).await
                {
                    log::error!("failed to queue process `{label}` output for log writing: {err}");
                    break;
                }

                let line = String::from_utf8_lossy(&buffer)
                    .trim_end_matches(['\r', '\n'])
                    .to_string();

                // if is_stderr {
                //     log::error!("[{label}]: {line}");
                // } else {
                //     log::info!("[{label}]: {line}");
                // }

                if let Some(handler) = &handler {
                    let event = if is_stderr {
                        ProcessEvent::Stderr {
                            label: label.clone(),
                            line,
                        }
                    } else {
                        ProcessEvent::Stdout {
                            label: label.clone(),
                            line,
                        }
                    };
                    handler(event);
                }
            }
            Err(err) => {
                log::error!("failed to read process `{label}` output: {err}");
                break;
            }
        }
    }
}

impl LogSink {
    async fn new(
        label: &str,
        log_file: Option<&PathBuf>,
        _truncate: bool,
        line_formatter: Option<LineFormatter>,
        roll_size: u64,
        max_keep_files: u64,
    ) -> Self {
        let Some(path) = log_file else {
            return Self {
                sender: None,
                task: None,
                _guard: None,
            };
        };

        log::debug!("open rolling process log file for `{label}` at {}", path.display());

        let file_name = match path.file_name().map(PathBuf::from) {
            Some(name) => name,
            None => {
                log::error!("invalid output log file path for process `{label}`: {}", path.display());
                return Self {
                    sender: None,
                    task: None,
                    _guard: None,
                };
            }
        };
        let log_dir = path.parent().unwrap_or_else(|| std::path::Path::new(".")).to_path_buf();

        let appender = match logroller::LogRollerBuilder::new(log_dir, file_name)
            .rotation(logroller::Rotation::SizeBased(logroller::RotationSize::MB(
                roll_size.max(1),
            )))
            .max_keep_files(max_keep_files)
            .time_zone(logroller::TimeZone::Local)
            .compression(logroller::Compression::Gzip)
            .graceful_shutdown(true)
            .build()
        {
            Ok(appender) => appender,
            Err(err) => {
                log::error!(
                    "failed to build rolling output log file for process `{label}` at {}: {err}",
                    path.display()
                );
                return Self {
                    sender: None,
                    task: None,
                    _guard: None,
                };
            }
        };

        let (writer, guard) = tracing_appender::non_blocking(appender);

        let file_layer = tracing_subscriber::fmt::layer()
            .compact()
            .with_ansi(false)
            .without_time()
            .with_level(false)
            .with_target(false)
            .with_line_number(false)
            .with_writer(writer);
        let subscriber = Registry::default().with(file_layer);
        let dispatch = tracing::Dispatch::new(subscriber);

        let (sender, mut receiver) = mpsc::channel::<Vec<u8>>(256);
        let task = tokio::spawn(async move {
            while let Some(chunk) = receiver.recv().await {
                let line = String::from_utf8_lossy(&chunk)
                    .trim_end_matches(['\r', '\n'])
                    .to_string();
                let line = if let Some(line_formatter) = line_formatter.as_ref() {
                    line_formatter(&line)
                } else {
                    line
                };

                tracing::dispatcher::with_default(&dispatch, || {
                    tracing::info!("{line}");
                });
            }
        });

        Self {
            sender: Some(sender),
            task: Some(task),
            _guard: Some(guard),
        }
    }

    fn sender(&self) -> Option<mpsc::Sender<Vec<u8>>> {
        self.sender.clone()
    }

    async fn shutdown(&mut self) {
        self.sender.take();
        if let Some(task) = self.task.take()
            && let Err(err) = task.await
        {
            log::error!("log writer task failed: {err}");
        }
        self._guard.take();
    }
}

/// Kills the process with the given PID by sending a terminate signal.
///
/// If sending the signal fails, the process is forcefully killed.
fn kill_pid(pid: u32) {
    log::debug!("send terminate signal to pid {pid}");
    let mut system = System::new();
    let pid = Pid::from_u32(pid);
    system.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);

    if let Some(process) = system.process(pid) {
        // Try to terminate gracefully, if not supported or fails, force kill.
        if !process.kill_with(Signal::Term).unwrap_or(false) {
            process.kill();
        }
    } else {
        log::debug!("pid {pid} is no longer present when stop was requested");
    }
}
