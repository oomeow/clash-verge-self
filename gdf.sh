# if ! git diff --quiet HEAD~1 HEAD -- \
#   crates/tauri-plugin-mihomo/guest-js \
#   crates/tauri-plugin-mihomo/src/models.rs
# then
#   echo "有相关文件变更"
# fi

if ! git diff --quiet HEAD~1 HEAD -- \
  'crates/tauri-plugin-mihomo/guest-js' \
  'crates/tauri-plugin-mihomo/src/models.rs'
then
  # echo "mihomo_changed=true" >> "$GITHUB_OUTPUT"
  echo "有相关文件变更"
else
  # echo "mihomo_changed=false" >> "$GITHUB_OUTPUT"
  echo "无"
fi
