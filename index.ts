import { execSync } from "child_process";
import { Command } from "commander";
import figlet from "figlet";
import ora, { Ora } from "ora";
import kebabCase from "just-kebab-case";

import pjson from "./package.json" assert { type: "json" };
import scriptConfig from "./gjb-config.json" assert { type: "json" };

type Ticket = {
  key: string;
  fields: {
    summary: string;
    description?: string;
  };
};

type FormattedTicket = {
  id: string;
  branchDescription: string;
  summary: string;
  description: string;
};

const { version, author, license } = pjson;
const { baseUrl, mail, token, primaryBranch } = scriptConfig;

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
    if (issues.length > 1) {
      throw new Error(
        "You have more than one in-progress ticket. Please only work on one ticket at a time"
      );
    }
    if (issues.length === 0) {
      spinner.text = "No in-progress tickets found!\n";
      spinner.fail();
      return null;
    }
    spinner.text = `Found ${issues.length} in-progress ${
      issues.length > 1 ? "tickets" : "ticket"
    }\n`;
    spinner.succeed();
    const issuesList: FormattedTicket[] = issues.map((issue) => {
      return {
        id: issue.key,
        branchDescription: kebabCase(issue.fields.summary),
        summary: issue.fields.summary,
        description: issue.fields.description || "N/A",
      };
    });
    issuesList.forEach((issue) => {
      console.log(`${issue.id}:${issue.branchDescription}`);
    });
    return issuesList;
  }
};

const pullPrimaryBranch = (spinner: Ora) => {
  spinner.text = "Checking out and pulling primary branch...\n";
  spinner.color = "yellow";
  try {
    console.log(`Your primary branch is ${primaryBranch}`);
    execSync(`git checkout ${primaryBranch} && git pull`);
    spinner.text = `Successfully checked out to and pulled latest from ${primaryBranch} \n`;
    spinner.succeed();
  } catch (e) {
    spinner.text = "Failed to checkout to primary branch!\n";
    spinner.fail();
  }
};

const createBranch = (issue: FormattedTicket, spinner: Ora) => {
  spinner.text = `Creating branch for ticket ${issue.id}...\n`;
  spinner.color = "yellow";
  try {
    const branchName = `${issue.id}/${issue.branchDescription}`;
    execSync(`git checkout -b ${branchName}`);
    spinner.text = `Successfully created branch ${branchName} \n`;
    spinner.succeed();
    console.log(`Press Ctrl+C to exit`);
  } catch (e) {
    spinner.text = "Failed to create branch!\n";
    spinner.fail();
  }
};

printPreamble();
if (init) {
  const spinner = ora("Initializing...\n").start();
  initialize(spinner)
    .then((issuesList) => {
      if (issuesList) {
        issuesList.forEach((issue) => {
          pullPrimaryBranch(spinner);
          createBranch(issue, spinner);
        });
      }
    })
    .catch((e) => {
      spinner.text = `Failed: ${e.message}\n`;
      spinner.fail();
    });
}
