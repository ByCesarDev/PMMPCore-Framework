console.log("=== TEST SCRIPT LOADING ===");

import { world, system } from "@minecraft/server";

console.log("=== TEST IMPORTS COMPLETED ===");

system.run(() => {
  console.log("=== TEST SYSTEM RUN ===");
});

console.log("=== TEST SCRIPT END ===");
