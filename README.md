<p align="center">
    <img src="doc/asciiart.png" alt="ascii art"/>
</p>

A CLI tool to create branch for your in-progress JIRA ticket, without leaving your terminal.

## Installation
1. ```touch gjb-config.json```
2. Add `gjb-config.json` to the .gitignore list.
3. Add the following values to your `gjb-config.json` file.

```json
{
    "baseUrl": "<your orgs JIRA url>"
    "mail": "<your email id associated with JIRA>"
    "token": "<your JIRA API token>"
    "primaryBranch": "<you git repo's primary branch name>"
}
```

## Usage
TBD