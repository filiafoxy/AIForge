// Поиск машин по госномеру.

import type { Vehicle } from '../../types/fleet';

// В парке госномера записаны латиницей, а механик может набрать их кириллицей:
// у всех двенадцати букв российских номеров есть латинские двойники.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
};

/** Приводит введённый номер к виду из парка: латиница, верхний регистр, без пробелов и дефисов. */
export function normalizePlate(text: string): string {
  return text
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[АВЕКМНОРСТУХ]/g, (letter) => CYRILLIC_TO_LATIN[letter] ?? letter);
}

/** Машины, в госномере которых встречается запрос. Пустой запрос возвращает весь список. */
export function filterVehiclesByPlate(vehicles: readonly Vehicle[], query: string): readonly Vehicle[] {
  const plateFragment = normalizePlate(query);
  if (plateFragment === '') return vehicles;
  return vehicles.filter((vehicle) => vehicle.vehicle_id.includes(plateFragment));
}
