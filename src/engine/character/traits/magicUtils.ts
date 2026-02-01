/**
 * Character Magic Utilities
 * Pure utility functions for magic and effect parsing
 *
 * C# Reference: Character.cs magic-related static methods
 */

/**
 * Parse magic list string with distance
 * C# Reference: Character.ParseMagicList
 *
 * @param listStr Format: "Magic1:Distance1;Magic2:Distance2" or "Magic1;Magic2"
 * @returns Array of {magicIni, useDistance}
 */
export function parseMagicList(listStr: string): Array<{ magicIni: string; useDistance: number }> {
  const result: Array<{ magicIni: string; useDistance: number }> = [];
  if (!listStr) return result;

  const parts = listStr.split(/[;；]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const colonMatch = trimmed.match(/^(.+?)[：:](\d+)$/);
    if (colonMatch) {
      const magicIni = colonMatch[1].trim();
      const useDistance = Number.parseInt(colonMatch[2], 10) || 0;
      result.push({ magicIni, useDistance });
    } else {
      // No distance specified, use 0 (will use attackRadius later)
      result.push({ magicIni: trimmed, useDistance: 0 });
    }
  }
  return result;
}

/**
 * Parse magic list string without distance
 * C# Reference: Character.ParseMagicListNoDistance
 *
 * @param listStr Format: "Magic1:Distance1;Magic2:Distance2" or "Magic1;Magic2"
 * @returns Array of magic file names only
 */
export function parseMagicListNoDistance(listStr: string): string[] {
  const result: string[] = [];
  if (!listStr) return result;

  const parts = listStr.split(/[;；]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const colonMatch = trimmed.match(/^(.+?)[：:](\d+)$/);
    if (colonMatch) {
      result.push(colonMatch[1].trim());
    } else {
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Build flyIniInfos list from magic list string
 * C# Reference: Character.AddMagicsToFlyIniInfos
 *
 * @param listStr Magic list string to parse
 * @param attackRadius Default attackRadius for entries without distance
 * @returns Sorted array of {useDistance, magicIni}
 */
export function buildFlyIniInfosFromList(
  listStr: string,
  attackRadius: number
): Array<{ useDistance: number; magicIni: string }> {
  const result: Array<{ useDistance: number; magicIni: string }> = [];
  const magics = parseMagicList(listStr);

  for (const item of magics) {
    const useDistance = item.useDistance === 0 ? attackRadius : item.useDistance;
    result.push({ useDistance, magicIni: item.magicIni });
  }

  // Sort by useDistance ascending
  result.sort((a, b) => a.useDistance - b.useDistance);
  return result;
}

/**
 * Build flyIniInfos list from individual flyIni fields
 * C# Reference: Character.FlyIni/FlyIni2/FlyInis setters
 *
 * @param flyIni Primary fly ini file
 * @param flyIni2 Secondary fly ini file
 * @param flyInis Multiple fly inis with distances
 * @param attackRadius Default attack radius
 * @returns Sorted array of {useDistance, magicIni}
 */
export function buildFlyIniInfos(
  flyIni: string,
  flyIni2: string,
  flyInis: string,
  attackRadius: number
): Array<{ useDistance: number; magicIni: string }> {
  const result: Array<{ useDistance: number; magicIni: string }> = [];

  // Parse flyInis first (format: "MagicIni1:Distance1;MagicIni2:Distance2")
  if (flyInis) {
    const parts = flyInis.split(/[;；]/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const colonMatch = trimmed.match(/^(.+?)[：:](\d+)$/);
      if (colonMatch) {
        const magicIni = colonMatch[1].trim();
        const useDistance = Number.parseInt(colonMatch[2], 10) || 0;
        result.push({ useDistance, magicIni });
      } else {
        // No distance specified, use attackRadius
        result.push({ useDistance: attackRadius, magicIni: trimmed });
      }
    }
  }

  // Add flyIni with attackRadius distance
  if (flyIni) {
    result.push({ useDistance: attackRadius, magicIni: flyIni });
  }

  // Add flyIni2 with attackRadius distance
  if (flyIni2) {
    result.push({ useDistance: attackRadius, magicIni: flyIni2 });
  }

  // Sort by useDistance ascending
  result.sort((a, b) => a.useDistance - b.useDistance);
  return result;
}

/**
 * Add magic to flyIniInfos list (in place modification)
 * C# Reference: Character.AddMagicToInfos
 *
 * @param list The list to add to
 * @param magicIni Magic ini file path
 * @param useDistance Use distance
 * @param notResort If true, skip re-sorting
 */
export function addMagicToInfos(
  list: Array<{ useDistance: number; magicIni: string }>,
  magicIni: string,
  useDistance: number,
  notResort: boolean = false
): void {
  if (!magicIni) return;
  list.push({ useDistance, magicIni });
  if (!notResort) {
    list.sort((a, b) => a.useDistance - b.useDistance);
  }
}

/**
 * Remove magic from flyIniInfos list (in place modification)
 * C# Reference: Character.RemoveMagicFromInfos
 *
 * @param list The list to remove from
 * @param magicIni Magic ini file path
 * @param useDistance Use distance
 */
export function removeMagicFromInfos(
  list: Array<{ useDistance: number; magicIni: string }>,
  magicIni: string,
  useDistance: number
): void {
  if (!magicIni) return;
  for (let i = 0; i < list.length; i++) {
    if (list[i].magicIni === magicIni && list[i].useDistance === useDistance) {
      list.splice(i, 1);
      break;
    }
  }
}

/**
 * Get random magic from list based on distance
 * C# Reference: Character.GetRandomMagicWithUseDistance
 *
 * @param list The flyIniInfos list
 * @param distance Attack distance to match
 * @returns Magic ini file path or null
 */
export function getRandomMagicWithUseDistance(
  list: Array<{ useDistance: number; magicIni: string }>,
  distance: number
): string | null {
  // Filter by distance
  const candidates = list.filter(info => info.useDistance <= distance);
  if (candidates.length === 0) return null;

  // Return random candidate
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx].magicIni;
}
