// DTCG recommends reverse domain name notation for $extensions keys.
export const vendorKey = (url) => new URL(url).hostname.split('.').reverse().join('.');
