import fs from "fs";
import { Command } from "commander";
import figlet from "figlet";
import pjson from "../package.json" assert { type: "json" };

const { version } = pjson;

const program = new Command();

const decoratedFiglet = figlet.textSync("Git Jira Branches");

console.log(decoratedFiglet);
console.log(`${"-".repeat(decoratedFiglet.length / 6)}\n`);

program
  .version(version)
  .name("gjb")
  .description(
    "Create Git branches named from your current in-progress Jira issues directly from the terminal."
  )
  .option("-i, --init", "initialize branching workflow")
  .option("-l, --list", "list branches")
  .parse(process.argv);

const { init, list } = program.opts();

if (init) {
    console.log("Initializing...");
} else if (list) {
    console.log("Listing...");
}
