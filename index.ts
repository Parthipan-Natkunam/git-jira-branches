import { Command } from "commander";
import figlet from "figlet";
import ora, { Ora } from "ora";

import pjson from "./package.json" assert { type: "json" };
import scriptConfig from "./config.json" assert { type: "json" };

type Ticket = {
  key: string;
  fields: {
    summary: string;
    description?: string;
  };
};

const { version, author, license } = pjson;
const { baseUrl, mail, token } = scriptConfig;

const program = new Command();
program
  .version(version)
  .name("gjb")
  .description(
    "Create Git branches named from your current in-progress Jira issues directly from the terminal"
  )
  .option("-i, --init", "initialize branching workflow")
  // .option("-l, --list", "list branches")
  .parse(process.argv);

const decoratedFiglet = figlet.textSync("Git Jira Branches");

const printPreamble = () => {
  console.log(decoratedFiglet);
  const underlineLength = decoratedFiglet.length / 5;
  console.log(`${"-".repeat(underlineLength)}\n`);
  console.log(
    `Version: ${version}\t Author: ${author}\t License: ${license}\n`
  );
  console.log(`Description:\n ${program.description()}\n`);
  console.log(`${"-".repeat(underlineLength)}\n`);
};

const { init } = program.opts();

const fetchTickets = (spinner: Ora): Promise<{ issues: Ticket[] }> => {
  spinner.text = "Fetching your in-progress tickets...\n";
  spinner.color = "yellow";
  return fetch(
    `${baseUrl}/rest/api/2/search?jql=assignee=currentuser()+AND+status='In+Progress'`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${mail}:${token}`).toString(
          "base64"
        )}`,
        Accept: "application/json",
      },
    }
  )
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
    })
    .catch((error) => {
      console.log(error);
      spinner.text = "Failed to fetch your in-progress tickets!\n";
      spinner.fail();
    });
};

const initialize = async (spinner: Ora) => {
  const data = await fetchTickets(spinner);
  if (data) {
    const issues = data.issues ?? [];
    spinner.text = `Found ${issues.length} in-progress ${
      issues.length > 1 ? "tickets" : "ticket"
    }\n`;
    spinner.succeed();
    const issuesList = issues.map((issue) => {
      return {
        id: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description || "N/A",
      };
    });
    issuesList.forEach((issue) => {
      console.log(`${issue.id}: ${issue.summary}`);
    });
  }
};

printPreamble();
if (init) {
  const spinner = ora("Initializing...\n").start();
  initialize(spinner);
}
