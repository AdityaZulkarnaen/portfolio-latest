import type { SchemaTypeDefinition } from "sanity";

import { about } from "./about";
import { experience } from "./experience";
import { message } from "./message";
import { tool } from "./tool";
import { work } from "./work";

export const schemaTypes: SchemaTypeDefinition[] = [
  work,
  experience,
  tool,
  about,
  message,
];
