import { migrate } from "../src/lib/db";
import { writeEdition } from "../src/sim/edition";

migrate()
  .then(() => writeEdition())
  .then((e) => {
    console.log(JSON.stringify(e, null, 2));
    process.exit(0);
  });
