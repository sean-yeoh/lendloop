// Usage: pnpm setup:env
// Creates .env.local from .env.example. An existing .env.local is never changed.
import { constants, copyFileSync, existsSync } from "node:fs";

const TARGET = ".env.local";

if (existsSync(TARGET)) {
  console.log(`✓ ${TARGET} exists, kept`);
} else {
  copyFileSync(".env.example", TARGET, constants.COPYFILE_EXCL);
  console.log(`✓ Created ${TARGET} from .env.example. Add your Clerk keys (README step 1).`);
}
