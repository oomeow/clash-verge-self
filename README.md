<h1 align="center">
  <img src="./src/assets/image/logo.png" alt="Clash" width="128" />
  <br>
  Clash Verge Self
  <br>
</h1>

<h3 align="center">
A <a href="https://github.com/MetaCubeX/mihomo">Mihomo</a> GUI based on <a href="https://github.com/tauri-apps/tauri">Tauri</a>.
</h3>

<div align="center">
  <img style="max-height: 500" src="./docs/verge.gif" />
</div>

<p align="center">
  <a href="https://github.com/oomeow/clash-verge-self/releases"><img src="https://img.shields.io/github/release/oomeow/clash-verge-self.svg" alt="Release" /></a>
  <a href="https://github.com/oomeow/clash-verge-self/blob/main/LICENSE"><img src="https://img.shields.io/github/license/oomeow/clash-verge-self" alt="License" /></a>
</p>

> [!Note]
>
> 此仓库 Fork 自 1.6.0 版本的 **_Clash Verge Rev_**，基于个人需求进行功能定制和优化。由于主要在 Linux 下开发和使用，不保证在其他系统上运行完美。
>
> 其他 Clash 系列桌面端软件：
>
> - [Sparkle](https://github.com/xishang0128/sparkle)
> - [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)
> - [Clash Nyanpasu](https://github.com/libnyanpasu/clash-nyanpasu)
> - [FlClash](https://github.com/chen08209/FlClash)

## Preview

| Light                      | Dark                     |
| -------------------------- | ------------------------ |
| ![light](./docs/light.png) | ![dark](./docs/dark.png) |

| Pink (customize)         | Blue (customize)         |
| ------------------------ | ------------------------ |
| ![pink](./docs/pink.png) | ![blue](./docs/blue.png) |

## Features

- **Mihomo Core Only** — Exclusive support for the [Mihomo](https://github.com/MetaCubeX/mihomo) (Clash Meta) core.
- **Profile Management** — Advanced profile management via YAML and JavaScript enhancement.
- **Customizable UI** — Custom theme colors and improved interface.
- **System Proxy** — System proxy setting and guard.

### FAQ

Refer to the [FAQ Page](https://clash-verge-rev.github.io/faq/windows.html).

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and contribution guidelines.

```shell
pnpm i                  # Install dependencies (also installs prek git hooks)
pnpm check              # Download resources; locally also builds the service binary
                        #   --force      Force re-download
                        #   --alpha      Download alpha channel service
                        #   --target     Specify target triple (e.g. x86_64-unknown-linux-gnu)
                        #   --no-confirm Skip confirmation prompt
pnpm build:service      # Rebuild service binary after modifying service code
pnpm dev                # Start development server
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) and [UPDATELOG.md](./UPDATELOG.md).

## Acknowledgement

Clash Verge Self was based on or inspired by these projects:

- [clash-verge-rev/clash-verge-rev](https://github.com/clash-verge-rev/clash-verge-rev): Continuation of Clash Verge - A Clash Meta GUI based on Tauri (Windows, MacOS, Linux).
- [zzzgydi/clash-verge](https://github.com/zzzgydi/clash-verge): A Clash GUI based on tauri. Supports Windows, macOS and Linux.
- [tauri-apps/tauri](https://github.com/tauri-apps/tauri): Build smaller, faster, and more secure desktop applications with a web frontend.
- [Dreamacro/clash](https://github.com/Dreamacro/clash): A rule-based tunnel in Go.
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo): A rule-based tunnel in Go.
- [Fndroid/clash_for_windows_pkg](https://github.com/Fndroid/clash_for_windows_pkg): A Windows/macOS GUI based on Clash.
- [vitejs/vite](https://github.com/vitejs/vite): Next generation frontend tooling. It's fast!

## Activity

![Alt](https://repobeats.axiom.co/api/embed/75152e62bbdd3da71dbc8519238a1741c97ab448.svg "Repobeats analytics image")

## License

[GPL-3.0 License](./LICENSE)
