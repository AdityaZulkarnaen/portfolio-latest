import type { SchemaTypeDefinition } from "sanity";

import { experience } from "./experience";
import { work } from "./work";

export const schemaTypes: SchemaTypeDefinition[] = [work, experience];
