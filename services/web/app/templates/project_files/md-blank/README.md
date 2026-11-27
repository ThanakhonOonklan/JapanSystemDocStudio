# How to use this project

This file explains how to start writing the manual. It is not put into the PDF. Delete it when you no longer need it.

## Where to start

1. Open `book.yaml` and replace the example text on the cover: system name (`title`), document name (`subtitle`), version and date (`description`) and the author (`preparedBy`).
2. Open `en/01-example.md` and replace the example text with real content.
3. Click **Recompile** to see the PDF on the right.

## What each file is

```text
book.yaml              Book settings: cover, contents, order of the files (start here)
style.css              Look of the book: cover frame, headings, tables, pictures, page numbers
README.md              This file (how to use the project)
en/01-example.md       The example page
images/logo.png        Logo on the cover. Upload a file with the same name to replace it.
images/screenshot.svg  An empty picture frame, used until you have a real screenshot
```

## Add a new page

1. Create a new file in `en/`, for example `02-page-name.md`.
2. Add its file name under `chapters:` in `book.yaml`, in the order you want.
3. Each file starts on a new page in the PDF.

## Write the content

| You want | Write |
|---|---|
| Page title (centred) | `# Page title` |
| Heading (numbered 1. 2. 3. automatically) | `## Heading` |
| A label at the end of a heading | Add `{.t-main}` (Main step), `{.t-view}` (Check), `{.t-branch}` (When needed) or `{.t-setting}` (Settings) |
| Bold | `**text**` |
| Picture | `![Caption under the picture](../images/file-name.png)` |
| Smaller picture | `![Caption](../images/file-name.png){width=60%}` |
| Numbered steps | `1. First step`, then a new line `2. Next step` |
| Table | See `en/01-example.md`; the first row of the table is the header row |
| New page | A line with only `\newpage`, with a blank line before and after |

## Add screenshots

1. Click Upload in the file panel on the left and choose the `images/` folder.
2. Change the file name in the picture line, for example `../images/screenshot.svg` to `../images/screen-1.png`.

## Write in more than one language

The book is in English only. To add a second language, create a folder named with its language code (for example `th/`), put a file with the same name as each chapter in it, and list both languages in `book.yaml`, for example `languages: [en, th]`.
