import { Migration } from '../types';
import { migration_v0_0_0_to_v0_1_0 } from './v0_0_0_to_v0_1_0';
import { migration_v0_1_0_to_v0_2_0 } from './v0_1_0_to_v0_2_0';
import { migration_v0_2_0_to_v1_0_0 } from './v0_2_0_to_v1_0_0';

export const migrations: Migration[] = [
  migration_v0_0_0_to_v0_1_0,
  migration_v0_1_0_to_v0_2_0,
  migration_v0_2_0_to_v1_0_0,
];

export {
  migration_v0_0_0_to_v0_1_0,
  migration_v0_1_0_to_v0_2_0,
  migration_v0_2_0_to_v1_0_0,
};
