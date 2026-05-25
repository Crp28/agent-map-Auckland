export function normalizeOwnerName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,()/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ownerTokens(value: string) {
  return normalizeOwnerName(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function variantsFromSingleOwner(value: string) {
  const variants = new Set<string>();
  const raw = value.trim();
  const normalized = normalizeOwnerName(raw);
  if (normalized) {
    variants.add(normalized);
  }

  const commaParts = raw
    .split(",")
    .map((part) => normalizeOwnerName(part))
    .filter(Boolean);
  if (commaParts.length === 2) {
    variants.add(`${commaParts[1]} ${commaParts[0]}`.trim());
  }

  return [...variants];
}

export function ownerNameVariants(value: string) {
  const split = value
    .split(/\r?\n|;|\||\//)
    .map((part) => part.trim())
    .filter(Boolean);

  const values = split.length > 0 ? split : [value];
  return [...new Set(values.flatMap((part) => variantsFromSingleOwner(part)))];
}

export function ownersMatch(propertySmartsOwner: string, dbOwnerNames: string[]) {
  const propertyVariants = new Set(ownerNameVariants(propertySmartsOwner));
  const dbVariants = dbOwnerNames.flatMap((name) => ownerNameVariants(name));

  return dbVariants.some((variant) => propertyVariants.has(variant));
}

export function isStrictFirstLastSubsetMatch(propertySmartsOwner: string, dbLegalName: string) {
  const propertyVariants = ownerNameVariants(propertySmartsOwner);
  const legalVariants = ownerNameVariants(dbLegalName);

  return legalVariants.some((legalVariant) => {
    const legalTokens = ownerTokens(legalVariant);
    if (legalTokens.length !== 2) {
      return false;
    }

    return propertyVariants.some((propertyVariant) => {
      const propertyTokens = ownerTokens(propertyVariant);
      if (propertyTokens.length <= 2) {
        return false;
      }

      return (
        legalTokens[0] === propertyTokens[0] &&
        legalTokens[legalTokens.length - 1] === propertyTokens[propertyTokens.length - 1]
      );
    });
  });
}
