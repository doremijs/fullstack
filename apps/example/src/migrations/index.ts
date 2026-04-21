import type { Migration } from "@aeron/database";
import { migration001 } from "./001_create_users";

export const migrations: Migration[] = [migration001];
