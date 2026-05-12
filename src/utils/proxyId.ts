const encodeIdPart = (value: string) => encodeURIComponent(value);

export function groupId(groupName: string) {
  return `group-${encodeIdPart(groupName)}`;
}

export function proxyId(groupName: string, proxyName: string) {
  return `group-${encodeIdPart(groupName)}-proxy-${encodeIdPart(proxyName)}`;
}
