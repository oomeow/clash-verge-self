#!/bin/bash
set -e  # 遇到错误立即退出
set -u  # 使用未定义变量时报错

# 默认构建 target
BUILD_TARGET=""
RESOURCE_DIR="src-tauri/resources"
PACKAGE_NAME="clash-verge-self-service"

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      BUILD_TARGET="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--target <cargo_target>]"
      exit 1
      ;;
  esac
done

# 1️⃣ 构建 release
if [ -z "$BUILD_TARGET" ]; then
  echo "Building $PACKAGE_NAME (default host target)..."
  cargo build --release --package "$PACKAGE_NAME"
else
  echo "Building $PACKAGE_NAME for target: $BUILD_TARGET ..."
  cargo build --release --package "$PACKAGE_NAME" --target "$BUILD_TARGET"
fi

# 2️⃣ 判断可执行文件拓展名
EXT=""
if [[ "$BUILD_TARGET" == *"windows"* ]]; then
  EXT=".exe"
fi

# 3️⃣ 构建产物路径
if [ -z "$BUILD_TARGET" ]; then
  BUILD_PATH="target/release/${PACKAGE_NAME}${EXT}"
else
  BUILD_PATH="target/${BUILD_TARGET}/release/${PACKAGE_NAME}${EXT}"
fi

# 4️⃣ 设置可执行权限（Windows 上不影响）
if [[ "$EXT" != ".exe" ]]; then
  echo "Setting executable permission..."
  chmod 755 "$BUILD_PATH"
fi

# 5️⃣ 检查资源目录是否存在
if [ ! -d "$RESOURCE_DIR" ]; then
  echo "Directory $RESOURCE_DIR does not exist. Creating..."
  mkdir -p "$RESOURCE_DIR"
fi

# 6️⃣ 拷贝文件到资源目录
echo "Copying executable to $RESOURCE_DIR..."
cp "$BUILD_PATH" "$RESOURCE_DIR/"

echo "Done."
