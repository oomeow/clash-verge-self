# React Router Navigation from Tauri Backend

## Overview

This implementation enables seamless navigation to React Router routes from the Rust backend in the Tauri application.

## Changes Made

### Backend Changes (Rust)

**File**: `src-tauri/src/utils/resolve.rs`

#### New Functions

1. **`navigate_window_to_route(route: &str)`**
   - Navigate existing window to a React Router route
   - If window doesn't exist, it's a no-op
   - Example: `navigate_window_to_route("/profiles")`

2. **`create_window_with_route(route: Option<&str>)`**
   - Create or show main window
   - Optionally navigate to a route if window already exists
   - If `route` is `Some("/profiles")`, it will navigate when window shows
   - Backward compatible: `create_window()` wraps this with `None`

#### Modified Functions

- `create_window()`: Now wraps `create_window_with_route(None)` for backward compatibility
- Added `use tauri::Emitter` import to support window event emission

### Frontend Changes (TypeScript/React)

**File**: `src/pages/_layout.tsx`

#### Changes

1. Added `useRouter` hook from `@tanstack/react-router`
2. Added event listener for `navigate_to_route` event
3. When event is received, router navigates to the specified route

```typescript
const unlistenNavigateToRoute = listen(
  "navigate_to_route",
  (e: Event<string>) => {
    const route = e.payload;
    void router.navigate({ to: route });
  },
);
```

## Usage Examples

### Example 1: Navigate to /profiles when system tray is clicked

In `src-tauri/src/core/tray.rs` or wherever appropriate:

```rust
use crate::utils::resolve::{create_window, navigate_window_to_route};

// If you want to create window and navigate if already open
create_window_with_route(Some("/profiles"));

// Or if you want to navigate an already open window
navigate_window_to_route("/profiles");
```

### Example 2: Navigate after Deep Link handling

In `src-tauri/src/utils/resolve.rs`, after processing a deep link:

```rust
pub fn resolve_deep_links(urls: impl IntoIterator<Item = String>) {
    // ... existing deep link processing ...
    
    // After import succeeds, navigate to profiles page
    navigate_window_to_route("/profiles");
}
```

### Example 3: Single instance protocol handling

In `src-tauri/src/lib.rs`:

```rust
single_instance_plugin_builder.with_handler(move |event| {
    if event.args.is_empty() {
        // User tried to open a second instance
        create_window_with_route(Some("/settings"));
    } else {
        // Handle deep links
        create_window_with_route(Some("/profiles"));
    }
})
```

## Available Routes

Based on `src/routes/__root.tsx`:

- `/` - Proxies (default)
- `/profiles` - Profiles management
- `/connections` - Connections monitor
- `/rules` - Rules display
- `/logs` - Application logs
- `/test` - Testing tools
- `/settings` - Application settings

## Testing

### Manual Testing Steps

1. **Test window exists + navigation**
   ```bash
   # Start the app
   pnpm dev
   
   # Use the system tray context menu "Open Window" to trigger create_window()
   # Check that window shows and appears to be in focus
   ```

2. **Test deep link navigation**
   ```bash
   # Trigger a deep link (platform-specific)
   # macOS: open 'clash://install-config/?url=...'
   # Verify window opens/navigates to profiles page
   ```

3. **Test single instance**
   ```bash
   # Start app, then try to start another instance
   # Verify window shows and is focused (navigation event fires)
   ```

### Rust Compilation Check

```bash
# Verify no compilation errors
cargo check -p clash-verge-self

# If needed, run specific checks
cargo clippy --all-targets -- -D warnings
```

### TypeScript Compilation Check

```bash
# Verify no TypeScript errors
pnpm tsc --noEmit
```

## Architecture

```
┌─ Rust Backend ──────────────────────┐
│                                     │
│  Single Instance / Deep Link / etc  │
│              │                      │
│              ├─ create_window()     │
│              ├─ navigate_window...()│
│              └─ emit("navigate...") │
│                      │              │
└─────────────────────┼──────────────┘
                      │ Tauri IPC Event
                      ▼
┌─ React Frontend ─────────────────────┐
│                                      │
│  listen("navigate_to_route")         │
│              │                       │
│              ▼                       │
│  router.navigate({ to: route })     │
│              │                       │
│              ▼                       │
│   ✅ React Router Updates URL        │
│   ✅ Route Component Renders         │
│                                      │
└──────────────────────────────────────┘
```

## Risk Assessment

**Overall Risk Level**: LOW

- ✅ Backward compatible: `create_window()` has same behavior
- ✅ No function signature changes
- ✅ Additive only: new functions and event listeners
- ✅ Errors are traced but don't crash: uses `trace_err!` macro
- ✅ Event listener cleanup: proper unsubscribe in useEffect return

## Future Enhancements

1. Query string support: `navigate_window_to_route("/profiles?tab=imports")`
2. Hash route support for deep linking
3. State passing through events
4. Navigation validation/guards in frontend
