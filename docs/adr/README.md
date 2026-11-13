# Decisions

Every decision that shapes the project, with the options that were weighed. The ADRs are
numbered in the order they were written and grouped here by what they are about. A new ADR
gets its line in this index in the same pull request.

## Product

What is built, for whom, and where its boundaries are.

<!-- prettier-ignore -->
| ADR | Decision | Status |
|---|---|---|
| [1](0001-beds24-and-an-own-website.md) | Beds24 holds the bookings, an own website shows them | Accepted |

## Stack

The technology the site is built with and runs on.

<!-- prettier-ignore -->
| ADR | Decision | Status |
|---|---|---|
| [4](0004-the-stack.md) | The stack: Angular with server rendering, keyed text files, spartan/ui and Tailwind | Accepted |
| [5](0005-the-simulator.md) | The simulator: TypeScript run by Node, a computed calendar, the business as one JSON file | Accepted |
| [6](0006-beds24-data-in-a-page.md) | Beds24 data reaches a page through a resolver whose source exists on the server only | Accepted |
| [7](0007-hosting-and-delivery.md) | Hosting and delivery: CI builds the images and pushes the demo over SSH; a tag names a release | Accepted, one condition |

## Process

How the project is developed, reviewed and released.

<!-- prettier-ignore -->
| ADR | Decision | Status |
|---|---|---|
| [2](0002-reviewer-agent.md) | The reviewer agent is a local command | Accepted |
| [3](0003-agent-identities.md) | Each agent has its own identity on GitHub | Accepted |
