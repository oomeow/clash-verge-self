export function groupId(groupName: string) {
  return `group-${groupName.replaceAll(" ", "::")}`;
}

export function proxyId(groupName: string, proxyName: string) {
  return `${groupName.replaceAll(" ", "::")}-proxy-${proxyName.replaceAll(" ", "::")}`;
}
