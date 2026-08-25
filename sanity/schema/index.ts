import type { SchemaTypeDefinition } from "sanity";

import { experience } from "./experience";
import { tool } from "./tool";
import { work } from "./work";

export const schemaTypes: SchemaTypeDefinition[] = [work, experience, tool];
