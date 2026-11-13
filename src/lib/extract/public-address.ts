import { BlockList, isIP } from 'node:net';

// Loopback, private, link-local (incl. cloud metadata 169.254.169.254), CGNAT, multicast and reserved ranges.
const blocked = new BlockList();
const V4: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
];
const V6: [string, number][] = [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]];
V4.forEach(([net, prefix]) => blocked.addSubnet(net, prefix, 'ipv4'));
V6.forEach(([net, prefix]) => blocked.addSubnet(net, prefix, 'ipv6'));

export function isPublicAddress(ip: string): boolean {
  const mappedV4 = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mappedV4) return isPublicAddress(mappedV4);
  const family = isIP(ip);
  if (family === 0) return false;
  return !blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}
