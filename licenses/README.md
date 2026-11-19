# Third-party licences

## Agent skills

The agent skills in `.claude/skills/` and `.agents/skills/` are third-party files, vendored
unedited. Their licence texts are kept here, because those folders are installed by tools.

<!-- prettier-ignore -->
| Skill | Source | Licence | What is here |
|---|---|---|---|
| `angular-developer` | [angular/skills](https://github.com/angular/skills) | MIT | The standard MIT text with the copyright line from the skill's own metadata. The source repository ships no licence file. |
| `impeccable` 4.9.1 | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache 2.0 | `LICENSE` and `NOTICE.md` from the tag `skill-v4.9.1`. The notice names [ehmo/platform-design-skills](https://github.com/ehmo/platform-design-skills) (MIT), from which two reference files derive; its licence is `platform-design-skills.LICENSE`. |
| `playwright-cli` | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) | Apache 2.0 | `LICENSE` from the package `@playwright/cli` 0.1.24. It ships no notice file. |

## Application

Copied into the application's source rather than installed as a package, so their licence texts
are kept here.

<!-- prettier-ignore -->
| Work | Source | Licence | What is here |
|---|---|---|---|
| spartan/ui components | [spartan-ng/spartan](https://github.com/spartan-ng/spartan) | MIT | `spartan/LICENSE` from the tag `v1.9.0`. The accordion, the navigation menu, the sheet and their helpers are copied from that tag into `src/ui/`, with the changes the design needed. |

## Design mock-up

The mock-up in `design/` contains third-party files and copies. Their licence texts are kept
here. The hero photographs it shows are the demo's content, below.

<!-- prettier-ignore -->
| Work | Source | Licence | What is here |
|---|---|---|---|
| Lucide icons | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | ISC, and MIT for the icons derived from Feather | `lucide/LICENSE` from the branch `main`, with both copyright lines. Nine icons are copied into `design/home.html`; the application takes the same set from the package `@ng-icons/lucide`. |
| Jost | [indestructible-type/Jost](https://github.com/indestructible-type/Jost) | SIL Open Font License 1.1 | `jost/OFL.txt` from the branch `master`, with its copyright line. The font file is `design/fonts/jost-latin-wght-normal.woff2`. |

## The demo's content

The two hero photographs in `content/demo/pictures/` are from Wikimedia Commons, scaled down to
2000 px width and saved as WebP. They are not covered by this repository's licence. Each is credited with its
author, source and licence in `content/demo/site.json`, which the site shows on its picture
credits page.

<!-- prettier-ignore -->
| File | Title on Commons | Author | Licence |
|---|---|---|---|
| `hero-winter.webp` | [Saalbach (8450786397).jpg](<https://commons.wikimedia.org/wiki/File:Saalbach_(8450786397).jpg>) | Ian Gratton | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| `hero-summer.webp` | [Saalbach, 2014 (02).JPG](<https://commons.wikimedia.org/wiki/File:Saalbach,_2014_(02).JPG>) | Bahnfrend | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |

## Generated apartment pictures

The 14 pictures `zirbe-1.webp` to `ahorn-6.webp` in `content/demo/pictures/` show the demo's invented apartments. They are
AI-generated with OpenAI's image generation, directed through Codex, from the prompts in
`design/apartment-pictures.md`; no photographs went in. They are supplied under this
repository's licence to the extent that copyright or other rights exist in them. OpenAI's
[Europe Terms of Use](https://openai.com/policies/eu-terms-of-use/) assign its rights in the
output, if any, to the user; similar output may be generated for others. Its
[sharing and publication policy](https://openai.com/policies/sharing-publication-policy/) asks
for a review before sharing and an AI disclosure no viewer could miss, so a site that shows
them labels each as generated. Both were checked on 17 November 2026; each apartment's note in
`design/generated/` has the details.
