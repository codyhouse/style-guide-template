export const vendorKey = (url: string): string => new URL(url).hostname.split('.').reverse().join('.');
