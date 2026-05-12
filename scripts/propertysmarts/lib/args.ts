export function getFlag(name: string) {
  const args = process.argv.slice(2);
  return args.includes(name);
}

export function getArgValue(name: string) {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === name);
  if (index < 0) {
    return undefined;
  }

  return args[index + 1];
}
