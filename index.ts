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

class ApllicationError extends Error {
  displayMessage: string;
  constructor(thrownError: Error | null, displayMessage: string) {
    super(thrownError?.message || "An error occurred");
    this.name = "ApplicationError";
    this.stack = thrownError?.stack;
    this.displayMessage = displayMessage;
  }
}

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

const fetchTickets = (): Promise<{ issues: Ticket[] }> => {
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
    .catch((error:unknown) => {
      const errorToThrow = error instanceof Error ? error : null;
      throw new ApllicationError(errorToThrow, "Failed to fetch tickets");
    });
};

const initialize = async () => {
  const data = await fetchTickets();
  if (data) {
    const issues = data.issues ?? [];
    if (issues.length > 1) {
      throw new ApllicationError(null, "Multiple in-progress tickets found!");
    }
    if (issues.length === 0) {
      throw new ApllicationError(null, "No in-progress tickets found!");
    }
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

const pullPrimaryBranch = () => {
  try {
    execSync(`git checkout ${primaryBranch} && git pull`);
    return primaryBranch as string;
  } catch (error) {
    let errorToThrow = error instanceof Error ? error : null;
    throw new ApllicationError(errorToThrow, "Failed to checkout to primary branch!");
  }
};

const createBranch = (issue: FormattedTicket) => {
  try {
    const branchName = `${issue.id}/${issue.branchDescription}`;
    execSync(`git checkout -b ${branchName}`);
    return branchName;
  } catch (error) {
    let errorToThrow = error instanceof Error ? error : null;
    throw new ApllicationError(errorToThrow, "Failed to create branch!");
  }
};

const executeInitFlowWithSpinnerDisplays = async() => {
  const spinner = ora("Initializing...\n").start();
  try{
    spinner.text = "Fetching your in-progress tickets...\n";
    spinner.color = "yellow";
    const issuesList = await initialize();
    spinner.text = "Successfully fetched your in-progress tickets!\n";
    spinner.succeed();
    if (issuesList) {
      issuesList.forEach((issue) => {
        spinner.text = "Checking out and pulling primary branch...\n";
        spinner.color = "yellow";
        const primaryBranch = pullPrimaryBranch();
        spinner.text = `Successfully checked out to and pulled latest from ${primaryBranch} \n`;
        spinner.succeed();
        spinner.text = `Creating branch for ticket ${issue.id}...\n`;
        spinner.color = "yellow";
        const branchName = createBranch(issue);
        spinner.text = `Successfully created branch ${branchName} \n`;
        spinner.succeed();
        console.log(`Press Ctrl+C to exit`);
      });
    }
  } catch (error) {
    let thrownError = error as ApllicationError;
    spinner.text = `${thrownError?.displayMessage || thrownError?.message || "Something went wrong."}\n`;
    spinner.fail();
  }
}

printPreamble();
if (init) {
  executeInitFlowWithSpinnerDisplays();  
}
